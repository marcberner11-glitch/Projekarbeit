"""
Asia Khan - Hero-Hintergrund: schwebende rote Laternen (nahtloser Loop).

Baut die komplette Szene prozedural (keine externen Assets), rendert die
Frames mit Cycles (CPU) und kodiert sie - falls ffmpeg vorhanden ist - zu
MP4 (H.264) / WebM (VP9) plus Poster-JPG.

Nutzung:
  * Blender: Scripting-Tab -> Datei oeffnen -> "Run Script"
  * Headless: pip install bpy==5.2.3 ; python hero_lanterns.py

Loop-Prinzip: Jede Laterne gehoert zu einem "Strom" aus n Laternen, die mit
gleichem Abstand H/n uebereinander liegen. In 8 s steigt jede genau H/n:
Laterne j landet am Ende exakt im Startzustand von Laterne j+1. Alle
Eigenschaften (Pendeln, Drehung, Flackern, Seitendrift) sind Funktionen der
Bahnposition p (periodisch in H) -> Frame 192 == Frame 0.
"""
import math
import os
import random
import shutil
import subprocess
import sys

import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

import bpy

# --------------------------------------------------------------------------
# Ausgabe / Einstellungen
# --------------------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
RENDER_DIR = os.path.abspath(os.path.join(HERE, "..", "renders"))
FRAME_DIR = os.environ.get("AK_FRAME_DIR", "/tmp/asiakhan_hero_frames")   # Zwischen-Frames (PNG)
OUT_MP4 = os.path.join(RENDER_DIR, "hero-lanterns.mp4")
OUT_WEBM = os.path.join(RENDER_DIR, "hero-lanterns.webm")
OUT_POSTER = os.path.join(RENDER_DIR, "hero-lanterns-poster.jpg")

RES_X, RES_Y = 1600, 900
FPS = 24
LOOP_FRAMES = 192            # 8 s
SAMPLES = 24
RENDER = True                # False = nur Szene bauen (z.B. in Blender ansehen)
ENCODE = True                # ffmpeg-Encoding nach dem Rendern

# Optionale Overrides fuer Testlaeufe (Umgebungsvariablen)
_PCT = int(os.environ.get("AK_PCT", "100"))
SAMPLES = int(os.environ.get("AK_SAMPLES", SAMPLES))
_FRAMES = os.environ.get("AK_FRAMES")          # z.B. "0,96,192" fuer Test-Stills
if os.environ.get("AK_NO_ENCODE"):
    ENCODE = False

SEED = 7

# Markenfarben (sRGB hex) -> linear
def srgb(h, a=1.0):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (lin[0], lin[1], lin[2], a)


# --------------------------------------------------------------------------
# Szene leeren / Renderer
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
    sc.render.fps = FPS
    sc.frame_start = 0
    sc.frame_end = LOOP_FRAMES - 1
    c = sc.cycles
    c.samples = SAMPLES
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.03
    c.use_denoising = True
    c.denoiser = "OPENIMAGEDENOISE"
    c.max_bounces = 3
    c.diffuse_bounces = 1
    c.glossy_bounces = 1
    c.transmission_bounces = 1
    c.volume_bounces = 0
    c.transparent_max_bounces = 4
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.sample_clamp_indirect = 4.0
    c.seed = 3
    c.use_animated_seed = False      # gleiches Rauschmuster -> Frame 192 == Frame 0
    sc.render.use_persistent_data = True
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.view_settings.exposure = 0.0
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.render.image_settings.color_depth = "8"


# --------------------------------------------------------------------------
# Node-Helfer
# --------------------------------------------------------------------------
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


def mix_color(nt, fac, a, b):
    n = nt.nodes.new("ShaderNodeMix")
    n.data_type = "RGBA"
    if isinstance(fac, (int, float)):
        n.inputs[0].default_value = fac
    else:
        nt.links.new(fac, n.inputs[0])
    for sock, v in ((n.inputs[6], a), (n.inputs[7], b)):
        if isinstance(v, tuple):
            sock.default_value = v
        else:
            nt.links.new(v, sock)
    return n.outputs[2]


