"""Builds the phone-version scene: an old writing desk in a clean cream void, with an
original candy-bar phone standing in its charging dock. Saves scene.blend."""
import math, sys, os
sys.path.insert(0, os.path.dirname(__file__))
import bpy, bmesh
from mathutils import Vector, Matrix, Euler
from lib import *

reset()
scn = bpy.context.scene
C_ROOM = collection('room')      # floor + rug + desk furniture
C_PROPS = collection('props')    # things on the desk
C_PHONE = collection('phone')    # phone + dock
C_LIGHT = collection('lights')

DESK_Z = 0.76

# ------------------------------------------------------------------ materials
M = {}
M['floor'] = principled('floor', (0.80, 0.74, 0.66), 0.95)
M['wood_top'] = wood('wood_top', (0.085, 0.036, 0.016), (0.20, 0.095, 0.042), 'X', 3.2, 0.36, seed=0.3)
M['wood_x'] = wood('wood_x', (0.08, 0.034, 0.015), (0.18, 0.085, 0.038), 'X', 4.0, 0.45, seed=1.1)
M['wood_y'] = wood('wood_y', (0.08, 0.034, 0.015), (0.18, 0.085, 0.038), 'Y', 4.0, 0.45, seed=2.3)
M['wood_z'] = wood('wood_z', (0.08, 0.034, 0.015), (0.18, 0.085, 0.038), 'Z', 4.0, 0.45, seed=3.7)
M['brass'] = principled('brass', (0.80, 0.60, 0.32), 0.30, metal=1.0)
M['brass_dark'] = principled('brass_dark', (0.55, 0.40, 0.20), 0.38, metal=1.0)
M['leather_g'] = bumpy(principled('leather_g', (0.018, 0.055, 0.032), 0.55), 900, 0.10)
M['leather_b'] = bumpy(principled('leather_b', (0.07, 0.03, 0.014), 0.5), 900, 0.10)
M['shade_out'] = principled('shade_out', (0.03, 0.30, 0.13), 0.08, coat=1.0,
                            emit=(0.10, 0.55, 0.22), emit_str=0.35)
M['shade_in'] = principled('shade_in', (1.0, 0.95, 0.85), 0.4, emit=(1.0, 0.86, 0.62), emit_str=4.0)
M['bulb'] = principled('bulb', (1, 1, 1), 0.3, emit=(1.0, 0.84, 0.6), emit_str=30.0)
M['mug'] = principled('mug', (0.90, 0.86, 0.77), 0.18, coat=0.4)
M['mug_band'] = principled('mug_band', (0.07, 0.13, 0.27), 0.2, coat=0.4)
M['coffee'] = principled('coffee', (0.09, 0.045, 0.02), 0.08)
M['paper_y'] = principled('paper_y', (0.97, 0.90, 0.56), 0.85)
M['paper_w'] = principled('paper_w', (0.93, 0.91, 0.86), 0.85)
M['pad_band'] = principled('pad_band', (0.42, 0.08, 0.07), 0.6)
M['pencil'] = principled('pencil', (0.95, 0.68, 0.10), 0.3, coat=0.5)
M['wood_raw'] = principled('wood_raw', (0.82, 0.62, 0.42), 0.8)
M['graphite'] = principled('graphite', (0.08, 0.08, 0.09), 0.4, metal=0.3)
M['eraser'] = principled('eraser', (0.90, 0.48, 0.50), 0.8)
M['ferrule'] = principled('ferrule', (0.75, 0.75, 0.72), 0.3, metal=1.0)
M['terracotta'] = bumpy(principled('terracotta', (0.66, 0.33, 0.20), 0.9), 400, 0.15)
M['soil'] = bumpy(principled('soil', (0.12, 0.085, 0.06), 1.0), 300, 0.4)
M['leaf'] = principled('leaf', (0.42, 0.58, 0.52), 0.45, coat=0.2)
M['book_r'] = bumpy(principled('book_r', (0.33, 0.07, 0.06), 0.6), 600, 0.08)
M['book_n'] = bumpy(principled('book_n', (0.06, 0.10, 0.20), 0.6), 600, 0.08)
M['book_o'] = bumpy(principled('book_o', (0.30, 0.31, 0.15), 0.6), 600, 0.08)
M['pages'] = principled('pages', (0.90, 0.85, 0.74), 0.9)
M['gold'] = principled('gold', (0.85, 0.66, 0.30), 0.35, metal=1.0)
M['clock_body'] = principled('clock_body', (0.62, 0.12, 0.10), 0.25, coat=0.6)
M['clock_face'] = principled('clock_face', (0.95, 0.93, 0.88), 0.5)
M['ink'] = principled('ink', (0.04, 0.04, 0.05), 0.5)
M['chrome'] = principled('chrome', (0.85, 0.85, 0.85), 0.15, metal=1.0)
M['glass'] = principled('glass', (0.9, 0.9, 0.9), 0.05, spec=0.6)
# phone
M['shell'] = principled('shell', (0.012, 0.026, 0.075), 0.48, coat=0.08)
M['shell_dark'] = principled('shell_dark', (0.02, 0.025, 0.035), 0.5)
M['silver'] = principled('silver', (0.62, 0.64, 0.67), 0.32, metal=0.85)
M['bezel'] = principled('bezel', (0.012, 0.014, 0.018), 0.15, coat=0.6)
M['key'] = principled('key', (0.70, 0.72, 0.75), 0.40, metal=0.35, coat=0.3)
M['label'] = principled('label', (0.05, 0.07, 0.13), 0.5)
M['label_g'] = principled('label_g', (0.05, 0.42, 0.16), 0.5)
M['label_r'] = principled('label_r', (0.62, 0.06, 0.05), 0.5)
M['rubber'] = principled('rubber', (0.03, 0.035, 0.045), 0.7)
M['lcd'] = principled('LCD', (0.52, 0.66, 0.40), 0.3, emit=(0.55, 0.72, 0.42), emit_str=0.6)
M['led'] = principled('led', (0.2, 1.0, 0.3), 0.3, emit=(0.2, 1.0, 0.35), emit_str=8.0)
M['dock'] = principled('dock', (0.03, 0.032, 0.038), 0.45, coat=0.3)

