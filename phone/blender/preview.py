"""Render quick Cycles previews from the scene cameras: preview.py [cams...] [--res 360] [--spp 48]"""
import sys, os, time
import bpy
args = sys.argv[1:]
res = 360; spp = 48
cams = []
i = 0
while i < len(args):
    if args[i] == '--res': res = int(args[i + 1]); i += 2; continue
    if args[i] == '--spp': spp = int(args[i + 1]); i += 2; continue
    cams.append(args[i]); i += 1
here = os.path.dirname(__file__)
bpy.ops.wm.open_mainfile(filepath=os.path.join(here, 'scene.blend'))
scn = bpy.context.scene
scn.render.engine = 'CYCLES'
scn.cycles.device = 'CPU'
scn.cycles.samples = spp
scn.cycles.use_denoising = True
try:
    scn.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception as e:
    print('no OIDN', e)
scn.render.resolution_x = res
scn.render.resolution_y = int(res * 16 / 9)
scn.render.resolution_percentage = 100
scn.view_settings.view_transform = 'AgX'
scn.view_settings.look = 'AgX - Punchy'
scn.view_settings.exposure = -0.6
scn.cycles.max_bounces = 6
os.makedirs(os.path.join(here, 'prev'), exist_ok=True)
for c in cams or ['cam_wide', 'cam_desk', 'cam_phone', 'cam_props']:
    scn.camera = bpy.data.objects[c]
    t = time.time()
    scn.render.filepath = os.path.join(here, 'prev', c + '.png')
    bpy.ops.render.render(write_still=True)
    print(c, round(time.time() - t, 1), 's')
