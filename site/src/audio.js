// All sounds are synthesised with Web Audio, so there are no sound files to manage.
let ctx = null, master = null, noise = null;

function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ctx.createDynamicsCompressor();
  master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(comp);
  comp.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function out(vol = 1, pan = 0) {
  const g = ctx.createGain();
  g.gain.value = vol;
  if (pan) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(master);
  } else g.connect(master);
  return g;
}

function env(g, t, peak, attack, decay) {
  peak = Math.max(peak, 0.0002); // exponential ramps can't reach 0; distant sounds fade to near-silence
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function burst(dest, t, dur, type, f0, f1, q, peak) {
  const s = ctx.createBufferSource();
  s.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  env(g, t, peak, 0.002, dur);
  s.connect(f).connect(g).connect(dest);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

function tone(dest, t, type, f0, f1, dur, peak) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  env(g, t, peak, 0.004, dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const now = () => ctx.currentTime;

export const audio = {
  init,
  gunshot(vol = 1, pan = 0, far = 0, kind = 'rifle') {
    if (!ctx) return;
    const t = now(), o = out(vol, pan);
    const k = {
      rifle: { len: 0.18, thump: 170, crack: 0.45, body: 0.9 },
      smg: { len: 0.11, thump: 220, crack: 0.5, body: 0.7 },
      pistol: { len: 0.14, thump: 200, crack: 0.6, body: 0.8 },
      sniper: { len: 0.55, thump: 110, crack: 0.7, body: 1.0 },
    }[kind];
    burst(o, t, k.len, 'lowpass', 7000 - far * 5000, 300, 0.7, k.body);
    burst(o, t, 0.05, 'highpass', 3500, 2200, 0.5, k.crack * (1 - far));
    tone(o, t, 'sine', k.thump, 40, k.len * 0.75, 0.9 * (1 - far * 0.6));
    if (kind === 'sniper') burst(o, t + 0.05, 0.7, 'lowpass', 1200, 120, 0.5, 0.35);
  },
  explosion(vol = 1, pan = 0) {
    if (!ctx) return;
    const t = now(), o = out(vol, pan);
    burst(o, t, 1.1, 'lowpass', 3000, 60, 0.6, 1.0);
    tone(o, t, 'sine', 90, 25, 0.8, 1.0);
    burst(o, t, 0.08, 'highpass', 2500, 1500, 0.5, 0.5);
  },
  swing() { if (!ctx) return; burst(out(0.3), now(), 0.14, 'bandpass', 1800, 600, 1.5, 0.6); },
  stab(big) {
    if (!ctx) return;
    const t = now(), o = out(0.6);
    burst(o, t, 0.1, 'lowpass', 1400, 300, 1, 0.8);
    if (big) [660, 880, 1320].forEach((f, i) => tone(o, t + i * 0.05, 'square', f, f, 0.08, 0.2));
  },
  punch() { if (!ctx) return; const t = now(), o = out(0.6); burst(o, t, 0.08, 'lowpass', 900, 200, 1, 0.9); tone(o, t, 'sine', 140, 60, 0.08, 0.6); },
  throwG(vol = 1) { if (!ctx) return; const t = now(), o = out(0.4 * vol); burst(o, t, 0.03, 'highpass', 4000, 3000, 1, 0.5); burst(o, t + 0.12, 0.18, 'bandpass', 1500, 500, 1.2, 0.5); },
  bounce(vol) { if (!ctx) return; tone(out(vol), now(), 'triangle', 900, 500, 0.05, 0.3); },
  pickup() {
    if (!ctx) return;
    const t = now(), o = out(0.35);
    [784, 1047, 1319].forEach((f, i) => tone(o, t + i * 0.06, 'triangle', f, f, 0.12, 0.5));
  },
  pad() { if (!ctx) return; const t = now(), o = out(0.4); tone(o, t, 'sine', 180, 900, 0.35, 0.6); burst(o, t, 0.3, 'bandpass', 600, 2400, 1, 0.3); },
  teleport() {
    if (!ctx) return;
    const t = now(), o = out(0.4);
    tone(o, t, 'sine', 1400, 300, 0.4, 0.5);
    tone(o, t + 0.05, 'triangle', 300, 1600, 0.35, 0.3);
  },
  slide() { if (!ctx) return; burst(out(0.35), now(), 0.45, 'bandpass', 900, 300, 0.8, 0.5); },
  victory() {
    if (!ctx) return;
    const t = now(), o = out(0.35);
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(o, t + i * 0.12, 'triangle', f, f, 0.2, 0.5));
  },
  defeat() {
    if (!ctx) return;
    const t = now(), o = out(0.35);
    [392, 349, 311, 262].forEach((f, i) => tone(o, t + i * 0.18, 'triangle', f, f * 0.98, 0.3, 0.5));
  },
  hit(head) {
    if (!ctx) return;
    const t = now(), o = out(0.45);
    tone(o, t, 'square', head ? 1500 : 1000, head ? 1800 : 950, 0.05, 0.2);
    if (head) tone(o, t + 0.03, 'sine', 2600, 2500, 0.18, 0.35);
  },
  hurt() {
    if (!ctx) return;
    const t = now(), o = out(0.7);
    tone(o, t, 'triangle', 220, 90, 0.18, 0.4);
    burst(o, t, 0.12, 'lowpass', 900, 200, 1, 0.4);
  },
  footstep(vol = 0.25, pan = 0) {
    if (!ctx) return;
    burst(out(vol, pan), now(), 0.08, 'bandpass', 520 + Math.random() * 120, 240, 1.3, 0.5);
  },
  jump() {
    if (!ctx) return;
    burst(out(0.15), now(), 0.08, 'bandpass', 700, 400, 1, 0.4);
  },
  magOut() { if (!ctx) return; const t = now(), o = out(0.4); burst(o, t, 0.05, 'highpass', 2500, 1800, 1, 0.6); tone(o, t, 'square', 700, 500, 0.04, 0.12); },
  magIn() { if (!ctx) return; const t = now(), o = out(0.45); burst(o, t, 0.06, 'bandpass', 1800, 1200, 2, 0.7); tone(o, t + 0.02, 'square', 900, 600, 0.05, 0.15); },
  bolt() { if (!ctx) return; const t = now(), o = out(0.45); burst(o, t, 0.04, 'highpass', 3000, 2000, 1, 0.6); burst(o, t + 0.09, 0.05, 'highpass', 2600, 1600, 1, 0.7); },
  empty() { if (!ctx) return; burst(out(0.4), now(), 0.03, 'highpass', 4000, 3000, 1, 0.6); },
  elim() {
    if (!ctx) return;
    const t = now(), o = out(0.35);
    [523, 659, 784, 1047].forEach((f, i) => tone(o, t + i * 0.07, 'triangle', f, f, 0.14, 0.5));
  },
  wave() {
    if (!ctx) return;
    const t = now(), o = out(0.3);
    tone(o, t, 'sawtooth', 330, 330, 0.18, 0.25);
    tone(o, t + 0.2, 'sawtooth', 440, 440, 0.3, 0.25);
  },
  death() {
    if (!ctx) return;
    const t = now(), o = out(0.4);
    [440, 370, 311, 262].forEach((f, i) => tone(o, t + i * 0.14, 'triangle', f, f * 0.97, 0.2, 0.5));
  },
};
