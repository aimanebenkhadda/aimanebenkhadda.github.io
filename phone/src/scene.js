// The phone version's 3D room: a terrace café table in Agadir at sunset,
// with mint tea, a teapot, a lantern, a notebook and Aïmane's phone.
// Everything is built in code, so there are no 3D model files to load.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { drawWallpaper } from "./wallpaper.js";

const TABLE_Y = 0.74;
const PHONE = { w: 0.074, d: 0.0085, l: 0.154, x: 0.035, z: 0.17, rot: -0.16 };
const SCREEN = { w: 0.068, l: 0.148 };

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

// ------------------------------------------------------------------ textures
function skyTexture() {
  return canvasTexture(4, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#2a1e4f");
    g.addColorStop(0.35, "#7b3c79");
    g.addColorStop(0.62, "#d9644f");
    g.addColorStop(0.8, "#f4a35a");
    g.addColorStop(1, "#fbd389");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function woodTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#8b5a33";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      const y = Math.random() * h;
      ctx.strokeStyle = `rgba(${Math.random() < 0.5 ? "60,32,14" : "170,112,62"},${0.08 + Math.random() * 0.18})`;
      ctx.lineWidth = 0.6 + Math.random() * 2.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) {
        ctx.lineTo(x, y + Math.sin(x / 70 + i) * 4 + Math.sin(x / 23 + i * 0.7) * 1.5);
      }
      ctx.stroke();
    }
  });
}

function zelligeTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#efe6d4";
    ctx.fillRect(0, 0, w, h);
    const star = (cx, cy, r, color) => {
      ctx.fillStyle = color;
      for (const a of [0, Math.PI / 4]) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        ctx.fillRect(-r, -r, 2 * r, 2 * r);
        ctx.restore();
      }
    };
    star(128, 128, 62, "#2b4bb3");
    star(128, 128, 40, "#efe6d4");
    star(128, 128, 26, "#c9762f");
    for (const [x, y] of [[0, 0], [256, 0], [0, 256], [256, 256]]) star(x, y, 30, "#2f7d5b");
    ctx.strokeStyle = "#d4c8b0";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, w, h);
  }, [14, 14]);
}

function softDot() {
  return canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

// ------------------------------------------------------------------ props
function std(color, rough = 0.6, metal = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
}

function shadowed(mesh) {
  mesh.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return mesh;
}

function teaGlass() {
  const g = new THREE.Group();
  const profile = [
    [0.0, 0.0], [0.021, 0.0], [0.022, 0.004], [0.019, 0.009], [0.02, 0.03], [0.025, 0.058], [0.03, 0.083], [0.031, 0.09],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 28),
    new THREE.MeshPhysicalMaterial({
      color: "#eef6f2", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, side: THREE.DoubleSide,
    })
  );
  const tea = new THREE.Mesh(
    new THREE.LatheGeometry(profile.slice(0, 6).map((v) => new THREE.Vector2(v.x * 0.9, v.y * 0.95)), 24),
    std("#6e3810", 0.25, 0, { transparent: true, opacity: 0.9 })
  );
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.0222, 24), std("#7d4214", 0.12));
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.055;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.0285, 0.0016, 6, 32), std("#d7a740", 0.3, 1));
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.075;
  const mint = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 8, 6), std("#2f6b35", 0.7));
    leaf.scale.set(1, 0.25, 1.9);
    leaf.position.set(Math.cos(i * 1.3) * 0.008, 0.058 + i * 0.004, Math.sin(i * 1.3) * 0.008);
    leaf.rotation.set(0.5 * Math.sin(i), i * 1.3, 0.3);
    mint.add(leaf);
  }
  g.add(tea, top, glass, band, mint);
  return shadowed(g);
}

