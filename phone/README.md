# AïmaneOS Phone

The phone version of the portfolio. Phones that open the main site are sent here.

- **3D room** (`src/scene.js`): a terrace table in Agadir at sunset, with mint tea, a teapot, a lantern, a notebook and the phone. Everything is built in code with three.js, so there are no model files.
- **Phone OS** (`src/main.js`, `phone.css`): lock screen, home screen and apps. The apps open the same AïmaneOS content as the computer version (`../os/`), so projects and CV stay in sync.
- **Wallpaper and icons** (`src/wallpaper.js`, `src/icons.js`): pixel art. The first seven icons are the AïmaneOS desktop icons.

## Rebuild `app.js` after editing `src/`

```bash
cd phone
npm install three@0.187.0 esbuild
npx esbuild src/main.js --bundle --minify --format=esm --target=es2019 --legal-comments=eof --outfile=app.js
```

Then bump `app.js?v=` in `index.html` so browsers load the new file.

three.js is © its authors, MIT License.
