import { canRunAsUser, exitExpandedMode, navigateTo, showShareSheet, showToast } from '@devvit/web/client';
import type { InitResponse, LeaderRow, ScoreResponse, ShareResponse, VoteResponse, VoteState } from '../shared/api';
import { BOSS_NAMES, findModifier, WEAPON_NAMES, type ModifierId } from '../shared/night';
import { createEngine, type Engine, type RunEnd } from './game/engine.js';
import { el, fetchJson, fmt, fmtTime, loadSettings, saveSettings } from './ui';

const settings = loadSettings();
let data: InitResponse | null = null;
let rankedAvailable = false;
let lastEnd: RunEnd | null = null;
let lastScore: ScoreResponse | null = null;

const show = (id: string) => {
  for (const s of ['loading', 'intro', 'results']) el(s).hidden = s !== id;
};

const engine: Engine = createEngine({
  canvas: el<HTMLCanvasElement>('game'),
  settings,
  firstTime: !settings.played,
  onEnd: (end) => void onRunEnd(end),
});

if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  // automated play-tests drive the engine through this hook
  Object.assign(window, { __lanternfall: engine });
}

/* ---------- leaderboard ---------- */
const renderBoard = (box: HTMLElement, rows: LeaderRow[], me: string | null, myRank: number | null, myScore: number | null) => {
  box.replaceChildren();
  if (!rows.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No one has finished tonight yet. Be the first.';
    box.append(p);
    return;
  }
  const all = [...rows];
  if (me && myRank && myScore !== null && !rows.some((r) => r.username === me)) all.push({ rank: myRank, username: me, score: myScore });
  for (const r of all) {
    const row = document.createElement('div');
    row.className = 'r' + (r.username === me ? ' me' : '');
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = '#' + r.rank;
    const u = document.createElement('span');
    u.className = 'u';
    u.textContent = 'u/' + r.username;
    const s = document.createElement('span');
    s.className = 's';
    s.textContent = fmt(r.score);
    row.append(n, u, s);
    box.append(row);
  }
};

