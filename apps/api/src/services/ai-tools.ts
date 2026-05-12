import { type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { type ClaudeTool } from './bedrock-client';
import { queryItems, getItem } from './dynamodb-client';
import { USER_PK, statsKey } from './keys';

export function buildReadTools(): ClaudeTool[] {
  return [
    {
      name: 'get_daily_logs',
      description:
        "Read the user's daily logs (sleep, mood, hydration, skincare, supplements) over a recent window.",
      input_schema: {
        type: 'object',
        properties: {
          range_days: { type: 'integer', minimum: 1, maximum: 365 },
        },
        required: ['range_days'],
      },
    },
    {
      name: 'get_workouts',
      description: "Read the user's workouts over a recent window.",
      input_schema: {
        type: 'object',
        properties: {
          range_days: { type: 'integer', minimum: 1, maximum: 365 },
        },
        required: ['range_days'],
      },
    },
    {
      name: 'get_measurements',
      description:
        "Read the user's body measurements (weight, waist, etc.) over a window. Optional metric filter.",
      input_schema: {
        type: 'object',
        properties: {
          range_days: { type: 'integer', minimum: 1, maximum: 365 },
          metrics: { type: 'array', items: { type: 'string' } },
        },
        required: ['range_days'],
      },
    },
    {
      name: 'get_photos',
      description:
        'Read photo metadata (tags, dates) over a window. Optional tag filter.',
      input_schema: {
        type: 'object',
        properties: {
          range_days: { type: 'integer', minimum: 1, maximum: 365 },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['range_days'],
      },
    },
    {
      name: 'get_stats',
      description: "Read the user's current RPG stats snapshot.",
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'get_quests',
      description: "Read the user's current quests (with status).",
      input_schema: { type: 'object', properties: {} },
    },
  ];
}

function shiftDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

type DailyLogRaw = { date: string; data?: Record<string, unknown> };
type WorkoutRaw = { data: { date: string } & Record<string, unknown> };
type MeasurementRaw = {
  data: { date: string; metric: string; value: number };
};
type PhotoRaw = { date: string; tags: string[]; id: string };

export function buildReadHandlers(
  doc: DynamoDBDocumentClient,
): Record<string, (input: unknown) => Promise<unknown>> {
  return {
    async get_daily_logs(input) {
      const { range_days } = input as { range_days: number };
      const from = shiftDays(range_days);
      const items = await queryItems<DailyLogRaw>(doc, {
        pk: USER_PK,
        skBegins: 'DAY#',
      });
      return items
        .filter((i) => i.date >= from)
        .map((i) => ({ date: i.date, ...(i.data ?? {}) }));
    },

    async get_workouts(input) {
      const { range_days } = input as { range_days: number };
      const from = shiftDays(range_days);
      const items = await queryItems<WorkoutRaw>(doc, {
        pk: USER_PK,
        skBegins: 'WORKOUT#',
      });
      return items.map((i) => i.data).filter((d) => d.date >= from);
    },

    async get_measurements(input) {
      const { range_days, metrics } = input as {
        range_days: number;
        metrics?: string[];
      };
      const from = shiftDays(range_days);
      const items = await queryItems<MeasurementRaw>(doc, {
        pk: USER_PK,
        skBegins: 'MEAS#',
      });
      return items
        .map((i) => i.data)
        .filter(
          (d) => d.date >= from && (!metrics || metrics.includes(d.metric)),
        );
    },

    async get_photos(input) {
      const { range_days, tags } = input as {
        range_days: number;
        tags?: string[];
      };
      const from = shiftDays(range_days);
      const items = await queryItems<PhotoRaw>(doc, {
        pk: USER_PK,
        skBegins: 'PHOTO#',
      });
      return items.filter(
        (p) =>
          p.date >= from && (!tags || p.tags.some((t) => tags.includes(t))),
      );
    },

    async get_stats() {
      const key = statsKey();
      const item = await getItem<{ stats: unknown }>(doc, key.pk, key.sk);
      return item?.stats ?? null;
    },

    async get_quests() {
      const items = await queryItems(doc, { pk: USER_PK, skBegins: 'QUEST#' });
      return items;
    },
  };
}
