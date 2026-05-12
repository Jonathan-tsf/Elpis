import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
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

describe('GET /briefings/today', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/briefings/today');
    expect(res.status).toBe(401);
  });

  it('returns cached briefing when one exists', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const storedBriefing = {
      PK: 'USER#me',
      SK: `BRIEF#${today}`,
      type: 'BRIEFING',
      date: today,
      text: 'Bonne journée Jonathan.',
      model: 'test-model',
      usage: { input_tokens: 10, output_tokens: 5 },
      created_at: 1000,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(GetCommand as never).resolves({ Item: storedBriefing } as any);

    const res = await app().request('/briefings/today', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { text: string; date: string };
    expect(body.text).toBe('Bonne journée Jonathan.');
    expect(body.date).toBe(today);
  });

  it('returns { text: null, date } when no briefing exists', async () => {
    const today = new Date().toISOString().slice(0, 10);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(GetCommand as never).resolves({} as any);

    const res = await app().request('/briefings/today', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { text: null; date: string };
    expect(body.text).toBeNull();
    expect(body.date).toBe(today);
  });
});

describe('POST /briefings/generate', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/briefings/generate', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('generates and persists a BRIEFING item', async () => {
    // First call: tool_use to fetch data
    const toolUseResponse = {
      content: [
        { type: 'tool_use', id: 'tid-1', name: 'get_daily_logs', input: { range_days: 7 } },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 50, output_tokens: 20 },
    };
    // Second call: final text
    const finalResponse = {
      content: [{ type: 'text', text: 'Semaine solide. Focus nutrition aujourd\'hui.' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 80, output_tokens: 15 },
    };
    bedrockMock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on(InvokeModelCommand as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolvesOnce({ body: encodeBedrockResponse(toolUseResponse) } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolvesOnce({ body: encodeBedrockResponse(finalResponse) } as any);

    // DDB: query for daily logs returns empty
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [] } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(PutCommand as never).resolves({} as any);

    const res = await app().request('/briefings/generate', {
      method: 'POST',
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      type: string;
      text: string;
      date: string;
      model: string;
      usage: { input_tokens: number; output_tokens: number };
    };
    expect(body.type).toBe('BRIEFING');
    expect(body.text).toBe("Semaine solide. Focus nutrition aujourd'hui.");
    expect(typeof body.date).toBe('string');
    expect(typeof body.model).toBe('string');
    expect(typeof body.usage).toBe('object');

    // Verify DDB put was called with BRIEFING item
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const puts = ddbMock.commandCalls(PutCommand as any);
    expect(puts.length).toBeGreaterThanOrEqual(1);
    const lastPut = puts[puts.length - 1];
    const item = (lastPut?.args[0].input as Record<string, unknown>)['Item'] as Record<string, unknown>;
    expect(item['type']).toBe('BRIEFING');
    expect(item['PK']).toBe('USER#me');
  });
});