/* ---------- intro ---------- */
const renderIntro = () => {
  if (!data) return;
  const { night, me } = data;
  const mod = findModifier(night.modifier);
  el('introNight').textContent = `Night ${night.number}`;
  el('introMod').textContent = mod?.name ?? '';
  el('introModDesc').textContent = mod?.desc ?? '';
  el('introStart').textContent = WEAPON_NAMES[night.start];
  el('introBoss').textContent = BOSS_NAMES[night.boss];
  el('introPlayers').textContent = fmt(data.players);
  el('introKills').textContent = data.kills ? `${fmt(data.kills)} shades banished tonight` : '';
  rankedAvailable = data.isTonight && !me.played && data.username !== null;
  const begin = el<HTMLButtonElement>('beginBtn');
  begin.textContent = rankedAvailable ? 'Begin the night' : 'Practice run';
  let status: string;
  if (!data.isTonight) status = 'This night has ended. Runs here are practice only.';
  else if (!data.username) status = 'You are not logged in, so this run will not be ranked.';
  else if (me.played) status = `You finished tonight with ${fmt(me.score ?? 0)} points${me.rank ? ` (#${me.rank})` : ''}. Practice runs do not change your score.`;
  else status = 'Your first run tonight counts for the leaderboard. You get one.';
  if (me.streak > 1) status += ` Streak: ${me.streak} nights.`;
  el('introStatus').textContent = status;
  renderBoard(el('introBoard'), data.top.slice(0, 5), data.username, me.rank, me.score);
  el<HTMLInputElement>('optSound').checked = settings.sound;
  el<HTMLInputElement>('optShake').checked = settings.shake;
  show('intro');
};

const load = async () => {
  try {
    data = await fetchJson<InitResponse>('/api/init');
    if (!data.isTonight && data.tonightUrl) {
      el('introClose').textContent = "Go to tonight's night";
    }
    renderIntro();
  } catch (error) {
    el('loadingText').textContent = error instanceof Error ? error.message : 'Could not load tonight. Close and reopen the post.';
  }
};

/* ---------- run ---------- */
const begin = () => {
  if (!data) return;
  engine.initAudio();
  engine.click();
  for (const s of ['loading', 'intro', 'results']) el(s).hidden = true;
  engine.start(data.night);
  settings.played = true;
  saveSettings(settings);
};

const onRunEnd = async (end: RunEnd) => {
  // clear in-run banners so they do not show through the results screen
  el('banner').className = '';
  el('tip').hidden = true;
  lastEnd = end;
  lastScore = null;
  renderResults();
  show('results');
  try {
    lastScore = await fetchJson<ScoreResponse>('/api/score', { report: end.report });
    if (data && lastScore.ranked) {
      data.me = lastScore.me;
      data.players = lastScore.players;
      data.top = lastScore.top;
      rankedAvailable = false;
    }
    renderResults();
  } catch (error) {
    el('resRank').textContent = error instanceof Error ? error.message : 'Could not save this run.';
  }
};

const renderResults = () => {
  if (!data || !lastEnd) return;
  const { report, survived, wave } = lastEnd;
  const sc = lastScore;
  el('resNight').textContent = `Night ${data.night.number} · ${findModifier(data.night.modifier)?.name ?? ''}`;
  el('resMode').textContent = sc ? (sc.ranked ? 'Ranked run' : 'Practice run') : 'Saving…';
  el('resMode').className = 'pill' + (sc?.ranked ? ' gold' : '');
  const title = el('resTitle');
  title.textContent = survived ? 'Dawn breaks' : 'The lantern went out';
  title.className = 'result-title ' + (survived ? 'win' : 'lose');
  el('resScore').textContent = sc ? fmt(sc.breakdown.total) : '…';
  const rank = el('resRank');
  if (sc && sc.rank) rank.textContent = sc.ranked ? `#${sc.rank} of ${fmt(sc.players)} tonight` : `Would place #${sc.rank}`;
  else rank.textContent = '';
  const bd = el('resBreakdown');
  bd.replaceChildren();
  if (sc) {
    const parts: [string, number][] = [
      ['Kills', sc.breakdown.kills],
      ['Survival', sc.breakdown.survival],
      ['Boss', sc.breakdown.boss],
      ['Before dawn', sc.breakdown.speed],
      ['Streak', sc.breakdown.streak],
    ];
    for (const [k, v] of parts) {
      if (!v) continue;
      const p = document.createElement('span');
      p.className = 'pill';
      p.textContent = `${k} +${fmt(v)}`;
      bd.append(p);
    }
    if (sc.newBest) bd.append(pill('Personal best', 'gold'));
    if (sc.ranked && sc.me.streak > 1) bd.append(pill(`${sc.me.streak}-night streak`, 'spark'));
  }
  const stats: [string, string][] = [
    ['Time', fmtTime(report.seconds)],
    ['Kills', fmt(report.kills)],
    ['Level', String(report.level)],
    [report.bossKilled ? 'Boss' : 'Reached', report.bossKilled ? 'Defeated' : survived ? 'Dawn' : `Wave ${wave}`],
  ];
  el('resStats').innerHTML = '';
  for (const [k, v] of stats) {
    const d = document.createElement('div');
    d.className = 'fact';
    const s = document.createElement('span');
    s.textContent = k;
    const b = document.createElement('b');
    b.textContent = v;
    d.append(s, b);
    el('resStats').append(d);
  }
  el('resPlayers').textContent = `${fmt(data.players)} players`;
  renderBoard(el('resBoard'), data.top, data.username, data.me.rank, data.me.score);
  renderVote(data.vote);
  const share = el<HTMLButtonElement>('shareBtn');
  share.hidden = !(data.me.played && data.isTonight && data.username);
  share.disabled = data.me.shared;
  share.textContent = data.me.shared ? 'Result posted' : 'Comment my result';
  el('againBtn').textContent = 'Practice run';
};

const pill = (text: string, cls: string) => {
  const p = document.createElement('span');
  p.className = 'pill ' + cls;
  p.textContent = text;
  return p;
};

/* ---------- vote ---------- */
const renderVote = (vote: VoteState) => {
  if (!data) return;
  const box = el('voteOpts');
  box.replaceChildren();
  const total = Object.values(vote.counts).reduce((a, b) => a + b, 0);
  const canVote = data.isTonight && data.username !== null;
  el('voteBox').hidden = !data.isTonight;
  el('voteNote').textContent = vote.mine ? 'Thanks. You can change your vote until midnight UTC.' : 'The most votes wins.';
  for (const id of vote.options) {
    const mod = findModifier(id);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'vopt' + (vote.mine === id ? ' mine' : '');
    b.disabled = !canVote;
    const pct = total ? Math.round(((vote.counts[id] ?? 0) / total) * 100) : 0;
    const bar = document.createElement('i');
    bar.className = 'bar';
    bar.style.width = vote.mine ? `${pct}%` : '0%';
    const name = document.createElement('b');
    name.textContent = mod?.name ?? id;
    const desc = document.createElement('span');
    desc.textContent = mod?.desc ?? '';
    b.append(bar, name, desc);
    if (vote.mine) {
      const p = document.createElement('span');
      p.className = 'pct';
      p.textContent = `${pct}%`;
      b.append(p);
    }
    b.addEventListener('click', () => void castVote(id));
    box.append(b);
  }
};

const castVote = async (option: ModifierId) => {
  if (!data) return;
  try {
    const res = await fetchJson<VoteResponse>('/api/vote', { option });
    data.vote = res.vote;
    renderVote(res.vote);
    engine.click();
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Could not save your vote.');
  }
};

/* ---------- sharing ---------- */
el('shareBtn').addEventListener('click', (e) => {
  void (async () => {
    if (!data) return;
    const allowed = await canRunAsUser(e).catch(() => false);
    if (!allowed) {
      showToast('Allow Lanternfall to comment for you to post your result.');
      return;
    }
    try {
      const res = await fetchJson<ShareResponse>('/api/share', {});
      showToast(res.message);
      if (res.ok) {
        data.me.shared = true;
        renderResults();
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not post your result.');
    }
  })();
});

el('shareSheetBtn').addEventListener('click', () => {
  if (!data) return;
  const mod = findModifier(data.night.modifier);
  const score = lastScore ? ` I scored ${fmt(lastScore.breakdown.total)}.` : '';
  void showShareSheet({
    title: `Lanternfall · Night ${data.night.number}`,
    text: `Tonight's twist is ${mod?.name ?? 'a surprise'}.${score} Can you hold the dark back until dawn?`,
  }).catch(() => showToast('Sharing is not available here.'));
});

/* ---------- buttons ---------- */
const close = (e: MouseEvent) => {
  if (data && !data.isTonight && data.tonightUrl) {
    navigateTo(data.tonightUrl);
    return;
  }
  try {
    exitExpandedMode(e);
  } catch {
    showToast('Close the game with the X in the corner.');
  }
};
el('introClose').addEventListener('click', close);
el('resClose').addEventListener('click', (e) => {
  try {
    exitExpandedMode(e);
  } catch {
    showToast('Close the game with the X in the corner.');
  }
});
el('beginBtn').addEventListener('click', begin);
el('againBtn').addEventListener('click', begin);
el<HTMLInputElement>('optSound').addEventListener('change', (e) => {
  settings.sound = (e.target as HTMLInputElement).checked;
  saveSettings(settings);
});
el<HTMLInputElement>('optShake').addEventListener('change', (e) => {
  settings.shake = (e.target as HTMLInputElement).checked;
  saveSettings(settings);
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && !el('intro').hidden && document.activeElement === document.body) begin();
});

void load();