function teapot() {
  const g = new THREE.Group();
  const silver = std("#dfe3e8", 0.22, 1);
  const body = [
    [0.0, 0.0], [0.045, 0.0], [0.05, 0.008], [0.068, 0.035], [0.076, 0.065], [0.07, 0.095], [0.052, 0.118], [0.036, 0.13],
    [0.031, 0.15], [0.036, 0.158],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(body, 32), silver));
  const lid = [
    [0.036, 0.158], [0.034, 0.17], [0.024, 0.19], [0.012, 0.215], [0.006, 0.232], [0.0, 0.236],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(lid, 24), silver));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 10), std("#d7a740", 0.3, 1));
  knob.position.y = 0.245;
  g.add(knob);
  const spout = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.055, 0.045, 0), new THREE.Vector3(0.095, 0.075, 0), new THREE.Vector3(0.12, 0.13, 0),
        new THREE.Vector3(0.14, 0.17, 0),
      ]),
      20, 0.0075, 10
    ),
    silver
  );
  g.add(spout);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.0065, 8, 24, Math.PI * 1.15), silver);
  handle.position.set(-0.062, 0.1, 0);
  handle.rotation.z = Math.PI * 0.45;
  g.add(handle);
  const foot = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.004, 6, 32), silver);
  foot.rotation.x = Math.PI / 2;
  foot.position.y = 0.003;
  g.add(foot);
  return shadowed(g);
}

function tray() {
  const g = new THREE.Group();
  const metal = std("#cfd3d8", 0.28, 1);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.008, 48), metal);
  plate.position.y = 0.004;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.006, 8, 64), metal);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.01;
  g.add(plate, rim);
  return shadowed(g);
}

function lantern() {
  const g = new THREE.Group();
  const brass = std("#b8862f", 0.35, 1);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.015, 6), brass);
  base.position.y = 0.008;
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.12, 6, 1, true),
    std("#ffcf7a", 0.4, 0, { emissive: "#ff9d3a", emissiveIntensity: 1.6, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  glass.position.y = 0.075;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.07, 6), brass);
  roof.position.y = 0.17;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 16), brass);
  ring.position.y = 0.215;
  g.add(base, glass, roof, ring);
  for (let i = 0; i < 6; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.12, 0.004), brass);
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    bar.position.set(Math.cos(a) * 0.046, 0.075, Math.sin(a) * 0.046);
    g.add(bar);
  }
  const light = new THREE.PointLight("#ffab55", 0.9, 1.6, 1.6);
  light.position.y = 0.08;
  g.add(light);
  shadowed(g);
  glass.castShadow = false;
  return g;
}

function notebook() {
  const g = new THREE.Group();
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.012, 0.21), std("#1d2c7a", 0.7));
  cover.position.y = 0.006;
  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.146, 0.009, 0.206), std("#f7f1e3", 0.9));
  pages.position.set(0.002, 0.006, 0);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.0128, 0.212), std("#f2c811", 0.5));
  band.position.set(0.055, 0.006, 0);
  const pen = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.13, 12), std("#14161c", 0.35, 0.4));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0045, 0.014, 12), std("#d7a740", 0.3, 1));
  tip.position.y = -0.072;
  tip.rotation.x = Math.PI;
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.05, 0.003), std("#d7a740", 0.3, 1));
  clip.position.set(0.005, 0.035, 0);
  pen.add(barrel, tip, clip);
  pen.rotation.set(Math.PI / 2, 0, 0.5);
  pen.position.set(-0.01, 0.017, 0.0);
  g.add(cover, pages, band, pen);
  return shadowed(g);
}

function cookies() {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.012, 36), std("#f4efe6", 0.4));
  plate.position.y = 0.006;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.003, 6, 40), std("#2b4bb3", 0.4));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.012;
  g.add(plate, rim);
  const dough = std("#e8c48f", 0.85);
  [[0, 0], [0.032, 0.012], [-0.03, 0.016], [0.004, -0.032]].forEach(([x, z], i) => {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.019, 16, 10), dough);
    c.scale.set(1, 0.45, 1);
    c.position.set(x, 0.02 + (i === 0 ? 0.006 : 0), z);
    g.add(c);
  });
  return shadowed(g);
}

