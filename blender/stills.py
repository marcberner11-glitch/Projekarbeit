"""
Asia Khan - freigestellte Einzelbilder (RGBA, transparenter Hintergrund):
  * renders/lantern.png / .webp  - rote chinesische Laterne, 3/4-Ansicht, 600x900
  * renders/steamer.png / .webp  - Bambus-Dampfkorb mit Dumplings + Dampf, 900x700

Nutzung:
  * Blender: Scripting-Tab -> Datei oeffnen -> "Run Script"
  * Headless: pip install bpy==5.2.3 ; python stills.py      (AK_ONLY=lantern|steamer)
Die PNGs werden anschliessend mit Pillow optimiert / nach WebP konvertiert
(optimize_outputs(), laeuft automatisch, wenn Pillow importierbar ist).
"""
import math
import os
import random
import warnings

warnings.filterwarnings("ignore", category=DeprecationWarning)

import bpy
import bmesh
import mathutils

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
RENDER_DIR = os.environ.get("AK_RENDER_DIR", os.path.abspath(os.path.join(HERE, "..", "renders")))
TMP_DIR = os.environ.get("AK_FRAME_DIR", "/tmp/asiakhan_stills")
OUT_LANTERN = os.path.join(RENDER_DIR, "lantern")    # .png / .webp
OUT_STEAMER = os.path.join(RENDER_DIR, "steamer")    # .png / .webp

LANTERN_RES = (600, 900)
STEAMER_RES = (900, 700)
SAMPLES_LANTERN = int(os.environ.get("AK_SAMPLES", 64))
SAMPLES_STEAMER = int(os.environ.get("AK_SAMPLES", 40))
_PCT = int(os.environ.get("AK_PCT", "100"))
ONLY = os.environ.get("AK_ONLY", "")


# --------------------------------------------------------------------------
# Helfer
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


def setup_render(sc, res, samples):
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = _PCT
    c = sc.cycles
    c.samples = samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.01
    c.use_denoising = True
    c.denoiser = "OPENIMAGEDENOISE"
    c.denoising_prefilter = "ACCURATE"
    c.max_bounces = 8
    c.diffuse_bounces = 3
    c.glossy_bounces = 3
    c.transmission_bounces = 4
    c.volume_bounces = 1
    c.transparent_max_bounces = 8
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.volume_step_rate = 2.0
    sc.render.film_transparent = True
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "8"
    sc.render.use_compositing = False


def world(sc, color, strength=1.0):
    w = bpy.data.worlds.new("World")
    sc.world = w
    w.use_nodes = True
    bg = [n for n in w.node_tree.nodes if n.bl_idname == "ShaderNodeBackground"][0]
    bg.inputs["Color"].default_value = color
    bg.inputs["Strength"].default_value = strength


def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    return m, nt, out


def math_node(nt, op, a=None, b=None):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
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


def mesh_from(name, verts, faces, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    for p in me.polygons:
        p.use_smooth = smooth
    return me


def revolve(name, profile, nu, radial_fn=None, closed=False):
    verts, faces = [], []
    rings = len(profile)
    for j, (r, z) in enumerate(profile):
        for i in range(nu):
            u = i / nu
            th = 2 * math.pi * u
            k = radial_fn(u, j, z) if radial_fn else 1.0
            verts.append((r * k * math.cos(th), r * k * math.sin(th), z))
    last = rings if closed else rings - 1
    for j in range(last):
        j2 = (j + 1) % rings
        for i in range(nu):
            a = j * nu + i
            b = j * nu + (i + 1) % nu
            faces.append((a, b, j2 * nu + (i + 1) % nu, j2 * nu + i))
    return mesh_from(name, verts, faces)


def catmull(points, n_per=8):
    """Glatte Kurve durch Kontrollpunkte (r, z)."""
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for k in range(n_per):
            t = k / n_per
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2
                                    + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3) for d in range(2)))
    out.append(points[-1])
    return out


def link(coll, name, me, loc=(0, 0, 0), rot=(0, 0, 0), parent=None, mat=None):
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    if parent:
        o.parent = parent
    if mat is not None:
        me.materials.append(mat)
    return o


