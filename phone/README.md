# AB-95 · the phone version

Phones that open the main site are sent here (`app/phone.js`). It is its own small world, separate from the computer version:

- **The room**: an old writing desk in a quiet cream room, with a banker's lamp, an alarm clock that shows the real time, a coffee mug, a legal pad, books, a plant and the AB-95 standing in its charging dock.
- **The phone**: the AB-95 is an original candy-bar phone designed for this site, with a monochrome LCD and a real keypad. Tap it to pick it up, then use the keys or the screen.
- **The software** (on the LCD): idle screen with the clock, a 3 × 3 menu, Profile, Projects (with small charts and pixel pictures of the dashboards; **Photos** opens the real screenshots in colour), Messages (experience and education, as SMS), Highlights, Snake, Contacts, CV and Settings (language, key tones, backlight colour). English and French.

## Files

| Path | What it is |
| --- | --- |
| `index.html`, `phone.css` | Page, start screen and the buttons around the 3D view |
| `app.js` | The built app (three.js + everything in `src/`) |
| `contact.json` | E-mail address and phone number shown in Contacts and used by Reply |
| `assets/office.glb` | The 3D model (meshopt-compressed) |
| `assets/*.webp` | Lighting baked in Blender for the phone, the props, the desk and the floor shadow |
| `src/` | App source: `main.js` (3D scene, camera, touch), `content.js` (all texts, EN/FR), `lcd/` (pixel font, screen, phone software, Snake) |
| `blender/` | Python scripts that model the scene and bake its lighting with Blender 4.2 |
| `tools/pics.py` | Turns the screenshots in `app/img/` into the 1-bit pictures in `src/lcd/pics.js` (run it again after changing a screenshot) |

## Change the texts

Edit `src/content.js` (or `contact.json` for the e-mail and phone number), then rebuild:

```bash
cd phone
npm install three@0.187.0 esbuild
npx esbuild src/main.js --bundle --minify --format=esm --target=es2019 --legal-comments=eof --outfile=app.js
```

Then bump `app.js?v=` in `index.html` so browsers load the new file.

## Rebuild the 3D scene

```bash
pip install bpy==4.2.0 pillow numpy      # Blender as a Python module (Python 3.11)
python blender/build_scene.py            # models the desk, props and phone -> scene.blend
python blender/bake.py --size 2048 --spp 64   # bakes lighting -> out/*.png + out/office.glb
npx gltfpack -i out/office.glb -o assets/office.glb -cc -kn -km -kv -vtf
```

Run `python blender/dilate.py out/office.glb out` to fill the empty texels, then convert the `*_filled.png` files to WebP (`phone`, `props`, `room`, and `floor_ratio` saved as `floor.webp`) into `assets/`.

three.js is © its authors, MIT License.
