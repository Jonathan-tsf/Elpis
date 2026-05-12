import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { HealthcheckResponse } from '@lifeos/shared';

describe('GET /healthcheck', () => {
  it('returns ok=true and a version string', async () => {
    const app = createApp({ version: '0.0.0', jwtVerifierStub: { verify: async () => null } });
    const res = await app.request('/healthcheck');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(HealthcheckResponse.parse(body)).toEqual({ ok: true, version: '0.0.0' });
  });
});
