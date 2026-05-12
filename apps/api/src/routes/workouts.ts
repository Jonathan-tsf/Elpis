import { Hono } from 'hono';
import { WorkoutInput } from '@lifeos/shared';
import { workoutKey, USER_PK, dateString } from '../services/keys';
import { putItem, queryItems, getDocClient } from '../services/dynamodb-client';
import { deltasForWorkout } from '../services/xp-engine';
import { awardXp } from '../services/xp-persistence';

type WorkoutItem = {
  PK: string;
  SK: string;
  type: 'WORKOUT';
  id: string;
  data: WorkoutInput;
  created_at: number;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function workoutsRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();

  // POST / — create a workout
  app.post('/', async (c) => {
    const bodyRaw = await c.req.json().catch(() => null);
    const parsed = WorkoutInput.safeParse(bodyRaw);
    if (!parsed.success) return c.json({ error: 'invalid body', issues: parsed.error.issues }, 400);

    const id = crypto.randomUUID();
    const created_at = Date.now();
    const input = parsed.data;
    const { pk, sk } = workoutKey(input.date, id);

    const item: WorkoutItem = {
      PK: pk,
      SK: sk,
      type: 'WORKOUT',
      id,
      data: input,
      created_at,
    };

    const doc = getDocClient();
    await putItem(doc, item);

    const deltas = deltasForWorkout(input);
    const stats = await awardXp(doc, deltas, `workout:${id}`);

    return c.json({ id, ...input, created_at, xp_deltas: deltas, stats });
  });

  // GET /:id — fetch one workout by id (query all workouts, find by id)
  app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const doc = getDocClient();
    const items = await queryItems<WorkoutItem>(doc, {
      pk: USER_PK,
      skBegins: 'WORKOUT#',
    });
    const found = items.find((i) => i.id === id);
    if (!found) return c.json({ error: 'not found' }, 404);
    return c.json({ id: found.id, ...found.data, created_at: found.created_at });
  });

  // GET / — range. ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive)
  app.get('/', async (c) => {
    const from = c.req.query('from') ?? dateString(new Date(Date.now() - 30 * 86400_000));
    const to = c.req.query('to') ?? dateString();
    if (!datePattern.test(from) || !datePattern.test(to)) {
      return c.json({ error: 'invalid date range' }, 400);
    }

    const doc = getDocClient();
    const items = await queryItems<WorkoutItem>(doc, {
      pk: USER_PK,
      skBegins: 'WORKOUT#',
    });
    const filtered = items
      .filter((i) => i.data.date >= from && i.data.date <= to)
      .sort((a, b) => a.data.date.localeCompare(b.data.date))
      .map((i) => ({ id: i.id, ...i.data, created_at: i.created_at }));
    return c.json({ items: filtered, from, to });
  });

  return app;
}