function palmTree(height, lean, seed) {
  const g = new THREE.Group();
  const bark = std("#3a2a22", 0.95);
  const leafMat = std("#25402c", 0.9, 0, { side: THREE.DoubleSide });
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push(new THREE.Vector3(lean * Math.pow(t, 1.7), t * height, 0));
  }
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.09, 8), bark);
  g.add(trunk);
  const top = pts[pts.length - 1];
  for (let i = 0; i < 9; i++) {
    const frond = new THREE.Group();
    const a = (i / 9) * Math.PI * 2 + seed;
    const len = 1.3 + Math.sin(i * 2.1 + seed) * 0.25;
    for (let s = 0; s < 4; s++) {
      const seg = new THREE.Mesh(new THREE.PlaneGeometry(len / 4 + 0.02, 0.32 - s * 0.06), leafMat);
      seg.position.set((s + 0.5) * (len / 4), -Math.pow(s / 3, 2) * 0.45, 0);
      seg.rotation.z = -s * 0.28;
      seg.rotation.x = 0.35;
      frond.add(seg);
    }
    frond.position.copy(top);
    frond.rotation.y = a;
    frond.rotation.z = 0.25;
    g.add(frond);
  }
  return g;
}

// ------------------------------------------------------------------ phone
function phoneScreenCanvas() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = Math.round((512 * SCREEN.l) / SCREEN.w);
  return c;
}

function drawLockScreen(canvas, lang) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  const r = 46;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(W, 0, W, H, r);
  ctx.arcTo(W, H, 0, H, r);
  ctx.arcTo(0, H, 0, 0, r);
  ctx.arcTo(0, 0, W, 0, r);
  ctx.clip();
  drawWallpaper(ctx, W, H);
  ctx.fillStyle = "rgba(10,8,30,0.18)";
  ctx.fillRect(0, 0, W, H);
  const now = new Date();
  const time = now.toLocaleTimeString(lang === "fr" ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long" });
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff6e0";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 8;
  ctx.font = "600 34px 'Pixelify Sans', monospace";
  ctx.fillText(date.charAt(0).toUpperCase() + date.slice(1), W / 2, 190);
  ctx.font = "700 150px 'Pixelify Sans', monospace";
  ctx.fillText(time, W / 2, 330);
  ctx.font = "500 30px 'Pixelify Sans', monospace";
  ctx.fillText("AïmaneOS", W / 2, 110);
  ctx.font = "500 28px 'Pixelify Sans', monospace";
  ctx.fillText(lang === "fr" ? "▲ Glissez pour déverrouiller" : "▲ Swipe up to unlock", W / 2, H - 90);
  ctx.restore();
  // punch-hole camera
  ctx.fillStyle = "#050507";
  ctx.beginPath();
  ctx.arc(W / 2, 34, 13, 0, Math.PI * 2);
  ctx.fill();
}

function phone(screenTexture) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(PHONE.w, PHONE.d, PHONE.l, 5, 0.0075),
    std("#1c1d23", 0.32, 0.6)
  );
  body.position.y = PHONE.d / 2;
  const frame = new THREE.Mesh(
    new RoundedBoxGeometry(PHONE.w + 0.0012, PHONE.d * 0.55, PHONE.l + 0.0012, 5, 0.0078),
    std("#8c93a3", 0.25, 1)
  );
  frame.position.y = PHONE.d * 0.45;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN.w, SCREEN.l),
    new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false })
  );
  screen.rotation.x = -Math.PI / 2;
  screen.position.y = PHONE.d + 0.0003;
  screen.name = "screen";
  g.add(frame, body, screen);
  body.castShadow = true;
  frame.castShadow = true;
  return g;
}

