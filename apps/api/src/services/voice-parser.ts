import { runWithTools, type ClaudeTool } from './bedrock-client';
import { CLAUDE_SONNET_4_6 } from './claude-models';
import type { DailyLogInput, WorkoutInput } from '@lifeos/shared';

const SYSTEM_PROMPT = `Tu es un parser. L'utilisateur t'a dicté sa journée en français. Extrais les infos en appelant les tools.
NE LOG QUE CE QUI EST EXPLICITEMENT DIT. Si l'utilisateur ne mentionne pas le sommeil, n'appelle pas log_sleep.
Les durées s'expriment en minutes. Les horaires en HH:MM. Quand tu as terminé, écris simplement "Terminé".`;

const writerTools: ClaudeTool[] = [
  {
    name: 'log_sleep',
    description: 'Enregistre les infos de sommeil de la nuit.',
    input_schema: {
      type: 'object',
      properties: {
        duration_min: { type: 'integer', minimum: 0, maximum: 1440 },
        quality: { type: 'integer', minimum: 1, maximum: 10 },
        bedtime: { type: 'string' },
        wake_time: { type: 'string' },
      },
      required: ['duration_min'],
    },
  },
  {
    name: 'log_mood',
    description: 'Enregistre mood/energy/focus + notes.',
    input_schema: {
      type: 'object',
      properties: {
        mood: { type: 'integer', minimum: 1, maximum: 10 },
        energy: { type: 'integer', minimum: 1, maximum: 10 },
        focus: { type: 'integer', minimum: 1, maximum: 10 },
        notes: { type: 'string' },
      },
      required: ['mood', 'energy', 'focus'],
    },
  },
  {
    name: 'log_hydration',
    description: "Enregistre l'hydratation en litres.",
    input_schema: {
      type: 'object',
      properties: { liters: { type: 'number' } },
      required: ['liters'],
    },
  },
  {
    name: 'log_skincare',
    description: 'Enregistre routine skincare AM et/ou PM.',
    input_schema: {
      type: 'object',
      properties: {
        am: { type: 'boolean' },
        pm: { type: 'boolean' },
        notes: { type: 'string' },
      },
    },
  },
  {
    name: 'log_meal',
    description: 'Ajoute un repas.',
    input_schema: {
      type: 'object',
      properties: {
        slot: { type: 'string', enum: ['breakfast', 'lunch', 'snack', 'dinner'] },
        description: { type: 'string' },
        score: { type: 'integer', minimum: 1, maximum: 5 },
      },
      required: ['slot', 'description'],
    },
  },
  {
    name: 'log_supplement',
    description: 'Ajoute un supplément pris.',
    input_schema: {
      type: 'object',
      properties: { name: { type: 'string' }, dose: { type: 'string' } },
      required: ['name'],
    },
  },
  {
    name: 'log_workout',
    description: 'Enregistre une séance de sport complète.',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['push', 'pull', 'legs', 'upper', 'lower', 'full', 'cardio', 'mobility', 'other'],
        },
        duration_min: { type: 'integer' },
        rpe: { type: 'integer', minimum: 1, maximum: 10 },
        exercises: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              sets: { type: 'array', items: { type: 'object' } },
            },
            required: ['name'],
          },
        },
        notes: { type: 'string' },
      },
      required: ['type'],
    },
  },
];

export interface ParsedDraft {
  daily_log_draft: Partial<DailyLogInput>;
  workout_draft?: Partial<WorkoutInput>;
  notes: string[];
}

export async function parseTranscript(transcript: string): Promise<ParsedDraft> {
  const draft: ParsedDraft = { daily_log_draft: {}, notes: [] };

  const handlers: Record<string, (input: unknown) => Promise<unknown>> = {
    async log_sleep(input) {
      draft.daily_log_draft.sleep = input as DailyLogInput['sleep'];
      return { ok: true };
    },
    async log_mood(input) {
      draft.daily_log_draft.mood = input as DailyLogInput['mood'];
      return { ok: true };
    },
    async log_hydration(input) {
      const { liters } = input as { liters: number };
      draft.daily_log_draft.hydration_l = liters;
      return { ok: true };
    },
    async log_skincare(input) {
      draft.daily_log_draft.skincare = input as DailyLogInput['skincare'];
      return { ok: true };
    },
    async log_meal(input) {
      draft.daily_log_draft.meals = draft.daily_log_draft.meals ?? [];
      draft.daily_log_draft.meals.push(
        input as {
          slot: 'breakfast' | 'lunch' | 'snack' | 'dinner';
          description: string;
          score?: number;
        },
      );
      return { ok: true };
    },
    async log_supplement(input) {
      draft.daily_log_draft.supplements = draft.daily_log_draft.supplements ?? [];
      draft.daily_log_draft.supplements.push(input as { name: string; dose?: string });
      return { ok: true };
    },
    async log_workout(input) {
      // Workouts are stored separately (not in daily_log).
      // Stash in draft as a single optional workout — frontend will surface a confirmation.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      draft.workout_draft = input as any;
      return { ok: true };
    },
  };

  await runWithTools({
    model: CLAUDE_SONNET_4_6,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Voici ma journée : ${transcript}` }],
    tools: writerTools,
    toolHandlers: handlers,
    maxIters: 6,
  });

  return draft;
}
