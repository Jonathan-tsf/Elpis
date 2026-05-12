import { z } from 'zod';

export const PhotoAnalysis = z.object({
  id: z.string(),
  photo_id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scope: z.enum(['face', 'body', 'posture', 'fit', 'auto']),
  markdown: z.string(),
  ratings: z.record(z.string(), z.number()).optional(),
  recommendations: z.array(z.string()).optional(),
  model: z.string(),
  created_at: z.number().int(),
});

export type PhotoAnalysis = z.infer<typeof PhotoAnalysis>;