# paper lines for the legal pad
def paper_lines(m, spacing=0.0072, margin_x=-0.042):
    p = m.node_tree.nodes['Principled BSDF']
    tc = node(m, 'ShaderNodeTexCoord', (-1200, 0))
    sep = node(m, 'ShaderNodeSeparateXYZ', (-1000, 0))
    lnk(m, tc.outputs['Object'], sep.inputs[0])
    # horizontal blue lines
    div = node(m, 'ShaderNodeMath', (-800, 100), operation='DIVIDE'); div.inputs[1].default_value = spacing
    lnk(m, sep.outputs['Y'], div.inputs[0])
    fr = node(m, 'ShaderNodeMath', (-650, 100), operation='FRACT'); lnk(m, div.outputs[0], fr.inputs[0])
    lt = node(m, 'ShaderNodeMath', (-500, 100), operation='LESS_THAN'); lt.inputs[1].default_value = 0.09
    lnk(m, fr.outputs[0], lt.inputs[0])
    # stop lines near the top band
    lt2 = node(m, 'ShaderNodeMath', (-500, 250), operation='LESS_THAN'); lt2.inputs[1].default_value = 0.085
    lnk(m, sep.outputs['Y'], lt2.inputs[0])
    gt2 = node(m, 'ShaderNodeMath', (-500, 400), operation='GREATER_THAN'); gt2.inputs[1].default_value = -0.105
    lnk(m, sep.outputs['Y'], gt2.inputs[0])
    a1 = node(m, 'ShaderNodeMath', (-350, 200), operation='MULTIPLY'); lnk(m, lt.outputs[0], a1.inputs[0]); lnk(m, lt2.outputs[0], a1.inputs[1])
    a2 = node(m, 'ShaderNodeMath', (-250, 200), operation='MULTIPLY'); lnk(m, a1.outputs[0], a2.inputs[0]); lnk(m, gt2.outputs[0], a2.inputs[1])
    # red margin
    sub = node(m, 'ShaderNodeMath', (-800, -150), operation='SUBTRACT'); sub.inputs[1].default_value = margin_x
    lnk(m, sep.outputs['X'], sub.inputs[0])
    ab = node(m, 'ShaderNodeMath', (-650, -150), operation='ABSOLUTE'); lnk(m, sub.outputs[0], ab.inputs[0])
    lt3 = node(m, 'ShaderNodeMath', (-500, -150), operation='LESS_THAN'); lt3.inputs[1].default_value = 0.0005
    lnk(m, ab.outputs[0], lt3.inputs[0])
    m1 = node(m, 'ShaderNodeMix', (-150, 0)); m1.data_type = 'RGBA'
    m1.inputs[6].default_value = (0.97, 0.90, 0.56, 1)
    m1.inputs[7].default_value = (0.38, 0.55, 0.78, 1)
    lnk(m, a2.outputs[0], m1.inputs[0])
    m2 = node(m, 'ShaderNodeMix', (0, 0)); m2.data_type = 'RGBA'
    lnk(m, m1.outputs[2], m2.inputs[6])
    m2.inputs[7].default_value = (0.82, 0.25, 0.25, 1)
    lnk(m, lt3.outputs[0], m2.inputs[0])
    lnk(m, m2.outputs[2], p.inputs['Base Color'])

paper_lines(M['paper_y'])

# rug pattern: terracotta field, cream border with two thin stripes
def rug_mat():
    m = principled('rug', (0.36, 0.10, 0.06), 1.0)
    p = m.node_tree.nodes['Principled BSDF']
    tc = node(m, 'ShaderNodeTexCoord', (-1400, 0))
    sep = node(m, 'ShaderNodeSeparateXYZ', (-1200, 0)); lnk(m, tc.outputs['Generated'], sep.inputs[0])
    def edge_dist(axis, loc):
        s = node(m, 'ShaderNodeMath', loc, operation='SUBTRACT'); s.inputs[1].default_value = 0.5
        lnk(m, sep.outputs[axis], s.inputs[0])
        a = node(m, 'ShaderNodeMath', (loc[0] + 150, loc[1]), operation='ABSOLUTE'); lnk(m, s.outputs[0], a.inputs[0])
        r = node(m, 'ShaderNodeMath', (loc[0] + 300, loc[1]), operation='SUBTRACT'); r.inputs[0].default_value = 0.5
        lnk(m, a.outputs[0], r.inputs[1])
        return r
    dx = edge_dist('X', (-1000, 200)); dy = edge_dist('Y', (-1000, -200))
    # scale X distances by aspect so the border width is even (rug is 1.7 x 1.15)
    sx = node(m, 'ShaderNodeMath', (-550, 200), operation='MULTIPLY'); sx.inputs[1].default_value = 1.7
    lnk(m, dx.outputs[0], sx.inputs[0])
    sy = node(m, 'ShaderNodeMath', (-550, -200), operation='MULTIPLY'); sy.inputs[1].default_value = 1.15
    lnk(m, dy.outputs[0], sy.inputs[0])
    mn = node(m, 'ShaderNodeMath', (-400, 0), operation='MINIMUM'); lnk(m, sx.outputs[0], mn.inputs[0]); lnk(m, sy.outputs[0], mn.inputs[1])
    cr = ramp(m, [(0.0, (0.80, 0.70, 0.55)), (0.07, (0.80, 0.70, 0.55)), (0.0701, (0.12, 0.17, 0.26)),
                  (0.082, (0.12, 0.17, 0.26)), (0.0821, (0.36, 0.10, 0.06)), (0.13, (0.36, 0.10, 0.06)),
                  (0.1301, (0.80, 0.70, 0.55)), (0.138, (0.80, 0.70, 0.55)), (0.1381, (0.30, 0.075, 0.045))],
              (-200, 0), 'CONSTANT')
    lnk(m, mn.outputs[0], cr.inputs['Fac'])
    # woven texture
    n = node(m, 'ShaderNodeTexNoise', (-400, -400)); n.inputs['Scale'].default_value = 900; n.inputs['Detail'].default_value = 2
    lnk(m, tc.outputs['Object'], n.inputs['Vector'])
    mx = node(m, 'ShaderNodeMix', (50, 0)); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'
    mx.inputs[0].default_value = 0.25
    lnk(m, cr.outputs['Color'], mx.inputs[6]); lnk(m, n.outputs['Color'], mx.inputs[7])
    lnk(m, mx.outputs[2], p.inputs['Base Color'])
    b = node(m, 'ShaderNodeBump', (50, -300)); b.inputs['Strength'].default_value = 0.25
    lnk(m, n.outputs['Fac'], b.inputs['Height']); lnk(m, b.outputs['Normal'], p.inputs['Normal'])
    return m
