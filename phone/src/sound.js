// Tiny square-wave beeper, like an old phone's buzzer.
const KEY_HZ = { '1': 1209, '2': 1336, '3': 1477, '4': 1209, '5': 1336, '6': 1477, '7': 1209, '8': 1336, '9': 1477, star: 1209, '0': 1336, hash: 1477 };

export class Beeper {
  constructor() { this.ctx = null; this.on = true; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { this.ctx = null; }
  }
  tone(hz, dur, vol = 0.035, when = 0) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.value = hz;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.setValueAtTime(vol, t + dur - 0.01);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  play(kind, k) {
    if (kind === 'key') this.tone(KEY_HZ[k] || 1650, 0.06);
    else if (kind === 'tap') this.tone(1900, 0.03, 0.02);
    else if (kind === 'eat') this.tone(2100, 0.035, 0.03);
    else if (kind === 'over') [880, 660, 440].forEach((f, i) => this.tone(f, 0.12, 0.035, i * 0.13));
    else if (kind === 'boot') [[784, 0.11], [988, 0.11], [1175, 0.11], [1568, 0.26], [1319, 0.11], [1568, 0.34]]
      .reduce((t, [f, d]) => { this.tone(f, d, 0.03, t); return t + d + 0.02; }, 0.05);
  }
}
