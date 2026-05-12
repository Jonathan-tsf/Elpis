import { z } from 'zod';
import { DateString } from './dailyLog';

export const MeasurementMetric = z.enum([
  'weight',
  'waist',
  'chest',
  'biceps_left',
  'biceps_right',
  'thigh_left',
  'thigh_right',
  'calf_left',
  'calf_right',
  'shoulders',
  'neck',
  'body_fat_pct',
]);

export const MeasurementInput = z.object({
  metric: MeasurementMetric,
  value: z.number().min(0).max(1000),
  date: DateString,
  notes: z.string().max(500).optional(),
});

export const Measurement = MeasurementInput.extend({
  created_at: z.number().int(),
});

export type MeasurementMetric = z.infer<typeof MeasurementMetric>;
export type MeasurementInput = z.infer<typeof MeasurementInput>;
export type Measurement = z.infer<typeof Measurement>;
