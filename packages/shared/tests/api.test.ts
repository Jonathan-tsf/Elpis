import { describe, expect, it } from 'vitest';
import { HealthcheckResponse } from '../src/api';

describe('HealthcheckResponse', () => {
  it('accepts a valid healthcheck payload', () => {
    const parsed = HealthcheckResponse.parse({ ok: true, version: '0.0.0' });
    expect(parsed.ok).toBe(true);
    expect(parsed.version).toBe('0.0.0');
  });

  it('rejects a payload missing `ok`', () => {
    expect(() => HealthcheckResponse.parse({ version: '0.0.0' })).toThrow();
  });
});
