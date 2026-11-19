// Lanternfall game engine: a canvas survival roguelite.
// Plain JavaScript on purpose: it is a hot loop full of numeric arrays, and the typed
// boundary lives in engine.d.ts. The DOM it drives (HUD, level-up and pause overlays)
// is declared in game.html.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const vrand = (a, b) => a + Math.random() * (b - a); // visuals only
const fmtTime = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/* ================= Audio (synthesised, no files) ================= */
function createSfx(settings) {
  let ac = null, master = null, nbuf = null;
  const last = {};
  function init() {
    if (!ac) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ac = new AC();
        master = ac.createGain(); master.gain.value = 0.3; master.connect(ac.destination);
        nbuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.6), ac.sampleRate);
        const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
  }
  const on = () => ac && settings.sound;
  const ok = (k, ms) => { if (!on()) return false; const n = performance.now(); if (last[k] && n - last[k] < ms) return false; last[k] = n; return true; };
  function tone(f, f2, t, type, v, delay = 0) {
    const now = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, now);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), now + t);
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(v, now + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, now + t);
    o.connect(g); g.connect(master); o.start(now); o.stop(now + t + 0.03);
  }
  function noise(t, v, freq, q = 1, delay = 0, type = 'bandpass') {
    const now = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nbuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(v, now); g.gain.exponentialRampToValueAtTime(0.0001, now + t);
    s.connect(f); f.connect(g); g.connect(master); s.start(now, Math.random() * 0.2); s.stop(now + t + 0.02);
  }
  return {
    init,
    shoot() { if (ok('shoot', 70)) tone(vrand(780, 940), 380, 0.07, 'square', 0.035); },
    hit() { if (ok('hit', 40)) noise(0.05, 0.1, vrand(1800, 2600), 2); },
    kill() { if (ok('kill', 45)) { tone(vrand(280, 360), 110, 0.09, 'triangle', 0.1); noise(0.07, 0.06, 900, 1); } },
    pickup(step) { if (ok('pick', 30)) tone(620 * Math.pow(1.0595, Math.min(step, 26)), null, 0.07, 'sine', 0.07); },
    level() { if (on()) [523, 659, 784, 1047].forEach((f, i) => tone(f, null, 0.18, 'triangle', 0.13, i * 0.07)); },
    hurt() { if (ok('hurt', 120)) { tone(190, 70, 0.25, 'sawtooth', 0.16); noise(0.2, 0.16, 400, 0.7); } },
    dash() { if (ok('dash', 80)) noise(0.18, 0.14, 1600, 0.6, 0, 'highpass'); },
    boom() { if (ok('boom', 70)) { noise(0.45, 0.28, 240, 0.6, 0, 'lowpass'); tone(110, 40, 0.35, 'sine', 0.22); } },
    zap() { if (ok('zap', 70)) { tone(1500, 300, 0.09, 'sawtooth', 0.045); noise(0.08, 0.06, 3200, 3); } },
    nova() { if (ok('nova', 100)) { tone(220, 620, 0.25, 'sine', 0.11); noise(0.25, 0.07, 1200, 0.8); } },
    warn() { if (on()) { tone(110, 90, 1.0, 'sawtooth', 0.1); tone(117, 86, 1.0, 'sawtooth', 0.08, 0.05); } },
    chest() { if (on()) [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, null, 0.2, 'square', 0.05, i * 0.05)); },
    evolve() { if (on()) [262, 392, 523, 784, 1047, 1568].forEach((f, i) => tone(f, null, 0.35, 'triangle', 0.12, i * 0.06)); },
    click() { if (ok('click', 40)) tone(720, 520, 0.05, 'triangle', 0.07); },
    heart() { if (ok('heart', 750)) { tone(70, 50, 0.12, 'sine', 0.28); tone(70, 50, 0.12, 'sine', 0.2, 0.16); } },
    heal() { if (ok('heal', 200)) [660, 880].forEach((f, i) => tone(f, null, 0.15, 'sine', 0.09, i * 0.07)); },
    win() { if (on()) [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, null, 0.32, 'triangle', 0.14, i * 0.13)); },
    lose() { if (on()) [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.97, 0.38, 'triangle', 0.13, i * 0.2)); },
  };
}

/* ================= Content ================= */
export const WEAPONS = {
  bolt:  { name: 'Lantern Bolt', color: '#FFB547', evo: 'eye', evoName: 'Sunlance',
    lv: ['Fires a bolt at the nearest enemy.', '+1 bolt per volley.', '+30% damage.', 'Bolts pierce 1 more enemy.', '+1 bolt and 20% faster volleys.'],
    evoDesc: 'Four huge bolts per volley that pierce everything, twice as often.' },
  orbit: { name: 'Moth Ring', color: '#C58BFF', evo: 'boots', evoName: 'Moth Storm',
    lv: ['Two moths circle you and hurt what they touch.', '+1 moth.', '+35% damage and a wider ring.', '+1 moth that spins faster.', '+1 moth and +25% damage.'],
    evoDesc: 'Seven moths on a wide, fast ring that hit hard.' },
  nova:  { name: 'Flare Pulse', color: '#FF7A2F', evo: 'bark', evoName: 'Solar Flare',
    lv: ['A burning ring bursts out and pushes enemies back.', '+25% damage.', 'Bigger ring.', 'Pulses 15% more often.', 'Bigger ring and +25% damage.'],
    evoDesc: 'A giant ring every 1.8 s that stuns everything it touches.' },
  chain: { name: 'Arc Spark', color: '#5FE3E0', evo: 'wick', evoName: 'Storm Lantern',
    lv: ['Lightning jumps between 3 enemies.', '+1 jump.', '+25% damage.', '+1 jump and faster.', '+2 jumps.'],
    evoDesc: 'Two storms that jump 10 times each, almost twice as often.' },
  comet: { name: 'Ember Comet', color: '#FF4D6D', evo: 'kindle', evoName: 'Meteor Rain',
    lv: ['Launches a homing comet that explodes on impact.', '+25% damage.', '+1 comet.', 'Bigger explosions.', '+1 comet and faster launches.'],
    evoDesc: 'Five comets with huge explosions.' },
};
export const PASSIVES = {
  boots:  { name: 'Swift Boots', color: '#6BE38E', desc: '+8% move speed.' },
  heart:  { name: 'Heart Oil', color: '#FF4D6D', desc: '+20 max HP and heal 20.' },
  kindle: { name: 'Kindling', color: '#FF7A2F', desc: '+10% damage.' },
  wick:   { name: 'Quick Wick', color: '#FFD166', desc: 'Weapons recharge 8% faster.' },
  lode:   { name: 'Lodestone', color: '#5FE3E0', desc: '+30% spark pickup range.' },
  eye:    { name: 'Ember Eye', color: '#FFB547', desc: '+6% critical chance. Crits deal 20% more.' },
  bark:   { name: 'Bark Skin', color: '#C9A06A', desc: 'Take 1 less damage from every hit.' },
  mend:   { name: 'Rekindle', color: '#F27FB2', desc: 'Recover 0.5 HP per second.' },
};
const MAX_W = 3, MAX_P = 4;
function wstats(id, l, evo) {
  const i = l - 1;
  switch (id) {
    case 'bolt': return evo ? { cd: 0.42, n: 4, dmg: 24, pierce: 99, size: 9, spd: 650 }
      : { cd: [0.8, 0.8, 0.8, 0.8, 0.64][i], n: [1, 2, 2, 2, 3][i], dmg: [12, 12, 15.5, 15.5, 15.5][i], pierce: [0, 0, 0, 1, 1][i], size: 5, spd: 560 };
    case 'orbit': return evo ? { n: 7, dmg: 18, rad: 104, spin: 5 }
      : { n: [2, 3, 3, 4, 5][i], dmg: [10, 10, 13, 13, 16][i], rad: [68, 68, 82, 82, 88][i], spin: [3.2, 3.2, 3.2, 4, 4][i] };
    case 'nova': return evo ? { cd: 1.8, dmg: 40, rad: 240, kb: 360, stun: 0.7 }
      : { cd: [2.6, 2.6, 2.6, 2.2, 2.2][i], dmg: [16, 20, 20, 20, 25][i], rad: [120, 120, 150, 150, 180][i], kb: 280, stun: 0 };
    case 'chain': return evo ? { cd: 0.9, jumps: 10, dmg: 24, count: 2, range: 200 }
      : { cd: [1.5, 1.5, 1.5, 1.28, 1.28][i], jumps: [2, 3, 3, 4, 6][i], dmg: [13, 13, 16, 16, 16][i], count: 1, range: 175 };
    case 'comet': return evo ? { cd: 1.6, n: 5, dmg: 50, aoe: 110 }
      : { cd: [2.2, 2.2, 2.2, 2.2, 1.75][i], n: [1, 1, 2, 2, 3][i], dmg: [26, 32, 32, 32, 32][i], aoe: [64, 64, 64, 86, 86][i] };
  }
  return { cd: 1 };
}

const ETYPES = {
  shade:   { name: 'Shade', hp: 10, spd: 74, r: 12, dmg: 6, xp: 1, color: '#7B5CFF', eye: '#EDE4FF', mass: 1 },
  wisp:    { name: 'Wisp', hp: 7, spd: 138, r: 9, dmg: 5, xp: 1, color: '#C58BFF', eye: '#FFFFFF', mass: 0.6 },
  brute:   { name: 'Brute', hp: 70, spd: 47, r: 20, dmg: 14, xp: 5, color: '#D63A5A', eye: '#FFE1E6', mass: 4 },
  spitter: { name: 'Spitter', hp: 22, spd: 62, r: 13, dmg: 8, xp: 3, color: '#FF8A3D', eye: '#FFF1E0', mass: 1.2 },
  bloater: { name: 'Bloater', hp: 30, spd: 56, r: 16, dmg: 22, xp: 4, color: '#58C97A', eye: '#EFFFF3', mass: 2 },
  warden:  { name: 'The Warden', hp: 1500, spd: 72, r: 38, dmg: 20, xp: 60, color: '#C9304E', eye: '#FFD166', mass: 40, boss: true },
  king:    { name: 'The Hollow King', hp: 2000, spd: 78, r: 46, dmg: 22, xp: 60, color: '#2E2156', eye: '#FFD166', mass: 60, boss: true },
};
const DAWN = 90;
const WAVES = [
  { dur: 25, rate: 1.5, mix: { shade: 1 }, hint: 'Shades drift in from the dark.' },
  { dur: 30, rate: 2.3, mix: { shade: 3, wisp: 1 }, hint: 'Wisps are fast but fragile.' },
  { dur: 30, rate: 2.9, mix: { shade: 3, wisp: 2, spitter: 1 }, hint: 'Spitters glow before they shoot. Step aside.' },
  { dur: 35, rate: 3.5, mix: { shade: 3, wisp: 2, brute: 1, spitter: 1 }, hint: 'Brutes are slow and tough. Keep moving.', ring: true },
  { dur: 35, rate: 4.2, mix: { shade: 3, wisp: 3, brute: 1, bloater: 1, spitter: 2 }, hint: 'Bloaters burst up close. Pop them early to hurt the crowd.' },
  { boss: true, rate: 1.8, mix: { shade: 2, wisp: 2, spitter: 1 }, hint: '' },
];

