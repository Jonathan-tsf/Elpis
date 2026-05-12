import { z } from 'zod';
import { DateString } from './dailyLog';

export const PhotoTag = z.enum([
  'face',
  'profile_left',
  'profile_right',
  'three_quarter',
  'back',
  'posture',
  'skin',
  'hair',
  'smile',
  'fit',
  'outfit',
  'body_front',
  'body_back',
  'body_side',
]);

export const PhotoPresignInput = z.object({
  contentType: z.string().min(1).max(80),
  tag: PhotoTag.optional(),
});
export const PhotoPresignResponse = z.object({
  photoId: z.string(),
  key: z.string(),
  uploadUrl: z.string().url(),
});

export const PhotoConfirmInput = z.object({
  photoId: z.string(),
  key: z.string(),
  date: DateString,
  tags: z.array(PhotoTag).min(1).max(10),
  conditions: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(1000).optional(),
});

export const Photo = z.object({
  id: z.string(),
  date: DateString,
  s3_key: z.string(),
  tags: z.array(PhotoTag),
  conditions: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().optional(),
  created_at: z.number().int(),
});

export type PhotoTag = z.infer<typeof PhotoTag>;
export type PhotoPresignInput = z.infer<typeof PhotoPresignInput>;
export type PhotoPresignResponse = z.infer<typeof PhotoPresignResponse>;
export type PhotoConfirmInput = z.infer<typeof PhotoConfirmInput>;
export type Photo = z.infer<typeof Photo>;
