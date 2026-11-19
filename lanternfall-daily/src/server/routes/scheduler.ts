import { Hono } from 'hono';
import type { TaskRequest, TaskResponse } from '@devvit/web/server';
import { createNightPost } from '../core/post';

export const schedulerRoutes = new Hono();

// Runs shortly after midnight UTC (see devvit.json) and posts the new night.
schedulerRoutes.post('/daily-night', async (c) => {
  try {
    const task = await c.req.json<TaskRequest>();
    const { id, created } = await createNightPost();
    console.log(`Task ${task.name}: night post ${id} ${created ? 'created' : 'already existed'}`);
  } catch (error) {
    console.error(`Daily night task failed: ${String(error)}`);
  }
  return c.json<TaskResponse>({});
});
