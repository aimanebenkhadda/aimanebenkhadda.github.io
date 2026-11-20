"""Small helpers for building the scene with bpy (Blender 4.2 as a Python module)."""
import math
import bpy
import bmesh
from mathutils import Vector, Matrix

R = math.radians


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def link(obj, coll=None):
    (coll or bpy.context.scene.collection).objects.link(obj)
    return obj


def collection(name):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def mesh_obj(name, bm, coll=None, mat=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    link(ob, coll)
    if mat:
        ob.data.materials.append(mat)
    return ob


def activate(ob):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)


def smooth(ob, angle=35):
    for p in ob.data.polygons:
        p.use_smooth = True
    mod = ob.modifiers.new("Smooth", 'SMOOTH_BY_ANGLE') if False else None
    # Blender 4.2: use the operator, it adds a geometry-nodes modifier we apply later
    activate(ob)
    bpy.ops.object.shade_smooth_by_angle(angle=R(angle))
    return ob


def flat(ob):
    for p in ob.data.polygons:
        p.use_smooth = False
    return ob


def bevel(ob, width, segments=3, angle=40, profile=0.5, clamp=True):
    m = ob.modifiers.new("Bevel", 'BEVEL')
    m.width = width
    m.segments = segments
    m.limit_method = 'ANGLE'
    m.angle_limit = R(angle)
    m.profile = profile
    m.use_clamp_overlap = clamp
    m.harden_normals = False
    return m


def apply_all(ob):
    activate(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)


def box(name, size, loc=(0, 0, 0), rot=(0, 0, 0), mat=None, coll=None, bev=None, seg=3):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    ob = mesh_obj(name, bm, coll, mat)
    ob.location = loc
    ob.rotation_euler = rot
    if bev:
        bevel(ob, bev, seg)
    return ob


def rounded_rect_bm(bm, w, h, r, seg=8, z=0.0):
    """Add a rounded-rectangle face (XY plane) to bm, return the face."""
    r = min(r, w / 2 - 1e-5, h / 2 - 1e-5)
    pts = []
    corners = [(w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90),
               (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)]
    for cx, cy, a0 in corners:
        for i in range(seg + 1):
            a = R(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a), z))
    vs = [bm.verts.new(p) for p in pts]
    return bm.faces.new(vs)


def rounded_slab(name, w, h, d, r, seg=8, mat=None, coll=None, edge=None, edge_seg=3, axis='Z'):
    """Rounded rectangle (w x h in XY) extruded by d along +Z, centred. axis='Y' turns it to face -Y."""
    bm = bmesh.new()
    f = rounded_rect_bm(bm, w, h, r, seg, -d / 2)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    vs = [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, d), verts=vs)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if axis == 'Y':
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(R(90), 3, 'X'), verts=bm.verts)
    ob = mesh_obj(name, bm, coll, mat)
    if edge:
        bevel(ob, edge, edge_seg, angle=50)
    return ob


