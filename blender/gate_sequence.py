"""
Asia Khan - Scroll-Sequenz "Das Tor oeffnet sich" (60 Frames).

Rot lackiertes chinesisches Doppeltor mit goldenen Tornaegeln, Tuerklopfer-
Ringen, Goldleisten und zwei Laternen. Ueber 60 Frames schwingen die Fluegel
nach innen auf, die Kamera faehrt durch die Oeffnung in warmes goldenes Licht.

Nutzung:
  * Blender: Scripting-Tab -> Datei oeffnen -> "Run Script"
  * Headless: pip install bpy==5.2.3 ; python gate_sequence.py
Danach (System-Python mit Pillow) werden die PNGs nach WebP konvertiert -
siehe README.md bzw. convert_webp() unten (laeuft automatisch, wenn Pillow
im Blender-Python verfuegbar ist, sonst per Kommandozeile).
"""
import math
import os
import shutil
import subprocess
import sys
import warnings

warnings.filterwarnings("ignore", category=DeprecationWarning)

import bpy
import bmesh

# --------------------------------------------------------------------------
# Ausgabe / Einstellungen
# --------------------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
RENDER_DIR = os.path.abspath(os.path.join(HERE, "..", "renders"))
FRAME_DIR = os.environ.get("AK_FRAME_DIR", "/tmp/asiakhan_gate_frames")   # PNG-Zwischenframes
OUT_DIR = os.path.join(RENDER_DIR, "gate")                                # frame-000.webp ...
OUT_POSTER = os.path.join(RENDER_DIR, "gate-poster.jpg")

RES_X, RES_Y = 1280, 720
N_FRAMES = 60
SAMPLES = 12
WEBP_QUALITY = 68
RENDER = True

_PCT = int(os.environ.get("AK_PCT", "100"))
SAMPLES = int(os.environ.get("AK_SAMPLES", SAMPLES))
_FRAMES = os.environ.get("AK_FRAMES")            # z.B. "0,30,59" fuer Tests


# --------------------------------------------------------------------------
# Grundlagen
# --------------------------------------------------------------------------
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        import addon_utils
        addon_utils.enable("cycles", default_set=True)
    except Exception:
        pass
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    return sc


def setup_render(sc):
    sc.render.resolution_x = RES_X
    sc.render.resolution_y = RES_Y
    sc.render.resolution_percentage = _PCT
    sc.frame_start = 0
    sc.frame_end = N_FRAMES - 1
    c = sc.cycles
    c.samples = SAMPLES
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.03
    c.use_denoising = True
    c.denoiser = "OPENIMAGEDENOISE"
    c.denoising_prefilter = "FAST"
    c.denoising_quality = "HIGH"
    c.max_bounces = 4
    c.diffuse_bounces = 2
    c.glossy_bounces = 2
    c.transmission_bounces = 1
    c.volume_bounces = 0
    c.transparent_max_bounces = 4
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.sample_clamp_indirect = 3.0
    c.use_animated_seed = True
    sc.render.use_persistent_data = True
    # Standard statt AgX: AgX entsaettigt helles Gold zu Creme; mit Standard
    # bleibt das Licht am Ende satt golden (Kanaele clippen Richtung Gelb).
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.render.image_settings.color_depth = "8"


def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    return m, nt, out


def math_node(nt, op, a=None, b=None, clamp=False):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    n.use_clamp = clamp
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def map_range(nt, val, fmin, fmax, tmin=0.0, tmax=1.0, interp="LINEAR"):
    n = nt.nodes.new("ShaderNodeMapRange")
    n.interpolation_type = interp
    n.clamp = True
    nt.links.new(val, n.inputs["Value"])
    n.inputs["From Min"].default_value = fmin
    n.inputs["From Max"].default_value = fmax
    n.inputs["To Min"].default_value = tmin
    n.inputs["To Max"].default_value = tmax
    return n.outputs["Result"]


def principled(name, base, rough=0.5, metal=0.0, coat=0.0, coat_rough=0.05, emit=None, emit_str=0.0,
               bump_scale=None, bump_strength=0.05, rough_noise=0.0):
    m, nt, out = new_mat(name)
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = base
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = coat_rough
    if emit:
        p.inputs["Emission Color"].default_value = emit
        p.inputs["Emission Strength"].default_value = emit_str
    if bump_scale or rough_noise:
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = bump_scale or 20.0
        nz.inputs["Detail"].default_value = 6.0
        if bump_scale:
            bp = nt.nodes.new("ShaderNodeBump")
            bp.inputs["Strength"].default_value = bump_strength
            nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
            nt.links.new(bp.outputs["Normal"], p.inputs["Normal"])
        if rough_noise:
            nt.links.new(map_range(nt, nz.outputs["Fac"], 0.3, 0.7, rough - rough_noise, rough + rough_noise),
                         p.inputs["Roughness"])
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    return m


