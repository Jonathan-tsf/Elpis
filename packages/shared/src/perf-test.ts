import { z } from 'zod';

export const PerfTestType = z.enum([
  '1rm_bench',
  '1rm_squat',
  '1rm_deadlift',
  '1rm_ohp',
  'vo2max',
  'mile_time',
  '5k_time',
  'pullups_max',
  'pushups_max',
  'plank_max',
]);

export const PerfTestInput = z.object({
  type: PerfTestType,
  value: z.number(),
  unit: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(2000).optional(),
});

export const PerfTest = PerfTestInput.extend({
  id: z.string(),
  created_at: z.number().int(),
});

export type PerfTestType = z.infer<typeof PerfTestType>;
export type PerfTestInput = z.infer<typeof PerfTestInput>;
export type PerfTest = z.infer<typeof PerfTest>;
