import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { createNightPost, postUrl } from '../core/post';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const { id, created } = await createNightPost();
    return c.json<UiResponse>({
      showToast: created ? "Tonight's night is posted" : "Tonight's night is already posted",
      navigateTo: postUrl(id),
    });
  } catch (error) {
    console.error(`Error creating post: ${String(error)}`);
    return c.json<UiResponse>({ showToast: 'Could not create the post' }, 400);
  }
});
