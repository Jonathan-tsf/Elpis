import { Hono } from 'hono';
import { getDocClient, putItem, getItem } from '../services/dynamodb-client';
import { USER_PK, dateString } from '../services/keys';
import { runWithTools, type ClaudeResponse } from '../services/bedrock-client';
import { CLAUDE_HAIKU_4_5 } from '../services/claude-models';
import { buildReadTools, buildReadHandlers } from '../services/ai-tools';

const SYSTEM_PROMPT = `Tu es le coach personnel de Jonathan dans LifeOS, une app de suivi physique gamifiée.
Tu génères un briefing du matin court (3-5 lignes max), direct, motivant mais pas mielleux.
Tu mentionnes 1 observation factuelle sur la semaine + le focus du jour + 1 alerte si pertinente.
Tu réponds en français. Pas d'émojis, sauf 1 max au début si tu juges pertinent.`;

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
    const today = dateString();
    const doc = getDocClient();
    const tools = buildReadTools();
    const handlers = buildReadHandlers(doc);

    const userMessage = `Génère le briefing du matin pour aujourd'hui (${today}). Utilise les outils pour récupérer le contexte nécessaire (sommeil 7 derniers jours, séances 7 derniers jours, stats, quêtes du jour). Garde le message court.`;

    const { finalText, usage } = await runWithTools({
      model: CLAUDE_HAIKU_4_5,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      tools,
      toolHandlers: handlers,
      maxIters: 4,
    });

    const item: BriefingItem = {
      PK: USER_PK,
      SK: `BRIEF#${today}`,
      type: 'BRIEFING',
      date: today,
      text: finalText,
      model: CLAUDE_HAIKU_4_5,
      usage,
      created_at: Date.now(),
    };
    await putItem(doc, item as unknown as Record<string, unknown>);
    return c.json(item);
  });

  return app;
}