def area_light(coll, name, loc, target, energy, size, color, size_y=None):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.size = size
    if size_y:
        ld.shape = "RECTANGLE"
        ld.size_y = size_y
    ld.color = color
    o = bpy.data.objects.new(name, ld)
    coll.objects.link(o)
    o.location = loc
    d = mathutils.Vector(target) - mathutils.Vector(loc)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("-Z", "Y")
    return o


def camera(sc, coll, loc, target, lens, fstop=None, focus=None):
    cd = bpy.data.cameras.new("Cam")
    cd.lens = lens
    cd.sensor_fit = "AUTO"
    cd.sensor_width = 36
    cd.clip_start = 0.01
    if fstop:
        cd.dof.use_dof = True
        cd.dof.aperture_fstop = fstop
        cd.dof.focus_distance = focus or (mathutils.Vector(target) - mathutils.Vector(loc)).length
    cam = bpy.data.objects.new("Cam", cd)
    coll.objects.link(cam)
    cam.location = loc
    d = mathutils.Vector(target) - mathutils.Vector(loc)
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = d.to_track_quat("-Z", "Y")
    sc.camera = cam
    return cam


def render_to(sc, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("[stills] saved", path, flush=True)


# --------------------------------------------------------------------------
# 1) Laterne
# --------------------------------------------------------------------------
L_R, L_H, L_RCAP, L_NSEG = 0.32, 0.24, 0.12, 18


def gold_mat(name="Gold", rough=0.22, color=(1.0, 0.64, 0.24, 1)):
    m, nt, out = new_mat(name)
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = color
    p.inputs["Metallic"].default_value = 1.0
    p.inputs["Roughness"].default_value = rough
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 60
    nz.inputs["Detail"].default_value = 4
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.04
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], p.inputs["Normal"])
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    return m


def lantern_silk_mat(strength=1.15):
    m, nt, out = new_mat("LanternSilk")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    ang = math_node(nt, "ARCTAN2", sep.outputs["Y"], sep.outputs["X"])
    seg = math_node(nt, "MULTIPLY", math_node(nt, "ADD", math_node(nt, "DIVIDE", ang, 2 * math.pi), 0.5), L_NSEG)
    fr = math_node(nt, "FRACT", seg)
    d = math_node(nt, "MINIMUM", fr, math_node(nt, "SUBTRACT", 1.0, fr))
    rib_k = map_range(nt, map_range(nt, d, 0.0, 0.07, 0.0, 1.0, "SMOOTHSTEP"), 0.0, 1.0, 0.28, 1.0)
    v = math_node(nt, "DIVIDE", sep.outputs["Z"], L_H)
    v2 = math_node(nt, "MULTIPLY", v, v)
    vert_k = map_range(nt, v2, 0.0, 1.0, 1.0, 0.30)
    # feine Seidenstruktur
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 140
    nz.inputs["Detail"].default_value = 2
    silk = map_range(nt, nz.outputs["Fac"], 0.3, 0.7, 0.92, 1.05)
    # schmale Goldlinien nahe den Deckeln
    av = math_node(nt, "ABSOLUTE", v)
    band = math_node(nt, "MULTIPLY", map_range(nt, av, 0.80, 0.82, 0.0, 1.0), map_range(nt, av, 0.85, 0.87, 1.0, 0.0))
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.45
    fac = math_node(nt, "ADD", lw.outputs["Facing"], math_node(nt, "MULTIPLY", v2, 0.35))
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].color = (1.0, 0.42, 0.10, 1)
    cr.elements[1].position = 0.40
    cr.elements[1].color = (0.80, 0.06, 0.016, 1)
    e = cr.elements.new(0.80)
    e.color = (0.32, 0.009, 0.004, 1)
    e = cr.elements.new(1.0)
    e.color = (0.13, 0.002, 0.001, 1)
    nt.links.new(fac, ramp.inputs[0])
    s = math_node(nt, "MULTIPLY", math_node(nt, "MULTIPLY", rib_k, vert_k), strength)
    s = math_node(nt, "MULTIPLY", s, silk)
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(ramp.outputs[0], em.inputs["Color"])
    nt.links.new(s, em.inputs["Strength"])
    # Goldlinie als glaenzendes Metall darueber
    gp = nt.nodes.new("ShaderNodeBsdfPrincipled")
    gp.inputs["Base Color"].default_value = (1.0, 0.62, 0.22, 1)
    gp.inputs["Metallic"].default_value = 1.0
    gp.inputs["Roughness"].default_value = 0.3
    gp.inputs["Emission Color"].default_value = (1.0, 0.55, 0.15, 1)
    gp.inputs["Emission Strength"].default_value = 0.35
    mx = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(band, mx.inputs[0])
    nt.links.new(em.outputs[0], mx.inputs[1])
    nt.links.new(gp.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs["Surface"])
    return m


