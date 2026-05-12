import { serve } from '@hono/node-server';
import { createApp } from './app';

const app = createApp({
  version: 'local-dev',
  jwtVerifierStub: { verify: async (t) => (t === 'local-dev' ? { sub: 'local-user' } : null) },
});

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port });
console.log(`API listening on http://localhost:${port}`);
