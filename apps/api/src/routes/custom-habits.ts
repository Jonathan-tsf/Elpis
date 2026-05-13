import { Hono } from 'hono';
import { CustomHabitInput, HabitLogInput } from '@lifeos/shared';
import { customHabitKey, habitLogKey, USER_PK, dateString } from '../services/keys';
import { putItem, queryItems, getItem, getDocClient } from '../services/dynamodb-client';

type CustomHabitItem = {
  PK: string;
  SK: string;
  type: 'CUSTOM_HABIT';
  id: string;
  name: string;
  icon?: string;
  description?: string;
  frequency: string;
  target_per_period?: number;
  measurement: string;
  archived: boolean;
  created_at: number;
};

type HabitLogItem = {
  PK: string;
  SK: string;
  type: 'HABIT_LOG';
  habit_id: string;
  date: string;
  value?: number;
  done?: boolean;
  notes?: string;
  created_at: number;
};

export function customHabitsRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();

  // POST / — create a habit
  app.post('/', async (c) => {
    const bodyRaw = await c.req.json().catch(() => null);
    const parsed = CustomHabitInput.safeParse(bodyRaw);
    if (!parsed.success) return c.json({ error: 'invalid body', issues: parsed.error.issues }, 400);

    const id = crypto.randomUUID();
    const created_at = Date.now();
    const input = parsed.data;
    const { pk, sk } = customHabitKey(id);

    const item: CustomHabitItem = {
      PK: pk,
      SK: sk,
      type: 'CUSTOM_HABIT',
      id,
      name: input.name,
      frequency: input.frequency,
      measurement: input.measurement,
      archived: input.archived ?? false,
      created_at,
      ...(input.icon ? { icon: input.icon } : {}),
      ...(input.description ? { description: input.description } : {}),
      ...(input.target_per_period != null ? { target_per_period: input.target_per_period } : {}),
    };

    const doc = getDocClient();
    await putItem(doc, item);

    return c.json({ id, ...input, archived: item.archived, created_at }, 201);
  });

  // GET / — list non-archived (or all if include_archived=true)
  app.get('/', async (c) => {
    const includeArchived = c.req.query('include_archived') === 'true';
    const doc = getDocClient();
    const items = await queryItems<CustomHabitItem>(doc, {
      pk: USER_PK,
      skBegins: 'HABIT#',
    });
    const habits = items.filter((h) => includeArchived || !h.archived);
    return c.json({ items: habits.map((h) => ({ id: h.id, name: h.name, icon: h.icon, description: h.description, frequency: h.frequency, target_per_period: h.target_per_period, measurement: h.measurement, archived: h.archived, created_at: h.created_at })) });
  });

  // PATCH /:id — partial update
  app.patch('/:id', async (c) => {
    const id = c.req.param('id');
    const bodyRaw = await c.req.json().catch(() => null);
    const parsed = CustomHabitInput.partial().safeParse(bodyRaw);
    if (!parsed.success) return c.json({ error: 'invalid body', issues: parsed.error.issues }, 400);

    const doc = getDocClient();
    const { pk, sk } = customHabitKey(id);
    const existing = await getItem<CustomHabitItem>(doc, pk, sk);
    if (!existing) return c.json({ error: 'not found' }, 404);

    const updated: CustomHabitItem = {
      ...existing,
      ...parsed.data,
      PK: existing.PK,
      SK: existing.SK,
      type: 'CUSTOM_HABIT',
      id: existing.id,
      name: parsed.data.name ?? existing.name,
      frequency: parsed.data.frequency ?? existing.frequency,
      measurement: parsed.data.measurement ?? existing.measurement,
      archived: parsed.data.archived ?? existing.archived,
      created_at: existing.created_at,
    };

    await putItem(doc, updated);
    return c.json({ id: updated.id, name: updated.name, icon: updated.icon, description: updated.description, frequency: updated.frequency, target_per_period: updated.target_per_period, measurement: updated.measurement, archived: updated.archived, created_at: updated.created_at });
  });

  // DELETE /:id — archive
  app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const doc = getDocClient();
    const { pk, sk } = customHabitKey(id);
    const existing = await getItem<CustomHabitItem>(doc, pk, sk);
    if (!existing) return c.json({ error: 'not found' }, 404);

    await putItem(doc, { ...existing, archived: true });
    return c.json({ archived: true });
  });

  // POST /logs — upsert a habit log
  app.post('/logs', async (c) => {
    const bodyRaw = await c.req.json().catch(() => null);
    const parsed = HabitLogInput.safeParse(bodyRaw);
    if (!parsed.success) return c.json({ error: 'invalid body', issues: parsed.error.issues }, 400);

    const input = parsed.data;
    const { pk, sk } = habitLogKey(input.habit_id, input.date);
    const created_at = Date.now();

    const item: HabitLogItem = {
      PK: pk,
      SK: sk,
      type: 'HABIT_LOG',
      habit_id: input.habit_id,
      date: input.date,
      created_at,
      ...(input.value != null ? { value: input.value } : {}),
      ...(input.done != null ? { done: input.done } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
    };

    const doc = getDocClient();
    await putItem(doc, item);

    return c.json({ habit_id: item.habit_id, date: item.date, value: item.value, done: item.done, notes: item.notes, created_at }, 201);
  });

  // GET /logs — list logs by habit_id and optional date range
  app.get('/logs', async (c) => {
    const habitId = c.req.query('habit_id');
    const from = c.req.query('from');
    const to = c.req.query('to');
    const doc = getDocClient();

    if (habitId) {
      const items = await queryItems<HabitLogItem>(doc, {
        pk: USER_PK,
        skBegins: `HLOG#${habitId}#`,
      });
      const filtered = items.filter((item) => {
        if (from && item.date < from) return false;
        if (to && item.date > to) return false;
        return true;
      });
      return c.json({ items: filtered.map((l) => ({ habit_id: l.habit_id, date: l.date, value: l.value, done: l.done, notes: l.notes, created_at: l.created_at })) });
    }

    // No habit_id — return all logs for the date range
    const items = await queryItems<HabitLogItem>(doc, {
      pk: USER_PK,
      skBegins: 'HLOG#',
    });
    const filtered = items.filter((item) => {
      if (from && item.date < from) return false;
      if (to && item.date > to) return false;
      return true;
    });
    return c.json({ items: filtered.map((l) => ({ habit_id: l.habit_id, date: l.date, value: l.value, done: l.done, notes: l.notes, created_at: l.created_at })) });
  });

  // GET /logs/today — all habit logs for today + habit metadata
  app.get('/logs/today', async (c) => {
    const today = dateString();
    const doc = getDocClient();

    const [habits, allLogs] = await Promise.all([
      queryItems<CustomHabitItem>(doc, { pk: USER_PK, skBegins: 'HABIT#' }),
      queryItems<HabitLogItem>(doc, { pk: USER_PK, skBegins: 'HLOG#' }),
    ]);

    const activeHabits = habits.filter((h) => !h.archived);
    const todayLogs = allLogs.filter((l) => l.date === today);
    const logsByHabitId = new Map(todayLogs.map((l) => [l.habit_id, l]));

    const result = activeHabits.map((h) => {
      const log = logsByHabitId.get(h.id);
      return {
        habit: { id: h.id, name: h.name, icon: h.icon, frequency: h.frequency, measurement: h.measurement, target_per_period: h.target_per_period },
        log: log ? { habit_id: log.habit_id, date: log.date, value: log.value, done: log.done, notes: log.notes } : null,
      };
    });

    return c.json({ date: today, items: result });
  });

  return app;
}