def build_lantern_scene():
    sc = reset_scene()
    setup_render(sc, LANTERN_RES, SAMPLES_LANTERN)
    coll = sc.collection
    world(sc, (0.012, 0.005, 0.004, 1))
    m_silk = lantern_silk_mat()
    m_gold = gold_mat()
    m_gold_satin = gold_mat("GoldSatin", 0.35, (0.95, 0.58, 0.22, 1))
    m_red = new_mat("Tassel")[0]
    nt = m_red.node_tree
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = (0.50, 0.02, 0.015, 1)
    p.inputs["Roughness"].default_value = 0.5
    p.inputs["Sheen Weight"].default_value = 0.8
    p.inputs["Sheen Tint"].default_value = (1.0, 0.35, 0.25, 1)
    nt.links.new(p.outputs[0], nt.nodes["Material Output"].inputs[0])

    root = bpy.data.objects.new("Lantern", None)
    coll.objects.link(root)
    # Koerper
    k = math.sqrt(1 - (L_RCAP / L_R) ** 2)
    prof = [(L_R * math.sqrt(max(0.0, 1 - (k * t) ** 2)), L_H * t) for t in [-1 + 2 * j / 64 for j in range(65)]]

    def rib(u, j, z):
        f = (u * L_NSEG) % 1.0
        return 1 - 0.05 * (1 - abs(math.sin(math.pi * f)) ** 0.55)

    body = revolve("Body", prof, L_NSEG * 14, rib)
    link(coll, "Body", body, parent=root, mat=m_silk)
    # Deckel (Profil wie Hero) - hier mit mehr Unterteilung
    rc = L_RCAP * 1.12
    top = [(rc * 0.90, L_H - 0.012), (rc, L_H - 0.006), (rc * 1.06, L_H + 0.004), (rc * 1.06, L_H + 0.022),
           (rc * 0.96, L_H + 0.030), (rc * 0.98, L_H + 0.040), (rc * 0.90, L_H + 0.050),
           (rc * 0.55, L_H + 0.060), (rc * 0.30, L_H + 0.072), (rc * 0.18, L_H + 0.088), (0.0001, L_H + 0.092)]
    bot = [(0.0001, -L_H - 0.070), (rc * 0.22, -L_H - 0.066), (rc * 0.40, -L_H - 0.058), (rc * 0.62, -L_H - 0.050),
           (rc * 0.90, -L_H - 0.044), (rc * 0.98, -L_H - 0.036), (rc * 0.96, -L_H - 0.028),
           (rc * 1.06, -L_H - 0.022), (rc * 1.06, -L_H - 0.004), (rc, -L_H + 0.006), (rc * 0.90, -L_H + 0.012)]

    def scallop(u, j, z):          # gezackter Rand (Lotusblatt-Motiv)
        return 1 + 0.025 * abs(math.sin(math.pi * u * 12))

    link(coll, "CapTop", revolve("CapTop", catmull(top, 4), 96, scallop), parent=root, mat=m_gold)
    link(coll, "CapBot", revolve("CapBot", catmull(bot, 4), 96, scallop), parent=root, mat=m_gold)
    # Oese + Kordel oben
    ring_me = torus_mesh("Loop", 0.03, 0.006)
    link(coll, "Loop", ring_me, loc=(0, 0, L_H + 0.12), rot=(math.radians(90), 0, 0), parent=root, mat=m_gold)
    cord = bpy.data.meshes.new("Cord")
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.007, radius2=0.007, depth=0.5)
    bm.to_mesh(cord)
    bm.free()
    link(coll, "Cord", cord, loc=(0, 0, L_H + 0.15 + 0.25), parent=root, mat=m_red)
    # Knoten + Perlen unten
    zb = -L_H - 0.07
    bead = revolve("Bead", [(max(0.0001, 0.03 * math.sin(math.pi * j / 16)), -0.03 * math.cos(math.pi * j / 16))
                            for j in range(17)], 40)
    link(coll, "Bead1", bead, loc=(0, 0, zb - 0.032), parent=root, mat=m_gold)
    knot = revolve("Knot", catmull([(0.0001, 0.03), (0.035, 0.026), (0.05, 0.0), (0.035, -0.026), (0.0001, -0.03)], 6),
                   48, lambda u, j, z: 1 + 0.18 * abs(math.sin(math.pi * u * 4)))
    link(coll, "Knot", knot, loc=(0, 0, zb - 0.10), parent=root, mat=m_red)
    link(coll, "Bead2", bead, loc=(0, 0, zb - 0.16), rot=(0, 0, 0), parent=root, mat=m_gold).scale = (0.7, 0.7, 0.7)
    # Quaste: goldene Manschette + viele Faeden
    zt = zb - 0.19
    band = revolve("TBand", [(0.022, zt + 0.005), (0.028, zt), (0.030, zt - 0.010), (0.030, zt - 0.045),
                             (0.028, zt - 0.055), (0.024, zt - 0.060)], 48)
    link(coll, "TBand", band, parent=root, mat=m_gold_satin)
    rnd = random.Random(3)
    verts, faces = [], []
    n_str = 110
    for i in range(n_str):
        a = rnd.uniform(0, 2 * math.pi)
        r0 = math.sqrt(rnd.uniform(0, 1)) * 0.024
        L = rnd.uniform(0.30, 0.34)
        flare = rnd.uniform(0.02, 0.05)
        base = len(verts)
        seg = 10
        for s in range(seg + 1):
            t = s / seg
            r = r0 + flare * t ** 1.5 * (0.5 + r0 / 0.024)
            cx, cy = r * math.cos(a), r * math.sin(a)
            cz = zt - 0.05 - L * t
            for q in range(4):
                b = q * math.pi / 2
                verts.append((cx + 0.0022 * math.cos(b), cy + 0.0022 * math.sin(b), cz))
        for s in range(seg):
            for q in range(4):
                a0 = base + s * 4 + q
                a1 = base + s * 4 + (q + 1) % 4
                faces.append((a0, a1, a1 + 4, a0 + 4))
    tme = mesh_from("Strands", verts, faces)
    link(coll, "Strands", tme, parent=root, mat=m_red)
    # Licht im Inneren (fuer Goldreflexe/Quaste)
    ld = bpy.data.lights.new("Inner", "POINT")
    ld.energy = 25
    ld.color = (1.0, 0.4, 0.15)
    ld.shadow_soft_size = 0.2
    lo = bpy.data.objects.new("InnerLight", ld)
    coll.objects.link(lo)
    lo.location = (0, 0, -L_H - 0.05)
    lo.parent = root
    root.rotation_euler = (math.radians(2), math.radians(-3), math.radians(8))
    # Licht
    area_light(coll, "Key", (-2.0, -2.5, 2.2), (0, 0, 0), 260, 1.6, (1.0, 0.82, 0.62))
    area_light(coll, "Rim", (2.2, 2.0, 1.2), (0, 0, 0), 300, 1.0, (1.0, 0.55, 0.3))
    area_light(coll, "Top", (0.0, 0.0, 2.5), (0, 0, 0), 120, 1.2, (1.0, 0.85, 0.7))
    # Kamera: 3/4-Heldenansicht, leicht von oben
    camera(sc, coll, (1.4, -3.7, 0.95), (0, 0, -0.12), 85)
    return sc


