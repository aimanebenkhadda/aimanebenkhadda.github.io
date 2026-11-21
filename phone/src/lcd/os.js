// AB-95 phone software: idle screen, menu grid, apps and Snake, drawn on a 120 x 150 1-bit LCD.
import { FB, W, H } from './fb.js';
import { ICONS, SMALL } from './icons.js';
import { T, LINKS } from '../content.js';
import { PICS } from './pics.js';

const picCache = {};
function pic(id) {
  if (picCache[id]) return picCache[id];
  const p = PICS[id], raw = atob(p.b), stride = Math.ceil(p.w / 8), bits = new Uint8Array(p.w * p.h);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++)
    bits[y * p.w + x] = (raw.charCodeAt(y * stride + (x >> 3)) >> (7 - (x & 7))) & 1;
  return (picCache[id] = { w: p.w, h: p.h, bits });
}

const HEAD = 12;              // title row + rule
const FOOT = 12;              // softkey labels + rule
const BY = HEAD + 1;          // body top
const BH = H - FOOT - BY - 1; // body height
const TW = W - 7;             // text width (room for the scroll bar)

function store(k, v) {
  try { if (v === undefined) return localStorage.getItem('ab95.' + k); localStorage.setItem('ab95.' + k, v); } catch (e) { return null; }
}

// ------------------------------------------------------------------ base screen
class Screen {
  constructor(os) { this.os = os; }
  get L() { return this.os.L; }
  title() { return ''; }
  soft() { return [this.L.select, this.L.backKey]; }
  draw(fb) {}
  key(k) { return false; }
  tap(x, y) {}
  drag(dy) {}
  swipe(d) {}
  tick(dt) { return false; }
  chrome(fb, title, soft, extra) {
    const [l, r] = soft;
    fb.text(title, 2, 0, { bold: true });
    if (extra) fb.text(extra, W - 2, 0, { align: 'right' });
    fb.hline(0, 10, W);
    fb.hline(0, H - FOOT, W);
    if (l) fb.text(l, 2, H - FOOT + 1);
    if (r) fb.text(r, W - 2, H - FOOT + 1, { align: 'right' });
  }
  scrollbar(fb, pos, view, total) {
    if (total <= view) return;
    const x = W - 3, y0 = BY + 1, h = BH - 2;
    fb.vline(x + 1, y0, h);
    const th = Math.max(6, Math.round(h * view / total));
    const ty = y0 + Math.round((h - th) * pos / (total - view));
    fb.fill(x, ty, 3, th);
  }
}

// ------------------------------------------------------------------ boot animation
class Boot extends Screen {
  constructor(os) { super(os); this.t = 0; }
  soft() { return ['', '']; }
  tick(dt) {
    this.t += dt;
    if (this.t > 3.1) { this.os.boot = false; this.os.reset(); }
    return true;
  }
  draw(fb) {
    const t = this.t;
    // a monogram that builds itself line by line, then the name
    const logo = [
      '....######....####.......',
      '...########...######.....',
      '..###....###..##...##....',
      '..##......##..##...##....',
      '..##......##..######.....',
      '..##########..######.....',
      '..##########..##...###...',
      '..##......##..##....##...',
      '..##......##..##...###...',
      '..##......##..#######....',
      '..##......##..######.....'];
    const sx = Math.round((W - 50) / 2), sy = 34;
    const rows = Math.min(logo.length, Math.floor((t - 0.2) / 0.07));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < logo[r].length; c++)
        if (logo[r][c] === '#') fb.fill(sx + c * 2, sy + r * 2, 2, 2);
    if (t > 1.1) fb.text('AB-95', W / 2, sy + 26, { align: 'center', bold: true });
    if (t > 1.6) {
      fb.hline(30, 86, 60);
      fb.text(this.L.welcome, W / 2, 92, { align: 'center' });
    }
    if (t > 2.0) {
      const n = Math.min(10, Math.floor((t - 2.0) / 0.1));
      for (let i = 0; i < 10; i++) fb.rect(26 + i * 7, 112, 5, 5);
      for (let i = 0; i < n; i++) fb.fill(27 + i * 7, 113, 3, 3);
    }
  }
}

