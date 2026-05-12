import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
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

const FAKE_SEASON_INPUT = {
  name: 'Saison Force',
  main_objective: 'Augmenter ma force maximale de 20%',
  start_date: '2026-06-01',
  end_date: '2026-08-31',
  quests: [
    {
      id: 'q1',
      title: 'Faire 30 séances de musculation',
      condition: { type: 'workout_count_gte', params: { count: 30 } },
      xp_reward: 10000,
      stat_reward: 'force',
      done: false,
    },
  ],
};

describe('POST /seasons', () => {
  it('returns 401 without auth', async () => {
    const res = await app().request('/seasons', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('creates a season and returns 201', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(PutCommand as never).resolves({} as any);

    const res = await app().request('/seasons', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(FAKE_SEASON_INPUT),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; status: string; name: string };
    expect(body.id).toBeDefined();
    expect(body.status).toBe('active');
    expect(body.name).toBe('Saison Force');
  });

  it('returns 400 for invalid input', async () => {
    const res = await app().request('/seasons', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /seasons', () => {
  it('returns 401 without auth', async () => {
    const res = await app().request('/seasons');
    expect(res.status).toBe(401);
  });

  it('returns list of seasons', async () => {
    const fakeSeason = {
      PK: 'USER#me',
      SK: 'SEASON#abc',
      type: 'SEASON',
      id: 'abc',
      status: 'active',
      created_at: 1000,
      ...FAKE_SEASON_INPUT,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [fakeSeason] } as any);

    const res = await app().request('/seasons', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });
});

describe('GET /seasons/current', () => {
  it('returns null when no active season covers today', async () => {
    const pastSeason = {
      PK: 'USER#me',
      SK: 'SEASON#abc',
      type: 'SEASON',
      id: 'abc',
      status: 'active',
      created_at: 1000,
      ...FAKE_SEASON_INPUT,
      start_date: '2020-01-01',
      end_date: '2020-03-31',
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [pastSeason] } as any);

    const res = await app().request('/seasons/current', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
  });

  it('returns active season when today is within range', async () => {
    const today = new Date();
    const start = new Date(today);
    start.setMonth(start.getMonth() - 1);
    const end = new Date(today);
    end.setMonth(end.getMonth() + 2);

    const activeSeason = {
      PK: 'USER#me',
      SK: 'SEASON#xyz',
      type: 'SEASON',
      id: 'xyz',
      status: 'active',
      created_at: 1000,
      ...FAKE_SEASON_INPUT,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [activeSeason] } as any);

    const res = await app().request('/seasons/current', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string };
    expect(body.id).toBe('xyz');
  });
});

describe('GET /seasons/:id', () => {
  it('returns 404 for unknown id', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(GetCommand as never).resolves({} as any);

    const res = await app().request('/seasons/nonexistent', { headers: authHeader() });
    expect(res.status).toBe(404);
  });

  it('returns the season for a known id', async () => {
    const fakeSeason = {
      PK: 'USER#me',
      SK: 'SEASON#abc',
      type: 'SEASON',
      id: 'abc',
      status: 'active',
      created_at: 1000,
      ...FAKE_SEASON_INPUT,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(GetCommand as never).resolves({ Item: fakeSeason } as any);

    const res = await app().request('/seasons/abc', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string };
    expect(body.id).toBe('abc');
  });
});

describe('POST /seasons/:id/end', () => {
  it('generates a recap and marks season ended', async () => {
    const fakeSeason = {
      PK: 'USER#me',
      SK: 'SEASON#abc',
      type: 'SEASON',
      id: 'abc',
      status: 'active',
      created_at: 1000,
      ...FAKE_SEASON_INPUT,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(GetCommand as never).resolves({ Item: fakeSeason } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [] } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(UpdateCommand as never).resolves({} as any);

    // Bedrock: tool_use then final text
    const toolUseRes = {
      content: [{ type: 'tool_use', id: 'tid1', name: 'get_stats', input: {} }],
      stop_reason: 'tool_use',
      usage: { input_tokens: 20, output_tokens: 10 },
    };
    const finalRes = {
      content: [{ type: 'text', text: '## Récap de saison\nBonne saison !' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 30, output_tokens: 20 },
    };
    bedrockMock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on(InvokeModelCommand as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolvesOnce({ body: encodeBedrockResponse(toolUseRes) } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolvesOnce({ body: encodeBedrockResponse(finalRes) } as any);

    const res = await app().request('/seasons/abc/end', {
      method: 'POST',
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; recap_markdown: string };
    expect(body.status).toBe('ended');
    expect(body.recap_markdown).toContain('Récap');
  });
});

describe('POST /seasons/:id/quests/:questId/complete', () => {
  it('marks quest done and awards XP', async () => {
    const fakeSeason = {
      PK: 'USER#me',
      SK: 'SEASON#abc',
      type: 'SEASON',
      id: 'abc',
      status: 'active',
      created_at: 1000,
      ...FAKE_SEASON_INPUT,
    };
    const fakeStats = {
      PK: 'USER#me',
      SK: 'STATS',
      type: 'STATS',
      stats: {
        global_level: 1,
        global_xp: 0,
        per_stat: {
          force: { level: 1, xp: 0, xp_to_next: 200 },
          endurance: { level: 1, xp: 0, xp_to_next: 200 },
          vitality: { level: 1, xp: 0, xp_to_next: 200 },
          discipline: { level: 1, xp: 0, xp_to_next: 200 },
          appearance: { level: 1, xp: 0, xp_to_next: 200 },
          spirit: { level: 1, xp: 0, xp_to_next: 200 },
        },
        updated_at: 1000,
      },
    };

    ddbMock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on(GetCommand as never)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolvesOnce({ Item: fakeSeason } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolvesOnce({ Item: fakeStats } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(UpdateCommand as never).resolves({} as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(PutCommand as never).resolves({} as any);

    const res = await app().request('/seasons/abc/quests/q1/complete', {
      method: 'POST',
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; xp_awarded: number };
    expect(body.ok).toBe(true);
    expect(body.xp_awarded).toBe(10000);
  });
});
