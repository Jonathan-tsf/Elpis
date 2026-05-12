import { Hono } from 'hono';

export function meRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();
  app.get('/', (c) => c.json({ sub: c.get('user').sub }));
  return app;
}