// ------------------------------------------------------------------ idle screen
class Idle extends Screen {
  soft() { return [this.L.menu, this.L.inbox]; }
  key(k) {
    if (k === 'soft_l' || k === 'ok' || k === 'up' || k === 'down') { this.os.push(new Menu(this.os)); return true; }
    if (k === 'soft_r' || k === 'right' || k === 'left') { this.os.push(new Inbox(this.os)); return true; }
    if (/^[1-9]$/.test(k)) { this.os.push(new Menu(this.os)); this.os.top.key(k); return true; }
    return false;
  }
  tap(x, y) {
    if (y > H - FOOT) return x < W / 2 ? this.key('soft_l') : this.key('soft_r');
    if (y > 100 && this.os.unread.size) return this.key('soft_r');
    this.key('ok');
  }
  tick() {
    const d = new Date(), k = d.getHours() * 60 + d.getMinutes() + '|' + this.os.unread.size + '|' + this.os.o.lang;
    if (k === this.k) return false;
    this.k = k;
    return true;
  }
  draw(fb) {
    const L = this.L, now = new Date();
    // status bar: signal on the left, battery on the right
    fb.sprite(SMALL.antenna, 1, 1);
    for (let i = 0; i < 5; i++) fb.fill(8 + i * 3, 7 - i, 2, i + 1);
    fb.rect(W - 17, 1, 14, 7); fb.fill(W - 3, 3, 2, 3);
    const lvl = 4;
    for (let i = 0; i < lvl; i++) fb.fill(W - 15 + i * 3, 3, 2, 3);
    fb.text(L.operator, W / 2, 0, { align: 'center', bold: true });
    fb.hline(0, 11, W);
    // clock
    const hh = String(now.getHours()).padStart(2, '0'), mm = String(now.getMinutes()).padStart(2, '0');
    const colon = ':';
    const cw = fb.textWidth('00:00', { scale: 3, bold: true });
    const cx = Math.round((W - cw) / 2);
    let x = fb.text(hh, cx, 14, { scale: 3, bold: true });
    if (colon === ':') fb.text(':', x, 14, { scale: 3, bold: true });
    fb.text(mm, cx + cw - fb.textWidth(mm, { scale: 3, bold: true }), 14, { scale: 3, bold: true });
    const date = `${L.days[now.getDay()]} ${now.getDate()} ${L.months[now.getMonth()]} ${now.getFullYear()}`;
    fb.text(date, W / 2, 46, { align: 'center' });
    // who
    fb.dotted(14, 60, W - 28);
    fb.text('Aïmane Benkhadda', W / 2, 66, { align: 'center', bold: true });
    const lines = fb.wrap(L.title, W - 10);
    lines.forEach((ln, i) => fb.text(ln, W / 2, 77 + i * 10, { align: 'center' }));
    // unread messages
    const n = this.os.unread.size;
    if (n) {
      const y = 104;
      const blink = 1;
      const label = L.newMsgs(n);
      const w = fb.textWidth(label) + 11;
      const x0 = Math.round((W - w) / 2);
      fb.roundRect(x0 - 3, y - 2, w + 6, 13);
      if (blink) fb.sprite(SMALL.env, x0, y + 2);
      fb.text(label, x0 + 10, y);
    }
    this.chrome(fb, '', this.soft());
    fb.hline(0, 10, W, 0);
  }
}

// ------------------------------------------------------------------ main menu (3 x 3 grid)
const MENU = ['profile', 'projects', 'messages', 'highlights', 'snake', 'contacts', 'cv', 'settings', 'exit'];
class Menu extends Screen {
  constructor(os) { super(os); this.sel = os.menuSel || 0; }
  soft() { return [this.L.select, this.L.backKey]; }
  open(i) {
    this.sel = i; this.os.menuSel = i;
    const id = MENU[i], os = this.os;
    const map = {
      profile: () => new Profile(os), projects: () => new Projects(os), messages: () => new Inbox(os),
      highlights: () => new Highlights(os), snake: () => new Snake(os), contacts: () => new Contacts(os),
      cv: () => new CV(os), settings: () => new Settings(os),
    };
    if (id === 'exit') { os.home(); os.o.onExit(); return; }
    os.push(map[id]());
  }
  key(k) {
    const s = this.sel;
    if (k === 'right') this.sel = (s + 1) % 9;
    else if (k === 'left') this.sel = (s + 8) % 9;
    else if (k === 'down') this.sel = (s + 3) % 9;
    else if (k === 'up') this.sel = (s + 6) % 9;
    else if (k === 'ok' || k === 'soft_l') this.open(s);
    else if (/^[1-9]$/.test(k)) this.open(+k - 1);
    else return false;
    this.os.menuSel = this.sel;
    return true;
  }
  tap(x, y) {
    if (y > H - FOOT) return x < W / 2 ? this.key('soft_l') : this.os.back();
    if (y < BY) return;
    const c = Math.min(2, Math.floor(x / 40)), r = Math.min(2, Math.floor((y - BY) / 41));
    this.open(r * 3 + c);
  }
  draw(fb) {
    const L = this.L;
    this.chrome(fb, L.apps[MENU[this.sel]], this.soft(), `${this.sel + 1}`);
    for (let i = 0; i < 9; i++) {
      const c = i % 3, r = Math.floor(i / 3);
      const x = c * 40, y = BY + 1 + r * 41;
      const on = i === this.sel;
      if (on) fb.roundFill(x + 3, y + 1, 34, 38);
      fb.sprite(ICONS[MENU[i]], x + 12, y + 5, on ? 0 : 1);
      fb.text(String(i + 1), x + 20, y + 26, { align: 'center', v: on ? 0 : 1 });
      if (MENU[i] === 'messages' && this.os.unread.size) {
        fb.roundFill(x + 27, y + 3, 8, 9, on ? 0 : 1);
        fb.text(String(this.os.unread.size), x + 31, y + 2, { align: 'center', v: on ? 1 : 0 });
      }
    }
  }
}

