// Shared rules for a "night": the daily challenge that every player gets.
// Used by the server (to create nights, check votes and score runs) and by the client (to show them).

export type WeaponId = 'bolt' | 'orbit' | 'nova' | 'chain' | 'comet';
export type BossId = 'warden' | 'king';

export type ModifierId =
  | 'blood_moon'
  | 'wisp_storm'
  | 'glass_lantern'
  | 'swarm'
  | 'bloom'
  | 'fog'
  | 'generous'
  | 'restless'
  | 'elite_hunt'
  | 'iron_bark'
  | 'falling_stars'
  | 'heavy_boots';

export type Modifier = {
  id: ModifierId;
  name: string;
  desc: string;
};

export const MODIFIERS: readonly Modifier[] = [
  { id: 'blood_moon', name: 'Blood Moon', desc: 'Enemies have 40% more HP. Sparks are worth double.' },
  { id: 'wisp_storm', name: 'Wisp Storm', desc: 'Wisps fill every wave and move 25% faster.' },
  { id: 'glass_lantern', name: 'Glass Lantern', desc: 'You have 60 max HP but deal 50% more damage.' },
  { id: 'swarm', name: 'The Swarm', desc: 'Twice as many enemies, each with half the HP.' },
  { id: 'bloom', name: 'Bloater Bloom', desc: 'Bloaters in every wave. Their bursts hit other enemies twice as hard.' },
  { id: 'fog', name: 'Thick Fog', desc: 'Your light shrinks, but sparks fly to you from 50% further away.' },
  { id: 'generous', name: 'Generous Night', desc: 'Every level-up offers 4 cards, and you start with 2 rerolls.' },
  { id: 'restless', name: 'Restless Night', desc: 'You and every enemy move 25% faster.' },
  { id: 'elite_hunt', name: 'Elite Hunt', desc: 'Golden elites with chests appear every 12 seconds.' },
  { id: 'iron_bark', name: 'Iron Bark', desc: 'Start with Bark Skin level 2, but move 12% slower.' },
  { id: 'falling_stars', name: 'Falling Stars', desc: 'Start with Ember Comet as a second weapon.' },
  { id: 'heavy_boots', name: 'Heavy Boots', desc: 'No dash tonight, but you take 25% less damage.' },
];

export const STARTERS: readonly WeaponId[] = ['bolt', 'orbit', 'nova', 'chain', 'comet'];

export const WEAPON_NAMES: Readonly<Record<WeaponId, string>> = {
  bolt: 'Lantern Bolt',
  orbit: 'Moth Ring',
  nova: 'Flare Pulse',
  chain: 'Arc Spark',
  comet: 'Ember Comet',
};

export const BOSS_NAMES: Readonly<Record<BossId, string>> = {
  warden: 'The Warden',
  king: 'The Hollow King',
};

export type Night = {
  day: string; // YYYY-MM-DD (UTC)
  number: number; // 1 for the first night in this community
  seed: number;
  modifier: ModifierId;
  start: WeaponId;
  boss: BossId;
};

/** Small, fast, deterministic random generator. Same seed gives the same sequence everywhere. */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const hashString = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

export const addDays = (day: string, n: number): string => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return dayKey(d);
};

export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

export const findModifier = (id: string | undefined): Modifier | undefined =>
  MODIFIERS.find((m) => m.id === id);

export const isModifierId = (id: unknown): id is ModifierId =>
  typeof id === 'string' && MODIFIERS.some((m) => m.id === id);

const pickFrom = <T>(list: readonly T[], r: number, fallback: T): T =>
  list[Math.floor(r * list.length)] ?? fallback;

/** The night's seeded defaults. The modifier can be replaced by the community vote. */
export const defaultNight = (day: string, number: number): Night => {
  const seed = hashString(`lanternfall:${day}`);
  const rng = mulberry32(seed);
  const modifier = pickFrom(MODIFIERS, rng(), MODIFIERS[0]!).id;
  const start = pickFrom(STARTERS, rng(), 'bolt');
  const boss: BossId = number % 2 === 0 ? 'king' : 'warden';
  return { day, number, seed, modifier, start, boss };
};

/** The three modifiers players can vote on for the night after `day`. Never repeats today's. */
export const voteOptions = (day: string, today: ModifierId): ModifierId[] => {
  const rng = mulberry32(hashString(`vote:${day}`));
  const pool = MODIFIERS.map((m) => m.id).filter((id) => id !== today);
  const out: ModifierId[] = [];
  while (out.length < 3 && pool.length) {
    const i = Math.floor(rng() * pool.length);
    const [id] = pool.splice(i, 1);
    if (id) out.push(id);
  }
  return out;
};

// ---------- Run scoring ----------

export const RUN_LIMITS = {
  maxSeconds: 300,
  maxKillsPerSecond: 9,
  dawnSeconds: 90,
} as const;

export type RunReport = {
  kills: number;
  seconds: number; // time survived, in whole seconds
  bossKilled: boolean;
  dawnLeft: number; // seconds left on the dawn timer when the boss died (0 otherwise)
  bestStreak: number;
  level: number;
  build: string[]; // e.g. ["Sunlance", "Moth Ring 3", "Ember Eye 2"]
};

export type ScoreBreakdown = {
  kills: number;
  survival: number;
  boss: number;
  speed: number;
  streak: number;
  total: number;
};

export const scoreRun = (r: RunReport): ScoreBreakdown => {
  const kills = r.kills * 10;
  const survival = r.seconds * 5;
  const boss = r.bossKilled ? 2500 : 0;
  const speed = r.bossKilled ? r.dawnLeft * 20 : 0;
  const streak = r.bestStreak * 5;
  return { kills, survival, boss, speed, streak, total: kills + survival + boss + speed + streak };
};

/** Rejects reports that no real run could produce. */
export const isPlausible = (r: RunReport): boolean =>
  Number.isInteger(r.kills) &&
  Number.isInteger(r.seconds) &&
  Number.isInteger(r.bestStreak) &&
  Number.isInteger(r.level) &&
  Number.isInteger(r.dawnLeft) &&
  r.seconds >= 0 &&
  r.seconds <= RUN_LIMITS.maxSeconds &&
  r.kills >= 0 &&
  r.kills <= r.seconds * RUN_LIMITS.maxKillsPerSecond + 40 &&
  r.bestStreak >= 0 &&
  r.bestStreak <= r.kills &&
  r.level >= 1 &&
  r.level <= 80 &&
  r.dawnLeft >= 0 &&
  r.dawnLeft <= RUN_LIMITS.dawnSeconds &&
  (r.bossKilled || r.dawnLeft === 0) &&
  Array.isArray(r.build) &&
  r.build.length <= 8 &&
  r.build.every((b) => typeof b === 'string' && b.length <= 40);
