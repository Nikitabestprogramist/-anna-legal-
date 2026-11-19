import { navigateTo, requestExpandedMode } from '@devvit/web/client';
import type { InitResponse } from '../shared/api';
import { BOSS_NAMES, findModifier } from '../shared/night';
import { el, fetchJson, fmt } from './ui';

let data: InitResponse | null = null;

/* A light, cheap night sky: drifting fireflies around a lantern glow. */
const sky = el<HTMLCanvasElement>('sky');
const ctx = sky.getContext('2d');
const flies = Array.from({ length: 34 }, (_, i) => ({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random(), p: i * 1.7 }));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const draw = (now: number) => {
  if (!ctx) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = innerWidth;
  const h = innerHeight;
  if (sky.width !== Math.round(w * dpr)) {
    sky.width = Math.round(w * dpr);
    sky.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0e0c1c';
  ctx.fillRect(0, 0, w, h);
  const t = now / 1000;
  const g = ctx.createRadialGradient(w * 0.5, h * 0.62, 0, w * 0.5, h * 0.62, Math.max(w, h) * 0.6);
  g.addColorStop(0, `rgba(255,181,71,${0.16 + Math.sin(t * 5) * 0.01})`);
  g.addColorStop(1, 'rgba(255,181,71,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (const f of flies) {
    const x = (f.x * w + Math.sin(t * 0.3 * f.s + f.p) * 30 + w) % w;
    const y = (f.y * h + Math.cos(t * 0.25 * f.s + f.p) * 24 + h) % h;
    const a = 0.25 + 0.55 * Math.abs(Math.sin(t * f.s + f.p));
    ctx.fillStyle = `rgba(255,200,110,${a * 0.22})`;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,226,160,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!reduce) requestAnimationFrame(draw);
};
requestAnimationFrame(draw);

const render = () => {
  if (!data) return;
  const { night, me } = data;
  const mod = findModifier(night.modifier);
  el('sNight').textContent = data.isTonight ? `Night ${night.number}` : `Night ${night.number} · ended`;
  el('sMod').textContent = mod?.name ?? '';
  el('sModDesc').textContent = mod?.desc ?? '';
  el('sPlayers').textContent = fmt(data.players);
  el('sKills').textContent = fmt(data.kills);
  const streak = el('sStreak');
  streak.hidden = me.streak < 2;
  streak.textContent = `${me.streak}-night streak`;
  const play = el<HTMLButtonElement>('sPlay');
  let status = `Survive five waves, then defeat ${BOSS_NAMES[night.boss]} before dawn.`;
  if (!data.isTonight) {
    play.textContent = data.tonightUrl ? "Play tonight's night" : 'Practice this night';
    status = 'This night is over. Its leaderboard is final.';
  } else if (me.played) {
    play.textContent = 'See results · practice';
    status = `You scored ${fmt(me.score ?? 0)}${me.rank ? `, #${me.rank} of ${fmt(data.players)}` : ''}. Come back tomorrow for a new night.`;
  } else if (data.players > 0 && data.top[0]) {
    status = `Top score: ${fmt(data.top[0].score)} by u/${data.top[0].username}. Your first run counts.`;
  }
  el('sStatus').textContent = status;
  const top = el('sTop');
  top.replaceChildren();
  if (!data.top.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No scores yet tonight. Be the first on the board.';
    top.append(li);
  }
  for (const r of data.top.slice(0, 3)) {
    const li = document.createElement('li');
    const u = document.createElement('span');
    u.textContent = `#${r.rank} u/${r.username}`;
    const b = document.createElement('b');
    b.textContent = fmt(r.score);
    li.append(u, b);
    top.append(li);
  }
};

el('sPlay').addEventListener('click', (e) => {
  if (data && !data.isTonight && data.tonightUrl) {
    navigateTo(data.tonightUrl);
    return;
  }
  requestExpandedMode(e, 'game');
});

fetchJson<InitResponse>('/api/init')
  .then((d) => {
    data = d;
    render();
  })
  .catch(() => {
    el('sMod').textContent = 'The dark is restless';
    el('sModDesc').textContent = 'Tap below to play.';
  });