// ------------------------------------------------------------------ scrolling list
class List extends Screen {
  constructor(os, rowH = 12) { super(os); this.sel = 0; this.top = 0; this.rowH = rowH; }
  items() { return []; }
  openItem(i) {}
  ensure() {
    const y = this.sel * this.rowH;
    if (y < this.top) this.top = y;
    if (y + this.rowH > this.top + BH) this.top = y + this.rowH - BH;
  }
  key(k) {
    const n = this.items().length;
    if (k === 'down' || k === '8') { this.sel = (this.sel + 1) % n; this.ensure(); return true; }
    if (k === 'up' || k === '2') { this.sel = (this.sel + n - 1) % n; this.ensure(); return true; }
    if (k === 'ok' || k === 'soft_l' || k === 'right' || k === 'call') { this.openItem(this.sel, k); return true; }
    if (k === 'left') { this.os.back(); return true; }
    if (/^[1-9]$/.test(k) && +k <= n) { this.sel = +k - 1; this.ensure(); this.openItem(this.sel, k); return true; }
    return false;
  }
  tap(x, y) {
    if (y > H - FOOT) return x < W / 2 ? this.key('soft_l') : this.os.back();
    if (y < BY) return;
    const i = Math.floor((y - BY + this.top) / this.rowH);
    if (i >= 0 && i < this.items().length) { this.sel = i; this.os.dirty(); this.openItem(i, 'tap'); }
  }
  drag(dy) {
    const total = this.items().length * this.rowH;
    this.top = Math.max(0, Math.min(Math.max(0, total - BH), this.top - dy));
  }
  drawRow(fb, it, x, y, on) {
    if (it.icon) fb.sprite(it.icon, x + 1, y + Math.floor((this.rowH - it.icon.length) / 2), on ? 0 : 1);
    const tx = x + (it.icon ? 10 : 2);
    fb.text(it.label, tx, y + 1, { v: on ? 0 : 1, bold: !!it.bold });
    if (it.right) fb.text(it.right, W - 8, y + 1, { align: 'right', v: on ? 0 : 1 });
    if (it.sub) fb.text(it.sub, tx, y + 11, { v: on ? 0 : 1 });
  }
  draw(fb) {
    const items = this.items();
    this.chrome(fb, this.title(), this.soft(), `${this.sel + 1}/${items.length}`);
    fb.clipY0 = BY; fb.clipY1 = H - FOOT;
    items.forEach((it, i) => {
      const y = BY + i * this.rowH - this.top;
      if (y > H || y + this.rowH < BY) return;
      const on = i === this.sel;
      if (on) fb.fill(0, y, W - 5, this.rowH);
      this.drawRow(fb, it, 0, y, on);
    });
    fb.clipY0 = 0; fb.clipY1 = H;
    this.scrollbar(fb, this.top, BH, items.length * this.rowH);
  }
}