def emission_mat(name, color, strength):
    m, nt, out = new_mat(name)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = color
    em.inputs["Strength"].default_value = strength
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m


def box(name, coll, size, loc, mat, bevel=0.0, parent=None, segments=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)   # size = halbe Kantenlaengen
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    o.location = loc
    if parent:
        o.parent = parent
    me.materials.append(mat)
    if bevel > 0:
        mod = o.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
    return o


def mesh_from(name, verts, faces, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    for p in me.polygons:
        p.use_smooth = smooth
    return me


def revolve(name, profile, nu, radial_fn=None, axis="Z"):
    verts, faces = [], []
    rings = len(profile)
    for j, (r, z) in enumerate(profile):
        for i in range(nu):
            u = i / nu
            th = 2 * math.pi * u
            k = radial_fn(u, j) if radial_fn else 1.0
            x, y = r * k * math.cos(th), r * k * math.sin(th)
            verts.append((x, y, z) if axis == "Z" else (x, z, y))
    for j in range(rings - 1):
        for i in range(nu):
            a = j * nu + i
            b = j * nu + (i + 1) % nu
            faces.append((a, b, b + nu, a + nu) if axis == "Z" else (a, a + nu, b + nu, b))
    return mesh_from(name, verts, faces)


def obj(name, me, coll, loc=(0, 0, 0), rot=(0, 0, 0), parent=None, mat=None):
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    if parent:
        o.parent = parent
    if mat and not me.materials:
        me.materials.append(mat)
    return o


# --------------------------------------------------------------------------
# Laterne (gleicher Aufbau wie im Hero-Loop)
# --------------------------------------------------------------------------
L_R, L_H, L_RCAP, L_NSEG = 0.32, 0.24, 0.12, 18


def lantern_meshes():
    k = math.sqrt(1 - (L_RCAP / L_R) ** 2)
    prof = []
    for j in range(45):
        t = -1 + 2 * j / 44
        prof.append((L_R * math.sqrt(max(0.0, 1 - (k * t) ** 2)), L_H * t))

    def rib(u, j):
        f = (u * L_NSEG) % 1.0
        return 1 - 0.05 * (1 - abs(math.sin(math.pi * f)) ** 0.55)

    body = revolve("LanternBody", prof, L_NSEG * 10, rib)
    rc = L_RCAP * 1.12
    top = [(rc * 0.90, L_H - 0.012), (rc, L_H - 0.006), (rc * 1.06, L_H + 0.004), (rc * 1.06, L_H + 0.022),
           (rc * 0.96, L_H + 0.030), (rc * 0.98, L_H + 0.040), (rc * 0.90, L_H + 0.050),
           (rc * 0.55, L_H + 0.060), (rc * 0.30, L_H + 0.072), (rc * 0.18, L_H + 0.088), (0.0001, L_H + 0.092)]
    bot = [(0.0001, -L_H - 0.070), (rc * 0.22, -L_H - 0.066), (rc * 0.40, -L_H - 0.058), (rc * 0.62, -L_H - 0.050),
           (rc * 0.90, -L_H - 0.044), (rc * 0.98, -L_H - 0.036), (rc * 0.96, -L_H - 0.028),
           (rc * 1.06, -L_H - 0.022), (rc * 1.06, -L_H - 0.004), (rc, -L_H + 0.006), (rc * 0.90, -L_H + 0.012)]
    knot = [(max(0.0001, 0.026 * math.sin(math.pi * j / 12)),
             -L_H - 0.074 - 0.026 * (1 - math.cos(math.pi * j / 12))) for j in range(13)]
    gold = [revolve("GoldTop", top, 48), revolve("GoldBot", bot, 48), revolve("GoldKnot", knot, 24)]
    tprof = []
    for j in range(27):
        t = j / 26
        tprof.append((0.020 + 0.030 * (t ** 0.8), -L_H - 0.125 - t * 0.30))
    tprof.append((0.0001, -L_H - 0.125 - 0.304))
    tprof = list(reversed(tprof))
    tassel = revolve("Tassel", tprof, 144, lambda u, j: 1 + 0.10 * math.sin(2 * math.pi * u * 36))
    band = revolve("TasselBand", [(0.024, -L_H - 0.175), (0.027, -L_H - 0.170), (0.027, -L_H - 0.145),
                                  (0.024, -L_H - 0.140)], 32)
    return body, gold + [band], tassel


def mat_lantern_body(strength=1.6):
    """Glimmende Seide; fuer Schattenstrahlen transparent, damit das Punktlicht
    im Inneren die Umgebung beleuchten kann."""
    m, nt, out = new_mat("LanternSilk")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    ang = math_node(nt, "ARCTAN2", sep.outputs["Y"], sep.outputs["X"])
    seg = math_node(nt, "MULTIPLY", math_node(nt, "ADD", math_node(nt, "DIVIDE", ang, 2 * math.pi), 0.5), L_NSEG)
    fr = math_node(nt, "FRACT", seg)
    d = math_node(nt, "MINIMUM", fr, math_node(nt, "SUBTRACT", 1.0, fr))
    rib_k = map_range(nt, map_range(nt, d, 0.0, 0.09, 0.0, 1.0, "SMOOTHSTEP"), 0.0, 1.0, 0.30, 1.0)
    v = math_node(nt, "DIVIDE", sep.outputs["Z"], L_H)
    v2 = math_node(nt, "MULTIPLY", v, v)
    vert_k = map_range(nt, v2, 0.0, 1.0, 1.0, 0.25)
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.45
    fac = math_node(nt, "ADD", lw.outputs["Facing"], math_node(nt, "MULTIPLY", v2, 0.35))
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].color = (1.0, 0.40, 0.09, 1)
    cr.elements[1].position = 0.40
    cr.elements[1].color = (0.78, 0.055, 0.014, 1)
    e = cr.elements.new(0.80)
    e.color = (0.30, 0.008, 0.004, 1)
    e = cr.elements.new(1.0)
    e.color = (0.12, 0.002, 0.001, 1)
    nt.links.new(fac, ramp.inputs[0])
    s = math_node(nt, "MULTIPLY", math_node(nt, "MULTIPLY", rib_k, vert_k), strength)
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(ramp.outputs[0], em.inputs["Color"])
    nt.links.new(s, em.inputs["Strength"])
    lp = nt.nodes.new("ShaderNodeLightPath")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Shadow Ray"], mix.inputs[0])
    nt.links.new(em.outputs[0], mix.inputs[1])
    nt.links.new(tr.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return m


def spawn_lantern(coll, name, loc, mats, meshes, chain_len=0.6):
    body, gold, tassel = meshes
    root = bpy.data.objects.new(name, None)
    coll.objects.link(root)
    root.location = loc
    o = obj(name + "_body", body, coll, parent=root)
    o.visible_shadow = False
    for g in gold:
        obj(name + "_" + g.name, g, coll, parent=root)
    obj(name + "_tassel", tassel, coll, parent=root)
    # Aufhaengung (Kordel)
    cord = bpy.data.meshes.new(name + "_cord")
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.013, radius2=0.013, depth=chain_len)
    bm.to_mesh(cord)
    bm.free()
    c = obj(name + "_cord", cord, coll, loc=(0, 0, L_H + 0.09 + chain_len / 2), parent=root)
    cord.materials.append(mats["gold"])
    # Licht im Inneren
    ld = bpy.data.lights.new(name + "_light", "POINT")
    ld.energy = 90
    ld.color = (1.0, 0.42, 0.16)
    ld.shadow_soft_size = 0.18
    lo = bpy.data.objects.new(name + "_light", ld)
    coll.objects.link(lo)
    lo.parent = root
    return root


