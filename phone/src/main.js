// Phone version: an old office desk in a quiet cream room, with the AB-95 standing in its dock.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PhoneOS } from './lcd/os.js';
import { W, H } from './lcd/fb.js';
import { makeLcd, setBacklight } from './lcd/lcdmat.js';
import { Beeper } from './sound.js';
import { T, LINKS } from './content.js';
import { FB } from './lcd/fb.js';
import { PHOTO } from './lcd/photo.js';

const V = '4';
const BG_HEX = '#e9e2d6';
const $ = s => document.querySelector(s);
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem('ab95.' + k); localStorage.setItem('ab95.' + k, v); } catch (e) { return null; } };
const B = (x, y, z) => new THREE.Vector3(x, z, -y);   // Blender -> three coordinates
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ------------------------------------------------------------------ settings
const qs = new URLSearchParams(location.search);
let lang = qs.get('lang') || ls('lang') || ((navigator.language || '').toLowerCase().startsWith('fr') ? 'fr' : 'en');
if (!T[lang]) lang = 'en';
const beeper = new Beeper();
const opts = {
  lang,
  tones: ls('tones') !== '0',
  backlight: ls('backlight') || 'green',
  photo: null,
};
beeper.on = opts.tones;

// ------------------------------------------------------------------ renderer + scene
const canvas = $('#scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  // no WebGL 2 here: fall back to the quick version
  location.replace(`${LINKS.quick}?lang=${lang}`);
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
const BG = new THREE.Color(BG_HEX);
scene.background = BG;
const camera = new THREE.PerspectiveCamera(40, 1, 0.18, 12);   // near plane at 12 cm: keeps the tiny key labels from flickering on phones with a 16-bit depth buffer

// ------------------------------------------------------------------ loading
const manager = new THREE.LoadingManager();
let progress = 0, loaded = false;
manager.onProgress = (url, a, b) => { progress = a / b; };
const texLoader = new THREE.TextureLoader(manager);
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function baked(name) {
  const t = texLoader.load(`assets/${name}.webp?v=${V}`);
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, maxAniso);
  return new THREE.MeshBasicMaterial({ map: t });
}
const MATS = { baked_phone: baked('phone'), baked_props: baked('props'), baked_room: baked('room') };
const floorTex = texLoader.load(`assets/floor.webp?v=${V}`);
floorTex.flipY = false;
floorTex.colorSpace = THREE.NoColorSpace;
MATS.baked_floor = new THREE.ShaderMaterial({
  uniforms: { map: { value: floorTex }, bg: { value: BG } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D map; uniform vec3 bg; varying vec2 vUv;
    void main(){ float s = texture2D(map, vUv).r; s *= s; gl_FragColor = vec4(bg * s, 1.0);
    #include <colorspace_fragment>
    }`,
});
const lcd = makeLcd();
setBacklight(lcd, opts.backlight);
MATS.lcd = lcd.mat;

const world = { root: null, phone: null, dock: null, lcdMesh: null, keys: {}, hands: {}, pickDesk: [], pickPhone: [] };
const LIVE = /^(key_|LCD$|clock_(hour|min|sec)$)/;
const liveOf = o => { for (let p = o; p; p = p.parent) if (p.name && LIVE.test(p.name)) return p; return null; };
// copy a (possibly quantized / interleaved) geometry into plain float position + uv
function plain(geo, mat) {
  const p = geo.attributes.position, u = geo.attributes.uv, n = p.count;
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(mat);
    pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    if (u) { uv[i * 2] = u.getX(i); uv[i * 2 + 1] = u.getY(i); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (geo.index) g.setIndex(Array.from(geo.index.array));
  else g.setIndex([...Array(n).keys()]);
  return g;
}
const gltfLoader = new GLTFLoader(manager);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
gltfLoader.load(`assets/office.glb?v=${V}`, gltf => {
  const root = gltf.scene;
  scene.add(root);
  root.updateMatrixWorld(true);
  world.root = root;
  world.phone = root.getObjectByName('phone_root');
  world.dock = root.getObjectByName('dock_root');
  // merge every static piece into one mesh per baked texture (the phone body stays inside the phone)
  const bins = new Map(), dead = [];
  const inPhone = o => { for (let p = o; p; p = p.parent) if (p === world.phone) return true; return false; };
  root.traverse(o => {
    if (!o.isMesh) return;
    const name = o.material && o.material.name;
    const mat = MATS[name];
    if (!mat) return;
    if (liveOf(o)) { o.material = mat; return; }
    const ph = inPhone(o), parent = ph ? world.phone : root, key = name + (ph ? '@phone' : '');
    if (!bins.has(key)) bins.set(key, { parent, mat, geos: [] });
    const rel = new THREE.Matrix4().copy(parent.matrixWorld).invert().multiply(o.matrixWorld);
    bins.get(key).geos.push(plain(o.geometry, rel));
    dead.push(o);
  });
  dead.forEach(o => o.removeFromParent());
  for (const [key, b] of bins) {
    const mesh = new THREE.Mesh(mergeGeometries(b.geos), b.mat);
    mesh.name = 'merged_' + key;
    b.parent.add(mesh);
  }
  root.traverse(o => {
    if (!o.isMesh) return;
    const live = liveOf(o);
    if (!live) return;
    if (live.name === 'LCD') world.lcdMesh = o;
    if (live.name.startsWith('key_') && !world.keys[live.name.slice(4)]) {
      world.keys[live.name.slice(4)] = live;
      live.userData.rest = live.position.clone();
    }
    if (live.name.startsWith('key_') || live.name === 'LCD') world.pickPhone.push(o);
  });
  for (const h of ['hour', 'min', 'sec']) world.hands[h] = root.getObjectByName('clock_' + h);
  // a generous invisible hit box around the phone and its dock for the desk view
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.08), new THREE.MeshBasicMaterial());
  hit.visible = false;
  hit.position.set(0, -0.004, -0.01);
  world.phone.add(hit);
  world.pickDesk.push(hit);
  root.updateMatrixWorld(true);
});
manager.onLoad = () => { loaded = true; progress = 1; onLoaded(); };

// contact details live in contact.json, next to this page
fetch(`contact.json?v=${V}`).then(r => r.json()).then(c => {
  Object.assign(LINKS, { email: c.email || '', phone: c.phone || '', phoneShow: c.phoneShow || c.phone || '' });
  for (const l of Object.values(T)) for (const it of l.contacts) {
    if (it.go === 'mail') it.v = LINKS.email;
    if (it.go === 'tel') it.v = LINKS.phoneShow;
  }
  for (const l of Object.values(T)) l.contacts = l.contacts.filter(it => it.v);
  os.dirty();
}).catch(() => {
  for (const l of Object.values(T)) l.contacts = l.contacts.filter(it => it.v);
});

// dithered 1-bit portrait for the Profile app (pre-made, 44 x 44)
opts.photo = { w: PHOTO.w, h: PHOTO.h, bits: Uint8Array.from(PHOTO.rows.join(''), c => (c === '#' ? 1 : 0)) };

// ------------------------------------------------------------------ phone software
const os = new PhoneOS({
  ...opts,
  get lang() { return opts.lang; },
  get tones() { return opts.tones; },
  get backlight() { return opts.backlight; },
  get photo() { return opts.photo; },
  sound: (kind, k) => beeper.play(kind, k),
  onUrl: (url, same) => {
    if (same || /^(mailto|tel):/.test(url)) { window.location.href = url; return; }
    const w = window.open(url, '_blank', 'noopener');
    if (!w) window.location.href = url;
  },
  onExit: () => goDesk(),
  onPhotos: (ids, i, title) => openPhotos(ids, i, title),
  onSetting: (k, v) => {
    if (k === 'lang') setLang(v);
    if (k === 'tones') { opts.tones = v; beeper.on = v; ls('tones', v ? '1' : '0'); syncHud(); }
    if (k === 'backlight') { opts.backlight = v; setBacklight(lcd, v); ls('backlight', v); }
  },
});

// ------------------------------------------------------------------ camera views
const VIEWS = {
  wide: { pos: B(-1.45, -2.45, 1.85), target: B(0, 0, 0.52), fov: 39.6 },
  desk: { pos: B(0.035, -0.44, 0.98), target: B(0, 0.0, 0.855), fov: 54.4 },
};
const tmp = new THREE.Vector3();
function fitFov(base) {
  // keep the horizontal framing of a 9:16 screen on taller phones, keep vertical framing on wider screens
  const a = camera.aspect, ref = 9 / 16;
  if (a >= ref) return base;
  const hh = Math.tan(THREE.MathUtils.degToRad(base / 2)) * ref;
  return THREE.MathUtils.radToDeg(2 * Math.atan(hh / a));
}
function phoneView() {
  const p = world.phone;
  p.updateMatrixWorld(true);
  const centre = new THREE.Vector3().setFromMatrixPosition(p.matrixWorld);
  const up = new THREE.Vector3(0, 1, 0).transformDirection(p.matrixWorld);
  const fwd = new THREE.Vector3(0, 0, 1).transformDirection(p.matrixWorld);
  const fov = 36, t = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const vh = window.innerHeight;
  const usable = Math.max(0.6, (vh - 118) / vh);       // keep clear of the top bar and the hint
  const needH = 0.158 / usable, needW = 0.072;
  const d = Math.max(needH / 2 / t, needW / 2 / (t * camera.aspect));
  const target = centre.clone().addScaledVector(up, 0.003 + (needH - 0.158) * 0.08);
  return { pos: target.clone().addScaledVector(fwd, d), target, fov, up };
}
const cam = { pos: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fov: 40 };
let anim = null;
let mode = 'start';
function setCam(v) { cam.pos.copy(v.pos); cam.target.copy(v.target); cam.up.copy(v.up || new THREE.Vector3(0, 1, 0)); cam.fov = v.fov; }
function viewFor(name) {
  if (name === 'phone') return phoneView();
  const v = VIEWS[name];
  return { pos: v.pos.clone(), target: v.target.clone(), fov: fitFov(v.fov), up: new THREE.Vector3(0, 1, 0) };
}
function flyTo(name, dur, done) {
  const from = { pos: cam.pos.clone(), target: cam.target.clone(), up: cam.up.clone(), fov: cam.fov };
  anim = { from, name, t: 0, dur, done };
}
function stepAnim(dt) {
  if (!anim) return;
  anim.t = Math.min(1, anim.t + dt / anim.dur);
  const k = ease(anim.t), to = viewFor(anim.name), f = anim.from;
  cam.pos.lerpVectors(f.pos, to.pos, k);
  cam.target.lerpVectors(f.target, to.target, k);
  cam.up.lerpVectors(f.up, to.up, k).normalize();
  cam.fov = f.fov + (to.fov - f.fov) * k;
  if (anim.t >= 1) { const d = anim.done; anim = null; d && d(); }
}

// ------------------------------------------------------------------ page chrome
const ui = {
  start: $('#start'), go: $('#go'), bar: $('#bar i'), hud: $('#hud'), tag: $('#tag'), hint: $('#hint'),
  back: $('#back'), who: $('#who'), links: $('#links'), sound: $('#sound'), langBtns: [...document.querySelectorAll('[data-lang]')],
};
function setLang(l) {
  opts.lang = l; ls('lang', l);
  document.documentElement.lang = l;
  const L = T[l];
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = L[el.dataset.t]; });
  ui.langBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
  $('#q-desk').href = LINKS.desk.replace('?', `?lang=${l}&`);
  $('#q-quick').href = `${LINKS.quick}?lang=${l}`;
  const u = new URL(location.href); u.searchParams.set('lang', l); history.replaceState(null, '', u);
  os.dirty();
}
function syncHud() {
  ui.sound.setAttribute('aria-pressed', String(opts.tones));
  ui.sound.classList.toggle('off', !opts.tones);
}
ui.langBtns.forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
ui.sound.addEventListener('click', () => { opts.tones = !opts.tones; beeper.on = opts.tones; ls('tones', opts.tones ? '1' : '0'); syncHud(); beeper.unlock(); beeper.play('tap'); });
setLang(opts.lang);
syncHud();

// pixel-font title on the start screen
(function drawTitle() {
  const fb = new FB(); fb.clear();
  const c = $('#title'), s = 4, lines = [['AÏMANE', true], ['BENKHADDA', true]];
  const w = Math.max(...lines.map(([t]) => fb.textWidth(t, { bold: true }))) + 2, h = 22;
  c.width = w * s; c.height = h * s;
  const g = c.getContext('2d');
  g.fillStyle = '#1d2a17';
  lines.forEach(([t, b], i) => {
    const f = new FB(); f.clear();
    f.text(t, 1, 0, { bold: b });
    const tw = f.textWidth(t, { bold: b });
    const ox = Math.round((w - tw) / 2) - 1;
    for (let y = 0; y < 10; y++) for (let x = 0; x < W; x++) if (f.get(x, y)) g.fillRect((x + ox) * s, (y + i * 11) * s, s - 0.6, s - 0.6);
  });
})();

function onLoaded() {
  ui.start.classList.add('ready');
  ui.go.disabled = false;
  setCam(viewFor('wide'));
}
ui.go.addEventListener('click', () => {
  if (!loaded || mode !== 'start') return;
  beeper.unlock();
  mode = 'intro';
  ui.start.classList.add('gone');
  setTimeout(() => { ui.start.style.display = 'none'; }, 900);
  setCam(viewFor('wide'));
  flyTo('desk', 2.6, () => { mode = 'desk'; document.body.dataset.mode = 'desk'; });
  setTimeout(() => os.powerOn(), 1300);
});

function goPhone() {
  if (mode !== 'desk') return;
  mode = 'flying';
  document.body.dataset.mode = 'flying';
  flyTo('phone', 1.35, () => { mode = 'phone'; document.body.dataset.mode = 'phone'; });
  if (!os.on) os.powerOn();
}
function goDesk() {
  if (mode !== 'phone') return;
  mode = 'flying';
  document.body.dataset.mode = 'flying';
  flyTo('desk', 1.25, () => { mode = 'desk'; document.body.dataset.mode = 'desk'; });
}
ui.back.addEventListener('click', () => { os.home(); goDesk(); });

// ------------------------------------------------------------------ steam from the coffee
const steam = new THREE.Mesh(
  new THREE.PlaneGeometry(0.08, 0.19, 1, 1).translate(0, 0.095, 0),
  new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * n(p); p = p * 2.03 + 1.7; a *= 0.5; } return v; }
      void main(){
        float y = vUv.y, t = uTime;
        float bend = (fbm(vec2(y * 1.3 - t * 0.10, 4.0)) - 0.5) * 0.9 * y;     // the column drifts more as it rises
        float x = vUv.x - 0.5 - bend;
        float wisp = fbm(vec2(x * 4.0, y * 2.6 - t * 0.32));
        wisp = smoothstep(0.36, 0.68, wisp);
        float width = mix(0.2, 0.46, y);
        float side = 1.0 - smoothstep(0.0, width, abs(x));
        float fade = smoothstep(0.0, 0.1, y) * (1.0 - smoothstep(0.5, 0.97, y));
        float a = min(1.0, wisp * side * fade * 1.15);
        gl_FragColor = vec4(vec3(1.0), a);
        #include <colorspace_fragment>
      }`,
  }));
