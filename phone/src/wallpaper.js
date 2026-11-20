// Pixel-art "Agadir sunset" wallpaper on a 90 x 195 grid.
// The same rectangles draw the HTML wallpaper (SVG) and the 3D phone screen (canvas).

export const WALL_W = 90;
export const WALL_H = 195;

const SKY = [
  [0, 14, "#251b45"],
  [14, 28, "#36285f"],
  [28, 40, "#563373"],
  [40, 52, "#7b3c79"],
  [52, 64, "#a5466f"],
  [64, 76, "#cc5960"],
  [76, 88, "#e6764f"],
  [88, 100, "#f2984e"],
  [100, 112, "#f7bb5b"],
  [112, 121, "#fbd67a"],
];
const SEA = [
  [121, 127, "#2b3fa8"],
  [127, 135, "#24358f"],
  [135, 147, "#1d2c7a"],
  [147, 162, "#172361"],
];
const STARS = [
  [8, 6], [21, 11], [37, 4], [52, 9], [66, 5], [80, 13], [14, 22], [44, 18], [71, 24], [30, 30], [86, 31], [5, 36],
];

function sunRects(out) {
  const cx = 45, cy = 121, r = 19;
  for (let y = cy - r; y < cy; y++) {
    // retro stripes cut through the lower half of the sun
    if (y === 106 || y === 107 || y === 111 || y === 112 || y === 115 || y === 116 || y === 118 || y === 119) continue;
    const dy = y + 0.5 - cy;
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    if (half > 0) out.push([cx - half, y, half * 2, 1, y < 104 ? "#ffe9b0" : "#ffd88a"]);
  }
}

function reflection(out) {
  const rows = [
    [122, 26], [124, 20], [127, 22], [130, 14], [133, 16], [137, 10], [141, 12], [146, 6], [151, 8], [157, 4],
  ];
  rows.forEach(([y, w], i) => out.push([45 - w / 2, y, w, 1, i < 4 ? "#ffd88a" : "#f7bb5b"]));
}

function palm(out, x0, base, h, lean, color) {
  // trunk: 3px wide segments drifting sideways
  for (let i = 0; i < h; i++) {
    const x = Math.round(x0 + lean * Math.pow(i / h, 1.6));
    out.push([x, base - i, 3, 1, color]);
  }
  const tx = Math.round(x0 + lean) + 1;
  const ty = base - h;
  const fronds = [
    [-1, -0.25, 14], [1, -0.25, 14], [-1, 0.35, 12], [1, 0.35, 12], [-0.35, -1, 7], [0.4, -1, 7], [-1, 0.9, 8], [1, 0.9, 8],
  ];
  fronds.forEach(([dx, dy, len]) => {
    for (let s = 0; s < len; s++) {
      const droop = (s * s) / (len * 1.6);
      const x = Math.round(tx + dx * s);
      const y = Math.round(ty + dy * s * 0.55 + droop);
      out.push([x, y, 2, 1, color]);
    }
  });
  out.push([tx - 1, ty - 1, 4, 3, color]);
}

export function wallpaperRects() {
  const out = [];
  SKY.forEach(([a, b, c]) => out.push([0, a, WALL_W, b - a, c]));
  STARS.forEach(([x, y]) => out.push([x, y, 1, 1, "#fff2cf"]));
  sunRects(out);
  SEA.forEach(([a, b, c]) => out.push([0, a, WALL_W, b - a, c]));
  reflection(out);
  // headland and beach
  out.push([0, 160, WALL_W, 35, "#14161c"]);
  for (let x = 0; x < WALL_W; x++) {
    const hgt = Math.round(4 + 3 * Math.sin(x / 9) + 2 * Math.sin(x / 4.3));
    out.push([x, 160 - hgt, 1, hgt, "#14161c"]);
  }
  palm(out, 14, 158, 46, 9, "#14161c");
  palm(out, 72, 156, 30, -6, "#14161c");
  palm(out, 60, 157, 20, 4, "#14161c");
  return out;
}

export function wallpaperSVG() {
  const rects = wallpaperRects()
    .map(([x, y, w, h, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`)
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WALL_W} ${WALL_H}" ` +
    `preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">${rects}</svg>`
  );
}

export function drawWallpaper(ctx, W, H) {
  // cover-fit like CSS background-size: cover
  const s = Math.max(W / WALL_W, H / WALL_H);
  const ox = (W - WALL_W * s) / 2;
  const oy = (H - WALL_H * s) / 2;
  ctx.imageSmoothingEnabled = false;
  wallpaperRects().forEach(([x, y, w, h, c]) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.floor(ox + x * s), Math.floor(oy + y * s), Math.ceil(w * s), Math.ceil(h * s));
  });
}
