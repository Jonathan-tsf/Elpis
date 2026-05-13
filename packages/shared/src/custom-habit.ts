import { z } from 'zod';
import { DateString } from './dailyLog';

export const HabitFrequency = z.enum(['daily', 'weekly', 'custom']);
export const HabitMeasurement = z.enum(['boolean', 'count', 'duration_min']);

export const CustomHabitInput = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().max(8).optional(), // emoji
  description: z.string().max(500).optional(),
  frequency: HabitFrequency,
  target_per_period: z.number().int().min(1).max(50).optional(),
  measurement: HabitMeasurement,
  archived: z.boolean().optional(),
});

export const CustomHabit = CustomHabitInput.extend({
  id: z.string(),
  created_at: z.number().int(),
});

export const HabitLogInput = z.object({
  habit_id: z.string(),
  date: DateString,
  value: z.number().min(0).max(10000).optional(), // for count/duration
  done: z.boolean().optional(), // for boolean
  notes: z.string().max(500).optional(),
});

export const HabitLog = HabitLogInput.extend({
  created_at: z.number().int(),
});

export type CustomHabitInput = z.infer<typeof CustomHabitInput>;
export type CustomHabit = z.infer<typeof CustomHabit>;
export type HabitLogInput = z.infer<typeof HabitLogInput>;
export type HabitLog = z.infer<typeof HabitLog>;
