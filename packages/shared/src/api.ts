import { z } from 'zod';

export const HealthcheckResponse = z.object({
  ok: z.literal(true),
  version: z.string(),
});
export type HealthcheckResponse = z.infer<typeof HealthcheckResponse>;

export const MeResponse = z.object({
  sub: z.string(),
  email: z.string().email().optional(),
});
export type MeResponse = z.infer<typeof MeResponse>;
