import { redis } from '@devvit/web/server';
import {
  addDays,
  dayKey,
  daysBetween,
  defaultNight,
  isModifierId,
  voteOptions,
  type BossId,
  type ModifierId,
  type Night,
  type RunReport,
  type WeaponId,
} from '../../shared/night';
import type { LeaderRow, MyStatus, VoteState } from '../../shared/api';

// Redis keys
const K = {
  launch: 'launch-day',
  current: 'current-day',
  night: (day: string) => `night:${day}`,
  postDay: (postId: string) => `post:${postId}`,
  board: (day: string) => `board:${day}`,
  run: (day: string, user: string) => `run:${day}:${user}`,
  stats: (day: string) => `stats:${day}`,
  votes: (day: string) => `votes:${day}`,
  myVote: (day: string, user: string) => `vote:${day}:${user}`,
  user: (user: string) => `user:${user}`,
  shared: (day: string, user: string) => `shared:${day}:${user}`,
};

export const today = (): string => dayKey(new Date());

const toInt = (v: string | undefined | null, fallback = 0): number => {
  const n = v == null ? NaN : parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

/** Returns the night for `day`, creating and saving it the first time. */
export const getOrCreateNight = async (day: string): Promise<Night> => {
  const saved = await redis.hGetAll(K.night(day));
  if (saved.day) {
    return {
      day: saved.day,
      number: toInt(saved.number, 1),
      seed: toInt(saved.seed),
      modifier: isModifierId(saved.modifier) ? saved.modifier : 'blood_moon',
      start: (saved.start as WeaponId) || 'bolt',
      boss: (saved.boss as BossId) || 'warden',
    };
  }
  await redis.set(K.launch, day, { nx: true });
  const launch = (await redis.get(K.launch)) ?? day;
  const night = defaultNight(day, Math.max(1, daysBetween(launch, day) + 1));
  const voted = await voteWinner(addDays(day, -1));
  if (voted) night.modifier = voted;
  await redis.hSet(K.night(day), {
    day: night.day,
    number: String(night.number),
    seed: String(night.seed),
    modifier: night.modifier,
    start: night.start,
    boss: night.boss,
  });
  return night;
};

/** The modifier players voted for on `day` (applies to the next night), if anyone voted. */
const voteWinner = async (day: string): Promise<ModifierId | null> => {
  const counts = await redis.hGetAll(K.votes(day));
  let best: ModifierId | null = null;
  let bestN = 0;
  for (const [id, n] of Object.entries(counts)) {
    const c = toInt(n);
    if (isModifierId(id) && c > bestN) {
      best = id;
      bestN = c;
    }
  }
  return best;
};

export const linkPostToNight = async (postId: string, day: string): Promise<void> => {
  await redis.set(K.postDay(postId), day);
  await redis.hSet(K.night(day), { postId });
  const current = await redis.get(K.current);
  if (!current || current <= day) await redis.set(K.current, day);
};

export const nightPostId = async (day: string): Promise<string | undefined> =>
  redis.hGet(K.night(day), 'postId');

export const dayForPost = async (postId: string): Promise<string | undefined> =>
  redis.get(K.postDay(postId));

export const currentDay = async (): Promise<string | undefined> => redis.get(K.current);

// ---------- Leaderboard and stats ----------

export const topRows = async (day: string, n = 10): Promise<LeaderRow[]> => {
  const rows = await redis.zRange(K.board(day), 0, n - 1, { by: 'rank', reverse: true });
  return rows.map((r, i) => ({ rank: i + 1, username: r.member, score: r.score }));
};

export const rankOf = async (day: string, user: string): Promise<number | null> => {
  const score = await redis.zScore(K.board(day), user);
  if (score === undefined) return null;
  // rank among players sorted high to low = number of players with a higher score + 1
  const higher = await redis.zRange(K.board(day), score + 0.5, '+inf', { by: 'score' });
  return higher.length + 1;
};

export const nightStats = async (day: string) => {
  const s = await redis.hGetAll(K.stats(day));
  return { players: toInt(s.players), kills: toInt(s.kills), bossKills: toInt(s.bossKills) };
};

export const myStatus = async (day: string, user: string | null): Promise<MyStatus> => {
  if (!user) return { played: false, score: null, rank: null, streak: 0, nights: 0, bestScore: 0, shared: false };
  const [run, u, shared] = await Promise.all([
    redis.get(K.run(day, user)),
    redis.hGetAll(K.user(user)),
    redis.get(K.shared(day, user)),
  ]);
  const score = run ? (JSON.parse(run) as { score: number }).score : null;
  const lastDay = u.lastDay;
  // a streak only counts if the last night played was today or yesterday
  const alive = lastDay === day || lastDay === addDays(day, -1);
  return {
    played: run !== undefined,
    score,
    rank: run ? await rankOf(day, user) : null,
    streak: alive ? toInt(u.streak) : 0,
    nights: toInt(u.nights),
    bestScore: toInt(u.bestScore),
    shared: shared !== undefined,
  };
};

/** Saves the first ranked run of the night. Returns false when the player already has one. */
export const saveRankedRun = async (day: string, user: string, report: RunReport, score: number): Promise<{ saved: boolean; newBest: boolean }> => {
  // one ranked run per player per night
  if ((await redis.get(K.run(day, user))) !== undefined) return { saved: false, newBest: false };
  await redis.set(K.run(day, user), JSON.stringify({ ...report, score, at: Date.now() }));
  await redis.zAdd(K.board(day), { member: user, score });
  await Promise.all([
    redis.hIncrBy(K.stats(day), 'players', 1),
    redis.hIncrBy(K.stats(day), 'kills', report.kills),
    report.bossKilled ? redis.hIncrBy(K.stats(day), 'bossKills', 1) : Promise.resolve(0),
  ]);
  const u = await redis.hGetAll(K.user(user));
  const streak = u.lastDay === addDays(day, -1) ? toInt(u.streak) + 1 : u.lastDay === day ? toInt(u.streak) : 1;
  const bestScore = toInt(u.bestScore);
  const newBest = score > bestScore;
  await redis.hSet(K.user(user), {
    lastDay: day,
    streak: String(streak),
    nights: String(toInt(u.nights) + 1),
    bestScore: String(Math.max(bestScore, score)),
  });
  return { saved: true, newBest };
};

export const getRun = async (day: string, user: string): Promise<(RunReport & { score: number }) | null> => {
  const run = await redis.get(K.run(day, user));
  return run ? (JSON.parse(run) as RunReport & { score: number }) : null;
};

export const markShared = async (day: string, user: string): Promise<boolean> => {
  if ((await redis.get(K.shared(day, user))) !== undefined) return false;
  await redis.set(K.shared(day, user), '1');
  return true;
};

export const unmarkShared = async (day: string, user: string): Promise<void> => {
  await redis.del(K.shared(day, user));
};

// ---------- Votes for tomorrow's modifier ----------

export const voteState = async (night: Night, user: string | null): Promise<VoteState> => {
  const options = voteOptions(night.day, night.modifier);
  const [counts, mine] = await Promise.all([
    redis.hGetAll(K.votes(night.day)),
    user ? redis.get(K.myVote(night.day, user)) : Promise.resolve(undefined),
  ]);
  const clean: Record<string, number> = {};
  for (const id of options) clean[id] = toInt(counts[id]);
  return { options, counts: clean, mine: isModifierId(mine) ? mine : null };
};

export const castVote = async (night: Night, user: string, option: ModifierId): Promise<void> => {
  const prev = await redis.get(K.myVote(night.day, user));
  if (prev === option) return;
  await redis.set(K.myVote(night.day, user), option);
  if (isModifierId(prev)) await redis.hIncrBy(K.votes(night.day), prev, -1);
  await redis.hIncrBy(K.votes(night.day), option, 1);
};
