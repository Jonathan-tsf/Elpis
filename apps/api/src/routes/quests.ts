import { Hono } from 'hono';
import { type DailyLogInput, DAILY_QUESTS } from '@lifeos/shared';
import { getDocClient, getItem } from '../services/dynamodb-client';
import { dailyLogKey, dateString } from '../services/keys';
import { evaluateCondition } from '../services/quest-evaluator';

type DailyLogItem = {
  PK: string;
  SK: string;
  type: 'DAILY_LOG';
  date: string;
  data: DailyLogInput;
  updated_at: number;
};

export function questsRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();

  app.get('/', async (c) => {
    const today = dateString();
    const { pk, sk } = dailyLogKey(today);
    const doc = getDocClient();
    const item = await getItem<DailyLogItem>(doc, pk, sk);
    const log = item?.data ?? null;

    const quests = DAILY_QUESTS.map((q) => {
      const done = evaluateCondition(q.condition, log);
      return { ...q, status: done ? ('done' as const) : ('active' as const) };
    });

    return c.json(quests);
  });

  return app;
}
