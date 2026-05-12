import { Hono } from 'hono';
import { z } from 'zod';
import { DailyLogInput } from '@lifeos/shared';
import { dailyLogKey, USER_PK, dateString } from '../services/keys';
import { getItem, putItem, queryItems, getDocClient } from '../services/dynamodb-client';

type DailyLogItem = {
  pk: string;
  sk: string;
  type: 'DAILY_LOG';
  date: string;
  data: z.infer<typeof DailyLogInput>;
  updated_at: number;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function dailyLogRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();

  // PUT /:date — upsert
  app.put('/:date', async (c) => {
    const dateParam = c.req.param('date');
    if (!datePattern.test(dateParam)) return c.json({ error: 'invalid date' }, 400);

    const bodyRaw = await c.req.json().catch(() => null);
    const parsed = DailyLogInput.safeParse(bodyRaw);
    if (!parsed.success) return c.json({ error: 'invalid body', issues: parsed.error.issues }, 400);

    const { pk, sk } = dailyLogKey(dateParam);
    const item: DailyLogItem = {
      pk,
      sk,
      type: 'DAILY_LOG',
      date: dateParam,
      data: parsed.data,
      updated_at: Date.now(),
    };

    const doc = getDocClient();
    await putItem(doc, item);

    return c.json({ date: dateParam, ...parsed.data, updated_at: item.updated_at });
  });

  // GET /:date — fetch one
  app.get('/:date', async (c) => {
    const dateParam = c.req.param('date');
    if (!datePattern.test(dateParam)) return c.json({ error: 'invalid date' }, 400);

    const { pk, sk } = dailyLogKey(dateParam);
    const doc = getDocClient();
    const item = await getItem<DailyLogItem>(doc, pk, sk);
    if (!item) return c.json({ error: 'not found' }, 404);
    return c.json({ date: item.date, ...item.data, updated_at: item.updated_at });
  });

  // GET / — range. ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive)
  app.get('/', async (c) => {
    const from = c.req.query('from') ?? dateString(new Date(Date.now() - 30 * 86400_000));
    const to = c.req.query('to') ?? dateString();
    if (!datePattern.test(from) || !datePattern.test(to)) {
      return c.json({ error: 'invalid date range' }, 400);
    }

    const doc = getDocClient();
    const items = await queryItems<DailyLogItem>(doc, {
      pk: USER_PK,
      skBegins: 'DAY#',
    });
    const filtered = items
      .filter((i) => i.date >= from && i.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((i) => ({ date: i.date, ...i.data, updated_at: i.updated_at }));
    return c.json({ items: filtered, from, to });
  });

  return app;
}