def cylinder(name, r, depth, verts=48, loc=(0, 0, 0), rot=(0, 0, 0), mat=None, coll=None, r2=None, cap=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=verts,
                          radius1=r, radius2=r if r2 is None else r2, depth=depth)
    ob = mesh_obj(name, bm, coll, mat)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def lathe(name, profile, verts=64, mat=None, coll=None, loc=(0, 0, 0)):
    """profile: list of (radius, z) from bottom centre outward/up. Spun around Z."""
    bm = bmesh.new()
    prev = None
    edges = []
    vs = []
    for (rr, zz) in profile:
        v = bm.verts.new((rr, 0, zz))
        vs.append(v)
    for a, b in zip(vs[:-1], vs[1:]):
        edges.append(bm.edges.new((a, b)))
    bmesh.ops.spin(bm, geom=vs + edges, cent=(0, 0, 0), axis=(0, 0, 1),
                   angle=R(360), steps=verts, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_obj(name, bm, coll, mat)
    ob.location = loc
    return ob


def sphere(name, r, loc=(0, 0, 0), scale=(1, 1, 1), mat=None, coll=None, seg=32, rings=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    ob = mesh_obj(name, bm, coll, mat)
    ob.location = loc
    ob.scale = scale
    return ob


def text_mesh(name, body, size, mat=None, coll=None, depth=0.0, align='CENTER', valign='CENTER', bold=False, font=None, spacing=1.0):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.align_x = align
    cu.align_y = valign
    cu.extrude = depth
    cu.resolution_u = 3
    cu.space_character = spacing
    if font:
        cu.font = font
    ob = bpy.data.objects.new(name, cu)
    link(ob, coll)
    activate(ob)
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.view_layer.objects.active
    if mat:
        ob.data.materials.clear()
        ob.data.materials.append(mat)
    return ob


def join(obs, name=None):
    obs = [o for o in obs if o]
    activate(obs[0])
    for o in obs:
        o.select_set(True)
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    if name:
        ob.name = name
        ob.data.name = name
    return ob


def parent(child, par):
    mw = child.matrix_world.copy()
    child.parent = par
    child.matrix_world = mw


def empty(name, loc=(0, 0, 0), rot=(0, 0, 0), coll=None):
    e = bpy.data.objects.new(name, None)
    link(e, coll)
    e.location = loc
    e.rotation_euler = rot
    return e


def look_at(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


# ---------------------------------------------------------------- materials

def principled(name, color, rough=0.5, metal=0.0, coat=0.0, emit=None, emit_str=0.0, spec=0.5, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    p.inputs['Coat Weight'].default_value = coat
    p.inputs['Specular IOR Level'].default_value = spec
    if emit:
        p.inputs['Emission Color'].default_value = (*emit, 1)
        p.inputs['Emission Strength'].default_value = emit_str
    return m


def node(m, kind, loc=(0, 0), **kw):
    n = m.node_tree.nodes.new(kind)
    n.location = loc
    for k, v in kw.items():
        setattr(n, k, v)
    return n


def lnk(m, a, b):
    m.node_tree.links.new(a, b)


def ramp(m, stops, loc=(0, 0), interp='LINEAR'):
    r = node(m, 'ShaderNodeValToRGB', loc)
    cr = r.color_ramp
    cr.interpolation = interp
    while len(cr.elements) < len(stops):
        cr.elements.new(0.5)
    for el, (pos, col) in zip(cr.elements, stops):
        el.position = pos
        el.color = (*col, 1) if len(col) == 3 else col
    return r


def wood(name, dark, light, direction='X', scale=5.0, rough=0.42, stretch=14.0, seed=0.0):
    """Procedural wood: stretched noise rings + fine grain, along `direction`."""
    m = principled(name, light, rough)
    p = m.node_tree.nodes['Principled BSDF']
    tc = node(m, 'ShaderNodeTexCoord', (-1400, 0))
    mp = node(m, 'ShaderNodeMapping', (-1200, 0))
    sx = {'X': (1 / stretch, 1, 1), 'Y': (1, 1 / stretch, 1), 'Z': (1, 1, 1 / stretch)}[direction]
    mp.inputs['Scale'].default_value = (sx[0] * scale, sx[1] * scale, sx[2] * scale)
    mp.inputs['Location'].default_value = (seed, seed * 1.7, seed * 0.3)
    lnk(m, tc.outputs['Object'], mp.inputs['Vector'])
    n1 = node(m, 'ShaderNodeTexNoise', (-1000, 100))
    n1.inputs['Scale'].default_value = 1.6
    n1.inputs['Detail'].default_value = 3
    n1.inputs['Distortion'].default_value = 0.0
    lnk(m, mp.outputs['Vector'], n1.inputs['Vector'])
    # rings: fraction of noise*k
    mul = node(m, 'ShaderNodeMath', (-800, 100), operation='MULTIPLY')
    mul.inputs[1].default_value = 9.0
    lnk(m, n1.outputs['Fac'], mul.inputs[0])
    fr = node(m, 'ShaderNodeMath', (-650, 100), operation='FRACT')
    lnk(m, mul.outputs[0], fr.inputs[0])
    pw = node(m, 'ShaderNodeMath', (-500, 100), operation='POWER')
    pw.inputs[1].default_value = 3.0
    lnk(m, fr.outputs[0], pw.inputs[0])
    # fine grain
    mp2 = node(m, 'ShaderNodeMapping', (-1000, -200))
    mp2.inputs['Scale'].default_value = (sx[0] * scale * 30, sx[1] * scale * 30, sx[2] * scale * 30)
    lnk(m, tc.outputs['Object'], mp2.inputs['Vector'])
    n2 = node(m, 'ShaderNodeTexNoise', (-800, -200))
    n2.inputs['Scale'].default_value = 2.0
    n2.inputs['Detail'].default_value = 6
    lnk(m, mp2.outputs['Vector'], n2.inputs['Vector'])
    mix = node(m, 'ShaderNodeMath', (-350, 0), operation='MULTIPLY_ADD')
    mix.inputs[1].default_value = 0.75
    lnk(m, pw.outputs[0], mix.inputs[0])
    lnk(m, n2.outputs['Fac'], mix.inputs[2])
    sub = node(m, 'ShaderNodeMath', (-250, 0), operation='SUBTRACT')
    sub.inputs[1].default_value = 0.25
    lnk(m, mix.outputs[0], sub.inputs[0])
    cr = ramp(m, [(0.0, light), (0.55, dark)], (-150, 0))
    lnk(m, sub.outputs[0], cr.inputs['Fac'])
    lnk(m, cr.outputs['Color'], p.inputs['Base Color'])
    bump = node(m, 'ShaderNodeBump', (-150, -300))
    bump.inputs['Strength'].default_value = 0.08
    bump.inputs['Distance'].default_value = 0.002
    lnk(m, n2.outputs['Fac'], bump.inputs['Height'])
    lnk(m, bump.outputs['Normal'], p.inputs['Normal'])
    return m


def bumpy(m, scale=200.0, strength=0.06, detail=4):
    p = m.node_tree.nodes['Principled BSDF']
    tc = node(m, 'ShaderNodeTexCoord', (-900, -300))
    n = node(m, 'ShaderNodeTexNoise', (-700, -300))
    n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = detail
    lnk(m, tc.outputs['Object'], n.inputs['Vector'])
    b = node(m, 'ShaderNodeBump', (-400, -300))
    b.inputs['Strength'].default_value = strength
    lnk(m, n.outputs['Fac'], b.inputs['Height'])
    lnk(m, b.outputs['Normal'], p.inputs['Normal'])
    return m
