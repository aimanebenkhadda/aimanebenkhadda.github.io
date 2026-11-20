"""Bake lighting into texture atlases and export a GLB for three.js.
usage: bake.py [--spp N] [--size N] [--only group,group]"""
import sys, os, time, re, math
sys.path.insert(0, os.path.dirname(__file__))
import bpy, bmesh
from mathutils import Vector
from lib import activate

args = sys.argv[1:]
def arg(name, default):
    return type(default)(args[args.index(name) + 1]) if name in args else default
SPP = arg('--spp', 160)
SIZE = arg('--size', 2048)
ONLY = arg('--only', '')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'scene.blend'))
scn = bpy.context.scene
scn.render.engine = 'CYCLES'
scn.cycles.device = 'CPU'
scn.cycles.samples = SPP
scn.cycles.max_bounces = 6
scn.cycles.diffuse_bounces = 4
scn.cycles.glossy_bounces = 3
scn.cycles.use_denoising = False
scn.render.bake.margin = 12
scn.render.bake.use_pass_direct = True
scn.render.bake.use_pass_indirect = True
scn.render.bake.use_pass_diffuse = True
scn.render.bake.use_pass_glossy = False
scn.render.bake.use_pass_transmission = True
scn.render.bake.use_pass_emit = True
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    p = m.node_tree.nodes.get('Principled BSDF')
    if not p:
        continue
    met = p.inputs['Metallic'].default_value
    if met > 0.0:
        c = p.inputs['Base Color'].default_value
        k = 0.78 if met > 0.5 else 0.92
        p.inputs['Base Color'].default_value = (c[0] * k, c[1] * k, c[2] * k, 1)
        p.inputs['Metallic'].default_value = 0.0
scn.render.bake.margin_type = 'EXTEND'
scn.view_settings.view_transform = 'AgX'
scn.view_settings.look = 'AgX - Punchy'
scn.view_settings.exposure = -0.6

# ---------------------------------------------------------------- 1. make every mesh final
meshes = [o for o in scn.objects if o.type == 'MESH']
dg = bpy.context.evaluated_depsgraph_get()
for o in meshes:
    if o.modifiers:
        ev = o.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev)
        o.modifiers.clear()
        o.data = me
# bake object scale into the meshes so UV islands get sizes that match the real surfaces
for o in scn.objects:
    if o.type == 'MESH' and any(abs(s - 1) > 1e-6 for s in o.scale):
        activate(o)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True, properties=False)

# delete faces nobody can ever see (bottoms resting on things, the phone's back in the dock)
def prune(o, test):
    bm = bmesh.new(); bm.from_mesh(o.data)
    mw = o.matrix_world; n3 = mw.to_3x3().inverted().transposed()
    zs = [(mw @ v.co).z for v in bm.verts]
    zmin = min(zs) if zs else 0
    dead = [f for f in bm.faces if test(f, (n3 @ f.normal).normalized(), mw @ f.calc_center_median(), zmin)]
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    bm.to_mesh(o.data); bm.free()
    return len(dead)
bottom = lambda f, n, c, zmin: n.z < -0.95 and c.z < zmin + 0.0025
removed = 0
for o in scn.objects:
    if o.type == 'MESH' and o.name not in ('floor', 'LCD') and not o.name.startswith('lamp_shade'):
        removed += prune(o, bottom)
pb = bpy.data.objects['phone_body']
back = (pb.matrix_world.to_3x3() @ Vector((0, 1, 0))).normalized()
for o in scn.objects:
    if o.type == 'MESH' and o.name != 'LCD' and any(c.name == 'phone' for c in o.users_collection) and not o.name.startswith('dock_') and o.name != 'antenna':
        removed += prune(o, lambda f, n, c, zmin: n.dot(back) > 0.9)
print('pruned faces', removed)

# replace the floor box by a 5 m plane with a simple top-down UV
fl = bpy.data.objects['floor']
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=2.5)
uv = bm.loops.layers.uv.new('UVMap')
for f in bm.faces:
    for lp in f.loops:
        lp[uv].uv = (lp.vert.co.x / 5 + 0.5, lp.vert.co.y / 5 + 0.5)
