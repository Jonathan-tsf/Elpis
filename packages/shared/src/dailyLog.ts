import { z } from 'zod';

export const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const SleepEntry = z.object({
  duration_min: z.number().int().min(0).max(24 * 60),
  quality: z.number().int().min(1).max(10).optional(),
  bedtime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  wake_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const MoodEntry = z.object({
  mood: z.number().int().min(1).max(10),
  energy: z.number().int().min(1).max(10),
  focus: z.number().int().min(1).max(10),
  notes: z.string().max(2000).optional(),
});

export const SkincareEntry = z.object({
  am: z.boolean(),
  pm: z.boolean(),
  products: z.array(z.string()).max(20).optional(),
  notes: z.string().max(500).optional(),
});

export const SupplementEntry = z.object({
  name: z.string().min(1).max(80),
  dose: z.string().max(40).optional(),
});

export const MealEntry = z.object({
  slot: z.enum(['breakfast', 'lunch', 'snack', 'dinner']),
  description: z.string().max(500),
  score: z.number().int().min(1).max(5).optional(),
});

export const DailyLogInput = z.object({
  sleep: SleepEntry.optional(),
  mood: MoodEntry.optional(),
  hydration_l: z.number().min(0).max(20).optional(),
  skincare: SkincareEntry.optional(),
  supplements: z.array(SupplementEntry).max(20).optional(),
  meals: z.array(MealEntry).max(10).optional(),
  notes: z.string().max(5000).optional(),
});

export const DailyLog = DailyLogInput.extend({
  date: DateString,
  updated_at: z.number().int(),
});

export type SleepEntry = z.infer<typeof SleepEntry>;
export type MoodEntry = z.infer<typeof MoodEntry>;
export type SkincareEntry = z.infer<typeof SkincareEntry>;
export type SupplementEntry = z.infer<typeof SupplementEntry>;
export type MealEntry = z.infer<typeof MealEntry>;
export type DailyLogInput = z.infer<typeof DailyLogInput>;
export type DailyLog = z.infer<typeof DailyLog>;