def torus_mesh(name, R, r, nu=48, nv=12):
    verts, faces = [], []
    for i in range(nu):
        a = 2 * math.pi * i / nu
        for j in range(nv):
            b = 2 * math.pi * j / nv
            verts.append(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b)))
    for i in range(nu):
        for j in range(nv):
            faces.append((i * nv + j, i * nv + (j + 1) % nv, ((i + 1) % nu) * nv + (j + 1) % nv,
                          ((i + 1) % nu) * nv + j))
    return mesh_from(name, verts, faces)


# --------------------------------------------------------------------------
# 2) Bambus-Dampfkorb
# --------------------------------------------------------------------------
S_R, S_H = 0.125, 0.068        # Radius / Hoehe Korb


def bamboo_mat(name, base=(0.52, 0.29, 0.085, 1), dark=(0.27, 0.13, 0.035, 1), grain_axis="Z", scale=(30, 30, 420),
               rough=0.45):
    m, nt, out = new_mat(name)
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = scale
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 1.0
    nz.inputs["Detail"].default_value = 8
    nz.inputs["Distortion"].default_value = 0.3
    nt.links.new(mp.outputs[0], nz.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = dark
    ramp.color_ramp.elements[1].position = 0.65
    ramp.color_ramp.elements[1].color = base
    nt.links.new(nz.outputs["Fac"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = rough
    p.inputs["Coat Weight"].default_value = 0.15
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.15
    bp.inputs["Distance"].default_value = 0.002
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], p.inputs["Normal"])
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    return m


def weave_mat(name):
    """Geflochtener Deckel: zwei Wellen-Texturen ueber Kreuz."""
    m, nt, out = new_mat(name)
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    sx = math_node(nt, "SINE", math_node(nt, "MULTIPLY", sep.outputs["X"], 2 * math.pi * 55))
    sy = math_node(nt, "SINE", math_node(nt, "MULTIPLY", sep.outputs["Y"], 2 * math.pi * 55))
    cx = math_node(nt, "SINE", math_node(nt, "MULTIPLY", sep.outputs["X"], 2 * math.pi * 27.5))
    cy = math_node(nt, "SINE", math_node(nt, "MULTIPLY", sep.outputs["Y"], 2 * math.pi * 27.5))
    chk = math_node(nt, "MULTIPLY", cx, cy)                          # +/- Schachbrett (Ueber/Unter)
    sel = map_range(nt, chk, -0.05, 0.05, 0.0, 1.0)
    hx = math_node(nt, "ABSOLUTE", sy)                               # Streifen in X-Richtung
    hy = math_node(nt, "ABSOLUTE", sx)
    mx = nt.nodes.new("ShaderNodeMix")
    mx.data_type = "FLOAT"
    nt.links.new(sel, mx.inputs[0])
    nt.links.new(hx, mx.inputs[2])
    nt.links.new(hy, mx.inputs[3])
    h = mx.outputs[0]
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 90
    nz.inputs["Detail"].default_value = 6
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.28, 0.14, 0.04, 1)
    ramp.color_ramp.elements[1].color = (0.62, 0.38, 0.13, 1)
    nt.links.new(math_node(nt, "MULTIPLY", map_range(nt, h, 0.0, 1.0, 0.35, 1.0),
                           map_range(nt, nz.outputs["Fac"], 0.3, 0.7, 0.75, 1.0)), ramp.inputs[0])
    nt.links.new(ramp.outputs[0], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.5
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.6
    bp.inputs["Distance"].default_value = 0.0015
    nt.links.new(h, bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], p.inputs["Normal"])
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    return m


