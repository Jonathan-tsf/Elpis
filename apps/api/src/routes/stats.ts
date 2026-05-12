import { Hono } from 'hono';
import { getDocClient, queryItems } from '../services/dynamodb-client';
import { readStats } from '../services/xp-persistence';
import { USER_PK } from '../services/keys';

export function statsRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();

  app.get('/', async (c) => {
    const doc = getDocClient();
    const stats = await readStats(doc);
    const events = await queryItems(doc, {
      pk: USER_PK,
      skBegins: 'XP#',
      limit: 20,
      scanIndexForward: false,
    });
    return c.json({ stats, recent_events: events });
  });

  return app;
}