steam.renderOrder = 2;
steam.visible = false;
scene.add(steam);
manager.onLoad = (prev => () => {
  const mug = world.root && world.root.getObjectByName('mug_root');
  if (mug) {
    mug.updateMatrixWorld(true);
    steam.position.setFromMatrixPosition(mug.matrixWorld);
    steam.position.y += 0.076;
    steam.visible = true;
  }
  prev();
})(manager.onLoad);

// ------------------------------------------------------------------ photo prints of the project screenshots
const ph = { box: $('#photos'), img: $('#photos img'), cap: $('#photos .t'), num: $('#photos .n'), full: $('#photos .full'), ids: [], i: 0, title: '' };
function showPhoto() {
  const id = ph.ids[ph.i];
  ph.img.src = `../app/img/${id}.webp`;
  ph.img.alt = `${ph.title} ${ph.i + 1}`;
  ph.cap.textContent = ph.title;
  ph.num.textContent = ph.ids.length > 1 ? `${ph.i + 1} / ${ph.ids.length}` : '';
  ph.full.href = ph.img.src;
  ph.box.classList.toggle('single', ph.ids.length < 2);
  ph.box.querySelector('.print').classList.remove('flip'); void ph.box.offsetWidth; ph.box.querySelector('.print').classList.add('flip');
}
function openPhotos(ids, i, title) {
  Object.assign(ph, { ids, i, title });
  showPhoto();
  ph.box.hidden = false;
  requestAnimationFrame(() => ph.box.classList.add('open'));
}
function closePhotos() {
  ph.box.classList.remove('open');
  setTimeout(() => { if (!ph.box.classList.contains('open')) ph.box.hidden = true; }, 350);
}
function stepPhoto(d) { ph.i = (ph.i + d + ph.ids.length) % ph.ids.length; showPhoto(); }
$('#photos .prev').addEventListener('click', e => { e.stopPropagation(); stepPhoto(-1); });
$('#photos .next').addEventListener('click', e => { e.stopPropagation(); stepPhoto(1); });
$('#photos .close').addEventListener('click', e => { e.stopPropagation(); closePhotos(); });
ph.box.addEventListener('click', e => { if (e.target === ph.box) closePhotos(); });
let phX = null;
ph.box.addEventListener('pointerdown', e => { phX = e.clientX; });
ph.box.addEventListener('pointerup', e => {
  if (phX === null) return;
  const dx = e.clientX - phX; phX = null;
  if (Math.abs(dx) > 40) stepPhoto(dx < 0 ? 1 : -1);
});
const photosOpen = () => !ph.box.hidden;

