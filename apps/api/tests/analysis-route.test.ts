import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ddbMock = mockClient(DynamoDBDocumentClient as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bedrockMock = mockClient(BedrockRuntimeClient as any);

const stubAccept = { verify: async (t: string) => (t === 'good' ? { sub: 'user-123' } : null) };

beforeAll(() => {
  process.env['TABLE_NAME'] = 'test';
});

beforeEach(() => {
  ddbMock.reset();
  bedrockMock.reset();
});

function app() {
  return createApp({ version: '0', jwtVerifierStub: stubAccept });
}

function authHeader() {
  return { Authorization: 'Bearer good' };
}

function encodeBedrockResponse(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj));
}

describe('POST /analysis/run', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/analysis/run', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('generates and persists a REPORT item', async () => {
    const finalResponse = {
      content: [{ type: 'text', text: '## Analyse Sommeil\n\nBonne régularité cette semaine.' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bedrockMock.on(InvokeModelCommand as any).resolves({ body: encodeBedrockResponse(finalResponse) } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [] } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(PutCommand as never).resolves({} as any);

    const res = await app().request('/analysis/run', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'sleep', days: 14 }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as {
      type: string;
      scope: string;
      days: number;
      markdown: string;
      id: string;
      created_at: number;
    };
    expect(body.type).toBe('REPORT');
    expect(body.scope).toBe('sleep');
    expect(body.days).toBe(14);
    expect(body.markdown).toContain('Analyse Sommeil');
    expect(typeof body.id).toBe('string');
    expect(typeof body.created_at).toBe('number');

    // Verify item was persisted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const puts = ddbMock.commandCalls(PutCommand as any);
    expect(puts.length).toBeGreaterThanOrEqual(1);
    const lastPut = puts[puts.length - 1];
    const item = (lastPut?.args[0].input as Record<string, unknown>)['Item'] as Record<string, unknown>;
    expect(item['type']).toBe('REPORT');
    expect(item['PK']).toBe('USER#me');
    expect((item['SK'] as string)).toMatch(/^REPORT#/);
  });

  it('uses global scope and 30 days by default when body is empty', async () => {
    const finalResponse = {
      content: [{ type: 'text', text: '## Analyse Globale\n\nBien.' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 80, output_tokens: 40 },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bedrockMock.on(InvokeModelCommand as any).resolves({ body: encodeBedrockResponse(finalResponse) } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [] } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(PutCommand as never).resolves({} as any);

    const res = await app().request('/analysis/run', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { scope: string; days: number };
    expect(body.scope).toBe('global');
    expect(body.days).toBe(30);
  });
});

describe('GET /analysis', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/analysis');
    expect(res.status).toBe(401);
  });

  it('returns reports sorted by created_at desc', async () => {
    const reports = [
      {
        PK: 'USER#me', SK: 'REPORT#2026-05-10#aaa', type: 'REPORT',
        id: 'aaa', scope: 'sleep', days: 7, markdown: '# Sleep', created_at: 100,
        usage: { input_tokens: 10, output_tokens: 5 },
      },
      {
        PK: 'USER#me', SK: 'REPORT#2026-05-12#bbb', type: 'REPORT',
        id: 'bbb', scope: 'global', days: 30, markdown: '# Global', created_at: 300,
        usage: { input_tokens: 20, output_tokens: 10 },
      },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: reports } as any);

    const res = await app().request('/analysis', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ id: string; created_at: number }>;
    expect(body).toHaveLength(2);
    expect(body[0]?.id).toBe('bbb'); // most recent first
    expect(body[1]?.id).toBe('aaa');
  });
});

describe('GET /analysis/:id', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/analysis/some-id');
    expect(res.status).toBe(401);
  });

  it('returns 404 when report not found', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [] } as any);

    const res = await app().request('/analysis/nonexistent', { headers: authHeader() });
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('not found');
  });

  it('returns the report when found by id', async () => {
    const report = {
      PK: 'USER#me', SK: 'REPORT#2026-05-12#bbb', type: 'REPORT',
      id: 'bbb', scope: 'workouts', days: 14, markdown: '# Workouts', created_at: 200,
      usage: { input_tokens: 15, output_tokens: 8 },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [report] } as any);

    const res = await app().request('/analysis/bbb', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; scope: string; markdown: string };
    expect(body.id).toBe('bbb');
    expect(body.scope).toBe('workouts');
    expect(body.markdown).toBe('# Workouts');
  });
});