bm.to_mesh(fl.data); bm.free()
fl.location = (0, 0, 0)

# join key labels into their keys so they move together
objs = {o.name: o for o in scn.objects}
for o in list(scn.objects):
    if o.name.startswith('lbl_'):
        kid = re.sub(r'\.\d+$', '', o.name[4:])
        kid = kid[4:] if kid.startswith('key_') else kid
        key = objs.get('key_' + kid)
        if key:
            activate(key); o.select_set(True)
            bpy.ops.object.join()

# ---------------------------------------------------------------- 2. groups
def in_coll(o, name):
    return any(c.name == name for c in o.users_collection)

def descendants_meshes(coll):
    return [o for o in scn.objects if o.type == 'MESH' and in_coll(o, coll)]

groups = {
    'floor': [bpy.data.objects['floor']],
    'room': [o for o in descendants_meshes('room') if o.name != 'floor'],
    'props': descendants_meshes('props') + [o for o in descendants_meshes('phone') if o.name.startswith('dock_')],
    'phone': [o for o in descendants_meshes('phone') if o.name != 'LCD' and not o.name.startswith('dock_')],
}
sizes = {'floor': 1024, 'room': SIZE, 'props': SIZE, 'phone': SIZE}

WEIGHT = {'rug': 0.45, 'blotter_frame': 0.7, 'blotter_pad': 0.7, 'mug_body': 1.7, 'mug_band': 1.7, 'mug_handle': 1.5, 'coffee': 1.3,
          'clock_body': 1.5, 'clock_face': 1.6, 'clock_rim': 1.4, 'pencil_body': 1.6, 'pad_stack': 1.2, 'pad_top': 1.3, 'pad_band': 1.3,
          'dock_base': 1.3, 'dock_back': 1.2, 'dock_lip': 1.3}

def unwrap(obs, margin):
    for o in scn.objects:
        o.select_set(False)
    for o in obs:
        o.select_set(True)
        # drop old uv layers, start clean
        while o.data.uv_layers:
            o.data.uv_layers.remove(o.data.uv_layers[0])
        o.data.uv_layers.new(name='UVMap')
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=margin, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in obs:
        f = WEIGHT.get(o.name)
        if f:
            for d in o.data.uv_layers.active.data:
                d.uv = d.uv * f
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    scn.tool_settings.use_uv_select_sync = True
    bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', rotate=True, margin_method='FRACTION', margin=margin, shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')

def set_target(obs, img):
    mats = set()
    for o in obs:
        for s in o.material_slots:
            if s.material:
                mats.add(s.material)
    for m in mats:
        nt = m.node_tree
        n = nt.nodes.get('BAKE_TARGET')
        if not n:
            n = nt.nodes.new('ShaderNodeTexImage'); n.name = 'BAKE_TARGET'; n.location = (600, 600)
        n.image = img
        for x in nt.nodes:
            x.select = False
        n.select = True
        nt.nodes.active = n

def denoise(img):
    """Run OpenImageDenoise on a baked image through the compositor of a throwaway scene."""
    sc = bpy.data.scenes.new('dn')
    sc.render.resolution_x, sc.render.resolution_y = img.size
    sc.render.resolution_percentage = 100
    sc.use_nodes = True
    nt = sc.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    a = nt.nodes.new('CompositorNodeImage'); a.image = img
    d = nt.nodes.new('CompositorNodeDenoise'); d.use_hdr = True; d.prefilter = 'ACCURATE'
    c = nt.nodes.new('CompositorNodeComposite')
    v = nt.nodes.new('CompositorNodeViewer')
    nt.links.new(a.outputs['Image'], d.inputs['Image'])
    nt.links.new(d.outputs['Image'], c.inputs['Image'])
    nt.links.new(d.outputs['Image'], v.inputs['Image'])
    sc.render.image_settings.file_format = 'OPEN_EXR'
    sc.render.image_settings.color_depth = '32'
    sc.view_settings.view_transform = 'Standard'
    tmp = os.path.join(OUT, '_dn.exr')
    sc.render.filepath = tmp
    sc.render.use_compositing = True
    sc.render.use_sequencer = False
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 1
    bpy.ops.render.render(write_still=True, scene=sc.name)
    res = bpy.data.images.load(tmp, check_existing=False)
    res.colorspace_settings.name = 'Linear Rec.709'
    px = list(res.pixels)
    img.pixels.foreach_set(px)
    img.update()
    bpy.data.images.remove(res)
    bpy.data.scenes.remove(sc)

