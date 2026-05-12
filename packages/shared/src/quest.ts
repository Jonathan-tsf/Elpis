import { z } from 'zod';
import { StatName } from './stats';

export const QuestPeriod = z.enum(['daily', 'weekly', 'season']);
export const QuestStatus = z.enum(['active', 'done', 'failed', 'expired']);

export const QuestConditionType = z.enum([
  'daily_log_filled',
  'sleep_hours_gte',
  'hydration_l_gte',
  'skincare_am_done',
  'skincare_pm_done',
  'workout_count_gte',
  'photo_with_tag',
]);

export const QuestCondition = z.object({
  type: QuestConditionType,
  params: z.record(z.string(), z.unknown()).optional(),
});

export const Quest = z.object({
  id: z.string(),
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  period: QuestPeriod,
  condition: QuestCondition,
  xp_reward: z.number().int().min(0).max(10_000),
  stat_reward: StatName.optional(),
  status: QuestStatus,
  due_at: z.number().int().optional(),
});

export type QuestPeriod = z.infer<typeof QuestPeriod>;
export type QuestStatus = z.infer<typeof QuestStatus>;
export type QuestConditionType = z.infer<typeof QuestConditionType>;
export type QuestCondition = z.infer<typeof QuestCondition>;
export type Quest = z.infer<typeof Quest>;