// ------------------------------------------------------------------ rich, scrolling document
class Doc extends Screen {
  constructor(os, opt) {
    super(os);
    this.opt = opt; this.y = 0; this.rows = null; this.lang = null;
  }
  title() { return this.opt.title(); }
  soft() { return this.opt.soft ? this.opt.soft() : ['', this.L.backKey]; }
  layout(fb) {
    const rows = [];
    const add = (h, f, tap) => rows.push({ h, f, tap });
    for (const b of this.opt.blocks()) {
      if (b.t === 'gap') add(b.h || 4, () => {});
      else if (b.t === 'h') { add(3, () => {}); fb.wrap(b.s, TW - 2, { bold: true }).forEach(l => add(10, (fb, y) => fb.text(l, 2, y, { bold: true }))); }
      else if (b.t === 'p') fb.wrap(b.s, TW - 2).forEach(l => add(10, (fb, y) => fb.text(l, 2, y)));
      else if (b.t === 'small') fb.wrap(b.s, TW - 2).forEach(l => add(10, (fb, y) => fb.text(l, 2, y)));
      else if (b.t === 'b') fb.wrap(b.s, TW - 9).forEach((l, i) => add(10, (fb, y) => {
        if (i === 0) fb.fill(3, y + 4, 2, 2);
        fb.text(l, 9, y);
      }));
      else if (b.t === 'rule') add(5, (fb, y) => fb.dotted(2, y + 2, TW - 2));
      else if (b.t === 'photo') {
        const ph = this.os.o.photo;
        const pw = ph ? ph.w : 40, phh = ph ? ph.h : 48;
        const L = this.L;
        const right = [];
        fb.wrap('Aïmane Benkhadda', TW - pw - 8, { bold: true }).forEach(l => right.push([l, true]));
        fb.wrap(L.title, TW - pw - 8).forEach(l => right.push([l, false]));
        right.push(['', false]);
        fb.wrap(L.location, TW - pw - 8).forEach(l => right.push([l, false]));
        add(Math.max(phh + 4, right.length * 10 + 2), (fb, y) => {
          fb.rect(1, y, pw + 2, phh + 2);
          if (ph) for (let j = 0; j < ph.h; j++) for (let i = 0; i < ph.w; i++) if (ph.bits[j * ph.w + i]) fb.set(2 + i, y + 1 + j);
          right.forEach(([l, b], i) => fb.text(l, pw + 7, y + i * 10, { bold: b }));
        });
      } else if (b.t === 'chart') {
        const c = b.c;
        add(3, () => {});
        fb.wrap(c.title, TW - 2).forEach(l => add(10, (fb, y) => fb.text(l, 2, y)));
        const max = c.max || Math.max(...c.bars.map(x => x[1]));
        const min = c.min || 0;
        const lw = Math.max(...c.bars.map(x => fb.textWidth(x[0]))) + 4;
        const vw = Math.max(...c.bars.map(x => fb.textWidth(x[2])));
        for (const [label, v, shown] of c.bars) {
          add(11, (fb, y) => {
            fb.text(label, 2, y);
            const bw = TW - lw - vw - 4;
            const len = Math.max(2, Math.round(bw * (v - min) / (max - min)));
            fb.fill(lw, y + 2, len, 6);
            fb.text(shown, lw + len + 3, y);
          });
        }
        add(3, () => {});
      } else if (b.t === 'kpis') {
        add(3, () => {});
        for (const [v, label] of b.k) add(12, (fb, y) => {
          fb.roundRect(1, y, TW, 12);
          fb.text(v, 4, y + 1, { bold: true });
          fb.text(label, TW - 3, y + 1, { align: 'right' });
        });
        add(3, () => {});
      } else if (b.t === 'meta') {
        add(11, (fb, y) => { fb.sprite(SMALL.envOpen, 2, y + 2); fb.text(b.from, 12, y, { bold: true }); });
        add(10, (fb, y) => fb.text(b.when, 12, y));
        add(4, (fb, y) => fb.dotted(2, y + 2, TW - 2));
      } else if (b.t === 'link') {
        add(12, (fb, y) => { fb.sprite(SMALL.link, 3, y + 3); fb.text(b.s, 11, y + 1); }, b.tap);
      } else if (b.t === 'pic') {
        const st = b.st, n = b.ids.length;
        add(3, () => {});
        const hMax = Math.max(...b.ids.map(id => pic(id).h));
        add(hMax + 3, (fb, y) => {
          const p = pic(b.ids[st.pi]);
          fb.rect(0, y, p.w + 2, p.h + 2);
          for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) if (p.bits[j * p.w + i]) fb.set(1 + i, y + 1 + j);
        }, b.tap);
        add(11, (fb, y) => {
          fb.text(n > 1 ? `◂ ${st.pi + 1}/${n} ▸` : '1/1', 1, y + 1);
          fb.text(this.L.inColour, TW, y + 1, { align: 'right' });
        }, b.tap);
      }
    }
    this.rows = rows;
    this.total = rows.reduce((a, r) => a + r.h, 0) + 4;
    this.lang = this.os.o.lang;
  }
  clamp() { this.y = Math.max(0, Math.min(Math.max(0, this.total - BH), this.y)); }
  key(k) {
    if (this.opt.key && this.opt.key(k)) return true;
    if (k === 'down' || k === '8') { this.y += 20; this.clamp(); return true; }
    if (k === 'up' || k === '2') { this.y -= 20; this.clamp(); return true; }
    if (k === 'right' || k === '6') { this.y += BH - 10; this.clamp(); return true; }
    if (k === 'left' || k === '4') { this.os.back(); return true; }
    if ((k === 'soft_l' || k === 'ok' || k === 'call') && this.opt.left) { this.opt.left(k); return true; }
    if (k === 'ok') { this.y += BH - 10; if (this.y > this.total - BH + BH - 10) this.y = 0; this.clamp(); return true; }
    return false;
  }
  tap(x, y) {
    if (y > H - FOOT) return x < W / 2 ? this.key('soft_l') : this.os.back();
    if (y < BY || !this.rows) return;
    let yy = BY + 2 - this.y;
    for (const r of this.rows) {
      if (y >= yy && y < yy + r.h) { if (r.tap) r.tap(x, y - yy); return; }
      yy += r.h;
    }
  }
  drag(dy) { this.y -= dy; this.clamp(); }
  draw(fb) {
    if (!this.rows || this.lang !== this.os.o.lang) this.layout(fb);
    this.chrome(fb, this.title(), this.soft());
    fb.clipY0 = BY; fb.clipY1 = H - FOOT;
    let y = BY + 2 - this.y;
    for (const r of this.rows) {
      if (y + r.h >= BY && y < H - FOOT) r.f(fb, y);
      y += r.h;
    }
    fb.clipY0 = 0; fb.clipY1 = H;
    this.scrollbar(fb, this.y, BH, this.total);
  }
}