# --------------------------------------------------------------------------
# Szene
# --------------------------------------------------------------------------
DOOR_W = 1.6          # Breite je Fluegel
DOOR_H = 3.70
DOOR_T = 0.12
SILL_H = 0.24         # Tuerschwelle
OPEN_W = 2 * DOOR_W   # lichte Breite


def build_materials():
    M = {}
    M["lacquer"] = principled("RedLacquer", (0.30, 0.016, 0.014, 1), rough=0.26, coat=0.7, coat_rough=0.12,
                              rough_noise=0.08, bump_scale=None)
    M["lacquer_dark"] = principled("RedLacquerDark", (0.16, 0.010, 0.010, 1), rough=0.35, coat=0.5)
    M["gold"] = principled("Gold", (1.0, 0.66, 0.28, 1), rough=0.24, metal=1.0, rough_noise=0.06)
    M["gold_rough"] = principled("GoldSatin", (0.9, 0.58, 0.24, 1), rough=0.38, metal=1.0)
    M["wall"] = principled("Wall", (0.050, 0.012, 0.010, 1), rough=0.85, bump_scale=8.0, bump_strength=0.12)
    M["stone"] = None
    M["roof"] = principled("RoofTile", (0.018, 0.016, 0.016, 1), rough=0.45)
    M["inner"] = emission_mat("InnerGlow", (1.0, 0.70, 0.34, 1), 9.0)
    M["tassel"] = principled("TasselRed", (0.5, 0.03, 0.02, 1), rough=0.6, emit=(0.9, 0.08, 0.03, 1), emit_str=0.2)
    M["silk"] = mat_lantern_body()
    # Steinboden mit Plattenfugen
    m, nt, out = new_mat("StoneFloor")
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    br = nt.nodes.new("ShaderNodeTexBrick")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(tc.outputs["Object"], br.inputs["Vector"])
    br.inputs["Color1"].default_value = (0.040, 0.030, 0.026, 1)
    br.inputs["Color2"].default_value = (0.028, 0.022, 0.020, 1)
    br.inputs["Mortar"].default_value = (0.008, 0.006, 0.006, 1)
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Mortar Size"].default_value = 0.012
    br.inputs["Brick Width"].default_value = 1.2
    br.inputs["Row Height"].default_value = 0.6
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 6.0
    nz.inputs["Detail"].default_value = 8.0
    mixc = nt.nodes.new("ShaderNodeMix")
    mixc.data_type = "RGBA"
    mixc.blend_type = "MULTIPLY"
    mixc.inputs[0].default_value = 0.5
    nt.links.new(br.outputs["Color"], mixc.inputs[6])
    nt.links.new(nz.outputs["Color"], mixc.inputs[7])
    nt.links.new(mixc.outputs[2], p.inputs["Base Color"])
    nt.links.new(map_range(nt, nz.outputs["Fac"], 0.35, 0.65, 0.18, 0.5), p.inputs["Roughness"])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.25
    nt.links.new(br.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], p.inputs["Normal"])
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    M["stone"] = m
    # Innenhof-Boden: geht mit der Entfernung in goldenen Lichtdunst ueber (kein harter Horizont)
    m2 = m.copy()
    m2.name = "FloorInGlow"
    nt2 = m2.node_tree
    out2 = [n for n in nt2.nodes if n.bl_idname == "ShaderNodeOutputMaterial"][0]
    bsdf = [n for n in nt2.nodes if n.bl_idname == "ShaderNodeBsdfPrincipled"][0]
    geo = nt2.nodes.new("ShaderNodeNewGeometry")
    sp = nt2.nodes.new("ShaderNodeSeparateXYZ")
    nt2.links.new(geo.outputs["Position"], sp.inputs[0])
    fog = map_range(nt2, sp.outputs["Y"], 1.0, 7.4, 0.0, 1.0, "SMOOTHSTEP")
    em = nt2.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (0.85, 0.36, 0.07, 1)
    em.inputs["Strength"].default_value = 0.55
    mx = nt2.nodes.new("ShaderNodeMixShader")
    nt2.links.new(fog, mx.inputs[0])
    nt2.links.new(bsdf.outputs[0], mx.inputs[1])
    nt2.links.new(em.outputs[0], mx.inputs[2])
    nt2.links.new(mx.outputs[0], out2.inputs["Surface"])
    M["floor_in"] = m2
    return M


