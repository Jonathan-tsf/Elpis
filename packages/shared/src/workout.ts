import { z } from 'zod';
import { DateString } from './dailyLog';

export const WorkoutType = z.enum(['push', 'pull', 'legs', 'upper', 'lower', 'full', 'cardio', 'mobility', 'other']);

export const WorkoutSet = z.object({
  reps: z.number().int().min(0).max(500),
  weight_kg: z.number().min(0).max(1000).optional(),
  rpe: z.number().min(1).max(10).optional(),
  notes: z.string().max(200).optional(),
});

export const WorkoutExercise = z.object({
  name: z.string().min(1).max(80),
  sets: z.array(WorkoutSet).min(1).max(20),
});

export const WorkoutInput = z.object({
  date: DateString,
  type: WorkoutType,
  duration_min: z.number().int().min(0).max(600).optional(),
  rpe: z.number().min(1).max(10).optional(),
  exercises: z.array(WorkoutExercise).min(0).max(40),
  notes: z.string().max(2000).optional(),
});

export const Workout = WorkoutInput.extend({
  id: z.string(),
  created_at: z.number().int(),
});

export type WorkoutType = z.infer<typeof WorkoutType>;
export type WorkoutSet = z.infer<typeof WorkoutSet>;
export type WorkoutExercise = z.infer<typeof WorkoutExercise>;
export type WorkoutInput = z.infer<typeof WorkoutInput>;
export type Workout = z.infer<typeof Workout>;