def dough_mat():
    m, nt, out = new_mat("Dough")
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 180
    nz.inputs["Detail"].default_value = 4
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.70, 0.60, 0.44, 1)
    ramp.color_ramp.elements[1].color = (0.84, 0.77, 0.62, 1)
    nt.links.new(nz.outputs["Fac"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.32
    p.inputs["Subsurface Weight"].default_value = 0.6
    p.inputs["Subsurface Radius"].default_value = (1.0, 0.6, 0.35)
    p.inputs["Subsurface Scale"].default_value = 0.006
    p.inputs["Coat Weight"].default_value = 0.35
    p.inputs["Coat Roughness"].default_value = 0.2
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.08
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], p.inputs["Normal"])
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    return m


def dumpling_mesh(seed=0):
    rnd = random.Random(seed)
    Hd = 0.040
    ctrl = [(0.0001, 0.0), (0.021, 0.0005), (0.0275, 0.005), (0.0295, 0.012), (0.027, 0.021), (0.019, 0.029),
            (0.010, 0.034), (0.0045, 0.0375), (0.0035, 0.040), (0.0001, 0.0415)]
    prof = catmull(ctrl, 6)
    twist = rnd.uniform(5, 8)
    npl = 16
    ph = rnd.uniform(0, 6.28)

    def pleat(u, j, z):
        w = max(0.0, min(1.0, (z / Hd - 0.30) / 0.55))
        w = w * w * (3 - 2 * w)
        s = abs(math.sin(math.pi * u * npl + twist * max(0.0, z / Hd) ** 1.5 + ph))
        return 1 + 0.16 * w * (s ** 0.5) - 0.10 * w

    me = revolve("Dumpling", prof, 192, pleat)
    return me


