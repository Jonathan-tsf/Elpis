import { handle } from 'hono/aws-lambda';
import { createApp } from './app';
import { makeCognitoVerifier } from './middlewares/auth';
import { loadEnv } from './env';

const env = loadEnv();
if (!env.COGNITO_USER_POOL_ID) {
  throw new Error('COGNITO_USER_POOL_ID is required in Lambda environment');
}
const verifier = makeCognitoVerifier(env.AWS_REGION, env.COGNITO_USER_POOL_ID);
const app = createApp({ version: env.VERSION, jwtVerifierStub: verifier });

export const handler = handle(app);
