import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type {
  ErrorResponse,
  InitResponse,
  ScoreRequest,
  ScoreResponse,
  ShareResponse,
  VoteRequest,
  VoteResponse,
} from '../../shared/api';
import { BOSS_NAMES, findModifier, isModifierId, isPlausible, scoreRun, type Night } from '../../shared/night';
import { postUrl } from '../core/post';
import {
  castVote,
  currentDay,
  dayForPost,
  getOrCreateNight,
  getRun,
  linkPostToNight,
  markShared,
  myStatus,
  nightPostId,
  nightStats,
  rankOf,
  saveRankedRun,
  today,
  topRows,
  unmarkShared,
  voteState,
} from '../core/store';

export const api = new Hono();

const fail = (message: string): ErrorResponse => ({ status: 'error', message });

/** Finds the night this post belongs to. Posts made before linking fall back to tonight. */
const nightForPost = async (postId: string): Promise<Night> => {
  let day = await dayForPost(postId);
  if (!day) {
    day = today();
    if (!(await nightPostId(day))) await linkPostToNight(postId, day);
  }
  return getOrCreateNight(day);
};

const username = async (): Promise<string | null> => (await reddit.getCurrentUsername()) ?? null;

api.get('/init', async (c) => {
  const { postId } = context;
  if (!postId) return c.json(fail('This only works inside a Lanternfall post.'), 400);
  try {
    const [night, user] = await Promise.all([nightForPost(postId), username()]);
    const tonight = today();
    const isTonight = night.day === tonight;
    let tonightUrl: string | null = null;
    if (!isTonight) {
      const cur = (await currentDay()) ?? tonight;
      const id = (await nightPostId(tonight)) ?? (await nightPostId(cur));
      tonightUrl = id ? postUrl(id) : null;
    }
    const [stats, top, me, vote] = await Promise.all([
      nightStats(night.day),
      topRows(night.day, 10),
      myStatus(night.day, user),
      voteState(night, user),
    ]);
    return c.json<InitResponse>({
      type: 'init',
      postId,
      username: user,
      night,
      isTonight,
      tonightUrl,
      players: stats.players,
      kills: stats.kills,
      bossKills: stats.bossKills,
      top,
      me,
      vote,
    });
  } catch (error) {
    console.error(`Init failed for ${postId}: ${String(error)}`);
    return c.json(fail('Could not load tonight. Try again in a moment.'), 500);
  }
});

api.post('/score', async (c) => {
  const { postId } = context;
  if (!postId) return c.json(fail('Missing post.'), 400);
  const body = await c.req.json<ScoreRequest>().catch(() => null);
  const report = body?.report;
  if (!report || !isPlausible(report)) return c.json(fail('That run could not be recorded.'), 400);
  try {
    const [night, user] = await Promise.all([nightForPost(postId), username()]);
    const breakdown = scoreRun(report);
    let ranked = false;
    let newBest = false;
    if (user && night.day === today()) {
      const res = await saveRankedRun(night.day, user, report, breakdown.total);
      ranked = res.saved;
      newBest = res.newBest;
    }
    const [stats, top, me] = await Promise.all([nightStats(night.day), topRows(night.day, 10), myStatus(night.day, user)]);
    // a practice run shows where it would have placed, without saving it
    const rank = ranked ? me.rank : user ? await practiceRank(night.day, breakdown.total) : null;
    return c.json<ScoreResponse>({ type: 'score', ranked, breakdown, rank, players: stats.players, top, me, newBest });
  } catch (error) {
    console.error(`Score failed: ${String(error)}`);
    return c.json(fail('Could not save your run.'), 500);
  }
});

const practiceRank = async (day: string, score: number): Promise<number> => {
  const top = await topRows(day, 1000);
  return top.filter((r) => r.score > score).length + 1;
};

api.post('/vote', async (c) => {
  const { postId } = context;
  if (!postId) return c.json(fail('Missing post.'), 400);
  const body = await c.req.json<VoteRequest>().catch(() => null);
  const user = await username();
  if (!user) return c.json(fail('Log in to vote.'), 401);
  const night = await nightForPost(postId);
  if (night.day !== today()) return c.json(fail('Voting for this night has closed.'), 400);
  const state = await voteState(night, user);
  if (!body || !isModifierId(body.option) || !state.options.includes(body.option)) {
    return c.json(fail('That option is not on the ballot.'), 400);
  }
  await castVote(night, user, body.option);
  return c.json<VoteResponse>({ type: 'vote', vote: await voteState(night, user) });
});

api.post('/share', async (c) => {
  const { postId } = context;
  if (!postId) return c.json(fail('Missing post.'), 400);
  const user = await username();
  if (!user) return c.json(fail('Log in to share.'), 401);
  const night = await nightForPost(postId);
  const run = await getRun(night.day, user);
  if (!run) return c.json(fail('Finish tonight’s run first.'), 400);
  if (!(await markShared(night.day, user))) {
    return c.json<ShareResponse>({ type: 'share', ok: false, message: 'You already shared tonight’s run.' });
  }
  const rank = await rankOf(night.day, user);
  const mod = findModifier(night.modifier);
  const outcome = run.bossKilled ? `defeated ${BOSS_NAMES[night.boss]} with ${run.dawnLeft}s to dawn` : 'held the dark back until the end';
  const text = [
    `**Night ${night.number} · ${mod?.name ?? ''}**: ${run.score.toLocaleString('en-US')} points${rank ? `, rank #${rank}` : ''}`,
    '',
    `I ${outcome}. ${run.kills} shades banished, level ${run.level}, best streak ${run.bestStreak}.`,
    '',
    run.build.length ? `Build: ${run.build.join(' · ')}` : '',
  ]
    .filter((l, i, a) => l !== '' || a[i - 1] !== '')
    .join('\n');
  try {
    await reddit.submitComment({ id: postId, text, runAs: 'USER' });
    return c.json<ShareResponse>({ type: 'share', ok: true, message: 'Your result is posted in the comments.' });
  } catch (error) {
    console.error(`Share failed: ${String(error)}`);
    await unmarkShared(night.day, user);
    return c.json(fail('Could not post the comment.'), 500);
  }
});
