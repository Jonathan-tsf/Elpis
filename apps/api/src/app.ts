import { Hono } from 'hono';
import { healthcheckRoute } from './routes/healthcheck';

export interface AppDeps {
  version: string;
  jwtVerifierStub?: { verify: (token: string) => Promise<{ sub: string } | null> };
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  app.route('/healthcheck', healthcheckRoute(deps.version));
  return app;
}