def steam_mat():
    m, nt, out = new_mat("Steam")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])      # Domain: -1..1 in allen Achsen
    # aufsteigende, verdrehte Fahnen
    z01 = map_range(nt, sep.outputs["Z"], -1.0, 1.0, 0.0, 1.0)
    tw = math_node(nt, "MULTIPLY", z01, 2.4)
    cx = math_node(nt, "SUBTRACT", math_node(nt, "MULTIPLY", sep.outputs["X"], math_node(nt, "COSINE", tw)),
                   math_node(nt, "MULTIPLY", sep.outputs["Y"], math_node(nt, "SINE", tw)))
    cy = math_node(nt, "ADD", math_node(nt, "MULTIPLY", sep.outputs["X"], math_node(nt, "SINE", tw)),
                   math_node(nt, "MULTIPLY", sep.outputs["Y"], math_node(nt, "COSINE", tw)))
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(cx, comb.inputs[0])
    nt.links.new(cy, comb.inputs[1])
    nt.links.new(math_node(nt, "MULTIPLY", sep.outputs["Z"], 0.35), comb.inputs[2])
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 2.2
    nz.inputs["Detail"].default_value = 5
    nz.inputs["Roughness"].default_value = 0.6
    nz.inputs["Distortion"].default_value = 0.8
    nt.links.new(comb.outputs[0], nz.inputs["Vector"])
    d = map_range(nt, nz.outputs["Fac"], 0.50, 0.72, 0.0, 1.0, "SMOOTHSTEP")
    # Maske: unten einsetzen, oben ausduennen, radial weich
    zm = math_node(nt, "MULTIPLY", map_range(nt, z01, 0.0, 0.18, 0.0, 1.0, "SMOOTHSTEP"),
                   map_range(nt, z01, 0.45, 1.0, 1.0, 0.0, "SMOOTHSTEP"))
    rr = math_node(nt, "SQRT", math_node(nt, "ADD", math_node(nt, "MULTIPLY", sep.outputs["X"], sep.outputs["X"]),
                                         math_node(nt, "MULTIPLY", sep.outputs["Y"], sep.outputs["Y"])))
    rw = map_range(nt, z01, 0.0, 1.0, 0.45, 0.95)
    rm = map_range(nt, math_node(nt, "DIVIDE", rr, rw), 0.4, 1.0, 1.0, 0.0, "SMOOTHSTEP")
    dens = math_node(nt, "MULTIPLY", math_node(nt, "MULTIPLY", d, zm), rm)
    pv = nt.nodes.new("ShaderNodeVolumePrincipled")
    pv.inputs["Color"].default_value = (1.0, 0.97, 0.92, 1)
    pv.inputs["Anisotropy"].default_value = 0.35
    nt.links.new(math_node(nt, "MULTIPLY", dens, 55.0), pv.inputs["Density"])
    nt.links.new(pv.outputs[0], out.inputs["Volume"])
    return m