# --------------------------------------------------------------------------
# Laternen-Geometrie
# --------------------------------------------------------------------------
L_R, L_H, L_RCAP, L_NSEG = 0.32, 0.24, 0.12, 18


def mesh_from(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    return me


def revolve(name, profile, nu, radial_fn=None, cap_top=False, cap_bottom=False):
    """profile: Liste (r, z). radial_fn(u, j) -> Faktor fuer Radius."""
    verts, faces = [], []
    rings = len(profile)
    for j, (r, z) in enumerate(profile):
        for i in range(nu):
            u = i / nu
            th = 2 * math.pi * u
            k = radial_fn(u, j) if radial_fn else 1.0
            verts.append((r * k * math.cos(th), r * k * math.sin(th), z))
    for j in range(rings - 1):
        for i in range(nu):
            a = j * nu + i
            b = j * nu + (i + 1) % nu
            faces.append((a, b, b + nu, a + nu))
    if cap_bottom:
        faces.append(tuple(reversed(range(nu))))
    if cap_top:
        faces.append(tuple(range((rings - 1) * nu, rings * nu)))
    return mesh_from(name, verts, faces)


def lantern_body_mesh():
    k = math.sqrt(1 - (L_RCAP / L_R) ** 2)
    rings = 44
    prof = []
    for j in range(rings + 1):
        t = -1 + 2 * j / rings
        prof.append((L_R * math.sqrt(max(0.0, 1 - (k * t) ** 2)), L_H * t))

    def rib(u, j):
        f = (u * L_NSEG) % 1.0
        s = abs(math.sin(math.pi * f)) ** 0.55
        return 1 - 0.05 * (1 - s)

    return revolve("LanternBody", prof, L_NSEG * 10, rib)


def lantern_gold_mesh():
    """Deckel oben/unten + Ringe + Knauf als ein Mesh."""
    rc = L_RCAP * 1.12
    parts = []
    # oberer Deckel: Kragen + Wulst + Kuppel + Oese
    top = [(rc * 0.90, L_H - 0.012), (rc, L_H - 0.006), (rc * 1.06, L_H + 0.004), (rc * 1.06, L_H + 0.022),
           (rc * 0.96, L_H + 0.030), (rc * 0.98, L_H + 0.040), (rc * 0.90, L_H + 0.050),
           (rc * 0.55, L_H + 0.060), (rc * 0.30, L_H + 0.072), (rc * 0.18, L_H + 0.088), (0.0001, L_H + 0.092)]
    bot = [(0.0001, -L_H - 0.070), (rc * 0.22, -L_H - 0.066), (rc * 0.40, -L_H - 0.058), (rc * 0.62, -L_H - 0.050),
           (rc * 0.90, -L_H - 0.044), (rc * 0.98, -L_H - 0.036), (rc * 0.96, -L_H - 0.028),
           (rc * 1.06, -L_H - 0.022), (rc * 1.06, -L_H - 0.004), (rc, -L_H + 0.006), (rc * 0.90, -L_H + 0.012)]
    # Knoten / Perle unter dem Deckel
    knot = []
    for j in range(13):
        a = math.pi * j / 12
        knot.append((max(0.0001, 0.026 * math.sin(a)), -L_H - 0.070 - 0.026 * (1 - math.cos(a)) - 0.004))
    return [revolve("GoldTop", top, 48), revolve("GoldBot", bot, 48), revolve("GoldKnot", knot, 24)]


def tassel_mesh(length=0.30):
    prof = []
    n = 26
    for j in range(n + 1):
        t = j / n
        z = -t * length
        r = 0.020 + 0.030 * (t ** 0.8)
        if j == n:
            r *= 0.85
        prof.append((r, z))
    prof.append((0.0001, -length - 0.004))
    prof = list(reversed(prof))

    def strands(u, j):
        return 1 + 0.10 * math.sin(2 * math.pi * u * 36)

    me = revolve("Tassel", prof, 144, strands)
    band = revolve("TasselBand", [(0.024, -0.050), (0.027, -0.045), (0.027, -0.020), (0.024, -0.015)], 32)
    top = revolve("TasselTop", [(0.0001, 0.0), (0.012, -0.002), (0.020, -0.010), (0.022, -0.016)], 24)
    return me, band, top


# --------------------------------------------------------------------------
# Materialien
# --------------------------------------------------------------------------
def mat_lantern_body(name="LanternSilk", strength=1.7):
    m, nt, out = new_mat(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    ang = math_node(nt, "ARCTAN2", sep.outputs["Y"], sep.outputs["X"])
    seg = math_node(nt, "MULTIPLY", math_node(nt, "ADD", math_node(nt, "DIVIDE", ang, 2 * math.pi), 0.5), L_NSEG)
    fr = math_node(nt, "FRACT", seg)
    d = math_node(nt, "MINIMUM", fr, math_node(nt, "SUBTRACT", 1.0, fr))
    ribmask = map_range(nt, d, 0.0, 0.09, 0.0, 1.0, "SMOOTHSTEP")         # 0 = Rippe
    rib_k = map_range(nt, ribmask, 0.0, 1.0, 0.30, 1.0)
    v = math_node(nt, "DIVIDE", sep.outputs["Z"], L_H)
    v2 = math_node(nt, "MULTIPLY", v, v)
    vert_k = map_range(nt, v2, 0.0, 1.0, 1.0, 0.25)
    # Facing: Mitte heiss/orange, Rand tiefrot
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.45
    core = math_node(nt, "POWER", math_node(nt, "SUBTRACT", 1.0, lw.outputs["Facing"]), 1.6)
    core2 = math_node(nt, "MULTIPLY", core, map_range(nt, v2, 0.0, 0.8, 1.0, 0.2))
    col = mix_color(nt, core2, (0.36, 0.006, 0.004, 1), (1.0, 0.20, 0.025, 1))
    # Flackern / Helligkeit pro Objekt: Objekt-Farbe R-Kanal
    oi = nt.nodes.new("ShaderNodeObjectInfo")
    sepc = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(oi.outputs["Color"], sepc.inputs[0])
    s = math_node(nt, "MULTIPLY", rib_k, vert_k)
    s = math_node(nt, "MULTIPLY", s, sepc.outputs["Red"])
    s = math_node(nt, "MULTIPLY", s, strength)
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(col, em.inputs["Color"])
    nt.links.new(s, em.inputs["Strength"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m


def mat_gold(name="Gold", glow=0.45):
    m, nt, out = new_mat(name)
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = (1.0, 0.66, 0.26, 1)
    p.inputs["Metallic"].default_value = 1.0
    p.inputs["Roughness"].default_value = 0.28
    p.inputs["Emission Color"].default_value = (1.0, 0.58, 0.18, 1)
    p.inputs["Emission Strength"].default_value = glow
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    return m


def mat_tassel(name="TasselRed", glow=0.5):
    m, nt, out = new_mat(name)
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = (0.55, 0.03, 0.02, 1)
    p.inputs["Roughness"].default_value = 0.55
    p.inputs["Sheen Weight"].default_value = 0.6
    p.inputs["Sheen Tint"].default_value = (1.0, 0.4, 0.3, 1)
    p.inputs["Emission Color"].default_value = (0.9, 0.08, 0.03, 1)
    p.inputs["Emission Strength"].default_value = glow
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    return m


def mat_dust(name="GoldDust"):
    m, nt, out = new_mat(name)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (1.0, 0.62, 0.22, 1)
    oi = nt.nodes.new("ShaderNodeObjectInfo")
    sepc = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(oi.outputs["Color"], sepc.inputs[0])
    nt.links.new(math_node(nt, "MULTIPLY", sepc.outputs["Red"], 14.0), em.inputs["Strength"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m


# --------------------------------------------------------------------------
# Laterne zusammensetzen
# --------------------------------------------------------------------------
class LanternKit:
    def __init__(self):
        self.body = lantern_body_mesh()
        self.gold = lantern_gold_mesh()
        self.tassel, self.band, self.ttop = tassel_mesh()
        self.m_body = mat_lantern_body()
        self.m_gold = mat_gold()
        self.m_tassel = mat_tassel()
        for me in self.gold + [self.band, self.ttop]:
            me.materials.append(self.m_gold)
        self.body.materials.append(self.m_body)
        self.tassel.materials.append(self.m_tassel)

    def spawn(self, coll, name):
        root = bpy.data.objects.new(name, None)
        root.empty_display_size = 0.3
        coll.objects.link(root)
        for i, me in enumerate([self.body] + self.gold):
            o = bpy.data.objects.new(f"{name}_p{i}", me)
            coll.objects.link(o)
            o.parent = root
        # Quaste: eigenes Pivot (haengt am Knoten), damit sie nachschwingen kann
        piv = bpy.data.objects.new(f"{name}_tasselpivot", None)
        coll.objects.link(piv)
        piv.parent = root
        piv.location = (0, 0, -L_H - 0.125)
        for me in (self.tassel, self.band, self.ttop):
            o = bpy.data.objects.new(f"{name}_{me.name}", me)
            coll.objects.link(o)
            o.parent = piv
        return root, piv


# --------------------------------------------------------------------------
# Welt, Dunst, Kamera, Compositing
# --------------------------------------------------------------------------
def setup_world(sc):
    w = bpy.data.worlds.new("NightWorld")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    # unten etwas waermer (Glut der Stadt/Laternen), oben fast schwarz
    g = map_range(nt, sep.outputs["Z"], -0.25, 0.25, 1.0, 0.0, "SMOOTHSTEP")
    col = mix_color(nt, g, (0.0105, 0.0050, 0.0074, 1), (0.0200, 0.0068, 0.0072, 1))
    nt.links.new(col, bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0
    nt.links.new(bg.outputs[0], out.inputs["Surface"])


def setup_haze(sc, coll):
    """Grosse, sehr schwache Rauch-/Dunstflaeche im Hintergrund (loopende 4D-Noise)."""
    me = bpy.data.meshes.new("Haze")
    W, Hh, y = 40.0, 22.0, 45.0
    me.from_pydata([(-W, y, -Hh), (W, y, -Hh), (W, y, Hh), (-W, y, Hh)], [], [(0, 1, 2, 3)])
    o = bpy.data.objects.new("Haze", me)
    coll.objects.link(o)
    m, nt, out = new_mat("HazeMat")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    val = nt.nodes.new("ShaderNodeValue")            # 0..2pi linear ueber den Loop
    th = val.outputs[0]
    r = 0.45
    cz = math_node(nt, "MULTIPLY", math_node(nt, "COSINE", th), r)
    sw = math_node(nt, "MULTIPLY", math_node(nt, "SINE", th), r)
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(math_node(nt, "MULTIPLY", sep.outputs["X"], 0.06), comb.inputs[0])
    nt.links.new(math_node(nt, "MULTIPLY", sep.outputs["Z"], 0.10), comb.inputs[1])
    nt.links.new(cz, comb.inputs[2])
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.noise_dimensions = "4D"
    nz.inputs["Scale"].default_value = 1.6
    nz.inputs["Detail"].default_value = 3.0
    nz.inputs["Roughness"].default_value = 0.55
    nt.links.new(comb.outputs[0], nz.inputs["Vector"])
    nt.links.new(sw, nz.inputs["W"])
    dens = map_range(nt, nz.outputs["Fac"], 0.42, 0.75, 0.0, 1.0, "SMOOTHSTEP")
    # unten staerker, Mitte (Text) schwaecher
    vg = map_range(nt, sep.outputs["Z"], -Hh, Hh * 0.6, 1.0, 0.15)
    ax = math_node(nt, "ABSOLUTE", sep.outputs["X"])
    cg = map_range(nt, ax, 2.0, 14.0, 0.35, 1.0)
    k = math_node(nt, "MULTIPLY", math_node(nt, "MULTIPLY", dens, vg), cg)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (0.55, 0.10, 0.04, 1)
    nt.links.new(math_node(nt, "MULTIPLY", k, 0.030), em.inputs["Strength"])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    add = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(tr.outputs[0], add.inputs[0])
    nt.links.new(em.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs["Surface"])
    me.materials.append(m)
    o.visible_shadow = False
    o.visible_diffuse = False
    o.visible_glossy = False
    F = LOOP_FRAMES
    set_keys(m.node_tree, 'nodes["%s"].outputs[0].default_value' % val.name, 0,
             [2 * math.pi * f / F for f in range(F + 1)])
    return o


def setup_camera(sc, coll):
    cd = bpy.data.cameras.new("Cam")
    cd.lens = 50
    cd.sensor_fit = "HORIZONTAL"
    cd.sensor_width = 36
    cd.clip_end = 200
    cd.dof.use_dof = True
    cd.dof.focus_distance = 9.0
    cd.dof.aperture_fstop = 0.45
    cd.dof.aperture_blades = 0
    cam = bpy.data.objects.new("Cam", cd)
    coll.objects.link(cam)
    cam.location = (0, 0, 0)
    cam.rotation_euler = (math.radians(90), 0, 0)
    sc.camera = cam
    return cam


def setup_compositor(sc):
    ng = bpy.data.node_groups.new("HeroComp", "CompositorNodeTree")
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl = ng.nodes.new("CompositorNodeRLayers")
    gl = ng.nodes.new("CompositorNodeGlare")
    gl.inputs["Type"].default_value = "Fog Glow"
    gl.inputs["Quality"].default_value = "High"
    gl.inputs["Threshold"].default_value = 0.6
    gl.inputs["Size"].default_value = 0.85
    gl.inputs["Strength"].default_value = 0.55
    ng.links.new(rl.outputs["Image"], gl.inputs["Image"])
    out = ng.nodes.new("NodeGroupOutput")
    ng.links.new(gl.outputs["Image"], out.inputs[0])
    sc.compositing_node_group = ng
    sc.render.use_compositing = not os.environ.get("AK_NO_COMP")
    sc.render.compositor_device = "CPU"     # headless: kein GPU-Kontext


# --------------------------------------------------------------------------
# Animation (periodisch)
# --------------------------------------------------------------------------
def set_keys(idb, path, index, values, frame0=0):
    """values: Liste pro Frame (frame0..). Schnell per foreach_set."""
    if idb.animation_data is None:
        idb.animation_data_create()
    act = idb.animation_data.action
    if act is None:
        act = bpy.data.actions.new(idb.name + "Action")
        idb.animation_data.action = act
    fc = None
    try:
        fc = act.fcurve_ensure_for_datablock(idb, path, index=index)
    except Exception:
        try:
            fc = act.fcurves.new(path, index=index)
        except Exception:
            fc = None
    if fc is None:
        # Fallback: langsam, aber robust
        for f, v in enumerate(values):
            arr = getattr(idb, path)
            arr[index] = v
            idb.keyframe_insert(path, index=index, frame=frame0 + f)
        return
    n = len(values)
    fc.keyframe_points.add(n)
    co = []
    for f, v in enumerate(values):
        co += [frame0 + f, v]
    fc.keyframe_points.foreach_set("co", co)
    fc.keyframe_points.foreach_set("interpolation", [1] * n)   # LINEAR
    fc.update()


def build_lanterns(sc, coll, kit, rnd):
    F = LOOP_FRAMES
    nframes = F + 1
    VH = 10.125 / 50.0     # halbe sichtbare Hoehe pro Meter Tiefe
    VW = 18.0 / 50.0       # halbe sichtbare Breite pro Meter Tiefe
    # (x relativ zur halben Bildbreite, Tiefe, Laternen pro Strom, Skala, Helligkeit)
    streams = [
        # nah (unscharf, gross) - nur an den Raendern
        (-0.86, 3.6, 1, 1.00, 1.00),
        (0.92, 4.4, 1, 1.05, 1.00),
        (0.66, 5.6, 1, 0.95, 0.95),
        # Mitte (Fokus ~9 m) - linkes/rechtes Drittel
        (-0.78, 8.6, 2, 1.00, 1.00),
        (-0.50, 10.4, 2, 0.95, 0.95),
        (-0.93, 11.5, 2, 1.05, 0.95),
        (0.55, 9.2, 2, 1.00, 1.00),
        (0.80, 11.0, 2, 1.00, 0.95),
        # fern (klein, weich)
        (-0.62, 19.0, 2, 1.10, 0.80),
        (-0.40, 26.0, 2, 1.10, 0.70),
        (0.42, 22.0, 2, 1.10, 0.75),
        (0.70, 30.0, 2, 1.15, 0.65),
    ]
    count = 0
    for si, (xn, y0, n, scl, bright) in enumerate(streams):
        margin = 1.6 * scl + (0.25 * y0 if y0 < 6 else 0.6)
        H = 2 * (VH * y0 + margin)
        x0 = xn * VW * y0
        p0 = rnd.uniform(0, H)
        ph = [rnd.uniform(0, 2 * math.pi) for _ in range(8)]
        msw = rnd.choice([3, 4, 5]) * n          # Pendelzyklen pro Umlauf H
        mspin = rnd.choice([-1, 1])
        ax = 0.06 * VW * y0
        for j in range(n):
            root, piv = kit.spawn(coll, f"Lantern_{si:02d}_{j}")
            root.scale = (scl, scl, scl)
            locx, locy, locz, rx, ry, rz, prx, pry, col = ([] for _ in range(9))
            for f in range(nframes):
                t = f / F
                p = (p0 + j * H / n + (H / n) * t) % H
                q = 2 * math.pi * p / H                     # Bahnphase 0..2pi
                locx.append(x0 + ax * math.sin(q + ph[0]) + 0.4 * ax * math.sin(3 * q + ph[1]))
                locy.append(y0 + 0.04 * y0 * math.sin(2 * q + ph[2]))
                locz.append(-H / 2 + p)
                sw = math.radians(7) * math.sin(msw * q + ph[3])
                sw2 = math.radians(4) * math.sin((msw + 1) * q + ph[4])
                rx.append(sw2)
                ry.append(sw)
                rz.append(mspin * q + ph[5])
                # Quaste schwingt verzoegert nach
                prx.append(-1.2 * math.radians(4) * math.sin((msw + 1) * q + ph[4] - 0.9))
                pry.append(-1.2 * math.radians(7) * math.sin(msw * q + ph[3] - 0.9))
                fl = 1.0 + 0.05 * math.sin(23 * q + ph[6]) + 0.035 * math.sin(41 * q + ph[7])
                col.append(bright * fl)
            for idx, vals in enumerate((locx, locy, locz)):
                set_keys(root, "location", idx, vals)
            for idx, vals in enumerate((rx, ry, rz)):
                set_keys(root, "rotation_euler", idx, vals)
            set_keys(piv, "rotation_euler", 0, prx)
            set_keys(piv, "rotation_euler", 1, pry)
            # Flackern ueber Objektfarbe (Object Info -> Color) der Laternenkoerper
            for ch in root.children:
                if ch.data is kit.body:
                    set_keys(ch, "color", 0, col)
            count += 1
    return count


def build_dust(sc, coll, rnd, n_streams=26):
    F = LOOP_FRAMES
    nframes = F + 1
    VH = 10.125 / 50.0
    VW = 18.0 / 50.0
    bm_me = bpy.data.meshes.new("Dust")
    # kleine Ikosphaere
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    bm.to_mesh(bm_me)
    bm.free()
    for p in bm_me.polygons:
        p.use_smooth = True
    bm_me.materials.append(mat_dust())
    n_per = 3
    for s in range(n_streams):
        y0 = rnd.uniform(7.0, 14.0)
        # Mitte meiden: x bevorzugt in den aeusseren Bereichen
        side = rnd.choice([-1, 1])
        xn = side * (rnd.uniform(0.25, 1.0) ** 0.7)
        x0 = xn * VW * y0
        H = 2 * (VH * y0 + 0.5)
        p0 = rnd.uniform(0, H)
        ph = [rnd.uniform(0, 2 * math.pi) for _ in range(4)]
        k1, k2 = rnd.choice([1, 2, 3]), rnd.choice([2, 3, 4, 5])
        a = rnd.uniform(0.1, 0.35) * VW * y0 * 0.25
        size = rnd.uniform(0.004, 0.009)
        bright = rnd.uniform(0.3, 1.0)
        for j in range(n_per):
            o = bpy.data.objects.new(f"Dust_{s:02d}_{j}", bm_me)
            coll.objects.link(o)
            o.scale = (size, size, size)
            o.visible_shadow = False
            lx, ly, lz, cc = [], [], [], []
            for f in range(nframes):
                t = f / F
                p = (p0 + j * H / n_per + (H / n_per) * t) % H
                q = 2 * math.pi * p / H
                lx.append(x0 + a * math.sin(k1 * q + ph[0]) + 0.5 * a * math.sin(k2 * q + ph[1]))
                ly.append(y0 + 0.3 * math.sin(k1 * q + ph[2]))
                lz.append(-H / 2 + p + 0.3 * a * math.sin(k2 * q + ph[3]))
                cc.append(bright * (0.75 + 0.25 * math.sin(9 * q + ph[0])))
            for idx, vals in enumerate((lx, ly, lz)):
                set_keys(o, "location", idx, vals)
            set_keys(o, "color", 0, cc)


def build_scene():
    sc = reset_scene()
    setup_render(sc)
    coll = sc.collection
    rnd = random.Random(SEED)
    setup_world(sc)
    setup_camera(sc, coll)
    kit = LanternKit()
    n = build_lanterns(sc, coll, kit, rnd)
    build_dust(sc, coll, rnd)
    setup_haze(sc, coll)
    setup_compositor(sc)
    print(f"[hero] {n} Laternen erzeugt")
    return sc


def render_frames(sc, frames):
    os.makedirs(FRAME_DIR, exist_ok=True)
    import time
    for f in frames:
        t0 = time.time()
        sc.frame_set(f)
        sc.render.filepath = os.path.join(FRAME_DIR, f"hero_{f:04d}.png")
        bpy.ops.render.render(write_still=True)
        print(f"[hero] frame {f} {time.time() - t0:.1f}s", flush=True)


def encode():
    ff = shutil.which("ffmpeg")
    if not ff:
        print("[hero] ffmpeg nicht gefunden - Encoding uebersprungen")
        return
    os.makedirs(RENDER_DIR, exist_ok=True)
    src = os.path.join(FRAME_DIR, "hero_%04d.png")
    common = [ff, "-y", "-framerate", str(FPS), "-start_number", "0", "-i", src,
              "-frames:v", str(LOOP_FRAMES), "-an"]
    subprocess.run(common + ["-c:v", "libx264", "-preset", "slow", "-crf", str(os.environ.get("AK_CRF", 24)),
                             "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-profile:v", "high",
                             "-tune", "film", OUT_MP4], check=True)
    subprocess.run(common + ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", str(os.environ.get("AK_VP9CRF", 38)),
                             "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-pix_fmt", "yuv420p",
                             OUT_WEBM], check=True)
    subprocess.run([ff, "-y", "-i", os.path.join(FRAME_DIR, "hero_0000.png"), "-q:v", "4", OUT_POSTER], check=True)


if __name__ == "__main__":
    sc = build_scene()
    if RENDER:
        frames = [int(x) for x in _FRAMES.split(",")] if _FRAMES else list(range(LOOP_FRAMES))
        render_frames(sc, frames)
        if ENCODE and not _FRAMES:
            encode()