M['rug'] = rug_mat()

# ------------------------------------------------------------------ room
floor = box('floor', (14, 14, 0.02), (0, 0, -0.01), mat=M['floor'], coll=C_ROOM)
rug = box('rug', (1.7, 1.15, 0.008), (0.0, 0.06, 0.004), mat=M['rug'], coll=C_ROOM, bev=0.003, seg=2)

desk_parts = []
top = box('desk_top', (1.0, 0.56, 0.032), (0, 0, DESK_Z - 0.016), mat=M['wood_top'], coll=C_ROOM, bev=0.007, seg=4)
desk_parts.append(top)
# apron
ap_z = DESK_Z - 0.032 - 0.055
desk_parts.append(box('apron_b', (0.90, 0.02, 0.11), (0, 0.235, ap_z), mat=M['wood_x'], coll=C_ROOM, bev=0.002))
desk_parts.append(box('apron_l', (0.02, 0.45, 0.11), (-0.44, 0, ap_z), mat=M['wood_y'], coll=C_ROOM, bev=0.002))
desk_parts.append(box('apron_r', (0.02, 0.45, 0.11), (0.44, 0, ap_z), mat=M['wood_y'], coll=C_ROOM, bev=0.002))
desk_parts.append(box('apron_f', (0.90, 0.02, 0.11), (0, -0.235, ap_z), mat=M['wood_x'], coll=C_ROOM, bev=0.002))
# drawers
for i, (x, w) in enumerate([(-0.315, 0.23), (0.0, 0.36), (0.315, 0.23)]):
    d = box(f'drawer{i}', (w, 0.014, 0.088), (x, -0.249, ap_z), mat=M['wood_x'], coll=C_ROOM, bev=0.004, seg=3)
    desk_parts.append(d)
    knobs = [x] if w < 0.3 else [x - 0.09, x + 0.09]
    for kx in knobs:
        st = cylinder(f'knobst{i}{kx}', 0.0035, 0.012, 16, (kx, -0.261, ap_z), (R(90), 0, 0), M['brass'], C_ROOM)
        kb = sphere(f'knob{i}{kx}', 0.011, (kx, -0.271, ap_z), (1, 0.75, 1), M['brass'], C_ROOM, 24, 12)
        desk_parts += [st, kb]
    if w > 0.3:
        esc = cylinder('escutcheon', 0.012, 0.002, 32, (x, -0.2565, ap_z), (R(90), 0, 0), M['brass'], C_ROOM)
        hole = box('keyhole', (0.003, 0.002, 0.008), (x, -0.258, ap_z - 0.001), mat=M['ink'], coll=C_ROOM)
        desk_parts += [esc, hole]
# tapered legs
for sx in (-1, 1):
    for sy in (-1, 1):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(0.048, 0.048, DESK_Z - 0.032), verts=bm.verts)
        for v in bm.verts:
            if v.co.z < 0:
                v.co.x *= 0.62; v.co.y *= 0.62
        leg = mesh_obj(f'leg{sx}{sy}', bm, C_ROOM, M['wood_z'])
        leg.location = (sx * 0.452, sy * 0.242, (DESK_Z - 0.032) / 2)
        bevel(leg, 0.003, 2)
        desk_parts.append(leg)
        # little brass feet caps
        cap = box(f'foot{sx}{sy}', (0.032, 0.032, 0.02), (sx * 0.452, sy * 0.242, 0.01), mat=M['brass_dark'], coll=C_ROOM, bev=0.002)
        desk_parts.append(cap)

# ------------------------------------------------------------------ props on the desk
Z = DESK_Z

# blotter: brown leather frame + green leather pad
blot = []
blot.append(box('blotter_frame', (0.50, 0.33, 0.004), (-0.02, -0.05, Z + 0.002), mat=M['leather_b'], coll=C_PROPS, bev=0.0015, seg=2))
blot.append(box('blotter_pad', (0.43, 0.29, 0.0042), (-0.02, -0.05, Z + 0.0023), mat=M['leather_g'], coll=C_PROPS, bev=0.001, seg=2))
for sx in (-1, 1):
    blot.append(box(f'blotter_side{sx}', (0.05, 0.33, 0.006), (-0.02 + sx * 0.225, -0.05, Z + 0.003), mat=M['leather_b'], coll=C_PROPS, bev=0.002, seg=3))

