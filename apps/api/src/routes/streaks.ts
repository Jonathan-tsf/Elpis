import { Hono } from 'hono';
import { type DailyLogInput } from '@lifeos/shared';
import { getDocClient, queryItems } from '../services/dynamodb-client';
import { USER_PK } from '../services/keys';
import { recomputeStreaks } from '../services/streaks';

type DailyLogItem = {
  PK: string;
  SK: string;
  type: 'DAILY_LOG';
  date: string;
  data: DailyLogInput;
  updated_at: number;
};

export function streaksRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();

  app.get('/', async (c) => {
    const doc = getDocClient();
    const items = await queryItems<DailyLogItem>(doc, {
      pk: USER_PK,
      skBegins: 'DAY#',
    });

    const logs = items.map((i) => ({ date: i.date, data: i.data }));
    const computed = recomputeStreaks(logs);

    return c.json({ streaks: Object.values(computed) });
  });

  return app;
}
