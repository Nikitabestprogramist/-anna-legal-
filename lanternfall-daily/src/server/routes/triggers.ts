import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createNightPost } from '../core/post';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  try {
    const input = await c.req.json<OnAppInstallRequest>();
    const { id } = await createNightPost();
    return c.json<TriggerResponse>({
      status: 'success',
      message: `Night post ${id} ready in r/${context.subredditName} (trigger: ${input.type})`,
    });
  } catch (error) {
    console.error(`Error creating post on install: ${String(error)}`);
    return c.json<TriggerResponse>({ status: 'error', message: 'Failed to create post' }, 400);
  }
});
