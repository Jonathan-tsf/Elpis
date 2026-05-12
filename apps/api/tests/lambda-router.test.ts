import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the briefing-generator module before importing lambda
vi.mock('../src/services/briefing-generator', () => ({
  generateBriefing: vi.fn().mockResolvedValue({
    text: 'Briefing généré automatiquement.',
    date: '2026-05-12',
    model: 'test-model',
    usage: { input_tokens: 10, output_tokens: 5 },
  }),
}));

// Mock env and cognito
vi.mock('../src/env', () => ({
  loadEnv: () => ({
    COGNITO_USER_POOL_ID: 'us-east-1_test',
    AWS_REGION: 'us-east-1',
    VERSION: 'test',
    TABLE_NAME: 'test',
  }),
}));

vi.mock('../src/middlewares/auth', () => ({
  makeCognitoVerifier: () => ({ verify: async () => null }),
  authMiddleware: () => async (c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock('../src/app', () => ({
  createApp: () => ({
    fetch: async () => new Response('ok', { status: 200 }),
  }),
}));

vi.mock('hono/aws-lambda', () => ({
  handle: () => async () => ({ statusCode: 200, body: 'ok' }),
}));

describe('lambda handler — EventBridge routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['TABLE_NAME'] = 'test';
  });

  it('calls generateBriefing for briefing_daily event and returns ok', async () => {
    const { handler } = await import('../src/lambda');
    const { generateBriefing } = await import('../src/services/briefing-generator');

    const result = await handler(
      { source: 'eventbridge.cron', kind: 'briefing_daily' },
      {},
    );

    expect(generateBriefing).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, briefing_date: '2026-05-12' });
  });

  it('does NOT call generateBriefing for normal API events', async () => {
    const { handler } = await import('../src/lambda');
    const { generateBriefing } = await import('../src/services/briefing-generator');

    await handler(
      { source: 'aws.apigateway', requestContext: { http: {} } },
      {},
    );

    expect(generateBriefing).not.toHaveBeenCalled();
  });
});
