import { Hono } from 'hono';
import { healthcheckRoute } from './routes/healthcheck';
import { meRoute } from './routes/me';
import { authMiddleware, type JwtVerifier } from './middlewares/auth';

export interface AppDeps {
  version: string;
  jwtVerifierStub: JwtVerifier;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  app.route('/healthcheck', healthcheckRoute(deps.version));
  app.use('/me/*', authMiddleware(deps.jwtVerifierStub));
  app.use('/me', authMiddleware(deps.jwtVerifierStub));
  app.route('/me', meRoute());
  return app;
}
