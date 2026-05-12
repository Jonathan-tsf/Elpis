import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

const stubAccept = { verify: async (t: string) => (t === 'good' ? { sub: 'user-123' } : null) };
const stubReject = { verify: async () => null };

describe('auth middleware', () => {
  it('rejects /me without Authorization header', async () => {
    const app = createApp({ version: '0', jwtVerifierStub: stubReject });
    const res = await app.request('/me');
    expect(res.status).toBe(401);
  });

  it('rejects /me with invalid token', async () => {
    const app = createApp({ version: '0', jwtVerifierStub: stubReject });
    const res = await app.request('/me', { headers: { Authorization: 'Bearer bad' } });
    expect(res.status).toBe(401);
  });

  it('accepts /me with valid token and returns sub', async () => {
    const app = createApp({ version: '0', jwtVerifierStub: stubAccept });
    const res = await app.request('/me', { headers: { Authorization: 'Bearer good' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sub).toBe('user-123');
  });
});