def build_door_leaf(coll, M, side):
    """side = -1 (links, Scharnier bei x=-1.6) / +1 (rechts)."""
    hinge_x = side * DOOR_W
    piv = bpy.data.objects.new(f"DoorPivot_{'L' if side < 0 else 'R'}", None)
    coll.objects.link(piv)
    piv.location = (hinge_x, 0.0, SILL_H)
    # lokale Koordinaten: Fluegel reicht von x=0 (Scharnier) Richtung Mitte
    dirx = -side
    cx = dirx * (DOOR_W / 2 - 0.004)
    box(f"Leaf_{side}", coll, (DOOR_W / 2 - 0.006, DOOR_T / 2, DOOR_H / 2), (cx, 0.0, DOOR_H / 2),
        M["lacquer"], bevel=0.012, parent=piv)
    front = -DOOR_T / 2
    # Gold-Rahmenleisten (vorn)
    fw = 0.05
    for (sx, sz, lx, lz) in (
        (DOOR_W / 2 - 0.03, fw / 2, cx, 0.10), (DOOR_W / 2 - 0.03, fw / 2, cx, DOOR_H - 0.10),
        (fw / 2, DOOR_H / 2 - 0.12, dirx * 0.10, DOOR_H / 2), (fw / 2, DOOR_H / 2 - 0.12, dirx * (DOOR_W - 0.10), DOOR_H / 2),
    ):
        box("Trim", coll, (sx, 0.012, sz), (lx, front - 0.010, lz), M["gold_rough"], bevel=0.008, parent=piv)
    # Querriegel-Paneel unten (dunkler)
    box("Panel", coll, (DOOR_W / 2 - 0.17, 0.010, 0.30), (cx, front - 0.008, 0.48), M["lacquer_dark"],
        bevel=0.01, parent=piv)
    box("PanelTrim", coll, (DOOR_W / 2 - 0.15, 0.006, 0.012), (cx, front - 0.016, 0.80), M["gold_rough"],
        parent=piv)
    # Tornaegel: Halbkugeln, 7 Reihen x 5 Spalten
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=10, radius=0.042)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > 0.004], context="VERTS")
    stud_me = bpy.data.meshes.new("Stud")
    bm.to_mesh(stud_me)
    bm.free()
    for p in stud_me.polygons:
        p.use_smooth = True
    stud_me.materials.append(M["gold"])
    cols, rows = 5, 7
    for r in range(rows):
        z = 1.05 + r * (DOOR_H - 1.35) / (rows - 1)
        for c in range(cols):
            x = dirx * (0.26 + c * (DOOR_W - 0.52) / (cols - 1))
            obj("Stud", stud_me, coll, loc=(x, front - 0.002, z), parent=piv)
    # Tuerklopfer (Pushou): Platte + Ring
    kx = dirx * (DOOR_W - 0.30)
    kz = 1.55
    plate = revolve("KnockPlate", [(0.0001, -0.035), (0.10, -0.030), (0.13, -0.024), (0.145, -0.014),
                                   (0.15, 0.0), (0.0001, 0.0)][::-1], 48, axis="Y")
    obj("KnockPlate", plate, coll, loc=(kx, front, kz), parent=piv, mat=M["gold"])
    boss = revolve("KnockBoss", [(0.0001, -0.075), (0.03, -0.072), (0.05, -0.060), (0.06, -0.040),
                                 (0.062, -0.025)][::-1], 32, axis="Y")
    obj("KnockBoss", boss, coll, loc=(kx, front, kz), parent=piv, mat=M["gold"])
    bm = bmesh.new()
    ring_me = bpy.data.meshes.new("KnockRing")
    R, rr, nu, nv = 0.13, 0.014, 48, 12
    verts, faces = [], []
    for i in range(nu):
        a = 2 * math.pi * i / nu
        for j in range(nv):
            b = 2 * math.pi * j / nv
            verts.append(((R + rr * math.cos(b)) * math.cos(a), rr * math.sin(b), (R + rr * math.cos(b)) * math.sin(a)))
    for i in range(nu):
        for j in range(nv):
            faces.append((i * nv + j, i * nv + (j + 1) % nv, ((i + 1) % nu) * nv + (j + 1) % nv, ((i + 1) % nu) * nv + j))
    ring_me = mesh_from("KnockRing", verts, faces)
    ring_me.materials.append(M["gold"])
    ring = obj("KnockRing", ring_me, coll, loc=(kx, front - 0.08, kz - 0.10), rot=(math.radians(-12), 0, 0),
               parent=piv)
    bm.free()
    return piv


