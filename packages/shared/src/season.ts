import { z } from 'zod';
import { StatName } from './stats';
import { QuestCondition } from './quest';

export const SeasonStatus = z.enum(['active', 'ended']);

export const SeasonQuest = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  condition: QuestCondition,
  xp_reward: z.number().int().min(0).max(50_000),
  stat_reward: StatName.optional(),
  done: z.boolean(),
});

export const SeasonReward = z.object({
  title: z.string(),
  description: z.string().optional(),
});

export const SeasonInput = z.object({
  name: z.string().min(1).max(120),
  main_objective: z.string().min(1).max(500),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quests: z.array(SeasonQuest).min(0).max(10),
  rewards: z.array(SeasonReward).max(10).optional(),
});

export const Season = SeasonInput.extend({
  id: z.string(),
  status: SeasonStatus,
  created_at: z.number().int(),
  recap_markdown: z.string().optional(),
});

export type SeasonQuest = z.infer<typeof SeasonQuest>;
export type SeasonReward = z.infer<typeof SeasonReward>;
export type SeasonInput = z.infer<typeof SeasonInput>;
export type Season = z.infer<typeof Season>;
