import { Hono } from 'hono';
import type { HealthcheckResponse } from '@lifeos/shared';

export function healthcheckRoute(version: string) {
  const app = new Hono();
  app.get('/', (c) => {
    const body: HealthcheckResponse = { ok: true, version };
    return c.json(body);
  });
  return app;
}
