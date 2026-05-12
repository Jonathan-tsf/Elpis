import { Hono } from 'hono';
import { z } from 'zod';
import { type DailyLogInput, DAILY_QUESTS, Quest as QuestSchema } from '@lifeos/shared';
import { getDocClient, getItem, queryItems, putItem, deleteItem } from '../services/dynamodb-client';
import { dailyLogKey, dateString, USER_PK } from '../services/keys';
import { evaluateCondition } from '../services/quest-evaluator';
import { invokeClaude } from '../services/bedrock-client';
import { CLAUDE_HAIKU_4_5 } from '../services/claude-models';

type DailyLogItem = {
  PK: string;
  SK: string;
  type: 'DAILY_LOG';
  date: string;
  data: DailyLogInput;
  updated_at: number;
};

type AiQuestItem = {
  PK: string;
  SK: string; // QUEST#daily#<date>#<id>
  type: 'AI_QUEST';
  date: string;
  quest: unknown;
  status: 'active' | 'done';
  updated_at: number;
};

const QUEST_GENERATION_SYSTEM = `Tu génères les quêtes du jour pour Jonathan, app gamifiée de suivi physique.
Génère 3 à 5 quêtes daily réalistes et adaptées à son contexte récent.
Format JSON strict: {"quests":[{"id":"daily_X","title":"...","description":"...","condition":{"type":"...","params":{}},"xp_reward":N,"stat_reward":"vitality|force|endurance|discipline|appearance|spirit"}]}
Types de conditions disponibles: daily_log_filled, sleep_hours_gte (params {hours}), hydration_l_gte (params {liters}), skincare_am_done, skincare_pm_done, workout_count_gte (params {count}), photo_with_tag (params {tag}).`;

const AiQuestSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  condition: z.object({
    type: z.string().min(1),
    params: z.record(z.string(), z.unknown()).optional(),
  }),
  xp_reward: z.number().int().min(0).max(10_000),
  stat_reward: z
    .enum(['vitality', 'force', 'endurance', 'discipline', 'appearance', 'spirit'])
    .optional(),
});

const AiQuestsResponse = z.object({
  quests: z.array(AiQuestSchema).min(1).max(10),
});

export function questsRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();

  // GET / — DynamoDB AI quests first, fall back to static catalog
  app.get('/', async (c) => {
    const today = dateString();
    const doc = getDocClient();

    // 1. Try AI quests for today
    const aiItems = await queryItems<AiQuestItem>(doc, {
      pk: USER_PK,
      skBegins: `QUEST#daily#${today}#`,
    });

    if (aiItems.length > 0) {
      const { pk: logPk, sk: logSk } = dailyLogKey(today);
      const logItem = await getItem<DailyLogItem>(doc, logPk, logSk);
      const log = logItem?.data ?? null;

      const quests = aiItems.map((item) => {
        const q = item.quest as {
          id: string;
          title: string;
          description?: string;
          condition: { type: string; params?: Record<string, unknown> };
          xp_reward: number;
          stat_reward?: string;
          period?: string;
        };
        const done = evaluateCondition(
          { type: q.condition.type as import('@lifeos/shared').QuestConditionType, params: q.condition.params },
          log,
        );
        return {
          ...q,
          period: q.period ?? 'daily',
          status: done ? ('done' as const) : ('active' as const),
        };
      });
      return c.json(quests);
    }

    // 2. Fall back to static catalog
    const { pk, sk } = dailyLogKey(today);
    const item = await getItem<DailyLogItem>(doc, pk, sk);
    const log = item?.data ?? null;

    const quests = DAILY_QUESTS.map((q) => {
      const done = evaluateCondition(q.condition, log);
      return { ...q, status: done ? ('done' as const) : ('active' as const) };
    });

    return c.json(quests);
  });

  // POST /regenerate — generate AI quests for today via Claude Haiku
  app.post('/regenerate', async (c) => {
    const today = dateString();
    const doc = getDocClient();

    let rawJson: string;
    try {
      const res = await invokeClaude({
        model: CLAUDE_HAIKU_4_5,
        system: QUEST_GENERATION_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Génère mes quêtes pour aujourd'hui (${today}). Réponds uniquement avec le JSON.`,
          },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      });

      const textBlock = res.content.find(
        (b): b is { type: 'text'; text: string } => b.type === 'text',
      );
      if (!textBlock) throw new Error('no text content in response');
      rawJson = textBlock.text.trim();
    } catch (e) {
      console.error('[quests/regenerate] Claude invocation failed:', e);
      return c.json({ error: 'ai_generation_failed' }, 500);
    }

    // Extract JSON — Claude may wrap in markdown code block
    const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[quests/regenerate] No JSON found in response:', rawJson);
      return c.json({ error: 'invalid_ai_response' }, 500);
    }

    let parsed: z.infer<typeof AiQuestsResponse>;
    try {
      const obj = JSON.parse(jsonMatch[0]) as unknown;
      parsed = AiQuestsResponse.parse(obj);
    } catch (e) {
      console.error('[quests/regenerate] JSON parse/validation failed:', e, rawJson);
      return c.json({ error: 'invalid_ai_response' }, 500);
    }

    // Delete existing AI quests for today
    const existing = await queryItems<AiQuestItem>(doc, {
      pk: USER_PK,
      skBegins: `QUEST#daily#${today}#`,
    });
    await Promise.all(existing.map((item) => deleteItem(doc, item.PK, item.SK)));

    // Persist new AI quests
    const now = Date.now();
    await Promise.all(
      parsed.quests.map((q) => {
        const item: AiQuestItem = {
          PK: USER_PK,
          SK: `QUEST#daily#${today}#${q.id}`,
          type: 'AI_QUEST',
          date: today,
          quest: { ...q, period: 'daily' },
          status: 'active',
          updated_at: now,
        };
        return putItem(doc, item);
      }),
    );

    // Evaluate statuses against today's log and return
    const { pk: logPk, sk: logSk } = dailyLogKey(today);
    const logItem = await getItem<DailyLogItem>(doc, logPk, logSk);
    const log = logItem?.data ?? null;

    const result = parsed.quests.map((q) => {
      const done = evaluateCondition(
        { type: q.condition.type as import('@lifeos/shared').QuestConditionType, params: q.condition.params },
        log,
      );
      return {
        ...q,
        period: 'daily' as const,
        status: done ? ('done' as const) : ('active' as const),
      };
    });

    return c.json(result);
  });

  return app;
}
