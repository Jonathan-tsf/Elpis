import { Hono } from 'hono';
import { MeasurementInput } from '@lifeos/shared';
import { measurementKey, USER_PK, dateString } from '../services/keys';
import { putItem, queryItems, getDocClient } from '../services/dynamodb-client';

type MeasurementItem = {
  PK: string;
  SK: string;
  type: 'MEASUREMENT';
  data: MeasurementInput;
  created_at: number;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function measurementsRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();

  // POST / — create a measurement
  app.post('/', async (c) => {
    const bodyRaw = await c.req.json().catch(() => null);
    const parsed = MeasurementInput.safeParse(bodyRaw);
    if (!parsed.success) return c.json({ error: 'invalid body', issues: parsed.error.issues }, 400);

    const input = parsed.data;
    const { pk, sk } = measurementKey(input.metric, input.date);

    const item: MeasurementItem = {
      PK: pk,
      SK: sk,
      type: 'MEASUREMENT',
      data: input,
      created_at: Date.now(),
    };

    const doc = getDocClient();
    await putItem(doc, item);

    return c.json({ ...input, created_at: item.created_at });
  });

  // GET /:metric — range for a specific metric. ?from=YYYY-MM-DD&to=YYYY-MM-DD
  app.get('/:metric', async (c) => {
    const metric = c.req.param('metric');
    const from = c.req.query('from') ?? dateString(new Date(Date.now() - 30 * 86400_000));
    const to = c.req.query('to') ?? dateString();
    if (!datePattern.test(from) || !datePattern.test(to)) {
      return c.json({ error: 'invalid date range' }, 400);
    }

    const doc = getDocClient();
    const items = await queryItems<MeasurementItem>(doc, {
      pk: USER_PK,
      skBegins: `MEAS#${metric}#`,
    });
    const filtered = items
      .filter((i) => i.data.date >= from && i.data.date <= to)
      .sort((a, b) => a.data.date.localeCompare(b.data.date))
      .map((i) => ({ date: i.data.date, value: i.data.value }));
    return c.json({ items: filtered, from, to });
  });

  // GET / — latest measurement per metric
  app.get('/', async (c) => {
    const doc = getDocClient();
    const items = await queryItems<MeasurementItem>(doc, {
      pk: USER_PK,
      skBegins: 'MEAS#',
    });

    const latestMap: Record<string, { date: string; value: number }> = {};
    for (const item of items) {
      const { metric, date, value } = item.data;
      const existing = latestMap[metric];
      if (existing == null || date > existing.date) {
        latestMap[metric] = { date, value };
      }
    }

    return c.json({ latest: latestMap });
  });

  return app;
}