# --- banker's lamp
def bankers_lamp(x, y, rz):
    root = empty('lamp_root', (x, y, Z), (0, 0, rz), C_PROPS)
    parts = []
    base = lathe('lamp_base', [(0, 0), (0.072, 0), (0.075, 0.003), (0.074, 0.009), (0.066, 0.013),
                               (0.06, 0.016), (0.052, 0.022), (0.03, 0.026), (0.012, 0.028), (0, 0.028)], 64, M['brass'], C_PROPS)
    base.scale = (1.35, 1.0, 1.0)
    parts.append(base)
    stem = cylinder('lamp_stem', 0.0075, 0.29, 32, (0, 0, 0.028 + 0.145), mat=M['brass'], coll=C_PROPS)
    knuckle = sphere('lamp_knuckle', 0.013, (0, 0, 0.14), (1, 1, 0.8), M['brass'], C_PROPS)
    collar = cylinder('lamp_collar', 0.012, 0.012, 32, (0, 0, 0.04), mat=M['brass'], coll=C_PROPS)
    parts += [stem, knuckle, collar]
    # yoke holding the shade
    yoke = box('lamp_yoke', (0.17, 0.012, 0.008), (0, 0, 0.312), mat=M['brass'], coll=C_PROPS, bev=0.002)
    for sx in (-1, 1):
        parts.append(box(f'lamp_yarm{sx}', (0.006, 0.01, 0.03), (sx * 0.082, 0, 0.325), mat=M['brass'], coll=C_PROPS, bev=0.0015))
    parts.append(yoke)
    # shade: half ellipsoid, green cased glass, opal inside
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=32, radius=1.0)
    bmesh.ops.scale(bm, vec=(0.135, 0.078, 0.07), verts=bm.verts)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-5,
                           plane_co=(0, 0, -0.008), plane_no=(0, 0, 1), clear_inner=True)
    shade = mesh_obj('lamp_shade', bm, C_PROPS)
    shade.data.materials.append(M['shade_out'])
    shade.data.materials.append(M['shade_in'])
    sol = shade.modifiers.new('Solid', 'SOLIDIFY'); sol.thickness = 0.003; sol.offset = -1
    sol.material_offset = 1; sol.material_offset_rim = 0
    shade.location = (0, -0.012, 0.335)
    shade.rotation_euler = (R(-14), 0, 0)
    smooth(shade, 60)
    parts.append(shade)
    # brass end caps / finial on shade top
    fin = sphere('lamp_finial', 0.008, (0, -0.012, 0.335 + 0.072), (1, 1, 0.7), M['brass'], C_PROPS, 24, 12)
    parts.append(fin)
    # bulb (visible from below)
    bulb = sphere('lamp_bulb', 0.016, (0, -0.012, 0.345), (2.2, 1, 1), M['bulb'], C_PROPS, 24, 12)
    parts.append(bulb)
    # pull chain
    for i in range(9):
        parts.append(sphere(f'lamp_chain{i}', 0.0016, (0.06, -0.06, 0.32 - i * 0.0042), (1, 1, 1), M['brass'], C_PROPS, 8, 6))
    parts.append(box('lamp_pull', (0.004, 0.004, 0.014), (0.06, -0.06, 0.32 - 9 * 0.0042 - 0.006), mat=M['brass'], coll=C_PROPS, bev=0.001))
    for p in parts:
        p.parent = root
    for p in (base, stem, knuckle, collar, fin):
        smooth(p, 50)
    # light under the shade
    ld = bpy.data.lights.new('lamp_light', 'AREA')
    ld.shape = 'ELLIPSE'; ld.size = 0.2; ld.size_y = 0.1
    ld.energy = 9.0; ld.color = (1.0, 0.74, 0.46)
    lo = bpy.data.objects.new('lamp_light', ld); link(lo, C_LIGHT)
    lo.parent = root; lo.location = (0, -0.02, 0.322); lo.rotation_euler = (R(-14), 0, 0)
    pd = bpy.data.lights.new('lamp_glow', 'POINT'); pd.energy = 1.2; pd.shadow_soft_size = 0.02; pd.color = (1.0, 0.75, 0.48)
    po = bpy.data.objects.new('lamp_glow', pd); link(po, C_LIGHT); po.parent = root; po.location = (0, -0.012, 0.34)
    return root

lamp = bankers_lamp(-0.345, 0.14, R(26))

