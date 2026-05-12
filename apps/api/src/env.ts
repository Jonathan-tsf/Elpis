import { z } from 'zod';

const EnvSchema = z.object({
  AWS_REGION: z.string().default('us-east-1'),
  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_CLIENT_ID: z.string().optional(),
  VERSION: z.string().default('0.0.0'),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  return EnvSchema.parse(process.env);
}
