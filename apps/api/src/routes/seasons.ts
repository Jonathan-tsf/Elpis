import { Hono } from 'hono';
import { z } from 'zod';
import { type Season, SeasonInput } from '@lifeos/shared';
import {
  getDocClient,
  getItem,
  putItem,
  queryItems,
  updateItem,
} from '../services/dynamodb-client';
import { USER_PK, seasonKey, dateString } from '../services/keys';
import { awardXp } from '../services/xp-persistence';
import { runWithTools } from '../services/bedrock-client';
import { CLAUDE_SONNET_4_6 } from '../services/claude-models';
import { buildReadTools, buildReadHandlers } from '../services/ai-tools';

const SEASON_SK_PREFIX = 'SEASON#';

interface SeasonItem extends Season {
  PK: string;
  SK: string;
  type: 'SEASON';
}

function toSeason(item: SeasonItem): Season {
  const { PK: _pk, SK: _sk, type: _type, ...rest } = item;
  return rest as Season;
}

// ---- AI helpers ----

const GENERATE_SYSTEM = `Tu es le coach de Jonathan dans LifeOS, une app de suivi physique gamifiée.
Tu génères un plan de saison (3 mois) basé sur ses données récentes.
Format JSON strict:
{
  "name": "string (max 120 chars)",
  "main_objective": "string (max 500 chars)",
  "quests": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "condition": {"type": "workout_count_gte|sleep_hours_gte|hydration_l_gte|daily_log_filled|skincare_am_done|skincare_pm_done|photo_with_tag", "params": {}},
      "xp_reward": 5000,
      "stat_reward": "force|endurance|vitality|discipline|appearance|spirit",
      "done": false
    }
  ]
}
Génère exactement 3 quêtes de saison ambitieuses mais réalistes. Réponds UNIQUEMENT avec le JSON.`;

const AiSeasonDraftSchema = z.object({
  name: z.string().min(1).max(120),
  main_objective: z.string().min(1).max(500),
  quests: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        condition: z.object({
          type: z.string().min(1),
          params: z.record(z.string(), z.unknown()).optional(),
        }),
        xp_reward: z.number().int().min(0).max(50_000),
        stat_reward: z
          .enum(['force', 'endurance', 'vitality', 'discipline', 'appearance', 'spirit'])
          .optional(),
        done: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(10),
});

const RECAP_SYSTEM = `Tu es le coach de Jonathan dans LifeOS.
Tu génères un récap de fin de saison en markdown (5-10 lignes).
Sois factuel, honnête, motivant. Mentionne les quêtes accomplies, les stats progressées, et un focus pour la prochaine saison.
Réponds en français.`;

async function generateSeasonDraft(
  start_date: string,
  end_date: string,
  doc: ReturnType<typeof getDocClient>,
): Promise<z.infer<typeof AiSeasonDraftSchema>> {
  const tools = buildReadTools();
  const handlers = buildReadHandlers(doc);

  const userMessage = `Génère un plan de saison du ${start_date} au ${end_date}.
Consulte les statistiques récentes, les performances, les mesures corporelles pour adapter le plan.
Réponds uniquement avec le JSON.`;

  const { finalText } = await runWithTools({
    model: CLAUDE_SONNET_4_6,
    system: GENERATE_SYSTEM,
    messages: [{ role: 'user', content: userMessage }],
    tools,
    toolHandlers: handlers,
    maxIters: 4,
  });

  const jsonMatch = finalText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in AI response');
  const parsed = AiSeasonDraftSchema.parse(JSON.parse(jsonMatch[0]));
  return parsed;
}

async function generateRecap(
  season: Season,
  doc: ReturnType<typeof getDocClient>,
): Promise<string> {
  const tools = buildReadTools();
  const handlers = buildReadHandlers(doc);

  const doneSummary = season.quests
    .map((q) => `- ${q.title}: ${q.done ? 'ACCOMPLIE' : 'NON ACCOMPLIE'}`)
    .join('\n');

  const userMessage = `La saison "${season.name}" (${season.start_date} → ${season.end_date}) est terminée.
Objectif principal: ${season.main_objective}
Quêtes:
${doneSummary}

Consulte les données récentes et génère un récap de fin de saison en markdown.`;

  const { finalText } = await runWithTools({
    model: CLAUDE_SONNET_4_6,
    system: RECAP_SYSTEM,
    messages: [{ role: 'user', content: userMessage }],
    tools,
    toolHandlers: handlers,
    maxIters: 4,
  });

  return finalText;
}

// ---- Route ----