# --- mug
def mug(x, y, rz):
    root = empty('mug_root', (x, y, Z), (0, 0, rz), C_PROPS)
    body = lathe('mug_body', [(0, 0), (0.036, 0), (0.0395, 0.003), (0.041, 0.012), (0.0415, 0.088),
                               (0.0405, 0.093), (0.0375, 0.093), (0.0365, 0.088), (0.0362, 0.015), (0.03, 0.011), (0, 0.011)],
                 64, M['mug'], C_PROPS)
    band = lathe('mug_band', [(0.04165, 0.062), (0.04175, 0.0625), (0.04175, 0.0705), (0.04165, 0.071)], 64, M['mug_band'], C_PROPS)
    cof = cylinder('coffee', 0.0364, 0.002, 64, (0, 0, 0.074), mat=M['coffee'], coll=C_PROPS)
    cu = bpy.data.curves.new('handle', 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(2)
    pts = [((0.038, 0, 0.078), (0.05, 0, 0.082)), ((0.068, 0, 0.05), (0.068, 0, 0.068)), ((0.038, 0, 0.022), (0.05, 0, 0.018))]
    for bp, (co, hl) in zip(sp.bezier_points, pts):
        bp.co = co; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    cu.bevel_depth = 0.0058; cu.bevel_resolution = 4; cu.resolution_u = 16; cu.use_fill_caps = True
    h = bpy.data.objects.new('mug_handle', cu); link(h, C_PROPS)
    activate(h); bpy.ops.object.convert(target='MESH'); h = bpy.context.view_layer.objects.active
    h.scale = (1, 1.35, 1)
    h.data.materials.append(M['mug'])
    for p in (body, band, cof, h):
        p.parent = root
        smooth(p, 50)
    return root

mug(0.108, 0.112, R(-35))

# --- legal pad + pencil
def legal_pad(x, y, rz):
    root = empty('pad_root', (x, y, Z), (0, 0, rz), C_PROPS)
    w, l = 0.13, 0.20
    stack = box('pad_stack', (w, l, 0.008), (0, 0, 0.004), mat=M['paper_y'], coll=C_PROPS, bev=0.0008, seg=2)
    top = box('pad_top', (w - 0.001, l - 0.022, 0.0006), (0, -0.011, 0.0083), mat=M['paper_y'], coll=C_PROPS)
    bandb = box('pad_band', (w + 0.002, 0.024, 0.0105), (0, l / 2 - 0.011, 0.0052), mat=M['pad_band'], coll=C_PROPS, bev=0.0015, seg=3)
    # curled corner of the top sheet: tiny wedge
    for p in (stack, top, bandb):
        p.parent = root
    # pencil lying across the pad
    proot = empty('pencil_root', (0.0, -0.01, 0.0122), (0, R(90), R(32)), C_PROPS)
    proot.parent = root
    hexa = cylinder('pencil_body', 0.0042, 0.15, 6, (0, 0, 0), mat=M['pencil'], coll=C_PROPS)
    cone = cylinder('pencil_cone', 0.0042, 0.017, 24, (0, 0, -0.075 - 0.0085), mat=M['wood_raw'], coll=C_PROPS, r2=0.0012)
    cone.rotation_euler = (R(180), 0, 0)
    tip = cylinder('pencil_tip', 0.0012, 0.004, 16, (0, 0, -0.075 - 0.017 - 0.0015), mat=M['graphite'], coll=C_PROPS, r2=0.0002)
    tip.rotation_euler = (R(180), 0, 0)
    fer = cylinder('pencil_ferrule', 0.0044, 0.012, 24, (0, 0, 0.075 + 0.006), mat=M['ferrule'], coll=C_PROPS)
    era = cylinder('pencil_eraser', 0.0041, 0.009, 24, (0, 0, 0.075 + 0.012 + 0.0045), mat=M['eraser'], coll=C_PROPS)
    bevel(era, 0.0015, 3)
    for p in (hexa, cone, tip, fer, era):
        p.parent = proot
    bevel(hexa, 0.0006, 2)
    return root

legal_pad(0.155, -0.165, R(-12))

# --- succulent in terracotta pot
def plant(x, y):
    root = empty('plant_root', (x, y, Z), (0, 0, 0), C_PROPS)
    pot = lathe('pot', [(0, 0), (0.033, 0), (0.035, 0.003), (0.042, 0.062), (0.0475, 0.064), (0.0478, 0.08),
                        (0.0462, 0.082), (0.0435, 0.08), (0.0428, 0.07), (0.0, 0.07)], 64, M['terracotta'], C_PROPS)
    soil = cylinder('soil', 0.0425, 0.004, 48, (0, 0, 0.071), mat=M['soil'], coll=C_PROPS)
    pot.parent = soil.parent = root
    smooth(pot, 50)
    leaves = []
    rings = [(0.0, 3, 75, 0.010), (0.012, 6, 55, 0.014), (0.024, 9, 35, 0.017), (0.034, 12, 18, 0.018)]
    k = 0
    for ri, (rad, n, tilt, ln) in enumerate(rings):
        for i in range(n):
            a = 2 * math.pi * i / n + ri * 0.4
            lf = sphere(f'leaf{k}', 1.0, (0, 0, 0), (ln * 0.55, ln, ln * 0.28), M['leaf'], C_PROPS, 16, 10)
            # tip outward along local +Y; place so the base sits at radius `rad`
            mat_r = Euler((R(tilt), 0, a - math.pi / 2), 'ZXY')
            lf.rotation_mode = 'ZXY'
            lf.rotation_euler = (R(tilt), 0, a - math.pi / 2)
            off = Matrix.Rotation(a - math.pi / 2, 4, 'Z') @ Matrix.Rotation(R(tilt), 4, 'X') @ Vector((0, ln * 0.75, 0, 1))
            lf.location = (rad * math.cos(a) + off.x, rad * math.sin(a) + off.y, 0.078 + off.z * 0.6 + (0.006 if ri == 0 else 0))
            lf.parent = root
            smooth(lf, 80)
            k += 1
    return root

plant(0.32, 0.175)

# --- stack of old books
def books(x, y, rz):
    root = empty('books_root', (x, y, Z), (0, 0, rz), C_PROPS)
    zc = 0.0
    specs = [(0.175, 0.245, 0.034, 'book_r', 0.0), (0.162, 0.232, 0.028, 'book_n', R(-6)), (0.150, 0.215, 0.030, 'book_o', R(5))]
    for i, (w, l, t, mat, rr) in enumerate(specs):
        br = empty(f'book{i}', (0, 0, zc), (0, 0, rr), C_PROPS); br.parent = root
        cov = 0.0022
        parts = [box(f'b{i}_bot', (w, l, cov), (0, 0, cov / 2), mat=M[mat], coll=C_PROPS, bev=0.0008, seg=2),
                 box(f'b{i}_top', (w, l, cov), (0, 0, t - cov / 2), mat=M[mat], coll=C_PROPS, bev=0.0008, seg=2),
                 box(f'b{i}_spine', (0.004, l, t), (-w / 2 + 0.002, 0, t / 2), mat=M[mat], coll=C_PROPS, bev=0.0016, seg=3),
                 box(f'b{i}_pages', (w - 0.008, l - 0.006, t - 2 * cov), (0.001, 0, t / 2), mat=M['pages'], coll=C_PROPS)]
        for gz in (0.25, 0.75):
            parts.append(box(f'b{i}_gold{gz}', (0.0042, l * 0.98, 0.0016), (-w / 2 + 0.0015, 0, t * gz), mat=M['gold'], coll=C_PROPS))
        for p in parts:
            p.parent = br
        zc += t
    return root

books(-0.315, -0.12, R(10))

# --- twin-bell alarm clock (hands get set to the real time in the browser)
def alarm_clock(x, y, rz):
    root = empty('clock_root', (x, y, Z), (0, 0, rz), C_PROPS)
    R0 = 0.042
    cz = 0.012 + R0
    body = cylinder('clock_body', R0, 0.03, 64, (0, 0, cz), (R(90), 0, 0), M['clock_body'], C_PROPS)
    bevel(body, 0.006, 4, 30)
    rim = lathe('clock_rim', [(R0 - 0.0035, 0.0), (R0 + 0.001, 0.0005), (R0 + 0.0012, 0.0035), (R0 - 0.001, 0.0045), (R0 - 0.0045, 0.0042), (R0 - 0.0045, 0.0005), (R0 - 0.0035, 0.0)], 64, M['chrome'], C_PROPS)
    rim.location = (0, -0.0145, cz); rim.rotation_euler = (R(90), 0, 0)
    face = cylinder('clock_face', R0 - 0.004, 0.001, 64, (0, -0.0155, cz), (R(90), 0, 0), M['clock_face'], C_PROPS)
    parts = [body, rim, face]
    for i in range(12):
        a = 2 * math.pi * i / 12
        big = i % 3 == 0
        t = box(f'tick{i}', (0.0016 if big else 0.001, 0.0006, 0.006 if big else 0.0035), (0, 0, 0), mat=M['ink'], coll=C_PROPS)
        rr = R0 - 0.0105 if big else R0 - 0.0095
        t.location = (rr * math.sin(a), -0.0163, cz + rr * math.cos(a))
        t.rotation_euler = (0, a, 0)
        parts.append(t)
    # bells, hammer, feet, handle
    for sx in (-1, 1):
        bell = sphere(f'bell{sx}', 0.022, (0, 0, 0), (1, 1, 1), M['chrome'], C_PROPS, 32, 16)
        bm = bmesh.new(); bm.from_mesh(bell.data)
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0), plane_no=(0, 0, 1), clear_inner=True)
        bm.to_mesh(bell.data); bm.free()
        sol = bell.modifiers.new('S', 'SOLIDIFY'); sol.thickness = 0.0015
        ang = R(40)
        rr = R0 + 0.011
        bell.location = (sx * math.sin(ang) * rr, 0.002, cz + math.cos(ang) * rr)
        bell.rotation_euler = (0, sx * ang, 0)   # dome tilted outwards, open side towards the clock
        smooth(bell, 60)
        # stem from the clock body to the bell, and a little knob on top of the bell
        stem = cylinder(f'bellstem{sx}', 0.0018, rr - R0 + 0.006, 12, (0, 0, 0), (0, sx * ang, 0), M['chrome'], C_PROPS)
        stem.location = (sx * math.sin(ang) * (R0 + (rr - R0) / 2 - 0.002), 0.002, cz + math.cos(ang) * (R0 + (rr - R0) / 2 - 0.002))
        knob = sphere(f'bellknob{sx}', 0.0032, (sx * math.sin(ang) * (rr + 0.0225), 0.002, cz + math.cos(ang) * (rr + 0.0225)), (1, 1, 1), M['chrome'], C_PROPS, 16, 8)
        parts += [stem, knob]
        foot = sphere(f'cfoot{sx}', 0.007, (sx * 0.026, 0.0, 0.009), (1, 1, 1), M['chrome'], C_PROPS, 16, 10)
        leg = cylinder(f'cleg{sx}', 0.0022, 0.016, 12, (sx * 0.024, 0.0, 0.016), (0, sx * R(20), 0), M['chrome'], C_PROPS)
        parts += [bell, foot, leg]
    post = cylinder('clock_post', 0.0025, 0.016, 12, (0, 0.002, cz + R0 + 0.006), mat=M['chrome'], coll=C_PROPS)
    hammer = box('clock_hammer', (0.008, 0.004, 0.004), (0, 0.002, cz + R0 + 0.015), mat=M['chrome'], coll=C_PROPS, bev=0.001)
    parts += [post, hammer]
    for p in parts:
        p.parent = root
    for p in (rim, face):
        smooth(p, 50)
    # hands (pivot at the clock centre, pointing up = 12 o'clock)
    hroot = empty('clock_hands', (0, -0.0172, cz), (0, 0, 0), C_PROPS); hroot.parent = root
    def hand(name, size, off, mat):
        h = box(name, size, (0, 0, 0), mat=mat, coll=C_PROPS)
        for v in h.data.vertices:
            v.co += Vector(off)
        return h
    hh = hand('clock_hour', (0.0028, 0.0006, 0.022), (0, 0, 0.007), M['ink'])
    mh = hand('clock_min', (0.0018, 0.0006, 0.032), (0, -0.0007, 0.012), M['ink'])
    sh = hand('clock_sec', (0.0007, 0.0004, 0.036), (0, -0.0013, 0.010), M['label_r'])
    cap = cylinder('clock_cap', 0.0022, 0.0016, 16, (0, -0.0017, 0), (R(90), 0, 0), M['chrome'], C_PROPS)
    # shift the geometry so each hand's origin is the pivot
    for hnd in (hh, mh, sh):
        hnd.parent = hroot
    cap.parent = hroot
    return root

