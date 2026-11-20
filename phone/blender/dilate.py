"""Fill the empty texels of each baked atlas (push-pull) so smaller mip levels never pull in black.
usage: dilate.py office.glb out_dir"""
import json, struct, sys, os
import numpy as np
from PIL import Image, ImageDraw

glb, out = sys.argv[1], sys.argv[2]
d = open(glb, 'rb').read()
jl = struct.unpack('<I', d[12:16])[0]
js = json.loads(d[20:20 + jl])
bin_ = d[20 + jl + 8:]

def acc(i):
    a = js['accessors'][i]; bv = js['bufferViews'][a['bufferView']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
    dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}[a['componentType']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    arr = np.frombuffer(bin_[off:off + a['count'] * n * np.dtype(dt).itemsize], dtype=dt)
    return arr.reshape(-1, n) if n > 1 else arr

def push_pull(img, mask):
    levels = [(img * mask[..., None], mask.astype(np.float32))]
    while min(levels[-1][1].shape) > 1:
        c, w = levels[-1]
        h, ww = (c.shape[0] // 2) * 2, (c.shape[1] // 2) * 2
        c, w = c[:h, :ww], w[:h, :ww]
        cs = c.reshape(h // 2, 2, ww // 2, 2, 3).sum((1, 3))
        ws = w.reshape(h // 2, 2, ww // 2, 2).sum((1, 3))
        levels.append((cs, ws))
    # normalise every level, then fill holes from the coarser level
    norm = [(c / np.maximum(w, 1e-6)[..., None], w > 0) for c, w in levels]
    fill = norm[-1][0]
    for c, has in reversed(norm[:-1]):
        up = np.repeat(np.repeat(fill, 2, 0), 2, 1)
        up = np.pad(up, ((0, c.shape[0] - up.shape[0]), (0, c.shape[1] - up.shape[1]), (0, 0)), mode='edge')
        fill = np.where(has[..., None], c, up)
    return fill

for group in ('phone', 'props', 'room'):
    path = os.path.join(out, group + '.png')
    im = Image.open(path).convert('RGB')
    W, H = im.size
    m = Image.new('L', (W, H), 0)
    dr = ImageDraw.Draw(m)
    for mesh in js['meshes']:
        for p in mesh['primitives']:
            if js['materials'][p['material']]['name'] != 'baked_' + group:
                continue
            uv = acc(p['attributes']['TEXCOORD_0']) * [W, H]
            idx = acc(p['indices']).reshape(-1, 3)
            for t in idx:
                dr.polygon([tuple(uv[k]) for k in t], fill=255, outline=255)
    mask = np.asarray(m) > 0
    # keep a few pixels of the bake's own margin as real data
    for _ in range(3):
        mm = mask.copy()
        mm[1:] |= mask[:-1]; mm[:-1] |= mask[1:]; mm[:, 1:] |= mask[:, :-1]; mm[:, :-1] |= mask[:, 1:]
        mask = mm
    a = np.asarray(im).astype(np.float32)
    res = push_pull(a, mask)
    Image.fromarray(np.clip(res + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(out, group + '_filled.png'))
    print(group, 'covered', round(mask.mean() * 100, 1), '%')