// ------------------------------------------------------------------ input
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(x, y, list) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.intersectObjects(list, false)[0];
}
function lcdXY(hit) {
  const pad = lcd.uniforms.uPad.value, uv = hit.uv;
  return [(uv.x - pad.x) / (1 - 2 * pad.x) * W, (uv.y - pad.y) / (1 - 2 * pad.y) * H];
}
function lcdPxScale() {
  // screen pixels per LCD pixel (for drag scrolling)
  const m = world.lcdMesh;
  const box = new THREE.Box3().setFromObject(m);
  const a = box.min.clone().project(camera), b = box.max.clone().project(camera);
  return Math.abs(a.y - b.y) / 2 * window.innerHeight / H / (1 - 2 * lcd.uniforms.uPad.value.y) || 2;
}
const pressed = new Map();
function pressKey(id) {
  const k = world.keys[id];
  if (k) {
    k.position.copy(k.userData.rest).z -= 0.0007;
    clearTimeout(pressed.get(id));
    pressed.set(id, setTimeout(() => k.position.copy(k.userData.rest), 130));
  }
  if (navigator.vibrate) try { navigator.vibrate(6); } catch (e) {}
  os.key(id);
}
let ptr = null;
canvas.addEventListener('pointerdown', e => {
  beeper.unlock();
  ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, ax: e.clientX, ay: e.clientY, t: performance.now(), moved: 0, lcd: false, acc: 0, scale: 2 };
  if (mode === 'phone') {
    const h = pick(e.clientX, e.clientY, [world.lcdMesh]);
    if (h) { ptr.lcd = true; ptr.scale = lcdPxScale(); }
  }
  canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  // a gentle parallax for mouse users only; on touch screens the camera stays perfectly still
  if (e.pointerType === 'mouse') { pointer.x = e.clientX / window.innerWidth - 0.5; pointer.y = e.clientY / window.innerHeight - 0.5; }
  if (!ptr || ptr.id !== e.pointerId) return;
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
  ptr.moved = Math.max(ptr.moved, Math.hypot(e.clientX - ptr.ax, e.clientY - ptr.ay));
  ptr.x = e.clientX; ptr.y = e.clientY;
  if (mode !== 'phone') return;
  if (ptr.lcd) {
    ptr.acc += dy / ptr.scale;
    const step = Math.trunc(ptr.acc);
    if (step) { os.drag(step); ptr.acc -= step; }
  }
  if (ptr.sx0 === undefined) { ptr.sx0 = ptr.ax; ptr.sy0 = ptr.ay; }
  const ddx = e.clientX - ptr.sx0, ddy = e.clientY - ptr.sy0;
  if (Math.max(Math.abs(ddx), Math.abs(ddy)) > 22) {
    os.swipe(Math.abs(ddx) > Math.abs(ddy) ? (ddx > 0 ? 'right' : 'left') : (ddy > 0 ? 'down' : 'up'));
    ptr.sx0 = e.clientX; ptr.sy0 = e.clientY; ptr.swiped = true;
  }
});
canvas.addEventListener('pointerup', e => {
  beeper.unlock();
  if (!ptr || ptr.id !== e.pointerId) return;
  const p = ptr; ptr = null;
  if (p.moved > 10 || performance.now() - p.t > 700) return;
  if (mode === 'desk') {
    if (pick(e.clientX, e.clientY, world.pickDesk)) goPhone();
    else nudge();
  } else if (mode === 'phone') {
    const h = pick(e.clientX, e.clientY, world.pickPhone);
    if (!h) return;
    if (h.object === world.lcdMesh) { const [x, y] = lcdXY(h); os.tap(x, y); }
    else { const k = liveOf(h.object); if (k) pressKey(k.name.slice(4)); }
    ui.hint.classList.add('used');
  }
});
canvas.addEventListener('pointercancel', () => { ptr = null; });
// tapping near (but not on) the phone still picks it up
function nudge() {
  ui.tag.classList.remove('nudge'); void ui.tag.offsetWidth; ui.tag.classList.add('nudge');
}
const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', ' ': 'ok',
  Backspace: 'soft_r', Escape: 'end', '*': 'star', '#': 'hash', s: 'soft_l', d: 'soft_r', c: 'call', e: 'end' };
