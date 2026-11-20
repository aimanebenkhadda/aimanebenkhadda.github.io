// 1-bit framebuffer for the phone LCD, with text and shape drawing.
import { FONT } from './fontdata.js';

export const W = 120;
export const H = 150;
export const LINE = 10;

export class FB {
  constructor() {
    this.px = new Uint8Array(W * H);
    this.dirty = true;
    this.clipY0 = 0;
    this.clipY1 = H;
  }
  clear(v = 0) { this.px.fill(v ? 255 : 0); this.dirty = true; }
  set(x, y, v = 1) {
    x |= 0; y |= 0;
    if (x < 0 || y < this.clipY0 || x >= W || y >= this.clipY1 || y >= H) return;
    this.px[y * W + x] = v === 2 ? 255 - this.px[y * W + x] : v ? 255 : 0;
  }
  get(x, y) { return x >= 0 && y >= 0 && x < W && y < H ? this.px[y * W + x] : 0; }
  fill(x, y, w, h, v = 1) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, v);
  }
  invert(x, y, w, h) { this.fill(x, y, w, h, 2); }
  rect(x, y, w, h, v = 1) {
    this.fill(x, y, w, 1, v); this.fill(x, y + h - 1, w, 1, v);
    this.fill(x, y, 1, h, v); this.fill(x + w - 1, y, 1, h, v);
  }
  roundRect(x, y, w, h, v = 1) {
    this.fill(x + 1, y, w - 2, 1, v); this.fill(x + 1, y + h - 1, w - 2, 1, v);
    this.fill(x, y + 1, 1, h - 2, v); this.fill(x + w - 1, y + 1, 1, h - 2, v);
  }
  roundFill(x, y, w, h, v = 1) {
    this.fill(x + 1, y, w - 2, h, v); this.fill(x, y + 1, 1, h - 2, v); this.fill(x + w - 1, y + 1, 1, h - 2, v);
  }
  hline(x, y, w, v = 1) { this.fill(x, y, w, 1, v); }
  vline(x, y, h, v = 1) { this.fill(x, y, 1, h, v); }
  dotted(x, y, w) { for (let i = 0; i < w; i += 2) this.set(x + i, y); }
  line(x0, y0, x1, y1, v = 1) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      this.set(x0, y0, v);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  // sprite: array of strings ('#' = on)
  sprite(rows, x, y, v = 1) {
    for (let j = 0; j < rows.length; j++)
      for (let i = 0; i < rows[j].length; i++) if (rows[j][i] === '#') this.set(x + i, y + j, v);
  }
  // ----- text
  glyph(ch) { return FONT[ch] || FONT[ch.normalize('NFD')[0]] || FONT['?']; }
  textWidth(s, opt = {}) {
    const sc = opt.scale || 1, b = opt.bold ? 1 : 0;
    let w = 0;
    for (const ch of s) w += (this.glyph(ch)[0] + 1 + b) * sc;
    return Math.max(0, w - sc);
  }
  text(s, x, y, opt = {}) {
    const sc = opt.scale || 1, b = opt.bold ? 1 : 0, v = opt.v === undefined ? 1 : opt.v;
    if (opt.align === 'center') x = Math.round(x - this.textWidth(s, opt) / 2);
    else if (opt.align === 'right') x = x - this.textWidth(s, opt);
    for (const ch of s) {
      const gl = this.glyph(ch), w = gl[0];
      for (let r = 0; r < 10; r++) {
        const bits = gl[r + 1];
        if (!bits) continue;
        for (let c = 0; c < w; c++) {
          if (bits & (1 << c)) {
            if (sc === 1) { this.set(x + c, y + r, v); if (b) this.set(x + c + 1, y + r, v); }
            else this.fill(x + c * sc, y + r * sc, sc + b, sc, v);
          }
        }
      }
      x += (w + 1 + b) * sc;
    }
    return x;
  }
  // word-wrap into lines no wider than maxW
  wrap(s, maxW, opt = {}) {
    const out = [];
    for (const para of String(s).split('\n')) {
      if (!para.trim()) { out.push(''); continue; }
      let line = '';
      for (const word of para.split(/ +/)) {
        const t = line ? line + ' ' + word : word;
        if (this.textWidth(t, opt) <= maxW) { line = t; continue; }
        if (line) out.push(line);
        if (this.textWidth(word, opt) <= maxW) { line = word; continue; }
        // hard-break a long word
        let part = '';
        for (const ch of word) {
          if (this.textWidth(part + ch, opt) > maxW) { out.push(part); part = ch; } else part += ch;
        }
        line = part;
      }
      out.push(line);
    }
    return out;
  }
}