def build_steamer_scene():
    sc = reset_scene()
    setup_render(sc, STEAMER_RES, SAMPLES_STEAMER)
    coll = sc.collection
    world(sc, (0.05, 0.035, 0.025, 1))
    m_bamboo = bamboo_mat("Bamboo")
    m_rim = bamboo_mat("BambooRim", base=(0.44, 0.23, 0.065, 1), dark=(0.22, 0.10, 0.03, 1), scale=(25, 25, 260))
    m_slat = bamboo_mat("Slat", base=(0.58, 0.36, 0.13, 1), dark=(0.36, 0.20, 0.07, 1), scale=(400, 30, 30))
    m_weave = weave_mat("Weave")
    m_dough = dough_mat()
    m_paper, nt, out = new_mat("Liner")
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = (0.78, 0.70, 0.52, 1)
    p.inputs["Roughness"].default_value = 0.6
    nt.links.new(p.outputs[0], out.inputs["Surface"])

    root = bpy.data.objects.new("Steamer", None)
    coll.objects.link(root)
    # Korbwand (geschlossener Ring-Querschnitt)
    t = 0.006
    wall = revolve("Wall", [(S_R, 0.004), (S_R, S_H), (S_R - t, S_H), (S_R - t, 0.004)], 160, closed=True)
    link(coll, "Wall", wall, parent=root, mat=m_bamboo)
    # Raender oben/unten
    for nm, z0, z1 in (("RimTop", S_H - 0.014, S_H + 0.002), ("RimBot", 0.0, 0.016)):
        rim = revolve(nm, catmull([(S_R + 0.0005, z0), (S_R + 0.0045, z0 + 0.002), (S_R + 0.0055, (z0 + z1) / 2),
                                   (S_R + 0.0045, z1 - 0.002), (S_R + 0.0005, z1)], 3)
                      + [(S_R - t - 0.003, z1), (S_R - t - 0.003, z0)], 160, closed=True)
        link(coll, nm, rim, parent=root, mat=m_rim)
    # Bindungen (Rattan-Stiche) an der Naht
    for i in range(5):
        st = bpy.data.meshes.new("Stitch")
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bm.to_mesh(st)
        bm.free()
        o = link(coll, "Stitch", st, loc=(S_R + 0.0012, -0.0, 0.020 + i * 0.0095), parent=root, mat=m_rim)
        o.scale = (0.002, 0.009, 0.004)
        o.rotation_euler = (0, 0, 0)
        o.location = (math.cos(math.radians(150)) * (S_R + 0.0015), math.sin(math.radians(150)) * (S_R + 0.0015),
                      0.022 + i * 0.0095)
        o.rotation_euler = (0, 0, math.radians(150))
    # Bodenlatten
    for i in range(-5, 6):
        y = i * 0.021
        half = math.sqrt(max(0.0, (S_R - t) ** 2 - y * y)) - 0.002
        if half <= 0.01:
            continue
        sl = bpy.data.meshes.new("Slat")
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=2.0)
        for v in bm.verts:
            v.co.x *= half
            v.co.y *= 0.0085
            v.co.z *= 0.003
        bm.to_mesh(sl)
        bm.free()
        link(coll, "Slat", sl, loc=(0, y, 0.010), parent=root, mat=m_slat)
    # Papiereinlage mit Loechern (leicht gewellt)
    liner = revolve("Liner", [(0.0001, 0.0145)] + [(r, 0.0145 + 0.0012 * math.sin(r * 160)) for r in
                                                   [0.02 * k for k in range(1, 6)] + [0.108]], 96)
    link(coll, "Liner", liner, parent=root, mat=m_paper)
    # Dumplings
    spots = [(-0.045, 0.036, 0.0), (0.048, 0.040, 1.1), (0.040, -0.048, 2.3), (-0.050, -0.040, 3.9)]
    for i, (x, y, rz) in enumerate(spots):
        me = dumpling_mesh(seed=i + 4)
        o = link(coll, f"Dumpling{i}", me, loc=(x, y, 0.0150), rot=(0, 0, rz), parent=root, mat=m_dough)
        s = 1.08 + 0.05 * math.sin(i * 2.1)
        o.scale = (s * 1.08, s * 1.08, s)
    # Deckel: Rand + geflochtene Kuppel, schraeg angehoben (hinten aufgestuetzt)
    lid = bpy.data.objects.new("Lid", None)
    coll.objects.link(lid)
    lid.parent = root
    lh = 0.036
    lw = revolve("LidWall", [(S_R + 0.008, 0.0), (S_R + 0.008, lh), (S_R + 0.002, lh), (S_R + 0.002, 0.0)], 160,
                 closed=True)
    link(coll, "LidWall", lw, parent=lid, mat=m_bamboo)
    lr = revolve("LidRim", catmull([(S_R + 0.0085, lh - 0.012), (S_R + 0.0125, lh - 0.010), (S_R + 0.0135, lh - 0.005),
                                    (S_R + 0.0125, lh), (S_R + 0.0085, lh + 0.002)], 3)
                 + [(S_R + 0.001, lh + 0.002), (S_R + 0.001, lh - 0.012)], 160, closed=True)
    link(coll, "LidRim", lr, parent=lid, mat=m_rim)
    lrb = revolve("LidRimB", catmull([(S_R + 0.0085, 0.0), (S_R + 0.0125, 0.002), (S_R + 0.0135, 0.006),
                                      (S_R + 0.0125, 0.011), (S_R + 0.0085, 0.013)], 3)
                  + [(S_R + 0.001, 0.013), (S_R + 0.001, 0.0)], 160, closed=True)
    link(coll, "LidRimB", lrb, parent=lid, mat=m_rim)
    dome = revolve("LidTop", [(r, lh - 0.004 + 0.010 * (1 - (r / (S_R + 0.004)) ** 2))
                              for r in [0.0001] + [(S_R + 0.004) * k / 24 for k in range(1, 25)]], 160)
    link(coll, "LidTop", dome, parent=lid, mat=m_weave)
    # Scharnierpunkt hinten rechts; Deckel um ~24 Grad gekippt und etwas angehoben
    # Deckel-Vorderkante (lokal -Y) ruht knapp ueber dem Korb, hinten angehoben
    edge_local = mathutils.Vector((0.0, -(S_R + 0.010), 0.0))
    contact = mathutils.Vector((0.012, 0.020, S_H + 0.022))
    rot = mathutils.Euler((math.radians(18), 0.0, math.radians(-22))).to_matrix().to_4x4()
    lid.matrix_world = (mathutils.Matrix.Translation(contact) @ rot @ mathutils.Matrix.Translation(-edge_local))
    # Dampf (Volumen) - quillt vorne aus dem Spalt
    dom = bpy.data.meshes.new("SteamDomain")
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    bm.to_mesh(dom)
    bm.free()
    so = link(coll, "Steam", dom, loc=(-0.035, -0.055, S_H + 0.125), mat=steam_mat())
    so.scale = (0.10, 0.09, 0.12)
    so.rotation_euler = (math.radians(-10), 0, 0)
    # Schattenfaenger (weicher Kontaktschatten im Alpha)
    pl = bpy.data.meshes.new("Catcher")
    pl.from_pydata([(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)], [], [(0, 1, 2, 3)])
    pc = link(coll, "ShadowCatcher", pl)
    pc.is_shadow_catcher = True
    root.rotation_euler = (0, 0, math.radians(-18))
    # Licht
    area_light(coll, "Key", (-0.55, -0.45, 0.75), (0, 0, 0.04), 22, 0.45, (1.0, 0.84, 0.66))
    area_light(coll, "Rim", (-0.10, 0.75, 0.30), (-0.03, -0.05, 0.16), 26, 0.30, (1.0, 0.80, 0.62))
    area_light(coll, "Fill", (0.7, -0.4, 0.35), (0, 0, 0.04), 6, 0.6, (0.9, 0.85, 0.85))
    camera(sc, coll, (0.35, -0.69, 0.57), (0.035, 0.015, 0.085), 52)
    # AgX: natuerliche Toene ohne hartes Clipping (Laterne nutzt Standard fuer sattes Rot)
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    return sc


