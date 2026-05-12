import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { getDocClient, putItem, queryItems, getItem } from '../services/dynamodb-client';
import { USER_PK, dateString } from '../services/keys';
import { runWithTools, type ClaudeResponse } from '../services/bedrock-client';
import { CLAUDE_SONNET_4_6 } from '../services/claude-models';
import { buildReadTools, buildReadHandlers } from '../services/ai-tools';

type Scope = 'sleep' | 'workouts' | 'looksmax' | 'global';

interface ReportItem {
  PK: string;
  SK: string;
  type: 'REPORT';
  id: string;
  scope: Scope;
  days: number;
  markdown: string;
  created_at: number;
  usage: ClaudeResponse['usage'];
}

function buildScopePrompt(scope: Scope, days: number): string {
  const window = `les ${days} derniers jours`;
  switch (scope) {
    case 'sleep':
      return `Analyse en profondeur le sommeil de Jonathan sur ${window}. Identifie les patterns, la durée moyenne, la régularité, les corrélations avec l'humeur/énergie. Donne des recommandations concrètes. Réponds en markdown structuré, en français.`;
    case 'workouts':
      return `Analyse les séances d'entraînement de Jonathan sur ${window}. Volume, fréquence, progression, régularité. Points forts, points faibles, recommandations. Réponds en markdown structuré, en français.`;
    case 'looksmax':
      return `Analyse le suivi looksmax de Jonathan (skincare, photos, mensurations, hydratation) sur ${window}. Identifie les tendances, les progrès, les gaps. Recommandations concrètes pour optimiser. Réponds en markdown structuré, en français.`;
    case 'global':
      return `Fais une analyse globale complète de Jonathan sur ${window} : santé physique, performance, habitudes, progression RPG. Synthèse avec les 3 forces et 3 axes d'amélioration prioritaires. Réponds en markdown structuré, en français.`;
  }
}

export function analysisRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();

  // POST /run — generate a new analysis report
  app.post('/run', async (c) => {
    const body = await c.req.json().catch(() => null) as {
      scope?: Scope;
      days?: number;
    } | null;

    const validScopes: Scope[] = ['sleep', 'workouts', 'looksmax', 'global'];
    const scope: Scope = body?.scope && validScopes.includes(body.scope) ? body.scope : 'global';
    const days = typeof body?.days === 'number' && body.days > 0 && body.days <= 365 ? body.days : 30;

    const doc = getDocClient();
    const tools = buildReadTools();
    const handlers = buildReadHandlers(doc);
    const prompt = buildScopePrompt(scope, days);

    const { finalText, usage } = await runWithTools({
      model: CLAUDE_SONNET_4_6,
      system: `Tu es un analyste de performance pour Jonathan. Tu analyses ses données de santé et d'entraînement avec rigueur. Utilise les outils pour lire les données avant d'analyser.`,
      messages: [{ role: 'user', content: prompt }],
      tools,
      toolHandlers: handlers,
      maxIters: 6,
    });

    const id = randomUUID();
    const date = dateString();
    const item: ReportItem = {
      PK: USER_PK,
      SK: `REPORT#${date}#${id}`,
      type: 'REPORT',
      id,
      scope,
      days,
      markdown: finalText,
      created_at: Date.now(),
      usage,
    };
    await putItem(doc, item as unknown as Record<string, unknown>);
    return c.json(item, 201);
  });

  // GET / — list all reports, most recent first
  app.get('/', async (c) => {
    const doc = getDocClient();
    const items = await queryItems<ReportItem>(doc, {
      pk: USER_PK,
      skBegins: 'REPORT#',
    });
    const sorted = [...items].sort((a, b) => b.created_at - a.created_at);
    return c.json(sorted);
  });

  // GET /:id — fetch a single report by id
  app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const doc = getDocClient();
    // We need to find by id — scan the reports and match
    const items = await queryItems<ReportItem>(doc, {
      pk: USER_PK,
      skBegins: 'REPORT#',
    });
    const item = items.find((r) => r.id === id);
    if (!item) return c.json({ error: 'not found' }, 404);
    return c.json(item);
  });

  return app;
}