alarm_clock(-0.125, 0.205, R(-14))

# ------------------------------------------------------------------ phone (original design, "AB-95")
PH_W, PH_H, PH_D = 0.060, 0.144, 0.021
FY = -PH_D / 2  # front surface y

def phone():
    root = empty('phone_root', (0, 0, 0), (0, 0, 0), C_PHONE)
    parts = []
    body = rounded_slab('phone_body', PH_W, PH_H, PH_D, 0.011, 10, M['shell'], C_PHONE, axis='Y')
    bevel(body, 0.0042, 5, 50)
    parts.append(body)
    def front(name, w, h, r, x, z, depth, mat, seg=6, edge=None):
        ob = rounded_slab(name, w, h, depth, r, seg, mat, C_PHONE, axis='Y')
        ob.location = (x, FY - depth / 2 + 0.0002, z)
        if edge:
            bevel(ob, edge, 3, 50)
        return ob
    # earpiece grille + brand
    parts.append(front('earpiece', 0.014, 0.0022, 0.0011, 0, 0.064, 0.0008, M['shell_dark']))
    brand = text_mesh('brand', 'AÏMANE', 0.0038, M['silver'], C_PHONE, spacing=1.25)
    brand.rotation_euler = (R(90), 0, 0); brand.location = (0, FY - 0.00025, 0.0565)
    parts.append(brand)
    # screen: silver ring, black glass, LCD
    parts.append(front('lens_ring', 0.0515, 0.0645, 0.0055, 0, 0.0235, 0.0010, M['silver'], edge=0.0004))
    parts.append(front('lens_black', 0.0485, 0.0615, 0.0042, 0, 0.0235, 0.0014, M['bezel']))
    lcd_w, lcd_h = 0.0424, 0.0530
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    bmesh.ops.scale(bm, vec=(lcd_w, lcd_h, 1), verts=bm.verts)
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(R(90), 3, 'X'), verts=bm.verts)
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for lp in f.loops:
            co = lp.vert.co
            lp[uv].uv = (co.x / lcd_w + 0.5, co.z / lcd_h + 0.5)
    lcd = mesh_obj('LCD', bm, C_PHONE, M['lcd'])
    lcd.location = (0, FY - 0.0014 - 0.00005, 0.0240)
    for p in lcd.data.polygons:
        p.use_smooth = False
    # keys
    keys = {}
    def key(name, w, h, x, z, r=None, mat=M['key'], depth=0.0026):
        ob = rounded_slab('key_' + name, w, h, depth, r if r is not None else min(w, h) * 0.45, 8, mat, C_PHONE, axis='Y')
        ob.location = (x, FY - depth / 2 + 0.0004, z)
        bevel(ob, 0.0007, 3, 50)
        keys[name] = ob
        return ob
    def label(k, txt, size, dx=0.0, dz=0.0, mat=M['label']):
        t = text_mesh('lbl_' + k.name, txt, size, mat, C_PHONE)
        t.rotation_euler = (R(90), 0, 0)
        t.location = (k.location.x + dx, FY - 0.0026 + 0.0004 - 0.00012, k.location.z + dz)
        return t
    labels = []
    # softkeys / call / end
    sk_w, sk_h = 0.0135, 0.0058
    key('soft_l', sk_w, sk_h, -0.0190, -0.0105)
    key('soft_r', sk_w, sk_h, 0.0190, -0.0105)
    key('call', sk_w, sk_h, -0.0190, -0.0235)
    key('end', sk_w, sk_h, 0.0190, -0.0235)
    labels.append(box('lbl_soft_l', (0.006, 0.0002, 0.0008), (-0.0190, FY - 0.0023, -0.0105), mat=M['label'], coll=C_PHONE))
    labels.append(box('lbl_soft_r', (0.006, 0.0002, 0.0008), (0.0190, FY - 0.0023, -0.0105), mat=M['label'], coll=C_PHONE))
    labels.append(box('lbl_call', (0.0065, 0.0002, 0.0016), (-0.0190, FY - 0.0023, -0.0235), mat=M['label_g'], coll=C_PHONE, bev=0.0005))
    labels.append(box('lbl_end', (0.0065, 0.0002, 0.0016), (0.0190, FY - 0.0023, -0.0235), mat=M['label_r'], coll=C_PHONE, bev=0.0005))
    # 4-way pad as four ring sectors + OK button
    pad_c = (0.0, -0.0170)
    pad_base = cylinder('pad_base', 0.0108, 0.0010, 64, (pad_c[0], FY - 0.0003, pad_c[1]), (R(90), 0, 0), M['shell_dark'], C_PHONE)
    parts.append(pad_base)
    for nm, ang in (('up', 90), ('left', 180), ('down', 270), ('right', 0)):
        bm = bmesh.new()
        r1, r2, n = 0.0051, 0.0098, 16
        a0, a1 = R(ang - 43), R(ang + 43)
        outer = [bm.verts.new((r2 * math.cos(a0 + (a1 - a0) * i / n), r2 * math.sin(a0 + (a1 - a0) * i / n), 0)) for i in range(n + 1)]
        inner = [bm.verts.new((r1 * math.cos(a1 - (a1 - a0) * i / n), r1 * math.sin(a1 - (a1 - a0) * i / n), 0)) for i in range(n + 1)]
        f = bm.faces.new(outer + inner)
        ext = bmesh.ops.extrude_face_region(bm, geom=[f])
        bmesh.ops.translate(bm, vec=(0, 0, 0.0024), verts=[e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(R(90), 3, 'X'), verts=bm.verts)
        ob = mesh_obj('key_' + nm, bm, C_PHONE, M['silver'])
        ob.location = (pad_c[0], FY + 0.0004 - 0.0024 / 2 + 0.0012 - 0.0012, pad_c[1])
        # rotate(90 about X) maps z->-y so the slab sits from y=0 to y=-0.0024: shift so its back touches the shell
        ob.location = (pad_c[0], FY + 0.0004, pad_c[1])
        bevel(ob, 0.0005, 2, 50)
        keys[nm] = ob
        # arrow mark
        am = (r1 + r2) / 2
        tri = bmesh.new()
        ca, sa = math.cos(R(ang)), math.sin(R(ang))
        tipv = (am + 0.0016, 0.0); b1 = (am - 0.0011, 0.0014); b2 = (am - 0.0011, -0.0014)
        vs = [tri.verts.new((px * ca - py * sa, px * sa + py * ca, 0)) for px, py in (tipv, b1, b2)]
        tri.faces.new(vs)
        bmesh.ops.rotate(tri, cent=(0, 0, 0), matrix=Matrix.Rotation(R(90), 3, 'X'), verts=tri.verts)
        to = mesh_obj('lbl_' + nm, tri, C_PHONE, M['label'])
        to.location = (pad_c[0], FY + 0.0004 - 0.0024 - 0.00012, pad_c[1])
        labels.append(to)
    ok = cylinder('key_ok', 0.0040, 0.0030, 48, (pad_c[0], FY + 0.0004 - 0.0015, pad_c[1]), (R(90), 0, 0), M['key'], C_PHONE)
    bevel(ok, 0.0009, 3, 40)
    keys['ok'] = ok
    # number pad
    letters = {'1': '', '2': 'abc', '3': 'def', '4': 'ghi', '5': 'jkl', '6': 'mno', '7': 'pqrs', '8': 'tuv', '9': 'wxyz',
               '*': '', '0': '+', '#': ''}
    order = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']
    names = {'*': 'star', '#': 'hash'}
    for i, ch in enumerate(order):
        r, c = divmod(i, 3)
        x = (c - 1) * 0.0178
        z = -0.0368 - r * 0.0094
        k = key(names.get(ch, ch), 0.0158, 0.0072, x, z, r=0.0030)
        lt = letters[ch]
        if lt:
            labels.append(label(k, ch, 0.0050, dx=-0.0033, dz=-0.0001))
            labels.append(label(k, lt, 0.0026, dx=0.0030, dz=-0.0002))
        else:
            labels.append(label(k, ch, 0.0054 if ch not in '*#' else 0.0058, dz=-0.0002 if ch != '*' else -0.0012))
    # antenna stub + side keys + mic
    ant = cylinder('antenna', 0.0042, 0.011, 32, (0.0175, 0.003, PH_H / 2 + 0.0035), mat=M['rubber'], coll=C_PHONE)
    bevel(ant, 0.0025, 4, 30)
    parts.append(ant)
    parts.append(box('vol_key', (0.0016, 0.006, 0.016), (-PH_W / 2 - 0.0002, 0.0, 0.025), mat=M['rubber'], coll=C_PHONE, bev=0.0007))
    parts.append(box('pwr_key', (0.010, 0.006, 0.0016), (-0.008, 0.0, PH_H / 2 + 0.0001), mat=M['rubber'], coll=C_PHONE, bev=0.0007))
    parts.append(front('mic', 0.0022, 0.0022, 0.0011, 0, -0.0688, 0.0006, M['shell_dark']))
    for p in parts + labels + [lcd] + list(keys.values()):
        p.parent = root
    for p in parts:
        if p.name in ('phone_body',):
            smooth(p, 40)
    return root, keys, lcd

phone_root, KEYS, LCD = phone()

# --- charging dock
def dock(x, y, rz, tilt):
    root = empty('dock_root', (x, y, Z), (0, 0, rz), C_PHONE)
    base = rounded_slab('dock_base', 0.084, 0.07, 0.022, 0.016, 10, M['dock'], C_PHONE)
    base.location = (0, 0.004, 0.011)
    bevel(base, 0.006, 5, 50)
    back = rounded_slab('dock_back', 0.07, 0.07, 0.012, 0.012, 10, M['dock'], C_PHONE, axis='Y')
    back.location = (0, 0.0285, 0.045)
    back.rotation_euler = (tilt, 0, 0)
    bevel(back, 0.004, 4, 50)
    lip = box('dock_lip', (0.066, 0.006, 0.0045), (0, -0.013, 0.0242), mat=M['dock'], coll=C_PHONE, bev=0.002, seg=3)
    led = sphere('dock_led', 0.0022, (0.031, -0.024, 0.0205), (1, 1, 0.5), M['led'], C_PHONE, 16, 8)
    feet = []
    for p in (base, back, lip, led):
        p.parent = root
    return root

TILT = R(-16)
dock_root = dock(0.0, -0.045, R(-7), TILT)
# phone stands in the dock, bottom resting on the base
phone_root.parent = dock_root
up = Vector((0, -math.sin(-TILT) * -1, 0))
phone_root.rotation_euler = (TILT, 0, 0)
c = Matrix.Rotation(TILT, 3, 'X') @ Vector((0, 0, PH_H / 2))
phone_root.location = (0, 0.0045 + c.y, 0.020 + c.z)

# ------------------------------------------------------------------ lights + world
world = bpy.data.worlds.new('world'); scn.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.88, 0.83, 0.76, 1)
bg.inputs['Strength'].default_value = 0.45