// ------------------------------------------------------------------ apps
class Profile extends Doc {
  constructor(os) {
    super(os, { title: () => os.L.apps.profile, blocks: () => os.L.profile,
      soft: () => [os.L.inbox, os.L.backKey], left: () => os.replace(new Inbox(os)) });
  }
}

class Projects extends List {
  title() { return this.L.apps.projects; }
  items() { return this.L.projects.map((p, i) => ({ label: `${i + 1} ${p.short}` })); }
  openItem(i) { this.os.push(new Project(this.os, i)); }
}

class Project extends Doc {
  constructor(os, i) {
    const p = () => os.L.projects[i];
    const st = { pi: 0 };
    const photos = () => { const q = p(); if (q.pics) os.o.onPhotos(q.pics, st.pi, q.short); };
    const github = () => { if (p().url) os.open(p().url); };
    super(os, {
      title: () => p().short,
      blocks: () => {
        const q = p(), out = [{ t: 'h', s: q.name }, { t: 'p', s: q.stack }];
        if (q.pics) out.push({ t: 'pic', ids: q.pics, st, tap: photos });
        if (q.chart) out.push({ t: 'chart', c: q.chart });
        if (q.kpis) out.push({ t: 'kpis', k: q.kpis });
        q.bullets.forEach(s => out.push({ t: 'b', s }));
        if (q.url) { out.push({ t: 'gap', h: 4 }); out.push({ t: 'link', s: 'GitHub', tap: github }); }
        return out;
      },
      soft: () => [p().pics ? os.L.photos : p().url ? 'GitHub' : '', os.L.backKey],
      left: () => (p().pics ? photos() : github()),
      key: k => {
        const q = p(), n = os.L.projects.length;
        if (k === 'call') { github(); return true; }
        if (q.pics && (k === 'left' || k === 'right')) {
          st.pi = (st.pi + (k === 'right' ? 1 : q.pics.length - 1)) % q.pics.length;
          return true;
        }
        if (k === 'hash') { os.replace(new Project(os, (i + 1) % n)); return true; }
        if (k === 'star') { os.replace(new Project(os, (i + n - 1) % n)); return true; }
        return false;
      },
    });
  }
  swipe(d) {
    if ((d === 'left' || d === 'right') && this.opt.blocks().some(b => b.t === 'pic')) this.key(d === 'left' ? 'right' : 'left');
  }
}

class Inbox extends List {
  constructor(os) { super(os, 21); }
  title() { return this.L.apps.messages; }
  soft() { return [this.L.open, this.L.backKey]; }
  items() { return this.L.messages; }
  drawRow(fb, m, x, y, on) {
    const v = on ? 0 : 1, i = this.L.messages.indexOf(m);
    fb.sprite(this.os.unread.has(i) ? SMALL.env : SMALL.envOpen, 2, y + 2, v);
    fb.text(m.from, 12, y + 1, { bold: this.os.unread.has(i), v });
    fb.text(m.subject, 12, y + 10, { v });
  }
  openItem(i) {
    const os = this.os;
    os.unread.delete(i);
    const m = () => os.L.messages[i];
    os.push(new Doc(os, {
      title: () => os.L.apps.messages,
      blocks: () => {
        const out = [{ t: 'meta', from: m().from, when: m().when }, { t: 'h', s: m().subject }, { t: 'gap', h: 2 }];
        for (const ln of m().body.split('\n')) out.push(ln.startsWith('• ') ? { t: 'b', s: ln.slice(2) } : { t: 'p', s: ln });
        return out;
      },
      soft: () => [os.L.reply, os.L.backKey],
      left: () => os.mail(),
    }));
  }
}

class Highlights extends Screen {
  constructor(os) { super(os); this.i = 0; this.t = 0; }
  soft() { return [this.L.more, this.L.backKey]; }
  key(k) {
    const n = this.L.highlights.length;
    if (k === 'right' || k === 'ok' || k === 'soft_l' || k === 'down' || k === '6') { this.i = (this.i + 1) % n; this.t = 0; return true; }
    if (k === 'left' || k === 'up' || k === '4') { this.i = (this.i + n - 1) % n; this.t = 0; return true; }
    return false;
  }
  tap(x, y) {
    if (y > H - FOOT) return x < W / 2 ? this.key('soft_l') : this.os.back();
    this.key(x < W / 3 ? 'left' : 'right');
  }
  swipe(d) { if (d === 'left') this.key('right'); if (d === 'right') this.key('left'); }
  tick(dt) { this.t += dt; if (this.t > 4.5) { this.key('right'); } return true; }
  draw(fb) {
    const L = this.L, [v, cap] = L.highlights[this.i];
    this.chrome(fb, L.apps.highlights, this.soft(), `${this.i + 1}/${L.highlights.length}`);
    // big figure with a little frame
    const sc = fb.textWidth(v, { scale: 3, bold: true }) <= W - 8 ? 3 : 2;
    fb.text(v, W / 2, 26, { scale: sc, bold: true, align: 'center' });
    fb.dotted(20, 26 + 10 * sc + 2, W - 40);
    fb.wrap(cap, W - 12).forEach((l, j) => fb.text(l, W / 2, 62 + j * 10, { align: 'center' }));
    const n = L.highlights.length;
    for (let j = 0; j < n; j++) {
      const x = W / 2 - n * 4 + j * 8;
      if (j === this.i) fb.fill(x, 126, 5, 5); else fb.rect(x, 126, 5, 5);
    }
    // progress tick
    fb.fill(0, H - FOOT - 2, Math.round(W * Math.min(1, this.t / 4.5)), 1);
  }
}

