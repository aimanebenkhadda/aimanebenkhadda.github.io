"""Turn the project screenshots into 1-bit pictures for the AB-95's screen -> src/lcd/pics.js
usage: pics.py <site root> <out js>"""
import sys, base64, json
import numpy as np
from PIL import Image, ImageFilter

ROOT, OUT = sys.argv[1], sys.argv[2]
IDS = ['fraud6m-1', 'fraud6m-2', 'fraud-1', 'fraud-2', 'fraud-3', 'hr-1', 'hr-2', 'car-1', 'car-2', 'pharma-1', 'pharma-2']
W = 112

def dither(path):
    im = Image.open(path).convert('L')
    H = round(W * im.height / im.width)
    s = im.resize((W * 3, H * 3), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=150, threshold=0)).resize((W, H), Image.LANCZOS)
    l = np.asarray(s).astype(np.float32) / 255
    lo, hi = np.percentile(l, 1), np.percentile(l, 99.5)
    l = np.clip((l - lo) / max(hi - lo, 1e-3), 0, 1) ** 0.9
    out = np.zeros((H, W), dtype=np.uint8)
    for y in range(H):
        for x in range(W):
            o = l[y, x]; n = 0 if o < 0.5 else 1; e = (o - n) / 8; out[y, x] = 0 if n else 1
            for dx, dy in ((1, 0), (2, 0), (-1, 1), (0, 1), (1, 1), (0, 2)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < W and yy < H:
                    l[yy, xx] += e
    return out

pics = {}
for i in IDS:
    bits = dither(f'{ROOT}/app/img/{i}.webp')
    packed = np.packbits(bits, axis=1)
    pics[i] = {'w': W, 'h': bits.shape[0], 'b': base64.b64encode(packed.tobytes()).decode()}
with open(OUT, 'w') as f:
    f.write('// 1-bit pictures of the project screenshots (made by tools/pics.py from app/img/*.webp)\n')
    f.write('export const PICS = ' + json.dumps(pics, separators=(',', ':')) + ';\n')
print(len(pics), 'pictures')