export function seasonsRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();

  // POST / — create a new season
  app.post('/', async (c) => {
    const body = await c.req.json();
    const parsed = SeasonInput.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const id = crypto.randomUUID();
    const now = Date.now();
    const { pk, sk } = seasonKey(id);
    const item: SeasonItem = {
      PK: pk,
      SK: sk,
      type: 'SEASON',
      id,
      status: 'active',
      created_at: now,
      ...parsed.data,
    };
    await putItem(getDocClient(), item as unknown as Record<string, unknown>);
    return c.json(toSeason(item), 201);
  });

  // POST /generate — ask Claude for a season draft (not persisted)
  app.post('/generate', async (c) => {
    const body = await c.req.json() as { start_date?: unknown; end_date?: unknown };
    const startDate = typeof body.start_date === 'string' ? body.start_date : '';
    const endDate = typeof body.end_date === 'string' ? body.end_date : '';
    if (!startDate || !endDate) {
      return c.json({ error: 'start_date and end_date required' }, 400);
    }
    const doc = getDocClient();
    const draft = await generateSeasonDraft(startDate, endDate, doc);
    const today = dateString();
    return c.json({
      name: draft.name,
      main_objective: draft.main_objective,
      start_date: startDate,
      end_date: endDate,
      quests: draft.quests.map((q) => ({ ...q, done: false })),
      rewards: [],
      _generated_at: today,
    });
  });

  // GET / — list all seasons, most recent first
  app.get('/', async (c) => {
    const doc = getDocClient();
    const items = await queryItems<SeasonItem>(doc, {
      pk: USER_PK,
      skBegins: SEASON_SK_PREFIX,
      scanIndexForward: false,
    });
    return c.json(items.map(toSeason));
  });

  // GET /current — active season covering today
  app.get('/current', async (c) => {
    const today = dateString();
    const doc = getDocClient();
    const items = await queryItems<SeasonItem>(doc, {
      pk: USER_PK,
      skBegins: SEASON_SK_PREFIX,
    });
    const current = items.find(
      (s) =>
        s.status === 'active' &&
        s.start_date <= today &&
        s.end_date >= today,
    );
    return c.json(current ? toSeason(current) : null);
  });

  // GET /:id — fetch a specific season
  app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const { pk, sk } = seasonKey(id);
    const item = await getItem<SeasonItem>(getDocClient(), pk, sk);
    if (!item) return c.json({ error: 'not_found' }, 404);
    return c.json(toSeason(item));
  });

  // POST /:id/end — end season and generate recap
  app.post('/:id/end', async (c) => {
    const id = c.req.param('id');
    const { pk, sk } = seasonKey(id);
    const doc = getDocClient();
    const item = await getItem<SeasonItem>(doc, pk, sk);
    if (!item) return c.json({ error: 'not_found' }, 404);
    if (item.status === 'ended') return c.json({ error: 'already_ended' }, 400);

    const season: Season = toSeason(item);
    const recap_markdown = await generateRecap(season, doc);

    await updateItem(doc, pk, sk, { status: 'ended', recap_markdown });
    return c.json({ ...season, status: 'ended', recap_markdown });
  });

  // PUT /:id — partial update (quests, rewards, etc.)
  app.put('/:id', async (c) => {
    const id = c.req.param('id');
    const { pk, sk } = seasonKey(id);
    const doc = getDocClient();
    const item = await getItem<SeasonItem>(doc, pk, sk);
    if (!item) return c.json({ error: 'not_found' }, 404);

    const body = await c.req.json();
    const PartialInput = SeasonInput.partial();
    const parsed = PartialInput.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const updates = parsed.data as Record<string, unknown>;
    if (Object.keys(updates).length > 0) {
      await updateItem(doc, pk, sk, updates);
    }
    return c.json({ ...toSeason(item), ...updates });
  });

  // POST /:id/quests/:questId/complete — mark one quest done + award XP
  app.post('/:id/quests/:questId/complete', async (c) => {
    const id = c.req.param('id');
    const questId = c.req.param('questId');
    const { pk, sk } = seasonKey(id);
    const doc = getDocClient();
    const item = await getItem<SeasonItem>(doc, pk, sk);
    if (!item) return c.json({ error: 'not_found' }, 404);

    const questIdx = item.quests.findIndex((q) => q.id === questId);
    if (questIdx === -1) return c.json({ error: 'quest_not_found' }, 404);

    const quest = item.quests[questIdx];
    if (!quest) return c.json({ error: 'quest_not_found' }, 404);
    if (quest.done) return c.json({ error: 'already_done' }, 400);

    const newQuests = item.quests.map((q, i) =>
      i === questIdx ? { ...q, done: true } : q,
    );
    await updateItem(doc, pk, sk, { quests: newQuests });

    // Award XP
    const stat = quest.stat_reward ?? 'discipline';
    await awardXp(doc, [{ stat, amount: quest.xp_reward, reason: `season_quest:${questId}` }], `season:${id}`);

    return c.json({ ok: true, quest_id: questId, xp_awarded: quest.xp_reward, stat });
  });

  return app;
}