const ICONS = {
  bolt: '<path d="M4 20 L15 9"/><path d="M10 5 L19 5 L19 14"/>',
  orbit: '<circle cx="12" cy="12" r="2.6"/><circle cx="12" cy="12" r="8.5" stroke-dasharray="3 3.2"/><circle cx="20.5" cy="12" r="1.8" fill="currentColor"/><circle cx="7.7" cy="4.6" r="1.6" fill="currentColor"/>',
  nova: '<circle cx="12" cy="12" r="2.4"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="9.6" opacity=".55"/>',
  chain: '<path d="M13 2 L6 13 H12 L10 22 L18 10 H12 Z"/>',
  comet: '<circle cx="16" cy="8" r="4"/><path d="M13 11 L4 20 M11.5 8.5 L5 12 M15.5 12.5 L12 19"/>',
  boots: '<path d="M5 6 L11 12 L5 18 M12 6 L18 12 L12 18"/>',
  heart: '<path d="M12 20 C4 14 3 9 6 6.5 C8.5 4.5 11 6 12 8 C13 6 15.5 4.5 18 6.5 C21 9 20 14 12 20 Z"/>',
  kindle: '<path d="M12 21 C7 21 5 17 6.5 13.5 C7.5 11 9 10 9 7 C11.5 8.5 12 10.5 11.5 12 C13 11 14 9 13.5 3 C17 6 19 10 18 15 C17.3 18.7 15 21 12 21 Z"/>',
  wick: '<path d="M7 3 H17 M7 21 H17 M8 3 C8 9 16 9 16 12 C16 15 8 15 8 21 M16 3 C16 9 8 9 8 12 C8 15 16 15 16 21"/>',
  lode: '<path d="M6 4 V12 A6 6 0 0 0 18 12 V4 M6 8 H9.5 M14.5 8 H18"/>',
  eye: '<path d="M2 12 C5 6.5 8.5 5 12 5 C15.5 5 19 6.5 22 12 C19 17.5 15.5 19 12 19 C8.5 19 5 17.5 2 12 Z"/><circle cx="12" cy="12" r="3"/>',
  bark: '<path d="M12 3 L20 6 V12 C20 16.5 16.5 19.5 12 21 C7.5 19.5 4 16.5 4 12 V6 Z"/>',
  mend: '<path d="M12 5 V19 M5 12 H19"/>',
  cache: '<path d="M4 9 H20 V20 H4 Z M4 9 L6 4 H18 L20 9 M12 9 V20"/>',
};
export const svgIcon = (id, color) => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id] || ''}</svg>`;

/* ================= Engine ================= */
export function createEngine(opts) {
  const { canvas: cv, settings } = opts;
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const Sfx = createSfx(settings);
  let W = 0, H = 0, DPR = 1, ZOOM = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ZOOM = Math.max(0.6, Math.min(1.1, Math.min(W, H) / 760));
  }
  window.addEventListener('resize', resize); resize();

  const G = { mode: 'idle', ts: 1, tsTarget: 1, hitstop: 0, trauma: 0, flash: 0, flashRGB: '255,255,255', hurtFlash: 0, levelupIn: -1, cam: { x: 0, y: 0 } };
  let R = null, M = null, srand = Math.random;
  const keys = {};
  let joy = null;
  const rand = (a, b) => a + srand() * (b - a);
  const spick = (a) => a[Math.floor(srand() * a.length)];

  function xpFor(l) { return Math.floor(2 + 2 * l + Math.pow(l, 1.45)); }

  function modsFor(id) {
    const m = { hp: 1, xp: 1, spawn: 1, enemySpd: 1, playerSpd: 1, dmg: 1, taken: 1, maxHp: 100, cards: 3, rerolls: 1, elite: 18, light: 1, magnet: 1, bloatDmg: 1, wispSpd: 1, dash: true, extraMix: {} };
    switch (id) {
      case 'blood_moon': m.hp = 1.4; m.xp = 2; break;
      case 'wisp_storm': m.extraMix = { wisp: 4 }; m.wispSpd = 1.25; break;
      case 'glass_lantern': m.maxHp = 60; m.dmg = 1.5; break;
      case 'swarm': m.spawn = 2; m.hp = 0.5; break;
      case 'bloom': m.extraMix = { bloater: 2 }; m.bloatDmg = 2; break;
      case 'fog': m.light = 0.62; m.magnet = 1.5; break;
      case 'generous': m.cards = 4; m.rerolls = 2; break;
      case 'restless': m.playerSpd = 1.25; m.enemySpd = 1.25; break;
      case 'elite_hunt': m.elite = 12; break;
      case 'iron_bark': m.playerSpd = 0.88; break;
      case 'heavy_boots': m.dash = false; m.taken = 0.75; break;
    }
    return m;
  }

  function newRun(night) {
    srand = mulberry32(night.seed);
    M = modsFor(night.modifier);
    R = {
      night, t: 0, wave: 0, waveT: 0, spawnAcc: 0, eliteT: 0, ringDone: false, bossIn: -1, boss: null, dawnT: -1,
      kills: 0, bossKilled: false, dawnLeft: 0, streak: 0, streakT: 0, bestStreak: 0,
      enemies: [], shots: [], ebullets: [], gems: [], pickups: [], parts: [], texts: [], rings: [], comets: [], arcs: [],
      weapons: {}, passives: {}, evolved: {}, timers: {}, pendingLevels: 0, pendingChests: 0,
      rerolls: M.rerolls, over: false, victory: false, overIn: -1, ended: false,
      pickChain: 0, pickChainT: 0, orbA: 0, tips: [], lowHp: false,
    };
    R.p = { x: 0, y: 0, vx: 0, vy: 0, r: 14, hp: 100, maxHp: 100, inv: 1, dashT: 0, dashCd: 0, dx: 1, dy: 0, face: 1, lvl: 1, xp: 0, next: xpFor(1), squash: 0, moving: false, ghostT: 0, walk: 0, ddx: 1, ddy: 0 };
    R.weapons[night.start] = 1; R.timers[night.start] = 0.6;
    if (night.modifier === 'falling_stars') { if (R.weapons.comet) R.weapons.comet = 2; else { R.weapons.comet = 1; R.timers.comet = 1.2; } }
    if (night.modifier === 'iron_bark') R.passives.bark = 2;
    recalc(); R.p.hp = R.p.maxHp;
    G.cam.x = 0; G.cam.y = 0; G.ts = 1; G.tsTarget = 1; G.hitstop = 0; G.trauma = 0; G.levelupIn = -1; G.hurtFlash = 0; G.flash = 0;
    if (opts.firstTime) R.tips = [[1.2, coarse ? 'Drag anywhere to move. Your weapon fires on its own.' : 'Move with WASD or the arrow keys. Your weapon fires on its own.'],
      [8, M.dash ? (coarse ? 'Tap Dash to slip through enemies. You cannot be hit while dashing.' : 'Press Space to dash. You cannot be hit while dashing.') : 'No dash tonight. Keep your distance.'],
      [15, 'Collect the blue sparks enemies drop to level up.']];
    startWave(1);
  }
  function recalc() {
    const p = R.p, ps = R.passives, oldMax = p.maxHp;
    p.maxHp = M.maxHp + 20 * (ps.heart || 0);
    if (p.maxHp > oldMax) p.hp += p.maxHp - oldMax;
    p.speed = 205 * M.playerSpd * (1 + 0.08 * (ps.boots || 0));
    p.dmgMul = M.dmg * (1 + 0.1 * (ps.kindle || 0));
    p.cdMul = Math.pow(0.92, ps.wick || 0);
    p.magnet = 110 * M.magnet * (1 + 0.3 * (ps.lode || 0));
    p.crit = 0.05 + 0.06 * (ps.eye || 0);
    p.critMul = 2 + 0.2 * (ps.eye || 0);
    p.armor = ps.bark || 0;
    p.regen = 0.5 * (ps.mend || 0);
    p.dashMax = 1.15;
  }
  const ws = (id) => wstats(id, R.weapons[id], R.evolved[id]);

  /* ---------- juice ---------- */
  const shake = (a) => { G.trauma = Math.min(1, G.trauma + a); };
  const hitstop = (s) => { G.hitstop = Math.max(G.hitstop, s); };
  function flash(a, rgb = '255,255,255') { G.flash = Math.max(G.flash, a); G.flashRGB = rgb; }
  function part(o) { if (R.parts.length > 900) R.parts.shift(); R.parts.push(o); }
  function burst(x, y, n, color, spd = 170, life = 0.5, size = 3, type = 'dot') {
    for (let i = 0; i < n; i++) {
      const a = vrand(0, TAU), s = vrand(spd * 0.3, spd), l = vrand(life * 0.6, life);
      part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: l, max: l, size: vrand(size * 0.6, size), color, type, drag: 4 });
    }
  }
  function ringFx(x, y, r, color, life = 0.35, w = 4) { part({ x, y, vx: 0, vy: 0, life, max: life, size: r, color, type: 'ring', w, drag: 0 }); }
  function text(x, y, s, color = '#F4EEE2', size = 14) { if (R.texts.length > 80) R.texts.shift(); R.texts.push({ x: x + vrand(-6, 6), y, vy: -60, life: 0.7, max: 0.7, s, color, size }); }
  function banner(t, s = '', cls = '') {
    const b = $('banner'); $('bannerT').textContent = t; $('bannerS').textContent = s;
    b.className = cls; void b.offsetWidth; b.className = (cls ? cls + ' ' : '') + 'show';
  }
  let tipHide = 0;
  function tip(s) { const t = $('tip'); t.textContent = s; t.hidden = false; t.style.opacity = '1'; tipHide = 5; }

  /* ---------- waves ---------- */
  const hpMul = () => (1 + 0.22 * (R.wave - 1) + 0.003 * R.t) * M.hp;
  function startWave(n) {
    R.wave = n; R.waveT = 0; R.spawnAcc = 0; R.eliteT = 0; R.ringDone = false;
    const w = WAVES[n - 1];
    if (w.boss) {
      const name = ETYPES[R.night.boss].name;
      banner('Final wave', name + ' rises. Defeat it before dawn.', 'danger');
      Sfx.warn(); R.bossIn = 2.6; shake(0.25);
      setTimeout(() => { if (R && R.wave === n && !R.over) tip(R.night.boss === 'king' ? 'The king fires rings of light. Weave through the gaps.' : 'The Warden charges in a straight line. Dash sideways.'); }, 2700);
    } else banner('Wave ' + n + ' of 6', w.hint);
  }
  function spawnPoint(extra = 0) {
    const a = rand(0, TAU), d = Math.hypot(W, H) / 2 / ZOOM + 50 + extra;
    return { x: R.p.x + Math.cos(a) * d, y: R.p.y + Math.sin(a) * d };
  }
  function weightedType(mix) {
    const full = { ...mix };
    if (R.wave >= 2) for (const k in M.extraMix) full[k] = (full[k] || 0) + M.extraMix[k];
    let tot = 0; for (const k in full) tot += full[k];
    let r = srand() * tot; for (const k in full) { r -= full[k]; if (r <= 0) return k; }
    return Object.keys(full)[0];
  }
  function spawnEnemy(type, x, y, elite) {
    const d = ETYPES[type];
    const e = { type, d, x, y, kx: 0, ky: 0, r: d.r * (elite ? 1.35 : 1), hp: d.boss ? d.hp : d.hp * hpMul() * (elite ? 7 : 1),
      spd: d.spd * M.enemySpd * (type === 'wisp' ? M.wispSpd : 1) * (1 + 0.025 * (R.wave - 1)) * rand(0.9, 1.1), flash: 0, stun: 0, dead: false, elite: !!elite,
      t: rand(0, 10), cd: rand(1.2, 2.6), fuse: -1, orbHit: 0, seed: srand() * 1000, state: 'chase', st: 2.5, sum: 6, ax: 1, ay: 0, vol: 0, spinA: 0, second: false, spawnT: 0.35, next: 'burst' };
    if (d.boss) e.spd = d.spd * M.enemySpd;
    e.maxHp = e.hp; R.enemies.push(e); return e;
  }
  function updateSpawns(dt) {
    const w = WAVES[R.wave - 1];
    R.waveT += dt;
    if (R.bossIn > 0) {
      R.bossIn -= dt;
      if (R.bossIn <= 0) {
        const sp = spawnPoint(-120), e = spawnEnemy(R.night.boss, sp.x, sp.y, false);
        R.boss = e; R.dawnT = DAWN; $('bossName').textContent = e.d.name; $('bossbar').hidden = false;
        shake(0.5); ringFx(e.x, e.y, 120, '#FF4D6D', 0.6, 6);
        for (const o of R.enemies) if (!o.dead && !o.d.boss && !o.elite) { o.dead = true; burst(o.x, o.y, 4, o.d.color, 90, 0.5, 2.5); }
      }
    }
    if (R.dawnT > 0) {
      R.dawnT -= dt;
      if (R.dawnT <= 0 && !R.over) { R.dawnT = 0; dawnBreaks(false); return; }
    }
    const prog = w.dur ? clamp(R.waveT / w.dur, 0, 1) : 0.5;
    if (R.enemies.length < 400) {
      R.spawnAcc += w.rate * M.spawn * (0.8 + 0.5 * prog) * dt;
      while (R.spawnAcc >= 1) {
        R.spawnAcc -= 1;
        const type = weightedType(w.mix), sp = spawnPoint();
        if (srand() < 0.14) { for (let i = 0; i < 4; i++) spawnEnemy(type, sp.x + rand(-30, 30), sp.y + rand(-30, 30)); }
        else spawnEnemy(type, sp.x, sp.y);
      }
    }
    if (!w.boss && R.wave >= 2) {
      R.eliteT += dt;
      if (R.eliteT >= M.elite) { R.eliteT = 0; const sp = spawnPoint(); spawnEnemy(weightedType(w.mix), sp.x, sp.y, true); }
    }
    if (w.ring && !R.ringDone && R.waveT > 16) {
      R.ringDone = true;
      const n = 26, gapA = rand(0, TAU), rr = 380;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const diff = Math.abs(((a - gapA + Math.PI * 3) % TAU) - Math.PI);
        if (diff < 0.45) continue;
        spawnEnemy('shade', R.p.x + Math.cos(a) * rr, R.p.y + Math.sin(a) * rr);
      }
      banner('Encircled', M.dash ? 'Find the gap or dash through.' : 'Find the gap.', 'danger'); Sfx.warn();
    }
    if (!w.boss && R.waveT >= w.dur) {
      const heal = Math.round(R.p.maxHp * 0.1);
      R.p.hp = Math.min(R.p.maxHp, R.p.hp + heal); text(R.p.x, R.p.y - 30, '+' + heal, '#6BE38E', 16);
      startWave(R.wave + 1);
    }
  }

  /* ---------- player ---------- */
  function inputVec() {
    let ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), iy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (joy && joy.active) {
      const jx = (joy.x - joy.ox) / 56, jy = (joy.y - joy.oy) / 56, l = Math.hypot(jx, jy);
      if (l > 0.15) { const m = Math.min(1, l); ix += jx / l * m; iy += jy / l * m; }
    }
    const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; }
    return { x: ix, y: iy, l: Math.min(1, l) };
  }
  function updatePlayer(dt) {
    const p = R.p, v = inputVec();
    p.moving = v.l > 0.1;
    if (p.moving) { p.dx = v.x / v.l; p.dy = v.y / v.l; if (Math.abs(v.x) > 0.05) p.face = Math.sign(v.x); }
    if (p.dashT > 0) {
      p.dashT -= dt; p.vx = p.ddx * p.speed * 3.4; p.vy = p.ddy * p.speed * 3.4;
      p.ghostT -= dt;
      if (p.ghostT <= 0) { p.ghostT = 0.025; part({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.22, max: 0.22, size: p.r, color: '#FFB547', type: 'ghost', drag: 0 }); }
    } else {
      const k = p.moving ? 16 : 11;
      p.vx = damp(p.vx, v.x * p.speed, k, dt); p.vy = damp(p.vy, v.y * p.speed, k, dt);
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.walk += Math.hypot(p.vx, p.vy) * dt * 0.05;
    p.dashCd = Math.max(0, p.dashCd - dt); p.inv = Math.max(0, p.inv - dt);
    if (p.regen && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
    p.squash = damp(p.squash, 0, 9, dt);
    if (p.moving && Math.random() < dt * 9) part({ x: p.x - p.dx * 8 + vrand(-4, 4), y: p.y + 10, vx: -p.dx * 20, vy: -10, life: 0.35, max: 0.35, size: vrand(1.5, 3), color: '#3A3264', type: 'dot', drag: 3 });
  }
  function tryDash() {
    if (G.mode !== 'play' || !R || R.over || !M.dash) return;
    const p = R.p; if (p.dashCd > 0 || p.dashT > 0) return;
    let dx = p.dx, dy = p.dy; const v = inputVec(); if (v.l > 0.1) { dx = v.x / v.l; dy = v.y / v.l; }
    p.ddx = dx; p.ddy = dy; p.dashT = 0.16; p.dashCd = p.dashMax; p.inv = Math.max(p.inv, 0.22); p.squash = 1;
    Sfx.dash(); shake(0.06); burst(p.x, p.y, 8, '#FFB547', 120, 0.3, 2.5);
  }
  function hurtPlayer(dmg, srcX, srcY) {
    const p = R.p;
    if (p.inv > 0 || p.dashT > 0 || R.over) return;
    dmg = Math.max(1, Math.round((dmg - p.armor) * M.taken));
    p.hp -= dmg; p.inv = 0.75;
    G.hurtFlash = 0.45; shake(0.38); hitstop(0.06); Sfx.hurt();
    text(p.x, p.y - 26, '-' + dmg, '#FF4D6D', 18);
    burst(p.x, p.y, 12, '#FF4D6D', 200, 0.45, 3);
    if (srcX != null) { const a = Math.atan2(p.y - srcY, p.x - srcX); p.vx += Math.cos(a) * 260; p.vy += Math.sin(a) * 260; }
    if (R.streak >= 10) text(p.x, p.y - 44, 'Streak lost', '#A69EC4', 13);
    R.streak = 0; R.streakT = 0;
    if (p.hp <= 0) endRun(false);
  }

  /* ---------- weapons ---------- */
  function nearestEnemy(x, y, maxD, exclude) {
    let best = null, bd = maxD * maxD;
    for (const e of R.enemies) {
      if (e.dead || (exclude && exclude.has(e))) continue;
      const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function updateWeapons(dt) {
    const p = R.p;
    for (const id in R.weapons) {
      const s = ws(id);
      if (id === 'orbit') { updateOrbit(s, dt); continue; }
      R.timers[id] = (R.timers[id] ?? 0.5) - dt;
      if (R.timers[id] > 0) continue;
      R.timers[id] = fire(id, s) ? s.cd * p.cdMul : 0.12;
    }
  }
  function fire(id, s) {
    const p = R.p, evo = R.evolved[id];
    if (id === 'bolt') {
      let t = nearestEnemy(p.x, p.y, 560);
      if (R.boss && !R.boss.dead && Math.random() < 0.6 && Math.hypot(R.boss.x - p.x, R.boss.y - p.y) < 600) t = R.boss;
      if (!t) return false;
      const base = Math.atan2(t.y - p.y, t.x - p.x);
      for (let i = 0; i < s.n; i++) {
        const a = base + (i - (s.n - 1) / 2) * 0.14;
        R.shots.push({ x: p.x, y: p.y, vx: Math.cos(a) * s.spd, vy: Math.sin(a) * s.spd, dmg: s.dmg, pierce: s.pierce, r: s.size, life: 1.1, hit: new Set(), evo });
      }
      p.squash = Math.max(p.squash, 0.25); Sfx.shoot();
      burst(p.x + Math.cos(base) * 16, p.y + Math.sin(base) * 16, 3, evo ? '#FFF2C2' : '#FFB547', 90, 0.15, 2);
      return true;
    }
    if (id === 'nova') {
      if (!nearestEnemy(p.x, p.y, s.rad * 1.15)) return false;
      R.rings.push({ x: p.x, y: p.y, r: 8, max: s.rad, dmg: s.dmg, kb: s.kb, stun: s.stun, hit: new Set(), evo });
      Sfx.nova(); shake(evo ? 0.18 : 0.1);
      return true;
    }
    if (id === 'chain') {
      let any = false;
      for (let c = 0; c < s.count; c++) {
        const used = new Set(); let from = { x: p.x, y: p.y }, cur = nearestEnemy(p.x, p.y, s.range + 60, used);
        // during the boss fight the first strike prefers the boss when it is in reach
        if (c === 0 && R.boss && !R.boss.dead && Math.hypot(R.boss.x - p.x, R.boss.y - p.y) < s.range + 120) cur = R.boss;
        if (!cur) break;
        const pts = [{ x: p.x, y: p.y }];
        for (let j = 0; j <= s.jumps && cur; j++) {
          used.add(cur); pts.push({ x: cur.x, y: cur.y });
          hurtEnemy(cur, s.dmg, { kx: cur.x - from.x, ky: cur.y - from.y, kb: 60, color: '#5FE3E0' });
          from = cur; cur = nearestEnemy(from.x, from.y, s.range, used);
        }
        R.arcs.push({ pts, life: 0.16, max: 0.16, evo }); any = true;
      }
      if (any) Sfx.zap();
      return any;
    }
    if (id === 'comet') {
      const pool = R.enemies.filter((e) => !e.dead).sort((a, b) => ((a.x - p.x) ** 2 + (a.y - p.y) ** 2) - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2)).slice(0, 8);
      if (R.boss && !R.boss.dead && !pool.includes(R.boss)) pool.push(R.boss, R.boss);
      if (!pool.length) return false;
      for (let i = 0; i < s.n; i++) {
        const a = vrand(0, TAU);
        R.comets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, target: pool[Math.floor(Math.random() * pool.length)], dmg: s.dmg, aoe: s.aoe, life: 3, sp: 160, evo, trail: 0 });
      }
      Sfx.shoot();
      return true;
    }
    return false;
  }
  function orbPositions(s) {
    const out = [];
    for (let i = 0; i < s.n; i++) { const a = R.orbA + (i / s.n) * TAU; out.push({ x: R.p.x + Math.cos(a) * s.rad, y: R.p.y + Math.sin(a) * s.rad, a }); }
    return out;
  }
  function updateOrbit(s, dt) {
    R.orbA += s.spin * dt;
    for (const o of orbPositions(s)) {
      forNear(o.x, o.y, 12, (e) => {
        if (R.t < e.orbHit) return;
        e.orbHit = R.t + 0.35;
        hurtEnemy(e, s.dmg, { kx: e.x - R.p.x, ky: e.y - R.p.y, kb: 150, color: '#C58BFF' });
      });
    }
  }

  /* ---------- spatial grid ---------- */
  const CELL = 64; let grid = new Map();
  const gk = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);
  function buildGrid() {
    grid = new Map();
    for (const e of R.enemies) {
      if (e.dead) continue;
      const k = gk(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
      let a = grid.get(k); if (!a) { a = []; grid.set(k, a); } a.push(e);
    }
  }
  function forNear(x, y, r, cb) {
    const reach = r + 48;
    const x0 = Math.floor((x - reach) / CELL), x1 = Math.floor((x + reach) / CELL), y0 = Math.floor((y - reach) / CELL), y1 = Math.floor((y + reach) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const a = grid.get(gk(cx, cy)); if (!a) continue;
      for (const e of a) {
        if (e.dead) continue;
        const dx = e.x - x, dy = e.y - y, rr = r + e.r;
        if (dx * dx + dy * dy < rr * rr) cb(e);
      }
    }
  }

  /* ---------- damage ---------- */
  function hurtEnemy(e, dmg, o = {}) {
    if (e.dead) return;
    const p = R.p; let crit = false;
    dmg *= p.dmgMul;
    if (Math.random() < p.crit) { dmg *= p.critMul; crit = true; }
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg; e.flash = 0.09;
    if (o.kb) { const l = Math.hypot(o.kx || 0, o.ky || 0) || 1, m = e.d.boss ? 0.05 : 1 / e.d.mass; e.kx += (o.kx / l) * o.kb * m; e.ky += (o.ky / l) * o.kb * m; }
    if (o.stun && !e.d.boss) e.stun = Math.max(e.stun, o.stun);
    text(e.x, e.y - e.r, crit ? dmg + '!' : String(dmg), crit ? '#FFB547' : '#F4EEE2', crit ? 17 : 13);
    Sfx.hit();
    if (o.color) burst(e.x, e.y, crit ? 5 : 2, o.color, 120, 0.25, 2.2);
    if (e.d.boss && crit) hitstop(0.02);
    if (e.hp <= 0) killEnemy(e);
  }
  function dropGem(x, y, v) {
    v *= M.xp;
    if (R.gems.length > 320) { const g = R.gems[Math.floor(Math.random() * R.gems.length)]; g.v += v; return; }
    R.gems.push({ x: x + vrand(-6, 6), y: y + vrand(-6, 6), vx: vrand(-70, 70), vy: vrand(-70, 70), v, pull: false, sp: 0, t: vrand(0, 6) });
  }
  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true; R.kills++;
    const d = e.d;
    R.streak++; R.streakT = 2.6; R.bestStreak = Math.max(R.bestStreak, R.streak);
    if ([25, 50, 100, 200].includes(R.streak)) { text(R.p.x, R.p.y - 50, 'Streak ' + R.streak + '!', '#FFB547', 18); Sfx.chest(); }
    burst(e.x, e.y, d.boss ? 60 : e.elite ? 26 : 10, d.color, d.boss ? 380 : 200, d.boss ? 1.1 : 0.55, d.boss ? 6 : 3.4);
    burst(e.x, e.y, 4, '#FFFFFF', 120, 0.2, 2);
    Sfx.kill();
    const xp = d.xp * (e.elite ? 6 : 1);
    if (xp > 0) { const n = Math.min(6, Math.ceil(xp / 4)); for (let i = 0; i < n; i++) dropGem(e.x, e.y, xp / n); }
    if (!d.boss) {
      const roll = srand();
      if (roll < 0.012) R.pickups.push({ x: e.x, y: e.y, kind: 'heart', t: 0 });
      else if (roll < 0.017) R.pickups.push({ x: e.x, y: e.y, kind: 'magnet', t: 0 });
      else if (roll < 0.021 && R.wave >= 3) R.pickups.push({ x: e.x, y: e.y, kind: 'bomb', t: 0 });
    }
    if (e.elite) { R.pickups.push({ x: e.x, y: e.y, kind: 'chest', t: 0 }); hitstop(0.07); shake(0.25); ringFx(e.x, e.y, 70, '#FFD166', 0.4, 5); }
    if (e.type === 'bloater') blast(e.x, e.y, 95, 45 * hpMul() * M.bloatDmg, false);
    if (d.boss) {
      R.boss = null; $('bossbar').hidden = true;
      hitstop(0.18); shake(0.9); flash(0.9, '255,209,102'); G.ts = 0.15;
      ringFx(e.x, e.y, 260, '#FFD166', 0.9, 8);
      R.ebullets.length = 0;
      R.bossKilled = true; R.dawnLeft = Math.max(0, Math.ceil(R.dawnT));
      dawnBreaks(true);
    }
  }
  function dawnBreaks(bossDead) {
    R.victory = true; R.over = true; R.overIn = 2.6;
    for (const o of R.enemies) if (!o.dead) { o.dead = true; burst(o.x, o.y, 8, o.d.color, 180, 0.5, 3); }
    R.ebullets.length = 0; $('bossbar').hidden = true;
    banner('Dawn breaks', bossDead ? ETYPES[R.night.boss].name + ' is gone.' : 'You held the dark back until morning.', 'gold');
    flash(0.6, '255,209,102'); Sfx.win();
  }
  function blast(x, y, r, dmg, hurtsPlayer) {
    burst(x, y, 30, '#7BE39A', 300, 0.55, 4); ringFx(x, y, r, '#7BE39A', 0.35, 6);
    Sfx.boom(); shake(0.22);
    for (const o of R.enemies) {
      if (o.dead) continue;
      const dx = o.x - x, dy = o.y - y;
      if (dx * dx + dy * dy < (r + o.r) ** 2) hurtEnemy(o, dmg / R.p.dmgMul, { kx: dx, ky: dy, kb: 260 });
    }
    if (hurtsPlayer) { const dx = R.p.x - x, dy = R.p.y - y; if (dx * dx + dy * dy < (r + R.p.r) ** 2) hurtPlayer(ETYPES.bloater.dmg, x, y); }
  }

  /* ---------- enemies ---------- */
  function enemyShoot(e, a, spd, dmg, r = 6, color = '#FF8A3D') {
    R.ebullets.push({ x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r, dmg, life: 6, color });
  }
  function bossAI(e, dt, nx, ny) {
    const phase2 = e.hp < e.maxHp * 0.5, king = e.type === 'king';
    e.st -= dt; e.sum -= dt;
    let mx = 0, my = 0, spd = 0;
    if (e.sum <= 0) {
      e.sum = king ? 9 : 7;
      const n = king ? 8 : 5;
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU; spawnEnemy(king && i % 2 ? 'wisp' : 'shade', e.x + Math.cos(a) * (e.r + 30), e.y + Math.sin(a) * (e.r + 30)); }
      ringFx(e.x, e.y, e.r + 40, '#9B6BFF', 0.5, 5);
    }
    switch (e.state) {
      case 'chase':
        mx = nx; my = ny; spd = e.spd * (phase2 ? 1.25 : 1);
        if (e.st <= 0) {
          if (king) { const o = phase2 ? ['burst', 'charge', 'spiral'] : ['burst', 'charge']; e.state = 'wind'; e.next = spick(o); e.st = 0.7; }
          else { e.state = 'aim'; e.st = phase2 ? 0.6 : 0.85; }
          Sfx.warn();
        }
        break;
      case 'wind':
        if (e.st <= 0) { if (e.next === 'charge') { e.state = 'aim'; e.st = 0.65; } else { e.state = e.next; e.st = e.next === 'spiral' ? 2.4 : 1.2; e.vol = 0; e.cd = 0; } }
        break;
      case 'aim':
        if (e.st > 0.25) { e.ax = nx; e.ay = ny; }
        if (e.st <= 0) { e.state = 'charge'; e.st = 0.55; shake(0.2); }
        break;
      case 'charge':
        mx = e.ax; my = e.ay; spd = 600 * M.enemySpd;
        if (Math.random() < dt * 40) part({ x: e.x + vrand(-e.r, e.r) * 0.6, y: e.y + vrand(-e.r, e.r) * 0.6, vx: -e.ax * 80, vy: -e.ay * 80, life: 0.4, max: 0.4, size: vrand(3, 6), color: '#3A3264', type: 'dot', drag: 2 });
        if (e.st <= 0) {
          if (phase2 && !e.second) { e.second = true; e.state = 'aim'; e.st = 0.45; }
          else { e.second = false; e.state = 'rest'; e.st = 0.8; }
        }
        break;
      case 'burst':
        e.cd -= dt;
        if (e.cd <= 0 && e.vol < 3) {
          e.cd = 0.38; const n = phase2 ? 22 : 15, off = e.vol * 0.13;
          for (let i = 0; i < n; i++) enemyShoot(e, (i / n) * TAU + off, 165, 11, 7, '#FFD166');
          e.vol++; shake(0.08); Sfx.zap();
        }
        if (e.st <= 0) { e.state = 'rest'; e.st = 0.6; }
        break;
      case 'spiral':
        e.cd -= dt; e.spinA += dt * 2.6;
        if (e.cd <= 0) { e.cd = 0.1; for (let k = 0; k < 3; k++) enemyShoot(e, e.spinA + k * TAU / 3, 185, 10, 6, '#FFD166'); }
        if (e.st <= 0) { e.state = 'rest'; e.st = 0.7; }
        break;
      case 'rest':
        if (e.st <= 0) { e.state = 'chase'; e.st = rand(2, 3) * (phase2 ? 0.7 : 1); }
        break;
    }
    return { mx, my, spd };
  }
  function updateEnemies(dt) {
    const p = R.p;
    for (const e of R.enemies) {
      if (e.dead) continue;
      e.t += dt; e.flash -= dt; e.spawnT = Math.max(0, e.spawnT - dt);
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
      let mx = nx, my = ny, spd = e.spd;
      const d0 = e.d;
      if (d0.boss) { const r = bossAI(e, dt, nx, ny); mx = r.mx; my = r.my; spd = r.spd; }
      else if (e.type === 'wisp') { const w = Math.sin(e.t * 6 + e.seed) * 0.7; mx = nx - ny * w; my = ny + nx * w; const l = Math.hypot(mx, my); mx /= l; my /= l; }
      else if (e.type === 'spitter') {
        if (d < 190) { mx = -nx; my = -ny; } else if (d < 280) { const s = e.seed > 500 ? 1 : -1; mx = -ny * s; my = nx * s; spd *= 0.7; }
        e.cd -= dt;
        if (e.cd <= 0 && d < 560) { enemyShoot(e, Math.atan2(dy, dx), 200, d0.dmg * (1 + 0.05 * R.wave)); e.cd = rand(2.4, 3.2); }
      } else if (e.type === 'bloater') {
        if (e.fuse >= 0) { e.fuse -= dt; spd *= 0.15; if (e.fuse <= 0) { e.dead = true; R.kills++; dropGem(e.x, e.y, d0.xp); blast(e.x, e.y, 95, 45 * hpMul() * M.bloatDmg, true); continue; } }
        else if (d < 78) e.fuse = 0.75;
      }
      if (e.stun > 0) { e.stun -= dt; spd = 0; }
      if (e.spawnT > 0) spd *= 0.3;
      e.x += (mx * spd + e.kx) * dt; e.y += (my * spd + e.ky) * dt;
      e.kx = damp(e.kx, 0, 7, dt); e.ky = damp(e.ky, 0, 7, dt);
      if (!d0.boss) {
        forNear(e.x, e.y, e.r, (o) => {
          if (o === e || o.d.boss) return;
          const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy) || 0.01, overlap = e.r + o.r - od;
          if (overlap > 0) { const push = overlap * 0.5 * (o.d.mass / (o.d.mass + d0.mass)); e.x += ox / od * push; e.y += oy / od * push; }
        });
        if (d > 1500) { const sp = spawnPoint(); e.x = sp.x; e.y = sp.y; }
      }
      if (d < e.r + p.r - 3) hurtPlayer(d0.dmg * (e.elite ? 1.5 : 1) * (1 + 0.05 * (R.wave - 1)), e.x, e.y);
    }
    if (R.enemies.length > 60 && R.enemies.some((e) => e.dead)) R.enemies = R.enemies.filter((e) => !e.dead);
  }

  /* ---------- projectiles, pickups, effects ---------- */
  function updateShots(dt) {
    for (const s of R.shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0) continue;
      forNear(s.x, s.y, s.r, (e) => {
        if (s.life <= 0 || s.hit.has(e)) return;
        s.hit.add(e);
        hurtEnemy(e, s.dmg, { kx: s.vx, ky: s.vy, kb: 70, color: '#FFB547' });
        if (s.hit.size > s.pierce) s.life = 0;
      });
    }
    R.shots = R.shots.filter((s) => s.life > 0);
    for (const c of R.comets) {
      c.life -= dt;
      if (!c.target || c.target.dead) c.target = nearestEnemy(c.x, c.y, 600);
      if (c.target) {
        const want = Math.atan2(c.target.y - c.y, c.target.x - c.x), cur = Math.atan2(c.vy, c.vx);
        const diff = ((want - cur + Math.PI * 3) % TAU) - Math.PI;
        const a = cur + clamp(diff, -6 * dt, 6 * dt);
        c.sp = Math.min(480, c.sp + 520 * dt);
        c.vx = Math.cos(a) * c.sp; c.vy = Math.sin(a) * c.sp;
      }
      c.x += c.vx * dt; c.y += c.vy * dt;
      c.trail -= dt; if (c.trail <= 0) { c.trail = 0.02; part({ x: c.x, y: c.y, vx: vrand(-20, 20), vy: vrand(-20, 20), life: 0.35, max: 0.35, size: vrand(2, 4), color: c.evo ? '#FFD166' : '#FF7A2F', type: 'glow', drag: 2 }); }
      let boom = c.life <= 0;
      if (!boom && c.target && Math.hypot(c.target.x - c.x, c.target.y - c.y) < c.target.r + 8) boom = true;
      if (boom) {
        c.life = -1;
        forNear(c.x, c.y, c.aoe, (e) => hurtEnemy(e, c.dmg, { kx: e.x - c.x, ky: e.y - c.y, kb: 220, color: '#FF7A2F' }));
        burst(c.x, c.y, 18, '#FF7A2F', 260, 0.45, 3.5); ringFx(c.x, c.y, c.aoe, '#FFB547', 0.3, 5); Sfx.boom(); shake(c.evo ? 0.14 : 0.1);
      }
    }
    R.comets = R.comets.filter((c) => c.life > 0);
    for (const g of R.rings) {
      g.r += (g.max / 0.32) * dt;
      forNear(g.x, g.y, g.r, (e) => {
        if (g.hit.has(e)) return;
        g.hit.add(e);
        hurtEnemy(e, g.dmg, { kx: e.x - g.x, ky: e.y - g.y, kb: g.kb, stun: g.stun, color: '#FF7A2F' });
      });
    }
    R.rings = R.rings.filter((g) => g.r < g.max);
    const p = R.p;
    for (const b of R.ebullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life > 0 && Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r - 2) {
        if (p.inv <= 0 && p.dashT <= 0) { hurtPlayer(b.dmg, b.x, b.y); b.life = 0; burst(b.x, b.y, 6, b.color, 120, 0.3, 2.5); }
      }
    }
    R.ebullets = R.ebullets.filter((b) => b.life > 0 && Math.abs(b.x - p.x) < 1400 && Math.abs(b.y - p.y) < 1400);
    for (const a of R.arcs) a.life -= dt;
    R.arcs = R.arcs.filter((a) => a.life > 0);
  }
  function updateGems(dt) {
    const p = R.p;
    R.pickChainT -= dt; if (R.pickChainT <= 0) R.pickChain = 0;
    for (const g of R.gems) {
      g.t += dt;
      const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy) || 1;
      if (!g.pull && d < p.magnet) g.pull = true;
      if (g.pull) { g.sp = Math.min(1100, g.sp + 1500 * dt); g.x += dx / d * g.sp * dt; g.y += dy / d * g.sp * dt; }
      else { g.x += g.vx * dt; g.y += g.vy * dt; g.vx = damp(g.vx, 0, 5, dt); g.vy = damp(g.vy, 0, 5, dt); }
      if (d < p.r + 6) { g.dead = true; p.xp += g.v; R.pickChain++; R.pickChainT = 0.4; Sfx.pickup(R.pickChain); }
    }
    R.gems = R.gems.filter((g) => !g.dead);
    while (p.xp >= p.next) { p.xp -= p.next; p.lvl++; p.next = xpFor(p.lvl); R.pendingLevels++; }
    for (const k of R.pickups) {
      k.t += dt;
      const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy) || 1;
      if (d < p.magnet * 0.6) { k.x += dx / d * 300 * dt; k.y += dy / d * 300 * dt; }
      if (d < p.r + 14) {
        k.dead = true;
        if (k.kind === 'heart') { const h = 30; p.hp = Math.min(p.maxHp, p.hp + h); text(p.x, p.y - 30, '+' + h, '#6BE38E', 18); Sfx.heal(); burst(p.x, p.y, 12, '#6BE38E', 140, 0.5, 3); }
        if (k.kind === 'magnet') { for (const g of R.gems) g.pull = true; Sfx.chest(); ringFx(p.x, p.y, 200, '#5FE3E0', 0.5, 4); text(p.x, p.y - 30, 'Magnet', '#5FE3E0', 16); }
        if (k.kind === 'bomb') {
          flash(0.75); shake(0.6); hitstop(0.08); Sfx.boom();
          for (const e of R.enemies) { if (e.dead) continue; const ox = e.x - p.x, oy = e.y - p.y; if (Math.abs(ox) < W / ZOOM && Math.abs(oy) < H / ZOOM) hurtEnemy(e, e.d.boss ? 100 : 9999, {}); }
          R.ebullets.length = 0;
        }
        if (k.kind === 'chest') { R.pendingChests++; Sfx.chest(); flash(0.4, '255,209,102'); burst(p.x, p.y, 24, '#FFD166', 220, 0.6, 3.5); }
      }
    }
    R.pickups = R.pickups.filter((k) => !k.dead);
  }
  function updateParts(dt) {
    for (const q of R.parts) {
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.drag) { q.vx = damp(q.vx, 0, q.drag, dt); q.vy = damp(q.vy, 0, q.drag, dt); }
    }
    R.parts = R.parts.filter((q) => q.life > 0);
    for (const t of R.texts) { t.life -= dt; t.y += t.vy * dt; t.vy = damp(t.vy, 0, 5, dt); }
    R.texts = R.texts.filter((t) => t.life > 0);
  }

  /* ---------- level-up ---------- */
  let choices = [];
  function buildChoices(n) {
    const opts2 = [], nW = Object.keys(R.weapons).length, nP = Object.keys(R.passives).length;
    const evos = [];
    for (const id in R.weapons) if (R.weapons[id] === 5 && !R.evolved[id] && R.passives[WEAPONS[id].evo]) evos.push({ kind: 'evo', id });
    for (const id in R.weapons) if (R.weapons[id] < 5) opts2.push({ kind: 'weapon', id, w: 3 });
    if (nW < MAX_W) for (const id in WEAPONS) if (!R.weapons[id]) opts2.push({ kind: 'weapon', id, w: 2 });
    for (const id in R.passives) if (R.passives[id] < 5) opts2.push({ kind: 'passive', id, w: 2.4 });
    if (nP < MAX_P) for (const id in PASSIVES) if (!R.passives[id]) opts2.push({ kind: 'passive', id, w: 1.6 });
    const out = evos.slice(0, n);
    while (out.length < n && opts2.length) {
      let tot = 0; for (const o of opts2) tot += o.w;
      let r = srand() * tot, i = 0;
      for (; i < opts2.length; i++) { r -= opts2[i].w; if (r <= 0) break; }
      out.push(opts2.splice(Math.min(i, opts2.length - 1), 1)[0]);
    }
    if (!out.length) out.push({ kind: 'cache' });
    return out;
  }
  function openLevelUp() {
    const chest = R.pendingChests > 0;
    G.mode = 'levelup';
    choices = buildChoices(M.cards);
    $('luTitle').textContent = chest ? 'Chest' : 'Level ' + R.p.lvl;
    $('luSub').textContent = chest ? 'A free upgrade from the elite.' : 'Pick one upgrade';
    renderCards();
    $('levelup').hidden = false;
    Sfx.level();
  }
  function evoPartnerOf(passiveId) { for (const id in WEAPONS) if (WEAPONS[id].evo === passiveId && R.weapons[id]) return id; return null; }
  function pipHtml(cur, max) { let s = '<span class="pips">'; for (let i = 0; i < max; i++) s += `<i class="${i < cur ? 'on' : i === cur ? 'next' : ''}"></i>`; return s + '</span>'; }
  function renderCards() {
    const box = $('cards'); box.style.setProperty('--n', choices.length); box.innerHTML = '';
    choices.forEach((c, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'card';
      let ic, color, kind, name, desc, note = '', pips = '';
      if (c.kind === 'weapon') {
        const w = WEAPONS[c.id], cur = R.weapons[c.id] || 0; color = w.color; ic = c.id; name = w.name; desc = w.lv[cur];
        kind = cur ? 'Weapon · level ' + (cur + 1) : 'New weapon'; if (!cur) b.classList.add('new');
        note = 'Evolves at level 5 with ' + PASSIVES[w.evo].name + (R.passives[w.evo] ? ' (owned)' : '') + '.';
        pips = pipHtml(cur, 5);
      } else if (c.kind === 'passive') {
        const ps = PASSIVES[c.id], cur = R.passives[c.id] || 0; color = ps.color; ic = c.id; name = ps.name; desc = ps.desc;
        kind = cur ? 'Charm · level ' + (cur + 1) : 'New charm'; if (!cur) b.classList.add('new');
        const partner = evoPartnerOf(c.id); note = partner ? 'Evolves your ' + WEAPONS[partner].name + ' at level 5.' : '';
        pips = pipHtml(cur, 5);
      } else if (c.kind === 'evo') {
        const w = WEAPONS[c.id]; color = '#FFD166'; ic = c.id; name = w.evoName; desc = w.evoDesc; kind = 'Evolution · ' + w.name; b.classList.add('evo');
      } else { color = '#FF7A2F'; ic = 'cache'; name = 'Second wind'; desc = 'Everything is maxed. Heal to full.'; kind = 'Reward'; }
      b.innerHTML = `<span class="key">${i + 1}</span><span class="ic">${svgIcon(ic, color)}</span><span class="txt"><span class="kind">${kind}</span><br><b>${name}</b></span>${pips}<p>${desc}</p>${note ? `<span class="note">${note}</span>` : ''}`;
      b.addEventListener('click', () => choose(i));
      box.appendChild(b);
    });
    const rr = $('rerollBtn'); rr.textContent = 'Reroll (' + R.rerolls + ')'; rr.disabled = R.rerolls <= 0;
    $('slotLine').textContent = 'Weapons ' + Object.keys(R.weapons).length + '/' + MAX_W + ' · Charms ' + Object.keys(R.passives).length + '/' + MAX_P;
    setTimeout(() => { const f = box.querySelector('.card'); if (f && !coarse) f.focus({ preventScroll: true }); }, 30);
  }
  function choose(i) {
    const c = choices[i]; if (!c || G.mode !== 'levelup') return;
    const p = R.p;
    if (c.kind === 'weapon') { const nw = !R.weapons[c.id]; R.weapons[c.id] = (R.weapons[c.id] || 0) + 1; if (nw) R.timers[c.id] = 0.2; }
    else if (c.kind === 'passive') { R.passives[c.id] = (R.passives[c.id] || 0) + 1; recalc(); if (c.id === 'heart') p.hp = Math.min(p.maxHp, p.hp + 20); p.hp = Math.min(p.hp, p.maxHp); }
    else if (c.kind === 'evo') { R.evolved[c.id] = true; banner(WEAPONS[c.id].evoName, 'Evolved from ' + WEAPONS[c.id].name + '.', 'gold'); Sfx.evolve(); flash(0.7, '255,209,102'); shake(0.4); ringFx(p.x, p.y, 220, '#FFD166', 0.7, 8); }
    else { p.hp = p.maxHp; }
    Sfx.click();
    nextChoiceOrResume();
  }
  function nextChoiceOrResume() {
    if (R.pendingChests > 0) R.pendingChests--; else R.pendingLevels = Math.max(0, R.pendingLevels - 1);
    if (R.pendingLevels > 0 || R.pendingChests > 0) { openLevelUp(); return; }
    $('levelup').hidden = true; G.mode = 'play'; G.ts = 0.25; G.tsTarget = 1; R.p.inv = Math.max(R.p.inv, 0.6);
  }

  /* ---------- end of run ---------- */
  function endRun(victory) {
    if (R.over) return;
    R.over = true; R.victory = victory;
    if (!victory) { G.tsTarget = 0.2; R.overIn = 1.6; flash(0.6, '255,77,109'); shake(0.7); burst(R.p.x, R.p.y, 40, '#FFB547', 260, 1, 4); Sfx.lose(); }
  }
  function buildList() {
    const out = [];
    for (const id in R.weapons) out.push(R.evolved[id] ? WEAPONS[id].evoName : WEAPONS[id].name + ' ' + R.weapons[id]);
    for (const id in R.passives) out.push(PASSIVES[id].name + ' ' + R.passives[id]);
    return out.slice(0, 8);
  }
  function finishRun() {
    if (R.ended) return;
    R.ended = true; G.mode = 'over';
    setHud(false); $('bossbar').hidden = true;
    opts.onEnd({
      report: { kills: R.kills, seconds: Math.floor(R.t), bossKilled: R.bossKilled, dawnLeft: R.bossKilled ? R.dawnLeft : 0, bestStreak: R.bestStreak, level: R.p.lvl, build: buildList() },
      survived: R.victory, wave: R.wave,
    });
  }

  /* ---------- main update ---------- */
  function update(dt) {
    if (!R) return;
    const p = R.p;
    if (R.tips.length && R.t >= R.tips[0][0]) tip(R.tips.shift()[1]);
    if (G.hitstop > 0) { G.hitstop -= dt; return; }
    G.ts = damp(G.ts, G.tsTarget, G.tsTarget < G.ts ? 14 : 4, dt);
    const sdt = dt * G.ts;
    if (!R.over) R.t += sdt;
    if (!R.over) updateSpawns(sdt);
    buildGrid();
    if (!R.over) { updatePlayer(sdt); updateWeapons(sdt); }
    updateEnemies(R.over ? sdt * 0.3 : sdt);
    updateShots(sdt);
    if (!R.over) updateGems(sdt);
    updateParts(sdt);
    R.streakT -= sdt; if (R.streakT <= 0) R.streak = 0;
    G.cam.x = damp(G.cam.x, p.x + p.vx / p.speed * 40, 7, dt);
    G.cam.y = damp(G.cam.y, p.y + p.vy / p.speed * 40, 7, dt);
    R.lowHp = p.hp < p.maxHp * 0.3 && !R.over;
    if (R.lowHp) Sfx.heart();
    if ((R.pendingLevels > 0 || R.pendingChests > 0) && G.mode === 'play' && G.levelupIn < 0 && !R.over) { G.levelupIn = 0.22; G.tsTarget = 0.05; flash(0.25, '95,227,224'); }
    if (G.levelupIn >= 0) { G.levelupIn -= dt; if (G.levelupIn < 0 && G.mode === 'play' && !R.over) openLevelUp(); else if (G.levelupIn < 0) G.tsTarget = 1; }
    if (R.overIn > 0) { R.overIn -= dt; if (R.overIn <= 0) finishRun(); }
  }

  /* ---------- rendering ---------- */
  function hash(x, y) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function drawGround(cx, cy, t) {
    const S = 110, vw = W / ZOOM / 2 + S, vh = H / ZOOM / 2 + S;
    const x0 = Math.floor((cx - vw) / S), x1 = Math.floor((cx + vw) / S), y0 = Math.floor((cy - vh) / S), y1 = Math.floor((cy + vh) / S);
    ctx.fillStyle = '#16122B';
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
      const h = hash(gx, gy), bx = gx * S, by = gy * S;
      ctx.fillRect(bx - 1.5, by - 1.5, 3, 3);
      if (h < 0.42) {
        const ox = bx + 20 + hash(gx + 7, gy) * 70, oy = by + 20 + hash(gx, gy + 7) * 70;
        ctx.strokeStyle = h < 0.2 ? '#231C44' : '#1D1838'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        const sway = Math.sin(t * 1.4 + gx * 0.7 + gy) * 2;
        ctx.beginPath();
        ctx.moveTo(ox, oy); ctx.lineTo(ox - 4 + sway, oy - 10);
        ctx.moveTo(ox + 4, oy); ctx.lineTo(ox + 5 + sway, oy - 13);
        ctx.moveTo(ox + 8, oy); ctx.lineTo(ox + 12 + sway, oy - 9);
        ctx.stroke();
      } else if (h > 0.9) {
        const ox = bx + 30 + hash(gx + 3, gy) * 50, oy = by + 30 + hash(gx, gy + 3) * 50;
        ctx.fillStyle = '#1E1938'; ctx.beginPath(); ctx.ellipse(ox, oy, 9, 6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#16122B';
      }
    }
  }
  function drawEyes(x, y, r, lookX, lookY, color, scale = 1) {
    const ex = lookX * r * 0.25, ey = lookY * r * 0.25;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x - r * 0.32 + ex, y - r * 0.1 + ey, r * 0.17 * scale, 0, TAU); ctx.arc(x + r * 0.32 + ex, y - r * 0.1 + ey, r * 0.17 * scale, 0, TAU); ctx.fill();
  }
  function drawEnemy(e, t) {
    const p = R.p, d = e.d, dx = p.x - e.x, dy = p.y - e.y, dl = Math.hypot(dx, dy) || 1, lx = dx / dl, ly = dy / dl;
    const white = e.flash > 0, sc = 1 - e.spawnT * 1.4;
    const r = e.r * Math.max(0.3, sc);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.85, r * 0.9, r * 0.3, 0, 0, TAU); ctx.fill();
    if (e.elite) { ctx.strokeStyle = '#FFD166'; ctx.lineWidth = 3; ctx.globalAlpha = 0.6 + Math.sin(t * 6) * 0.3; ctx.beginPath(); ctx.arc(e.x, e.y, r + 6, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    const body = white ? '#FFFFFF' : d.color;
    ctx.fillStyle = body;
    if (e.type === 'shade') {
      const wob = Math.sin(t * 5 + e.seed) * 1.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, r + wob * 0.3, Math.PI, 0);
      for (let i = 0; i <= 4; i++) { const xx = e.x + r - (i / 4) * r * 2, yy = e.y + r * 0.75 + (i % 2 ? -3 : 3) + wob; ctx.lineTo(xx, yy); }
      ctx.closePath(); ctx.fill();
      drawEyes(e.x, e.y, r, lx, ly, white ? d.color : d.eye);
    } else if (e.type === 'wisp') {
      const a = Math.atan2(dy, dx);
      ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * r * 1.4, e.y + Math.sin(a) * r * 1.4);
      ctx.lineTo(e.x + Math.cos(a + 2.4) * r, e.y + Math.sin(a + 2.4) * r); ctx.lineTo(e.x + Math.cos(a - 2.4) * r, e.y + Math.sin(a - 2.4) * r); ctx.closePath(); ctx.fill();
      ctx.fillStyle = white ? d.color : '#FFFFFF'; ctx.beginPath(); ctx.arc(e.x + lx * 2, e.y + ly * 2, r * 0.25, 0, TAU); ctx.fill();
    } else if (e.type === 'brute') {
      const s = r * 1.7;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(e.x - s / 2, e.y - s / 2, s, s, 7); else ctx.rect(e.x - s / 2, e.y - s / 2, s, s);
      ctx.fill();
      ctx.fillStyle = white ? d.color : '#8E1F37'; ctx.fillRect(e.x - s / 2 + 4, e.y + s / 2 - 8, s - 8, 4);
      drawEyes(e.x, e.y, r, lx, ly, white ? d.color : d.eye, 0.9);
    } else if (e.type === 'spitter') {
      ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill();
      const charge = e.cd < 0.6 ? 1 - e.cd / 0.6 : 0;
      if (charge > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,138,61,${0.25 + charge * 0.5})`; ctx.beginPath(); ctx.arc(e.x + lx * r, e.y + ly * r, 4 + charge * 8, 0, TAU); ctx.fill(); ctx.restore(); }
      drawEyes(e.x, e.y, r, lx, ly, white ? d.color : d.eye);
    } else if (e.type === 'bloater') {
      const fuse = e.fuse >= 0, puls = fuse ? 1 + Math.sin(t * 40) * 0.08 : 1 + Math.sin(t * 4 + e.seed) * 0.05;
      if (fuse) { ctx.strokeStyle = 'rgba(123,227,154,.45)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(e.x, e.y, 95, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = (Math.floor(t * 16) % 2) ? '#FFFFFF' : body; }
      ctx.beginPath(); ctx.arc(e.x, e.y, r * puls, 0, TAU); ctx.fill();
      drawEyes(e.x, e.y, r, lx, ly, white ? d.color : d.eye);
    } else if (e.type === 'warden') {
      const spikes = 10;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) { const a = (i / (spikes * 2)) * TAU + t * 0.4, rr = i % 2 ? r : r * 1.18; ctx.lineTo(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = white ? d.color : '#2A0E1A'; ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.62, 0, TAU); ctx.fill();
      drawEyes(e.x, e.y, r * 0.8, lx, ly, d.eye, 1.1);
    } else if (e.type === 'king') {
      const phase2 = e.hp < e.maxHp * 0.5;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = phase2 ? 'rgba(255,77,109,.18)' : 'rgba(155,107,255,.16)'; ctx.beginPath(); ctx.arc(e.x, e.y, r * (1.5 + Math.sin(t * 3) * 0.08), 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = white ? '#FFFFFF' : '#FFD166';
      ctx.beginPath(); const cy = e.y - r * 0.75;
      ctx.moveTo(e.x - r * 0.6, cy + 8); ctx.lineTo(e.x - r * 0.6, cy - 14); ctx.lineTo(e.x - r * 0.3, cy - 4); ctx.lineTo(e.x, cy - 20); ctx.lineTo(e.x + r * 0.3, cy - 4); ctx.lineTo(e.x + r * 0.6, cy - 14); ctx.lineTo(e.x + r * 0.6, cy + 8); ctx.closePath(); ctx.fill();
      drawEyes(e.x, e.y + 6, r * 0.8, lx, ly, phase2 ? '#FF4D6D' : d.eye, 1.2);
    }
    if (!d.boss && (e.elite || e.type === 'brute') && e.hp < e.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(e.x - 16, e.y - r - 12, 32, 4);
      ctx.fillStyle = e.elite ? '#FFD166' : '#FF4D6D'; ctx.fillRect(e.x - 16, e.y - r - 12, 32 * Math.max(0, e.hp / e.maxHp), 4);
    }
  }
  function drawTelegraphs(t) {
    for (const e of R.enemies) {
      if (e.dead || !e.d.boss) continue;
      if (e.state === 'aim') {
        const a = 0.18 + 0.25 * Math.abs(Math.sin(t * 18));
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.atan2(e.ay, e.ax));
        ctx.fillStyle = `rgba(255,77,109,${a})`; ctx.fillRect(0, -e.r, 600, e.r * 2);
        ctx.strokeStyle = 'rgba(255,77,109,.8)'; ctx.lineWidth = 2; ctx.strokeRect(0, -e.r, 600, e.r * 2);
        ctx.restore();
      }
      if (e.state === 'wind') {
        ctx.strokeStyle = `rgba(255,209,102,${0.4 + 0.4 * Math.sin(t * 20)})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 20 + (0.7 - e.st) * 40, 0, TAU); ctx.stroke();
      }
    }
  }
  function drawKeeper(x, y, t, face, squash, moving, walk, speed) {
    const bob = moving ? Math.abs(Math.sin(walk * 3)) * 3 : Math.sin(t * 2.5) * 1;
    const sx = 1 + squash * 0.35 + speed * 0.05, sy = 1 - squash * 0.25 - speed * 0.03;
    ctx.save(); ctx.translate(x, y - bob); ctx.scale(sx, sy);
    ctx.fillStyle = '#3B2F6B';
    ctx.beginPath(); ctx.moveTo(-13, 12); ctx.quadraticCurveTo(-15, -12, 0, -16); ctx.quadraticCurveTo(15, -12, 13, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#120E24'; ctx.beginPath(); ctx.arc(face * 1.5, -5, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FFE7B0'; ctx.beginPath(); ctx.arc(face * 4 - 2.5, -5, 1.6, 0, TAU); ctx.arc(face * 4 + 2.5, -5, 1.6, 0, TAU); ctx.fill();
    const lx = face * 15, ly = 4 + Math.sin(t * 3) * 1.5;
    ctx.strokeStyle = '#8C7A5A'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(face * 9, -2); ctx.lineTo(lx, ly - 6); ctx.stroke();
    ctx.fillStyle = '#FFB547'; ctx.beginPath(); ctx.arc(lx, ly, 5.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FFF2C2'; ctx.beginPath(); ctx.arc(lx, ly, 2.6, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawPlayer(t) {
    const p = R.p;
    if (R.over && !R.victory) return;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 15, 14, 5, 0, 0, TAU); ctx.fill();
    if (p.inv > 0 && p.dashT <= 0 && Math.floor(t * 20) % 2 === 0) return;
    drawKeeper(p.x, p.y, t, p.face, p.squash, p.moving, p.walk, Math.hypot(p.vx, p.vy) / p.speed);
  }
  function drawWorld(t) {
    drawTelegraphs(t);
    for (const k of R.pickups) {
      const x = k.x, y = k.y + Math.sin(k.t * 4) * 3;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const col = k.kind === 'heart' ? '255,77,109' : k.kind === 'magnet' ? '95,227,224' : k.kind === 'bomb' ? '255,122,47' : '255,209,102';
      ctx.fillStyle = `rgba(${col},.22)`; ctx.beginPath(); ctx.arc(x, y, 20, 0, TAU); ctx.fill(); ctx.restore();
      if (k.kind === 'chest') {
        ctx.fillStyle = '#8A5A2B'; ctx.fillRect(x - 12, y - 7, 24, 15); ctx.fillStyle = '#FFD166'; ctx.fillRect(x - 12, y - 9, 24, 5); ctx.fillRect(x - 2, y - 4, 4, 6);
      } else if (k.kind === 'heart') {
        ctx.fillStyle = '#FF4D6D'; ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.bezierCurveTo(x - 14, y - 2, x - 6, y - 12, x, y - 4); ctx.bezierCurveTo(x + 6, y - 12, x + 14, y - 2, x, y + 8); ctx.fill();
      } else if (k.kind === 'magnet') {
        ctx.strokeStyle = '#5FE3E0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y - 1, 7, Math.PI, 0, true); ctx.stroke();
        ctx.strokeStyle = '#F4EEE2'; ctx.beginPath(); ctx.moveTo(x - 7, y - 1); ctx.lineTo(x - 7, y - 7); ctx.moveTo(x + 7, y - 1); ctx.lineTo(x + 7, y - 7); ctx.stroke();
      } else {
        ctx.fillStyle = '#2A2140'; ctx.beginPath(); ctx.arc(x, y + 1, 8, 0, TAU); ctx.fill(); ctx.fillStyle = '#FF7A2F'; ctx.fillRect(x + 3, y - 10, 3, 5);
      }
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const g of R.gems) {
      const s = g.v >= 20 ? 7 : g.v >= 5 ? 5.5 : 4, col = g.v >= 20 ? '#B78BFF' : g.v >= 5 ? '#4FA3FF' : '#5FE3E0';
      ctx.fillStyle = col; ctx.beginPath();
      const tw = Math.sin(g.t * 5) * 0.25 + 1;
      ctx.moveTo(g.x, g.y - s * 1.3 * tw); ctx.lineTo(g.x + s, g.y); ctx.lineTo(g.x, g.y + s * 1.3 * tw); ctx.lineTo(g.x - s, g.y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    for (const g of R.rings) {
      const f = g.r / g.max;
      ctx.strokeStyle = g.evo ? `rgba(255,209,102,${1 - f})` : `rgba(255,122,47,${1 - f})`; ctx.lineWidth = 10 * (1 - f) + 3;
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, TAU); ctx.stroke();
    }
    for (const e of R.enemies) if (!e.dead) drawEnemy(e, t);
    drawPlayer(t);
    if (R.weapons.orbit && !R.over) {
      const s = ws('orbit'), evo = R.evolved.orbit;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const o of orbPositions(s)) {
        ctx.fillStyle = evo ? 'rgba(255,209,102,.25)' : 'rgba(197,139,255,.25)'; ctx.beginPath(); ctx.arc(o.x, o.y, 15, 0, TAU); ctx.fill();
        ctx.fillStyle = evo ? '#FFE7A3' : '#E3CCFF';
        const wing = Math.sin(t * 30 + o.a) * 4 + 6;
        ctx.beginPath(); ctx.ellipse(o.x - 4, o.y, wing, 4, o.a, 0, TAU); ctx.ellipse(o.x + 4, o.y, wing, 4, -o.a, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const s of R.shots) {
      const a = Math.atan2(s.vy, s.vx), len = s.evo ? 34 : 18;
      ctx.strokeStyle = s.evo ? 'rgba(255,242,194,.9)' : 'rgba(255,181,71,.9)'; ctx.lineWidth = s.r * 1.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s.x - Math.cos(a) * len, s.y - Math.sin(a) * len); ctx.lineTo(s.x, s.y); ctx.stroke();
      ctx.fillStyle = '#FFF6DE'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.7, 0, TAU); ctx.fill();
    }
    for (const c of R.comets) { ctx.fillStyle = c.evo ? '#FFE7A3' : '#FF9A5A'; ctx.beginPath(); ctx.arc(c.x, c.y, c.evo ? 8 : 6, 0, TAU); ctx.fill(); }
    for (const b of R.ebullets) {
      ctx.fillStyle = b.color; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    }
    for (const a of R.arcs) {
      ctx.strokeStyle = a.evo ? `rgba(255,255,255,${a.life / a.max})` : `rgba(95,227,224,${a.life / a.max})`; ctx.lineWidth = a.evo ? 4 : 3;
      ctx.beginPath();
      for (let i = 0; i < a.pts.length - 1; i++) {
        const A = a.pts[i], B = a.pts[i + 1];
        ctx.moveTo(A.x, A.y);
        for (let k = 1; k < 5; k++) { const f = k / 5; ctx.lineTo(lerp(A.x, B.x, f) + vrand(-9, 9), lerp(A.y, B.y, f) + vrand(-9, 9)); }
        ctx.lineTo(B.x, B.y);
      }
      ctx.stroke();
    }
    for (const q of R.parts) {
      const f = q.life / q.max;
      if (q.type === 'ring') { ctx.strokeStyle = q.color; ctx.globalAlpha = f; ctx.lineWidth = q.w * f + 1; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1.15 - f * 0.6), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; continue; }
      if (q.type === 'ghost') { ctx.fillStyle = q.color; ctx.globalAlpha = f * 0.35; ctx.beginPath(); ctx.arc(q.x, q.y - 2, q.size, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; continue; }
      ctx.fillStyle = q.color; ctx.globalAlpha = q.type === 'dot' ? f : f * 0.8;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (q.type === 'glow' ? 1 : f * 0.7 + 0.3), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const tx of R.texts) {
      const f = tx.life / tx.max, pop = f > 0.85 ? 1 + (f - 0.85) * 3 : 1;
      ctx.globalAlpha = Math.min(1, f * 2.2);
      ctx.font = `800 ${tx.size * pop}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(14,12,28,.85)'; ctx.strokeText(tx.s, tx.x, tx.y); ctx.fillStyle = tx.color; ctx.fillText(tx.s, tx.x, tx.y);
    }
    ctx.globalAlpha = 1;
  }
  function drawScreen(t, ox, oy) {
    const p = R ? R.p : { x: G.cam.x, y: G.cam.y };
    const light = M ? M.light : 1;
    const px = W / 2 + (p.x - G.cam.x) * ZOOM + ox, py = H / 2 + (p.y - G.cam.y) * ZOOM + oy;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const lr = 200 * ZOOM * light + Math.sin(t * 7) * 4;
    const lg = ctx.createRadialGradient(px, py, 0, px, py, lr);
    lg.addColorStop(0, 'rgba(255,181,71,.13)'); lg.addColorStop(1, 'rgba(255,181,71,0)');
    ctx.fillStyle = lg; ctx.fillRect(px - lr, py - lr, lr * 2, lr * 2); ctx.restore();
    const dg = ctx.createRadialGradient(px, py, 150 * ZOOM * light, px, py, Math.max(W, H) * 0.78 * light);
    dg.addColorStop(0, 'rgba(7,5,16,0)'); dg.addColorStop(1, `rgba(7,5,16,${light < 1 ? 0.93 : 0.82})`);
    ctx.fillStyle = dg; ctx.fillRect(0, 0, W, H);
    if (!R) return;
    const hurt = Math.max(G.hurtFlash, R.lowHp ? 0.18 + 0.14 * Math.sin(t * 6) : 0);
    if (hurt > 0) {
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(255,40,70,0)'); vg.addColorStop(1, `rgba(255,40,70,${Math.min(0.6, hurt)})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
    if (G.flash > 0) { ctx.fillStyle = `rgba(${G.flashRGB},${G.flash * 0.6})`; ctx.fillRect(0, 0, W, H); }
    const marks = [];
    for (const e of R.enemies) if (!e.dead && (e.d.boss || e.elite)) marks.push({ x: e.x, y: e.y, c: e.d.boss ? '#FF4D6D' : '#FFD166' });
    for (const k of R.pickups) if (k.kind === 'chest') marks.push({ x: k.x, y: k.y, c: '#FFD166' });
    for (const m of marks) {
      const sx = W / 2 + (m.x - G.cam.x) * ZOOM, sy = H / 2 + (m.y - G.cam.y) * ZOOM;
      if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
      const a = Math.atan2(sy - H / 2, sx - W / 2), pad = 34;
      const ex = clamp(W / 2 + Math.cos(a) * W, pad, W - pad), ey = clamp(H / 2 + Math.sin(a) * H, pad + 70, H - pad);
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.fillStyle = m.c; ctx.globalAlpha = 0.7 + Math.sin(t * 6) * 0.3;
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-7, -8); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    if (joy && joy.active && G.mode === 'play') {
      ctx.strokeStyle = 'rgba(244,238,226,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 56, 0, TAU); ctx.stroke();
      const jx = joy.x - joy.ox, jy = joy.y - joy.oy, l = Math.hypot(jx, jy), m = Math.min(56, l);
      ctx.fillStyle = 'rgba(255,181,71,.5)'; ctx.beginPath(); ctx.arc(joy.ox + (l ? jx / l * m : 0), joy.oy + (l ? jy / l * m : 0), 22, 0, TAU); ctx.fill();
    }
  }
  function drawIdle(t) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 40; i++) {
      const h1 = hash(i, 3), h2 = hash(i, 9);
      const x = G.cam.x + (h1 - 0.5) * W / ZOOM + Math.sin(t * (0.3 + h2) + i) * 40, y = G.cam.y + (h2 - 0.5) * H / ZOOM + Math.cos(t * (0.4 + h1) + i) * 30;
      const a = 0.3 + 0.5 * Math.abs(Math.sin(t * (1 + h1) + i));
      ctx.fillStyle = `rgba(255,190,90,${a * 0.25})`; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,220,150,${a})`; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill();
    }
    ctx.restore();
    drawKeeper(G.cam.x, G.cam.y + 40, t, 1, 0, false, 0, 0);
  }
  function render(t) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#0E0C1C'; ctx.fillRect(0, 0, W, H);
    const sh = settings.shake ? G.trauma * G.trauma : 0;
    const ox = vrand(-1, 1) * 16 * sh, oy = vrand(-1, 1) * 16 * sh, rot = vrand(-1, 1) * 0.02 * sh;
    ctx.setTransform(DPR * ZOOM, 0, 0, DPR * ZOOM, DPR * (W / 2 + ox), DPR * (H / 2 + oy));
    ctx.rotate(rot);
    ctx.translate(-G.cam.x, -G.cam.y);
    drawGround(G.cam.x, G.cam.y, t);
    if (R) drawWorld(t); else drawIdle(t);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawScreen(t, ox, oy);
  }

  /* ---------- HUD ---------- */
  let hudCache = {};
  function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
  function setHud(on) { $('hud').hidden = !on; $('dashBtn').hidden = !(on && coarse && M && M.dash); if (!on) { $('streak').hidden = true; $('tip').hidden = true; } }
  function updateHud() {
    if (!R) return;
    const p = R.p;
    $('xpFill').style.width = (p.xp / p.next * 100).toFixed(1) + '%';
    $('hpFill').style.width = Math.max(0, p.hp / p.maxHp * 100).toFixed(1) + '%';
    setText('hpText', Math.max(0, Math.ceil(p.hp)) + ' / ' + p.maxHp);
    setText('hudLvl', 'LV ' + p.lvl);
    const w = WAVES[R.wave - 1];
    setText('hudWave', w.boss ? 'Dawn in' : 'Wave ' + R.wave + ' of 6');
    setText('hudTime', w.boss ? fmtTime(R.dawnT >= 0 ? R.dawnT : DAWN) : fmtTime(Math.max(0, w.dur - R.waveT)));
    setText('hudKills', String(R.kills));
    if (R.boss) $('bossFill').style.width = Math.max(0, R.boss.hp / R.boss.maxHp * 100).toFixed(1) + '%';
    const st = $('streak');
    if (R.streak >= 10) {
      st.hidden = false;
      if (hudCache.streakN !== String(R.streak)) { setText('streakN', String(R.streak)); if (R.streak % 10 === 0) { st.classList.remove('pop'); void st.offsetWidth; st.classList.add('pop'); } }
    } else st.hidden = true;
    $('dashBtn').classList.toggle('cool', p.dashCd > 0);
  }

  /* ---------- pause ---------- */
  function renderPause() {
    const slots = (obj, max, defs, label) => {
      let h = `<div class="slotcol"><h3>${label}</h3>`;
      const ids = Object.keys(obj);
      for (const id of ids) {
        const d = defs[id], evo = R.evolved[id];
        h += `<div class="slot">${svgIcon(id, evo ? '#FFD166' : d.color)}<span class="nm">${evo ? d.evoName : d.name}</span>${evo ? '<span class="pill gold">Evolved</span>' : pipHtml(obj[id], 5).replace(/ class="next"/g, '')}</div>`;
      }
      for (let i = ids.length; i < max; i++) h += '<div class="slot empty">Empty slot</div>';
      return h + '</div>';
    };
    $('buildBox').innerHTML = slots(R.weapons, MAX_W, WEAPONS, 'Weapons') + slots(R.passives, MAX_P, PASSIVES, 'Charms');
  }
  function pause() {
    if (G.mode !== 'play' || !R || R.over) return;
    G.mode = 'pause'; renderPause(); $('pause').hidden = false; Sfx.click();
  }
  function resume() { if (G.mode !== 'pause') return; $('pause').hidden = true; G.mode = 'play'; lastT = performance.now(); Sfx.click(); }

  /* ---------- loop ---------- */
  let lastT = performance.now(), clock = 0, raf = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; clock += dt;
    if (tipHide > 0) { tipHide -= dt; if (tipHide <= 0) { const tEl = $('tip'); tEl.style.opacity = '0'; setTimeout(() => { if (tipHide <= 0) tEl.hidden = true; }, 320); } }
    if (G.mode === 'play' && R) update(dt);
    else if (R && G.mode === 'over') updateParts(dt);
    else if (!R) { G.cam.x += 14 * dt; G.cam.y += 6 * dt; }
    G.trauma = Math.max(0, G.trauma - dt * 1.6); G.flash = Math.max(0, G.flash - dt * 2.5); G.hurtFlash = Math.max(0, G.hurtFlash - dt * 1.6);
    render(clock);
    if (G.mode === 'play') updateHud();
    raf = requestAnimationFrame(frame);
  }

  /* ---------- input ---------- */
  const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  const onKeyDown = (e) => {
    if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; if (G.mode === 'play') e.preventDefault(); }
    if ((e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && G.mode === 'play') { e.preventDefault(); tryDash(); }
    if (e.code === 'Escape' || e.code === 'KeyP') { if (G.mode === 'play') pause(); else if (G.mode === 'pause') resume(); }
    if (G.mode === 'levelup') {
      const n = parseInt(e.key, 10); if (n >= 1 && n <= choices.length) { e.preventDefault(); choose(n - 1); }
      if (e.code === 'KeyR') $('rerollBtn').click();
    }
  };
  const onKeyUp = (e) => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; joy = null; pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  cv.addEventListener('pointerdown', (e) => {
    if (G.mode !== 'play') return;
    Sfx.init();
    joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY, active: true };
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!joy || e.pointerId !== joy.id) return;
    joy.x = e.clientX; joy.y = e.clientY;
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, l = Math.hypot(dx, dy);
    if (l > 90) { joy.ox = joy.x - dx / l * 90; joy.oy = joy.y - dy / l * 90; }
  });
  const endJoy = (e) => { if (joy && e.pointerId === joy.id) joy = null; };
  cv.addEventListener('pointerup', endJoy); cv.addEventListener('pointercancel', endJoy);
  $('dashBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); tryDash(); });
  $('pauseBtn').addEventListener('click', pause);
  $('resumeBtn').addEventListener('click', resume);
  $('quitBtn').addEventListener('click', () => { $('pause').hidden = true; G.mode = 'play'; R.over = true; R.victory = false; R.overIn = 0.01; });
  $('rerollBtn').addEventListener('click', () => { if (R.rerolls <= 0) return; R.rerolls--; choices = buildChoices(M.cards); renderCards(); Sfx.click(); });
  $('skipBtn').addEventListener('click', () => { const p = R.p; p.hp = Math.min(p.maxHp, p.hp + 15); Sfx.heal(); nextChoiceOrResume(); });

  raf = requestAnimationFrame(frame);

  return {
    start(night) {
      Sfx.init();
      newRun(night);
      hudCache = {}; $('bossbar').hidden = true; $('levelup').hidden = true; $('pause').hidden = true;
      setHud(true);
      G.mode = 'play'; lastT = performance.now();
    },
    get mode() { return G.mode; },
    initAudio() { Sfx.init(); },
    click() { Sfx.click(); },
    /** Fast-forwards the simulation. Used by automated play-tests only. */
    sim(steps, o = {}) {
      for (let i = 0; i < steps; i++) {
        if (G.mode === 'levelup') choose(o.pickRandom ? Math.floor(Math.random() * choices.length) : 0);
        if (G.mode !== 'play' || !R) break;
        if (o.god) R.p.hp = R.p.maxHp;
        if (o.move) {
          let vx = 0, vy = 0; const P = R.p;
          const keep = R.weapons.bolt || R.weapons.chain || R.weapons.comet ? 230 : 115;
          for (const e of R.enemies) { if (e.dead) continue; const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1; if (d < keep) { const w = (keep - d) / keep * (e.d.boss ? 4 : 1); vx += dx / d * w * 3; vy += dy / d * w * 3; } }
          for (const bl of R.ebullets) { const dx = P.x - bl.x, dy = P.y - bl.y, d = Math.hypot(dx, dy) || 1; if (d < 120) { vx += dx / d * 2; vy += dy / d * 2; } }
          let g = null, gd = 1e9; for (const q of R.gems) { const d = Math.hypot(q.x - P.x, q.y - P.y); if (d < gd) { gd = d; g = q; } }
          if (g && gd < 600) { vx += (g.x - P.x) / gd * 1.2; vy += (g.y - P.y) / gd * 1.2; }
          for (const k of R.pickups) { const d = Math.hypot(k.x - P.x, k.y - P.y) || 1; if (d < 700) { vx += (k.x - P.x) / d * 2; vy += (k.y - P.y) / d * 2; } }
          keys.left = vx < -0.3; keys.right = vx > 0.3; keys.up = vy < -0.3; keys.down = vy > 0.3;
          if (o.dash && P.dashCd <= 0) { let close = 0; for (const e of R.enemies) if (!e.dead && Math.hypot(e.x - P.x, e.y - P.y) < 45) close++; if (close >= 2) tryDash(); }
        }
        update(1 / 60);
      }
      return R ? { mode: G.mode, wave: R.wave, t: Math.round(R.t), lvl: R.p.lvl, hp: Math.round(R.p.hp), kills: R.kills, boss: R.boss ? Math.round(R.boss.hp) : null, dawn: Math.round(R.dawnT), victory: R.victory, bossKilled: R.bossKilled, weapons: { ...R.weapons }, evolved: { ...R.evolved } } : { mode: G.mode };
    },
    destroy() { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); },
  };
}