window.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (photosOpen()) {
    if (e.key === 'Escape' || e.key === 'Backspace') closePhotos();
    else if (e.key === 'ArrowRight') stepPhoto(1);
    else if (e.key === 'ArrowLeft') stepPhoto(-1);
    e.preventDefault();
    return;
  }
  if (mode === 'start' && e.key === 'Enter') { ui.go.click(); return; }
  if (mode === 'desk' && (e.key === 'Enter' || e.key === ' ')) { goPhone(); e.preventDefault(); return; }
  if (mode !== 'phone') return;
  const k = /^[0-9]$/.test(e.key) ? e.key : KEYMAP[e.key];
  if (!k) return;
  e.preventDefault();
  pressKey(k);
});

// ------------------------------------------------------------------ frame loop
const pointer = { x: 0, y: 0 };
const sway = new THREE.Vector3();
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (!anim && world.phone && mode !== 'start') setCam(viewFor(mode === 'phone' ? 'phone' : mode === 'desk' ? 'desk' : 'wide'));
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
const tagPos = new THREE.Vector3();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  stepAnim(dt);
  // LCD
  if (os.update(dt)) {
    lcd.data.set(os.fb.px);
    lcd.tex.needsUpdate = true;
  }
  const lt = os.on ? 1 : 0, u = lcd.uniforms.uLight;
  u.value += (lt - u.value) * Math.min(1, dt * 4);
  // steam turns to face the camera
  if (steam.visible) {
    steam.material.uniforms.uTime.value = now / 1000;
    steam.rotation.y = Math.atan2(camera.position.x - steam.position.x, camera.position.z - steam.position.z);
  }
  // clock hands follow the real time
  if (world.hands.sec) {
    const d = new Date(), s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
    world.hands.sec.rotation.z = -Math.floor(s) / 60 * Math.PI * 2;
    world.hands.min.rotation.z = -m / 60 * Math.PI * 2;
    world.hands.hour.rotation.z = -h / 12 * Math.PI * 2;
  }
  // idle sway in the desk view
  const t = now / 1000;
  const swayOn = mode === 'desk' || mode === 'intro' ? 1 : 0;
  sway.lerp(tmp.set(pointer.x * 0.015, -pointer.y * 0.008, 0).multiplyScalar(swayOn), Math.min(1, dt * 2));
  camera.position.copy(cam.pos).add(sway);
  camera.up.copy(cam.up);
  if (camera.fov !== cam.fov) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
  camera.lookAt(cam.target);
  // "tap the phone" tag follows the phone
  if (world.phone && (mode === 'desk')) {
    tagPos.setFromMatrixPosition(world.phone.matrixWorld);
    tagPos.y += 0.095;
    tagPos.project(camera);
    ui.tag.style.transform = `translate(${(tagPos.x * 0.5 + 0.5) * window.innerWidth}px, ${(-tagPos.y * 0.5 + 0.5) * window.innerHeight}px)`;
  }
  // loading bar
  if (ui.bar) ui.bar.style.transform = `scaleX(${progress})`;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// small handle for automated checks
window.__ab95 = { os, world, camera, get mode() { return mode; }, goPhone, goDesk, pressKey, setLang };