def build_scene():
    sc = reset_scene()
    setup_render(sc)
    coll = sc.collection
    M = build_materials()

    # Welt: tiefe Nacht
    w = bpy.data.worlds.new("Night")
    sc.world = w
    w.use_nodes = True
    bg = [n for n in w.node_tree.nodes if n.bl_idname == "ShaderNodeBackground"][0]
    bg.inputs["Color"].default_value = (0.010, 0.0035, 0.004, 1)
    bg.inputs["Strength"].default_value = 1.0

    # Boden aussen + innen
    box("FloorOut", coll, (14, 10, 0.1), (0, -9.4, -0.1), M["stone"])
    box("Step", coll, (3.2, 0.7, 0.06), (0, -1.1, 0.06), M["stone"], bevel=0.02)
    box("FloorIn", coll, (14, 10, 0.1), (0, 10.6, -0.1), M["floor_in"])
    # Schwelle
    box("Sill", coll, (OPEN_W / 2 + 0.05, 0.16, SILL_H / 2), (0, 0.02, SILL_H / 2), M["lacquer_dark"], bevel=0.015)
    box("SillGold", coll, (OPEN_W / 2 + 0.05, 0.005, 0.015), (0, -0.142, SILL_H - 0.05), M["gold_rough"])

    # Wand mit Oeffnung (Dicke 0.6, Vorderkante y=0.1)
    WT = 0.6
    top = DOOR_H + SILL_H
    wi = OPEN_W / 2 + 0.16                      # Innenkante der Wand
    box("WallL", coll, (5.0, WT / 2, 4.5), (-wi - 5.0, WT / 2 + 0.1, 4.5), M["wall"])
    box("WallR", coll, (5.0, WT / 2, 4.5), (wi + 5.0, WT / 2 + 0.1, 4.5), M["wall"])
    box("WallTop", coll, (wi + 0.1, WT / 2, 2.5), (0, WT / 2 + 0.1, top + 0.14 + 2.5), M["wall"])
    # Steinsockel der Wand
    box("PlinthL", coll, (5.0, WT / 2 + 0.04, 0.35), (-wi - 5.0 - 0.02, WT / 2 + 0.06, 0.35), M["stone"],
        bevel=0.02)
    box("PlinthR", coll, (5.0, WT / 2 + 0.04, 0.35), (wi + 5.0 + 0.02, WT / 2 + 0.06, 0.35), M["stone"],
        bevel=0.02)
    # Laibung (Torrahmen), rot
    for s in (-1, 1):
        box(f"Jamb{s}", coll, (0.08, WT / 2 + 0.04, (top + 0.1) / 2), (s * (OPEN_W / 2 + 0.08), WT / 2 + 0.06,
                                                                        (top + 0.1) / 2), M["lacquer"], bevel=0.01)
        box(f"JambGold{s}", coll, (0.012, 0.01, top / 2), (s * (OPEN_W / 2 + 0.15), -0.03, top / 2 + 0.05),
            M["gold_rough"])
    box("Header", coll, (OPEN_W / 2 + 0.16, WT / 2 + 0.04, 0.10), (0, WT / 2 + 0.06, top + 0.10), M["lacquer"],
        bevel=0.01)

    # Saeulen mit Steinbasis
    for s in (-1, 1):
        x = s * (OPEN_W / 2 + 0.50)
        col = bpy.data.meshes.new("Pillar")
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=40, radius1=0.20, radius2=0.19, depth=4.9)
        bm.to_mesh(col)
        bm.free()
        for p in col.polygons:
            p.use_smooth = True
        obj(f"Pillar{s}", col, coll, loc=(x, -0.22, 2.45 + 0.30), mat=M["lacquer"])
        base = revolve("PillarBase", [(0.0001, 0.0), (0.33, 0.0), (0.34, 0.06), (0.31, 0.16), (0.25, 0.26),
                                      (0.21, 0.30), (0.0001, 0.30)], 40)
        obj(f"PillarBase{s}", base, coll, loc=(x, -0.22, 0.0), mat=M["stone"])
        for zz in (0.55, 4.75):
            ring = revolve("PillarRing", [(0.0001, -0.03), (0.215, -0.03), (0.225, 0.0), (0.215, 0.03),
                                          (0.0001, 0.03)], 40)
            obj(f"PillarRing{s}", ring, coll, loc=(x, -0.22, zz), mat=M["gold_rough"])

    # Querbalken (Architrav) mit Goldbaendern + Vordach
    bz = 5.15
    box("Beam", coll, (OPEN_W / 2 + 1.0, 0.24, 0.26), (0, -0.20, bz), M["lacquer"], bevel=0.02)
    for dz in (-0.18, 0.18):
        box("BeamGold", coll, (OPEN_W / 2 + 1.0, 0.245, 0.018), (0, -0.20, bz + dz * 0.72), M["gold_rough"])
    box("BeamUpper", coll, (OPEN_W / 2 + 1.2, 0.30, 0.16), (0, -0.25, bz + 0.40), M["lacquer_dark"], bevel=0.02)
    # Goldenes Schmuckband mit Rauten (vereinfachte Ornamentik)
    for i in range(-8, 9):
        d = box("BeamOrn", coll, (0.06, 0.01, 0.06), (i * 0.30, -0.448, bz), M["gold"], bevel=0.0)
        d.rotation_euler = (0, math.radians(45), 0)
    # Plakette ueber dem Tor
    box("Plaque", coll, (0.85, 0.05, 0.30), (0, -0.10, top + 0.55), M["lacquer_dark"], bevel=0.02)
    box("PlaqueFrame", coll, (0.92, 0.04, 0.36), (0, -0.07, top + 0.55), M["gold"], bevel=0.02)
    # Dach: geneigte Ziegelflaeche mit hochgezogenen Ecken
    roof_verts, roof_faces = [], []
    nx, ny = 40, 8
    W = OPEN_W / 2 + 2.2
    for j in range(ny + 1):
        v = j / ny
        for i in range(nx + 1):
            u = -1 + 2 * i / nx
            x = u * W
            y = -1.5 + v * 1.6
            z = bz + 0.62 + v * 0.9 + 0.35 * (abs(u) ** 4) * (1 - v) + 0.035 * math.sin(i * math.pi)
            roof_verts.append((x, y, z))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            roof_faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    roof = mesh_from("Roof", roof_verts, roof_faces)
    ro = obj("Roof", roof, coll, mat=M["roof"])
    mod = ro.modifiers.new("Solid", "SOLIDIFY")
    mod.thickness = 0.12
    box("Ridge", coll, (W, 0.14, 0.12), (0, 0.10, bz + 1.6), M["roof"], bevel=0.03)

    # Torfluegel
    left = build_door_leaf(coll, M, -1)
    right = build_door_leaf(coll, M, +1)

    # Innenhof: goldenes Licht
    inner = bpy.data.meshes.new("InnerWall")
    inner.from_pydata([(-12, 7.5, -1), (12, 7.5, -1), (12, 7.5, 12), (-12, 7.5, 12)], [], [(0, 1, 2, 3)])
    gw = obj("InnerGlow", inner, coll, mat=None)
    m, nt, out = new_mat("InnerGlowGrad")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    dx = math_node(nt, "ABSOLUTE", sep.outputs["X"])
    dz = math_node(nt, "ABSOLUTE", math_node(nt, "SUBTRACT", sep.outputs["Z"], 2.2))
    dist = math_node(nt, "SQRT", math_node(nt, "ADD", math_node(nt, "MULTIPLY", dx, dx),
                                           math_node(nt, "MULTIPLY", dz, dz)))
    k = map_range(nt, dist, 0.0, 9.0, 1.0, 0.25, "SMOOTHSTEP")
    em = nt.nodes.new("ShaderNodeEmission")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.62, 0.20, 0.03, 1)
    ramp.color_ramp.elements[1].color = (1.0, 0.52, 0.14, 1)
    nt.links.new(k, ramp.inputs[0])
    nt.links.new(ramp.outputs[0], em.inputs["Color"])
    nt.links.new(math_node(nt, "MULTIPLY", k, 0.95), em.inputs["Strength"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    inner.materials.append(m)
    # Lichtquelle direkt hinter dem Tor (dringt durch die Fugen, flutet beim Oeffnen)
    ld = bpy.data.lights.new("GateLight", "AREA")
    ld.shape = "RECTANGLE"
    ld.size = OPEN_W - 0.2
    ld.size_y = DOOR_H - 0.2
    ld.energy = 300
    ld.spread = math.radians(50)                       # gebuendelt: beleuchtet die offenen Fluegel kaum
    ld.color = (1.0, 0.70, 0.36)
    lo = bpy.data.objects.new("GateLight", ld)
    coll.objects.link(lo)
    lo.location = (0, 4.2, SILL_H + DOOR_H / 2)
    lo.rotation_euler = (math.radians(-90), 0, 0)      # strahlt Richtung -Y (zur Kamera)
    lo.visible_camera = False
    lo.visible_glossy = False      # sonst spiegelt der Klarlack der offenen Fluegel die Flaeche weiss
    # Gerichtete Streiflichter auf das Tor (warmes Randlicht)
    for s in (-1, 1):
        sd = bpy.data.lights.new(f"Graze{s}", "SPOT")
        sd.energy = 1400
        sd.spot_size = math.radians(38)
        sd.spot_blend = 0.6
        sd.shadow_soft_size = 0.25
        sd.color = (1.0, 0.55, 0.26)
        so = bpy.data.objects.new(f"Graze{s}", sd)
        coll.objects.link(so)
        so.location = (s * 4.2, -3.2, 6.2)
        tgt = (0.0, 0.0, 2.2)
        d = (tgt[0] - so.location.x, tgt[1] - so.location.y, tgt[2] - so.location.z)
        so.rotation_mode = "QUATERNION"
        import mathutils
        so.rotation_quaternion = mathutils.Vector(d).to_track_quat("-Z", "Y")
    # schwaches Fuelllicht von vorn
    fd = bpy.data.lights.new("Fill", "AREA")
    fd.size = 6
    fd.energy = 140
    fd.color = (1.0, 0.45, 0.30)
    fo = bpy.data.objects.new("Fill", fd)
    coll.objects.link(fo)
    fo.location = (0, -8, 3.0)
    fo.rotation_euler = (math.radians(90), 0, 0)
    fo.visible_camera = False
    fo.visible_glossy = False

    # Laternen links/rechts am Balken
    meshes = lantern_meshes()
    body, gold, tassel = meshes
    body.materials.append(M["silk"])
    for g in gold:
        g.materials.append(M["gold"])
    tassel.materials.append(M["tassel"])
    for s in (-1, 1):
        spawn_lantern(coll, f"Lantern{s}", (s * (OPEN_W / 2 + 1.25), -0.95, 3.70), M, meshes, chain_len=1.75)
    # Kamera
    cd = bpy.data.cameras.new("Cam")
    cd.lens = 32
    cd.sensor_width = 36
    cd.clip_end = 100
    cd.dof.use_dof = True
    cd.dof.aperture_fstop = 5.6
    cam = bpy.data.objects.new("Cam", cd)
    coll.objects.link(cam)
    sc.camera = cam
    focus = bpy.data.objects.new("Focus", None)
    coll.objects.link(focus)
    cd.dof.focus_object = focus
    focus.location = (0, 0, 2.2)

    animate(sc, cam, left, right, focus)
    setup_compositor(sc)
    return sc


def smoothstep(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def smootherstep(x):
    x = min(1.0, max(0.0, x))
    return x * x * x * (x * (6 * x - 15) + 10)


def animate(sc, cam, left, right, focus):
    for f in range(N_FRAMES):
        t = f / (N_FRAMES - 1)
        # Tuer: Frame 2..38 von 0 auf 104 Grad
        a = math.radians(104) * smoothstep((f - 2) / 36.0)
        left.rotation_euler = (0, 0, a)
        right.rotation_euler = (0, 0, -a)
        left.keyframe_insert("rotation_euler", index=2, frame=f)
        right.keyframe_insert("rotation_euler", index=2, frame=f)
        # Kamera: Dolly von y=-9.6 bis y=+2.6 (durch das Tor), Blick senkt sich auf horizontal
        k = smoothstep(t * 0.92 + 0.08 * t * t)
        y = -9.6 + 12.2 * k
        z = 1.90 + 0.10 * k
        tilt = math.radians(95.0 - 5.0 * smoothstep(t * 1.15))
        cam.location = (0.0, y, z)
        cam.rotation_euler = (tilt, 0, 0)
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_euler", frame=f)
        focus.location = (0, max(0.0, y + 3.0), 2.2)
        focus.keyframe_insert("location", frame=f)
        # Belichtung: am Ende in goldenes Licht ueberblenden
        sc.view_settings.exposure = 0.35 * smoothstep((f - 44) / 15.0)
        sc.view_settings.keyframe_insert("exposure", frame=f)


def setup_compositor(sc):
    ng = bpy.data.node_groups.new("GateComp", "CompositorNodeTree")
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl = ng.nodes.new("CompositorNodeRLayers")
    beams = ng.nodes.new("CompositorNodeGlare")
    beams.inputs["Type"].default_value = "Sun Beams"
    beams.inputs["Quality"].default_value = "High"
    beams.inputs["Threshold"].default_value = 0.8
    beams.inputs["Size"].default_value = 0.40
    beams.inputs["Strength"].default_value = 0.0
    # Lichtstrahlen erst, wenn sich das Tor oeffnet
    for f, v in ((0, 0.0), (8, 0.0), (24, 0.15), (59, 0.15)):
        beams.inputs["Strength"].default_value = v
        beams.inputs["Strength"].keyframe_insert("default_value", frame=f)
    beams.inputs["Sun Position"].default_value = (0.5, 0.48)
    ng.links.new(rl.outputs["Image"], beams.inputs["Image"])
    glow = ng.nodes.new("CompositorNodeGlare")
    glow.inputs["Type"].default_value = "Fog Glow"
    glow.inputs["Quality"].default_value = "High"
    glow.inputs["Threshold"].default_value = 1.0
    glow.inputs["Size"].default_value = 0.8
    glow.inputs["Strength"].default_value = 0.5
    ng.links.new(beams.outputs["Image"], glow.inputs["Image"])
    out = ng.nodes.new("NodeGroupOutput")
    ng.links.new(glow.outputs["Image"], out.inputs[0])
    sc.compositing_node_group = ng
    sc.render.use_compositing = not os.environ.get("AK_NO_COMP")
    sc.render.compositor_device = "CPU"


def render_frames(sc, frames):
    import time
    os.makedirs(FRAME_DIR, exist_ok=True)
    for f in frames:
        t0 = time.time()
        sc.frame_set(f)
        sc.render.filepath = os.path.join(FRAME_DIR, f"gate_{f:03d}.png")
        bpy.ops.render.render(write_still=True)
        print(f"[gate] frame {f} {time.time() - t0:.1f}s", flush=True)


def convert_webp():
    """PNG -> WebP (q=68) + Poster-JPG. Benoetigt Pillow (z.B. System-Python)."""
    try:
        from PIL import Image
    except ImportError:
        print("[gate] Pillow fehlt - bitte separat konvertieren (siehe README)")
        return
    os.makedirs(OUT_DIR, exist_ok=True)
    for f in range(N_FRAMES):
        im = Image.open(os.path.join(FRAME_DIR, f"gate_{f:03d}.png")).convert("RGB")
        im.save(os.path.join(OUT_DIR, f"frame-{f:03d}.webp"), "WEBP", quality=WEBP_QUALITY, method=6)
        if f == 0:
            im.save(OUT_POSTER, "JPEG", quality=80, optimize=True, progressive=True)


if __name__ == "__main__":
    sc = build_scene()
    if RENDER:
        frames = [int(x) for x in _FRAMES.split(",")] if _FRAMES else list(range(N_FRAMES))
        render_frames(sc, frames)
        if not _FRAMES:
            convert_webp()
