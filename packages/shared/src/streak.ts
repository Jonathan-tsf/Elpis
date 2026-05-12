import { z } from 'zod';

export const StreakCategory = z.enum(['daily_log', 'skincare_am', 'skincare_pm', 'sleep_7h_plus', 'workout_weekly', 'hydration_target']);

export const Streak = z.object({
  category: StreakCategory,
  current: z.number().int().min(0),
  longest: z.number().int().min(0),
  last_event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type StreakCategory = z.infer<typeof StreakCategory>;
export type Streak = z.infer<typeof Streak>;