class Contacts extends List {
  constructor(os) { super(os, 21); }
  title() { return this.L.apps.contacts; }
  soft() { return [this.L.open, this.L.backKey]; }
  items() { return this.L.contacts; }
  drawRow(fb, c, x, y, on) {
    const v = on ? 0 : 1;
    fb.text(c.k, 3, y + 1, { bold: true, v });
    const t = fb.wrap(c.v, TW - 4)[0];
    fb.text(t === c.v ? t : t + '…', 3, y + 10, { v });
    if (c.go) fb.sprite(c.go === 'tel' ? SMALL.phone : SMALL.link, W - 13, y + 3, v);
  }
  openItem(i) {
    const c = this.L.contacts[i];
    if (!c.go) return;
    const os = this.os;
    if (c.go === 'mail') os.mail();
    else if (c.go === 'tel') os.tel();
    else os.open(LINKS[c.go]);
  }
}

class CV extends List {
  constructor(os) { super(os, 21); }
  title() { return this.L.apps.cv; }
  soft() { return [this.L.open, this.L.backKey]; }
  items() { return this.L.cvItems.map(([a, b, l]) => ({ label: a, sub: b, bold: true, l })); }
  drawRow(fb, it, x, y, on) {
    const v = on ? 0 : 1;
    fb.text(it.label, 3, y + 1, { bold: true, v });
    fb.text(it.sub, 3, y + 10, { v });
    fb.sprite(SMALL.link, W - 13, y + 3, v);
  }
  openItem(i) { this.os.open(LINKS.cv[this.L.cvItems[i][2]]); }
}

class Settings extends List {
  title() { return this.L.apps.settings; }
  soft() { return [this.L.change, this.L.backKey]; }
  items() {
    const S = this.L.settings, o = this.os.o;
    return [
      { label: S.lang, right: S.langV },
      { label: S.tones, right: o.tones ? S.on : S.off },
      { label: S.light, right: S.lights[o.backlight] },
      { label: S.desktop, right: '›' },
      { label: S.quick, right: '›' },
      { label: S.about, right: '›' },
    ];
  }
  drawRow(fb, it, x, y, on) {
    fb.text(it.label, 3, y + 1, { v: on ? 0 : 1 });
    fb.text(it.right === '›' ? '' : it.right, W - 8, y + 1, { align: 'right', v: on ? 0 : 1, bold: true });
    if (it.right === '›') fb.sprite(SMALL.link, W - 14, y + 3, on ? 0 : 1);
  }
  openItem(i) {
    const os = this.os, o = os.o;
    if (i === 0) o.onSetting('lang', o.lang === 'en' ? 'fr' : 'en');
    else if (i === 1) o.onSetting('tones', !o.tones);
    else if (i === 2) { const ls = ['green', 'blue', 'amber']; o.onSetting('backlight', ls[(ls.indexOf(o.backlight) + 1) % 3]); }
    else if (i === 3) os.open(LINKS.desk, true);
    else if (i === 4) os.open(LINKS.quick, true);
    else if (i === 5) os.push(new Doc(os, { title: () => os.L.settings.about, blocks: () => os.L.about.split('\n').map(s => ({ t: 'p', s })).flatMap((b, j) => j ? [{ t: 'gap', h: 5 }, b] : [b]) }));
    os.dirty();
  }
}

