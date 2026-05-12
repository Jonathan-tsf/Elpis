import { Hono } from 'hono';
import { type StatName } from '@lifeos/shared';
import { getDocClient, queryItems } from '../services/dynamodb-client';
import { readStats } from '../services/xp-persistence';
import { USER_PK } from '../services/keys';
import { computeActivity } from '../services/decay';

export function statsRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();

  app.get('/', async (c) => {
    const doc = getDocClient();
    const stats = await readStats(doc);
    const events = await queryItems(doc, {
      pk: USER_PK,
      skBegins: 'XP#',
      limit: 100,
      scanIndexForward: false,
    });
    const { activity, avatar_mode } = computeActivity(
      stats,
      events as { ts: number; stat: StatName }[],
      new Date(),
    );
    return c.json({ stats, recent_events: events, activity, avatar_mode });
  });

  return app;
}
