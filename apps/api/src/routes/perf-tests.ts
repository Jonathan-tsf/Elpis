import { Hono } from 'hono';
import { PerfTestInput, PerfTestType } from '@lifeos/shared';
import { perfTestKey, USER_PK, dateString } from '../services/keys';
import { putItem, queryItems, getDocClient } from '../services/dynamodb-client';
import { deltasForPerfTest } from '../services/xp-engine';
import { awardXp } from '../services/xp-persistence';

type PerfTestItem = {
  PK: string;
  SK: string;
  type: 'PERF_TEST';
  id: string;
  data: {
    type: string;
    value: number;
    unit?: string;
    date: string;
    notes?: string;
  };
  created_at: number;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function perfTestsRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();

  // POST / — create a perf test entry
  app.post('/', async (c) => {
    const bodyRaw = await c.req.json().catch(() => null);
    const parsed = PerfTestInput.safeParse(bodyRaw);
    if (!parsed.success) return c.json({ error: 'invalid body', issues: parsed.error.issues }, 400);

    const input = parsed.data;
    const id = crypto.randomUUID();
    const created_at = Date.now();
    const { pk, sk } = perfTestKey(input.date, id);

    const item: PerfTestItem = {
      PK: pk,
      SK: sk,
      type: 'PERF_TEST',
      id,
      data: input,
      created_at,
    };

    const doc = getDocClient();
    await putItem(doc, item);

    const deltas = deltasForPerfTest(input);
    const stats = await awardXp(doc, deltas, `perf_test:${id}`);

    return c.json({ id, ...input, created_at, xp_deltas: deltas, stats });
  });

  // GET / — list perf tests with optional date range
  app.get('/', async (c) => {
    const from = c.req.query('from') ?? dateString(new Date(Date.now() - 365 * 86400_000));
    const to = c.req.query('to') ?? dateString();
    if (!datePattern.test(from) || !datePattern.test(to)) {
      return c.json({ error: 'invalid date range' }, 400);
    }

    const doc = getDocClient();
    const items = await queryItems<PerfTestItem>(doc, { pk: USER_PK, skBegins: 'PERF#' });
    const filtered = items
      .filter((i) => i.data.date >= from && i.data.date <= to)
      .sort((a, b) => a.data.date.localeCompare(b.data.date))
      .map((i) => ({ id: i.id, ...i.data, created_at: i.created_at }));
    return c.json({ items: filtered, from, to });
  });

  // GET /:type — time series for a specific test type
  app.get('/:type', async (c) => {
    const typeParam = c.req.param('type');
    const parsed = PerfTestType.safeParse(typeParam);
    if (!parsed.success) return c.json({ error: 'invalid test type' }, 400);

    const doc = getDocClient();
    const items = await queryItems<PerfTestItem>(doc, { pk: USER_PK, skBegins: 'PERF#' });
    const filtered = items
      .filter((i) => i.data.type === typeParam)
      .sort((a, b) => a.data.date.localeCompare(b.data.date))
      .map((i) => ({ id: i.id, ...i.data, created_at: i.created_at }));
    return c.json({ items: filtered, type: typeParam });
  });

  return app;
}