// ------------------------------------------------------------------ Snake
const COLS = 29, ROWS = 30, FX = 2, FY = 14;
class Snake extends Screen {
  constructor(os) {
    super(os);
    this.state = 'title';
    this.level = +(store('level') || 5);
    this.best = +(store('best') || 0);
  }
  soft() {
    const L = this.L;
    if (this.state === 'play') return [L.pause, L.backKey];
    if (this.state === 'pause') return [L.play, L.backKey];
    return [this.state === 'over' ? L.again : L.play, L.backKey];
  }
  reset() {
    const y = Math.floor(ROWS / 2);
    this.body = [[8, y], [7, y], [6, y], [5, y], [4, y]];
    this.dir = [1, 0]; this.queue = []; this.score = 0; this.acc = 0; this.flash = 0;
    this.placeFood();
    this.state = 'play';
  }
  placeFood() {
    for (;;) {
      const f = [Math.floor(Math.random() * COLS), Math.floor(Math.random() * ROWS)];
      if (!this.body.some(([x, y]) => x === f[0] && y === f[1])) { this.food = f; return; }
    }
  }
  turn(d) {
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if (d[0] === -last[0] && d[1] === -last[1]) return;
    if (d[0] === last[0] && d[1] === last[1]) return;
    if (this.queue.length < 3) this.queue.push(d);
  }
  key(k) {
    const dirs = { up: [0, -1], '2': [0, -1], down: [0, 1], '8': [0, 1], left: [-1, 0], '4': [-1, 0], right: [1, 0], '6': [1, 0] };
    if (this.state === 'play') {
      if (dirs[k]) { this.turn(dirs[k]); return true; }
      if (k === 'soft_l' || k === '5' || k === 'ok') { this.state = 'pause'; return true; }
      return false;
    }
    if (this.state === 'title' || this.state === 'over') {
      if ((k === 'left' || k === '4') && this.state === 'title') { this.level = Math.max(1, this.level - 1); store('level', this.level); return true; }
      if ((k === 'right' || k === '6') && this.state === 'title') { this.level = Math.min(9, this.level + 1); store('level', this.level); return true; }
      if (/^[1-9]$/.test(k) && this.state === 'title') { this.level = +k; store('level', k); return true; }
      if (k === 'ok' || k === 'soft_l' || k === '5' || k === 'up' || k === 'down') { this.reset(); return true; }
      return false;
    }
    if (this.state === 'pause') {
      if (k === 'ok' || k === 'soft_l' || k === '5' || dirs[k]) { this.state = 'play'; if (dirs[k]) this.turn(dirs[k]); return true; }
    }
    return false;
  }
  swipe(d) {
    if (this.state === 'play') this.key(d);
    else if (this.state === 'pause') { this.state = 'play'; this.key(d); }
  }
  tap(x, y) {
    if (y > H - FOOT) return x < W / 2 ? this.key('soft_l') : this.os.back();
    if (this.state !== 'play') return this.key('ok');
    // steer towards the tapped side of the head
    const [hx, hy] = this.body[0];
    const px = FX + hx * 4 + 1, py = FY + hy * 4 + 1;
    const dx = x - px, dy = y - py;
    if (this.dir[0] !== 0) this.turn([0, dy < 0 ? -1 : 1]);
    else this.turn([dx < 0 ? -1 : 1, 0]);
  }
  tick(dt) {
    if (this.state !== 'play') return this.state === 'over' && (this.flash += dt) < 2;
    this.acc += dt;
    const step = (230 - this.level * 20) / 1000;
    let changed = false;
    while (this.acc >= step && this.state === 'play') {
      this.acc -= step;
      if (this.queue.length) this.dir = this.queue.shift();
      const [hx, hy] = this.body[0];
      const nx = (hx + this.dir[0] + COLS) % COLS, ny = (hy + this.dir[1] + ROWS) % ROWS;
      const eat = nx === this.food[0] && ny === this.food[1];
      if (!eat) this.body.pop();
      if (this.body.some(([x, y]) => x === nx && y === ny)) {
        this.state = 'over'; this.flash = 0;
        if (this.score > this.best) { this.best = this.score; store('best', this.best); }
        this.os.o.sound('over');
        return true;
      }
      this.body.unshift([nx, ny]);
      if (eat) { this.score += this.level; this.placeFood(); this.os.o.sound('eat'); }
      changed = true;
    }
    return changed;
  }
  draw(fb) {
    const L = this.L, S = L.snake;
    if (this.state === 'title') {
      this.chrome(fb, S.title, this.soft());
      // a little snake drawn under the title
      fb.text('SNAKE', W / 2, 18, { scale: 3, bold: true, align: 'center' });
      const wig = Math.floor(performance.now() / 180) % 4;
      for (let i = 0; i < 18; i++) {
        const yy = 56 + Math.round(Math.sin((i + wig) * 0.7) * 3);
        fb.fill(20 + i * 4, yy, 3, 3);
      }
      fb.fill(20 + 18 * 4, 56 + Math.round(Math.sin((18 + wig) * 0.7) * 3) - 1, 4, 5);
      fb.text(`${S.level}: ◂ ${this.level} ▸`, W / 2, 74, { align: 'center' });
      fb.text(`${S.best}: ${this.best}`, W / 2, 86, { align: 'center' });
      if (Math.floor(performance.now() / 500) % 2) fb.text(S.start, W / 2, 106, { align: 'center', bold: true });
      return;
    }
    // score line
    fb.text(String(this.score).padStart(4, '0'), 2, 1, { bold: true });
    fb.text(`${S.best} ${this.best}`, W - 2, 1, { align: 'right' });
    fb.rect(FX - 2, FY - 2, COLS * 4 + 3, ROWS * 4 + 3);
    const hide = this.state === 'over' && Math.floor(this.flash / 0.25) % 2 === 1 && this.flash < 1.5;
    if (!hide) {
      this.body.forEach(([x, y], i) => {
        const px = FX + x * 4, py = FY + y * 4;
        fb.fill(px, py, 3, 3);
        const nxt = this.body[i + 1];
        if (nxt) {
          const dx = nxt[0] - x, dy = nxt[1] - y;
          if (dx === 1) fb.vline(px + 3, py, 3); else if (dx === -1) fb.vline(px - 1, py, 3);
          else if (dy === 1) fb.hline(px, py + 3, 3); else if (dy === -1) fb.hline(px, py - 1, 3);
        }
        if (i === 0) fb.set(px + 1, py + 1, 0);
      });
    }
    const [fx, fy] = this.food;
    const ax = FX + fx * 4, ay = FY + fy * 4;
    fb.set(ax + 1, ay); fb.set(ax, ay + 1); fb.set(ax + 2, ay + 1); fb.set(ax + 1, ay + 2);
    if (this.state === 'pause' || this.state === 'over') {
      const msg = this.state === 'pause' ? S.paused : S.over;
      const sub = this.state === 'over' ? `${S.score}: ${this.score}` : '';
      fb.fill(14, 52, W - 28, sub ? 34 : 22, 0);
      fb.roundRect(14, 52, W - 28, sub ? 34 : 22);
      fb.text(msg, W / 2, 58, { bold: true, align: 'center' });
      if (sub) fb.text(sub, W / 2, 70, { align: 'center' });
    }
    fb.hline(0, H - FOOT, W);
    const [l, r] = this.soft();
    fb.text(l, 2, H - FOOT + 1); fb.text(r, W - 2, H - FOOT + 1, { align: 'right' });
  }
}