# --------------------------------------------------------------------------
# Optimierung (Pillow)
# --------------------------------------------------------------------------
def optimize(png_path, out_base, max_kb=400):
    try:
        from PIL import Image
    except ImportError:
        print("[stills] Pillow fehlt - PNG/WebP bitte separat optimieren (siehe README)")
        return
    im = Image.open(png_path).convert("RGBA")
    im.save(out_base + ".webp", "WEBP", quality=88, method=6, exact=False)
    im.save(out_base + ".png", "PNG", optimize=True)
    if os.path.getsize(out_base + ".png") > max_kb * 1024:
        q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
        q.save(out_base + ".png", "PNG", optimize=True)
    for ext in (".png", ".webp"):
        print("[stills]", out_base + ext, os.path.getsize(out_base + ext) // 1024, "KB")


if __name__ == "__main__":
    os.makedirs(TMP_DIR, exist_ok=True)
    if ONLY in ("", "lantern"):
        sc = build_lantern_scene()
        p = os.path.join(TMP_DIR, "lantern_raw.png")
        render_to(sc, p)
        optimize(p, OUT_LANTERN)
    if ONLY in ("", "steamer"):
        sc = build_steamer_scene()
        p = os.path.join(TMP_DIR, "steamer_raw.png")
        render_to(sc, p)
        optimize(p, OUT_STEAMER)
