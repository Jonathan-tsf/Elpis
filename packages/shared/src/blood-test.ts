import { z } from 'zod';

export const BloodMarker = z.object({
  name: z.string(),
  value: z.number(),
  unit: z.string().optional(),
  reference_range: z.string().optional(),
});

export const BloodTestInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lab: z.string().optional(),
  notes: z.string().max(2000).optional(),
  markers: z.array(BloodMarker).min(0).max(100),
  pdf_key: z.string().optional(),
});

export const BloodTest = BloodTestInput.extend({
  id: z.string(),
  created_at: z.number().int(),
});

export type BloodMarker = z.infer<typeof BloodMarker>;
export type BloodTestInput = z.infer<typeof BloodTestInput>;
export type BloodTest = z.infer<typeof BloodTest>;