// ------------------------------------------------------------------ the OS
export class PhoneOS {
  constructor(o) {
    this.o = o;   // { lang, tones, backlight, photo, onUrl(url, sameTab), onExit(), onSetting(k, v), sound(kind) }
    this.fb = new FB();
    this.stack = [];
    this.on = false;
    this.boot = false;
    this.unread = new Set([0, 1, 2, 3]);
    this.menuSel = 0;
    this.toast = null;
    this._dirty = true;
  }
  get L() { return T[this.o.lang]; }
  get top() { return this.stack[this.stack.length - 1]; }
  dirty() { this._dirty = true; }
  powerOn() {
    if (this.on) return;
    this.on = true; this.boot = true;
    this.stack = [new Boot(this)];
    this.o.sound('boot');
    this.dirty();
  }
  reset() { this.stack = [new Idle(this)]; this.dirty(); }
  home() { if (this.on && !this.boot) this.reset(); }
  push(s) { this.stack.push(s); this.dirty(); }
  replace(s) { this.stack[this.stack.length - 1] = s; this.dirty(); }
  back() { if (this.stack.length > 1) this.stack.pop(); this.dirty(); }
  open(url, same) { this.flash(this.L.opening); this.o.onUrl(url, same); }
  mail() { if (!LINKS.email) return this.open(LINKS.linkedin); this.o.onUrl('mailto:' + LINKS.email, true); }
  tel() { if (!LINKS.phone) return this.open(LINKS.linkedin); this.o.onUrl('tel:' + LINKS.phone, true); }
  flash(msg) { this.toast = { msg, t: 1.4 }; this.dirty(); }
  key(k) {
    if (!this.on || this.boot) return;
    this.o.sound('key', k);
    if (k === 'end') {
      if (this.top instanceof Idle) this.o.onExit();
      else this.reset();
      return;
    }
    if (!this.top.key(k)) {
      if (k === 'soft_r' || k === 'clear') this.back();
      else if (k === 'call' && this.top instanceof Idle) this.push(new Contacts(this));
    }
    this.dirty();
  }
  tap(x, y) {
    if (!this.on || this.boot) return;
    this.o.sound('tap');
    this.top.tap(x, y);
    this.dirty();
  }
  drag(dy) { if (this.on && !this.boot) { this.top.drag(dy); this.dirty(); } }
  swipe(d) { if (this.on && !this.boot) { this.top.swipe(d); this.dirty(); } }
  update(dt) {
    if (!this.on) return false;
    if (this.top.tick(dt)) this._dirty = true;
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; this._dirty = true; }
    if (!this._dirty) return false;
    this._dirty = false;
    const fb = this.fb;
    fb.clear();
    this.top.draw(fb);
    if (this.toast) {
      const w = Math.min(W - 10, fb.textWidth(this.toast.msg) + 14);
      const x = Math.round((W - w) / 2);
      fb.fill(x, 60, w, 22, 0); fb.roundRect(x, 60, w, 22); fb.rect(x + 2, 62, w - 4, 18);
      fb.text(this.toast.msg, W / 2, 66, { align: 'center' });
    }
    return true;
  }
}

export { W, H };
