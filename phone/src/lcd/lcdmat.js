// LCD glass: draws the 1-bit framebuffer as real-looking liquid-crystal pixels
// (square dots with a soft shadow on the backplate, faint unlit grid, backlight glow).
import * as THREE from 'three';
import { W, H } from './fb.js';

export const BACKLIGHTS = {
  green: { bg: '#b9cf8c', edge: '#8fa86a', ink: '#1d2a17', glow: 1.0 },
  blue: { bg: '#a9c6d8', edge: '#7f9fb6', ink: '#13202d', glow: 1.0 },
  amber: { bg: '#e2bd78', edge: '#bb9450', ink: '#2c1d0b', glow: 1.0 },
};

export function makeLcd() {
  const data = new Uint8Array(W * H);
  const tex = new THREE.DataTexture(data, W, H, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.needsUpdate = true;
  const u = {
    uFB: { value: tex },
    uRes: { value: new THREE.Vector2(W, H) },
    uBg: { value: new THREE.Color(BACKLIGHTS.green.bg) },
    uEdge: { value: new THREE.Color(BACKLIGHTS.green.edge) },
    uInk: { value: new THREE.Color(BACKLIGHTS.green.ink) },
    uLight: { value: 0.0 },   // 0 = screen off, 1 = backlight on
    uPad: { value: new THREE.Vector2(0.035, 0.03) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uFB; uniform vec2 uRes; uniform vec3 uBg, uEdge, uInk; uniform float uLight; uniform vec2 uPad;
      varying vec2 vUv;
      float px(vec2 id) {
        if (id.x < 0.0 || id.y < 0.0 || id.x >= uRes.x || id.y >= uRes.y) return 0.0;
        return texture2D(uFB, (id + 0.5) / uRes).r;
      }
      float dotMask(vec2 cell, vec2 aa) {
        vec2 a = smoothstep(vec2(0.06) - aa, vec2(0.06) + aa, cell) * (1.0 - smoothstep(vec2(0.94) - aa, vec2(0.94) + aa, cell));
        return a.x * a.y;
      }
      void main() {
        // inner active area with a small margin like a real LCD window
        vec2 uv = (vUv - uPad) / (1.0 - 2.0 * uPad);
        vec2 p = uv * uRes;   // glTF uv: v = 0 at the top of the screen
        vec2 aa = fwidth(p) * 0.75;
        vec2 id = floor(p), cell = fract(p);
        float on = px(id) * dotMask(cell, aa);
        vec2 q = p - vec2(0.28, 0.32);
        float sh = px(floor(q)) * dotMask(fract(q), aa * 1.6);
        // backlight: brighter centre, darker edges
        vec2 c = vUv - 0.5;
        float vig = smoothstep(0.75, 0.15, length(c * vec2(1.0, 0.85)));
        vec3 base = mix(uEdge, uBg, 0.35 + 0.65 * vig);
        vec3 off = uEdge * vec3(0.32, 0.36, 0.3);
        vec3 col = mix(off, base, uLight);
        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        col = mix(col, col * 0.93, dotMask(cell, aa) * 0.5 * inside);     // faint unlit grid
        col = mix(col, uInk * 1.4 + col * 0.25, sh * 0.22 * inside);       // pixel shadow on the backplate
        col = mix(col, uInk, on * inside * mix(0.85, 1.0, uLight));
        // glass sheen
        float g = smoothstep(0.0, 0.5, (1.0 - vUv.y) * 0.9 - vUv.x * 0.45 + 0.05) * (1.0 - smoothstep(0.5, 0.52, (1.0 - vUv.y) * 0.9 - vUv.x * 0.45 + 0.05)) * 0.045;
        col += g;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  mat.extensions = { derivatives: true };
  return { mat, tex, data, uniforms: u };
}

export function setBacklight(lcd, name) {
  const b = BACKLIGHTS[name] || BACKLIGHTS.green;
  lcd.uniforms.uBg.value.set(b.bg);
  lcd.uniforms.uEdge.value.set(b.edge);
  lcd.uniforms.uInk.value.set(b.ink);
}