def save_tonemapped(img, path):
    s = scn.render.image_settings
    s.file_format = 'PNG'; s.color_mode = 'RGB'; s.color_depth = '8'
    img.save_render(path, scene=scn)

order = ['phone', 'props', 'room', 'floor']
if ONLY:
    order = [g for g in order if g in ONLY.split(',')]

for g in ['phone', 'props', 'room']:
    unwrap(groups[g], 0.004 if g != 'room' else 0.003)
if '--nobake' in args:
    order = []
for g in order:
    obs = groups[g]
    t0 = time.time()
    sz = sizes[g] if g != 'floor' else 1024
    if '--size' in args and g != 'floor':
        sz = SIZE
    img = bpy.data.images.new('bake_' + g, sz, sz, float_buffer=True, alpha=False)
    img.colorspace_settings.name = 'Linear Rec.709'
    set_target(obs, img)
    for o in scn.objects:
        o.select_set(False)
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    scn.cycles.samples = SPP if g != 'floor' else max(64, SPP // 2)
    bpy.ops.object.bake(type='COMBINED', margin=12, use_clear=True)
    t1 = time.time()
    if g == 'floor':
        import numpy as np
        shad = np.array(img.pixels[:], dtype=np.float32).reshape(sz, sz, 4)
        hidden = [o for o in scn.objects if o.type == 'MESH' and o.name != 'floor']
        for o in hidden: o.hide_render = True
        bpy.ops.object.bake(type='COMBINED', margin=12, use_clear=True)
        for o in hidden: o.hide_render = False
        lit = np.array(img.pixels[:], dtype=np.float32).reshape(sz, sz, 4)
        lum = lambda a: a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722
        ratio = np.clip(lum(shad) / np.maximum(lum(lit), 1e-4), 0, 1)
        from PIL import Image as PI, ImageFilter
        im = PI.fromarray((np.sqrt(ratio) * 255 + 0.5).astype(np.uint8)[::-1])
        im = im.filter(ImageFilter.GaussianBlur(1.2))
        im.save(os.path.join(OUT, 'floor_ratio.png'))
        print(f'BAKED floor ratio in {time.time() - t0:.0f}s', flush=True)
        continue
    try:
        denoise(img)
    except Exception as e:
        print('DENOISE FAILED', e)
    save_tonemapped(img, os.path.join(OUT, f'{g}.png'))
    print(f'BAKED {g}: {len(obs)} objects, {sz}px, bake {t1 - t0:.0f}s, total {time.time() - t0:.0f}s', flush=True)

# ---------------------------------------------------------------- 3. export GLB
simple = {}
def simple_mat(name):
    if name not in simple:
        m = bpy.data.materials.new(name)
        simple[name] = m
    return simple[name]
for g, obs in groups.items():
    for o in obs:
        o.data.materials.clear()
        o.data.materials.append(simple_mat('baked_' + g))
lcd = bpy.data.objects['LCD']
lcd.data.materials.clear(); lcd.data.materials.append(simple_mat('lcd'))
for o in scn.objects:
    o.select_set(o.type in ('MESH', 'EMPTY'))
GLB = os.path.join(OUT, 'office_test.glb' if '--nobake' in args else 'office.glb')
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True,
                          export_yup=True, export_apply=True, export_texcoords=True, export_normals=False,
                          export_materials='EXPORT', export_cameras=False, export_lights=False,
                          export_extras=False, export_animations=False)
print('EXPORTED', GLB, os.path.getsize(GLB))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'baked.blend'))