def area(name, loc, target, size, energy, color=(1, 1, 1), shape='SQUARE'):
    ld = bpy.data.lights.new(name, 'AREA'); ld.size = size; ld.energy = energy; ld.color = color; ld.shape = shape
    ob = bpy.data.objects.new(name, ld); link(ob, C_LIGHT)
    ob.location = loc; look_at(ob, target)
    return ob

area('key', (-1.7, -2.1, 2.7), (0, 0, 0.75), 2.6, 520, (1.0, 0.96, 0.9))
area('rim', (1.9, 2.0, 2.2), (0, 0, 0.8), 1.6, 160, (0.85, 0.9, 1.0))
area('fill', (2.2, -1.6, 1.2), (0, 0, 0.7), 2.0, 90, (1.0, 0.95, 0.9))

# ------------------------------------------------------------------ cameras
def cam(name, loc, target, lens):
    cd = bpy.data.cameras.new(name); cd.lens = lens; cd.clip_start = 0.01
    ob = bpy.data.objects.new(name, cd); link(ob)
    ob.location = loc; look_at(ob, target)
    return ob

cam('cam_wide', (-1.45, -2.45, 1.85), (0.0, 0.0, 0.52), 50)
cam('cam_desk', (0.035, -0.44, 0.98), (0.0, 0.0, 0.855), 35)
cam('cam_props', (-0.05, -0.42, 1.0), (-0.08, 0.12, 0.84), 35)
# phone close-up along the screen normal
bpy.context.view_layer.update()
lw = LCD.matrix_world
centre = lw.translation.copy()
normal = (lw.to_3x3() @ Vector((0, -1, 0))).normalized()
cam('cam_phone', centre + normal * 0.30 + Vector((0, 0, -0.02)), centre + Vector((0, 0, -0.02)), 50)

scn.camera = bpy.data.objects['cam_desk']
out = os.path.join(os.path.dirname(__file__), 'scene.blend')
bpy.ops.wm.save_as_mainfile(filepath=out)
print('saved', out, len(bpy.data.objects), 'objects')
