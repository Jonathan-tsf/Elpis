import { handle } from 'hono/aws-lambda';
import { createApp } from './app';
import { makeCognitoVerifier } from './middlewares/auth';
import { loadEnv } from './env';
import { generateBriefing } from './services/briefing-generator';

const env = loadEnv();
if (!env.COGNITO_USER_POOL_ID) {
  throw new Error('COGNITO_USER_POOL_ID is required in Lambda environment');
}
const verifier = makeCognitoVerifier(env.AWS_REGION, env.COGNITO_USER_POOL_ID);
const app = createApp({ version: env.VERSION, jwtVerifierStub: verifier });
const honoHandler = handle(app);

type EventBridgeScheduledEvent = {
  source: string;
  kind?: string;
  'detail-type'?: string;
};

export const handler = async (event: unknown, context: unknown) => {
  const e = event as EventBridgeScheduledEvent & { requestContext?: unknown };

  // EventBridge scheduled invocation
  if (e.source === 'eventbridge.cron' && e.kind === 'briefing_daily') {
    const result = await generateBriefing();
    return { ok: true, briefing_date: result.date };
  }

  // Fallback: API Gateway v2 invocation
  return honoHandler(
    event as Parameters<typeof honoHandler>[0],
    context as Parameters<typeof honoHandler>[1],
  );
};
