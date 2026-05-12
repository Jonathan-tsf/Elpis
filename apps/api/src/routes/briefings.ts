import { Hono } from 'hono';
import { getDocClient, getItem } from '../services/dynamodb-client';
import { USER_PK, dateString } from '../services/keys';
import { generateBriefing } from '../services/briefing-generator';
import type { ClaudeResponse } from '../services/bedrock-client';

interface BriefingItem {
  PK: string;
  SK: string;
  type: 'BRIEFING';
  date: string;
  text: string;
  model: string;
  usage: ClaudeResponse['usage'];
  created_at: number;
}

export function briefingsRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();

  app.get('/today', async (c) => {
    const today = dateString();
    const sk = `BRIEF#${today}`;
    const doc = getDocClient();
    const item = await getItem<BriefingItem>(doc, USER_PK, sk);
    return c.json(item ?? { text: null, date: today });
  });

  app.post('/generate', async (c) => {
    const item = await generateBriefing();
    return c.json({ ...item, type: 'BRIEFING' as const, PK: USER_PK, SK: `BRIEF#${item.date}`, created_at: Date.now() });
  });

  return app;
}