// ------------------------------------------------------------------ scene
export function createScene(canvas, { onPhoneTap, onTap } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog("#e98e5e", 7, 26);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 120);

  // light: low sunset sun behind the table, warm sky, cool fill
  scene.add(new THREE.HemisphereLight("#ffd2a6", "#4a3028", 0.9));
  const sun = new THREE.DirectionalLight("#ffb072", 2.4);
  sun.position.set(-2.2, 2.6, -3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -1, right: 1, top: 1, bottom: -1, near: 0.5, far: 9 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.01;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#9fb4ff", 0.35);
  fill.position.set(2, 2, 3);
  scene.add(fill);

  // terrace floor, wall, sea, sun disc, palms
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshStandardMaterial({ map: zelligeTexture(), roughness: 0.55 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 0.3), std("#f1e8db", 0.9));
  wall.position.set(0, 0.25, -3.4);
  wall.receiveShadow = true;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(14, 0.08, 0.38), std("#2b4bb3", 0.6));
  cap.position.set(0, 0.54, -3.4);
  scene.add(wall, cap);

  // the beach below the terrace, then the Atlantic
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(80, 21), std("#d8a46a", 0.95));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, -0.55, -13.5);
  scene.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), std("#2a3a8c", 0.25, 0.1));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.6, -124);
  scene.add(sea);

  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 48),
    new THREE.MeshBasicMaterial({ color: "#ffe2a0", fog: false, toneMapped: false })
  );
  sunDisc.position.set(-1.6, 1.2, -62);
  scene.add(sunDisc);

  [
    [-1.3, -10, 3.2, 0.4, 0.3],
    [1.6, -12, 3.6, -0.5, 1.7],
    [-3.6, -13, 3.8, 0.7, 2.9],
    [3.8, -15, 3.4, -0.4, 4.1],
    [0.3, -18.5, 3.0, 0.3, 5.3],
  ].forEach(([x, z, h, lean, seed]) => {
    const p = palmTree(h, lean, seed);
    p.position.set(x, -0.55, z);
    scene.add(p);
  });

  // table
  const table = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.56, 0.04, 64),
    new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.55 })
  );
  top.position.y = TABLE_Y - 0.02;
  const iron = std("#2a2522", 0.6, 0.5);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, TABLE_Y - 0.04, 16), iron);
  leg.position.y = (TABLE_Y - 0.04) / 2;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.025, 32), iron);
  base.position.y = 0.0125;
  table.add(top, leg, base);
  scene.add(shadowed(table));

  const place = (obj, x, z, ry = 0) => {
    obj.position.set(x, TABLE_Y, z);
    obj.rotation.y = ry;
    scene.add(obj);
    return obj;
  };
  const tr = place(tray(), -0.24, -0.2);
  const pot = teapot();
  pot.position.set(-0.05, 0.01, -0.04);
  pot.rotation.y = 0.6;
  tr.add(pot);
  [[0.1, 0.08], [0.11, -0.07], [-0.02, 0.13]].forEach(([x, z]) => {
    const gl = teaGlass();
    gl.position.set(x, 0.01, z);
    tr.add(gl);
  });
  const myGlass = place(teaGlass(), -0.14, 0.15);
  place(lantern(), 0.3, -0.27);
  place(notebook(), 0.27, 0.06, 0.32);
  place(cookies(), 0.06, -0.3);

  // steam rising from the glass next to the phone
  const steamTex = softDot();
  const steam = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData.t = i / 7;
    scene.add(s);
    steam.push(s);
  }

  // the phone
  const screenCanvas = phoneScreenCanvas();
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.anisotropy = 8;
  let lang = "en";
  const redrawScreen = () => {
    drawLockScreen(screenCanvas, lang);
    screenTexture.needsUpdate = true;
  };
  redrawScreen();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redrawScreen);
  setInterval(redrawScreen, 30000);
  const phoneObj = place(phone(screenTexture), PHONE.x, PHONE.z, PHONE.rot);

  // ---------------------------------------------------------------- camera keyframes
  const portrait = () => camera.aspect < 1;
  function keyframe(name) {
    if (name === "phone") {
      const screenWorld = new THREE.Vector3(0, PHONE.d, 0).applyMatrix4(phoneObj.matrixWorld);
      const topDir = new THREE.Vector3(0, 0, -1).applyQuaternion(phoneObj.quaternion).normalize();
      const f = THREE.MathUtils.degToRad(camera.fov / 2);
      // cover-fit: the phone screen fills the whole view
      const dH = SCREEN.l / (2 * Math.tan(f));
      const dW = SCREEN.w / (2 * Math.tan(f) * camera.aspect);
      const d = Math.min(dH, dW) * 0.985;
      return { pos: screenWorld.clone().add(new THREE.Vector3(0, d, 0)), target: screenWorld, up: topDir };
    }
    const P = portrait();
    const frames = {
      intro: P ? [[0.2, 2.8, 3.9], [0, 0.6, -0.3]] : [[0.4, 2.4, 3.4], [0, 0.6, -0.3]],
      idle: P ? [[0.0, 1.5, 2.05], [0, 0.98, -0.6]] : [[0.0, 1.38, 1.6], [0, 0.9, -0.5]],
      table: P ? [[0.04, 1.16, 0.68], [0.035, 0.745, 0.12]] : [[0.1, 1.06, 0.56], [0.03, 0.75, 0.1]],
    };
    const [p, t] = frames[name];
    return { pos: new THREE.Vector3(...p), target: new THREE.Vector3(...t), up: new THREE.Vector3(0, 1, 0) };
  }

  const rig = { pos: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) };
  let current = "intro";
  let tween = null;
  Object.assign(rig, keyframe("intro"));

  function to(name, ms = 1600) {
    const from = { pos: rig.pos.clone(), target: rig.target.clone(), up: rig.up.clone() };
    const goal = keyframe(name);
    current = null;
    return new Promise((resolve) => {
      tween = { from, goal, name, start: performance.now(), ms, resolve };
    });
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1 ? 50 : 42;
    camera.updateProjectionMatrix();
    if (current) Object.assign(rig, keyframe(current));
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------------------------------------------------------------- taps
  const ray = new THREE.Raycaster();
  let down = null;
  canvas.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY, t: performance.now() }));
  canvas.addEventListener("pointerup", (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 12) return;
    const rect = canvas.getBoundingClientRect();
    const p = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(p, camera);
    const hit = ray.intersectObject(phoneObj, true).length > 0;
    if (hit && onPhoneTap) onPhoneTap();
    else if (onTap) onTap();
  });

  // ---------------------------------------------------------------- loop
  const t0 = performance.now();
  const glassTop = new THREE.Vector3();
  let running = true;
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const t = (performance.now() - t0) / 1000;
    if (tween) {
      const k = Math.min(1, (performance.now() - tween.start) / tween.ms);
      const e = ease(k);
      rig.pos.lerpVectors(tween.from.pos, tween.goal.pos, e);
      rig.target.lerpVectors(tween.from.target, tween.goal.target, e);
      rig.up.lerpVectors(tween.from.up, tween.goal.up, e).normalize();
      if (k >= 1) {
        current = tween.name;
        const done = tween.resolve;
        tween = null;
        done();
      }
    }
    // a slow breathing sway, except when holding the phone
    const sway = current === "phone" || (tween && tween.name === "phone") ? 0 : 1;
    camera.position.set(
      rig.pos.x + Math.sin(t * 0.35) * 0.025 * sway,
      rig.pos.y + Math.sin(t * 0.5) * 0.012 * sway,
      rig.pos.z
    );
    camera.up.copy(rig.up);
    camera.lookAt(rig.target);

    myGlass.getWorldPosition(glassTop);
    steam.forEach((s) => {
      s.userData.t = (s.userData.t + 0.0035) % 1;
      const k = s.userData.t;
      s.position.set(glassTop.x + Math.sin(k * 6 + s.id) * 0.012, glassTop.y + 0.07 + k * 0.16, glassTop.z);
      const size = 0.03 + k * 0.05;
      s.scale.set(size, size, size);
      s.material.opacity = Math.sin(k * Math.PI) * 0.22;
    });
    renderer.render(scene, camera);
  }
  frame();

  return {
    to,
    resize,
    setLang(l) {
      lang = l;
      redrawScreen();
    },
    get state() {
      return current;
    },
    pause() {
      running = false;
    },
    resume() {
      if (!running) {
        running = true;
        frame();
      }
    },
  };
}
