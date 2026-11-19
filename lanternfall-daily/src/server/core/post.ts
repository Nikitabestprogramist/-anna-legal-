import { context, reddit } from '@devvit/web/server';
import { BOSS_NAMES, findModifier, type Night } from '../../shared/night';
import { getOrCreateNight, linkPostToNight, nightPostId, today } from './store';

const title = (n: Night): string => {
  const mod = findModifier(n.modifier);
  return `Lanternfall · Night ${n.number}: ${mod ? mod.name : 'The dark returns'}`;
};

/** Creates the post for `day` (tonight by default) unless it already exists. Returns its id. */
export const createNightPost = async (day: string = today()): Promise<{ id: string; created: boolean }> => {
  const existing = await nightPostId(day);
  if (existing) return { id: existing, created: false };
  const night = await getOrCreateNight(day);
  const mod = findModifier(night.modifier);
  const post = await reddit.submitCustomPost({
    subredditName: context.subredditName,
    title: title(night),
    entry: 'default',
    postData: { day: night.day, number: night.number },
    textFallback: {
      text: `Night ${night.number} of Lanternfall. Tonight: ${mod?.name ?? ''}. ${mod?.desc ?? ''} Survive until dawn and defeat ${BOSS_NAMES[night.boss]}. Open this post on new Reddit or the app to play.`,
    },
  });
  await linkPostToNight(post.id, night.day);
  return { id: post.id, created: true };
};

export const postUrl = (postId: string): string =>
  `https://www.reddit.com/r/${context.subredditName}/comments/${postId.replace(/^t3_/, '')}`;
