import { z } from 'zod';

export const StatName = z.enum(['force', 'endurance', 'vitality', 'discipline', 'appearance', 'spirit']);

export const StatLevel = z.object({
  level: z.number().int().min(1).max(100),
  xp: z.number().int().min(0),
  xp_to_next: z.number().int().min(0),
});

export const Stats = z.object({
  global_level: z.number().int().min(1).max(100),
  global_xp: z.number().int().min(0),
  per_stat: z.record(StatName, StatLevel),
  updated_at: z.number().int(),
});

export const XpEvent = z.object({
  id: z.string(),
  ts: z.number().int(),
  source: z.string(),
  amount: z.number().int(),
  stat: StatName,
  reason: z.string().max(200).optional(),
});

export type StatName = z.infer<typeof StatName>;
export type StatLevel = z.infer<typeof StatLevel>;
export type Stats = z.infer<typeof Stats>;
export type XpEvent = z.infer<typeof XpEvent>;
