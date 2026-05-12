import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
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

describe('POST /coach/threads', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/coach/threads', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('creates a thread and returns 201', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(PutCommand as never).resolves({} as any);

    const res = await app().request('/coach/threads', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Mon analyse' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as {
      type: string;
      id: string;
      title: string;
      created_at: number;
      last_message_at: number;
      PK: string;
      SK: string;
    };
    expect(body.type).toBe('AI_THREAD');
    expect(typeof body.id).toBe('string');
    expect(body.title).toBe('Mon analyse');
    expect(typeof body.created_at).toBe('number');
    expect(body.PK).toBe('USER#me');
    expect(body.SK).toMatch(/^THREAD#/);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const puts = ddbMock.commandCalls(PutCommand as any);
    expect(puts).toHaveLength(1);
  });

  it('uses default title when none provided', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(PutCommand as never).resolves({} as any);

    const res = await app().request('/coach/threads', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { title: string };
    expect(body.title).toBe('Nouvelle conversation');
  });
});

describe('GET /coach/threads', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/coach/threads');
    expect(res.status).toBe(401);
  });

  it('returns threads sorted by last_message_at desc', async () => {
    const threads = [
      {
        PK: 'USER#me', SK: 'THREAD#abc', type: 'AI_THREAD',
        id: 'abc', title: 'Thread 1', created_at: 100, last_message_at: 100,
      },
      {
        PK: 'USER#me', SK: 'THREAD#def', type: 'AI_THREAD',
        id: 'def', title: 'Thread 2', created_at: 200, last_message_at: 300,
      },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: threads } as any);

    const res = await app().request('/coach/threads', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ id: string }>;
    expect(body).toHaveLength(2);
    // Most recent first (last_message_at 300 > 100)
    expect(body[0]?.id).toBe('def');
    expect(body[1]?.id).toBe('abc');
  });
});

describe('GET /coach/threads/:id/messages', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/coach/threads/abc/messages');
    expect(res.status).toBe(401);
  });

  it('returns messages sorted by ts asc', async () => {
    const messages = [
      { PK: 'USER#me', SK: 'MSG#abc#200', type: 'AI_MSG', threadId: 'abc', ts: 200, role: 'assistant', content: 'Hello' },
      { PK: 'USER#me', SK: 'MSG#abc#100', type: 'AI_MSG', threadId: 'abc', ts: 100, role: 'user', content: 'Hi' },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: messages } as any);

    const res = await app().request('/coach/threads/abc/messages', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ ts: number; role: string }>;
    expect(body).toHaveLength(2);
    expect(body[0]?.ts).toBe(100);
    expect(body[1]?.ts).toBe(200);
  });
});

describe('POST /coach/threads/:id/messages', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/coach/threads/abc/messages', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when text is missing', async () => {
    const res = await app().request('/coach/threads/abc/messages', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('text is required');
  });

  it('runs the tool-use loop (1 tool call then text) and persists both messages', async () => {
    // Tool-use response for history fetch
    const toolUseResponse = {
      content: [{ type: 'tool_use', id: 'tid-1', name: 'get_stats', input: {} }],
      stop_reason: 'tool_use',
      usage: { input_tokens: 40, output_tokens: 10 },
    };
    const finalResponse = {
      content: [{ type: 'text', text: 'Tu progresses bien!' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 60, output_tokens: 12 },
    };
    bedrockMock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on(InvokeModelCommand as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolvesOnce({ body: encodeBedrockResponse(toolUseResponse) } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolvesOnce({ body: encodeBedrockResponse(finalResponse) } as any);

    // DDB: first query returns no history, second query for stats returns null
    ddbMock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on(QueryCommand as never)
      // History query (empty — new thread) then stats via queryItems for QUEST#
      .resolves({ Items: [] } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(PutCommand as never).resolves({} as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(UpdateCommand as never).resolves({} as any);

    const res = await app().request('/coach/threads/thread-1/messages', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Comment je progresse?' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      type: string;
      role: string;
      content: string;
      threadId: string;
      usage: { input_tokens: number; output_tokens: number };
    };
    expect(body.type).toBe('AI_MSG');
    expect(body.role).toBe('assistant');
    expect(body.content).toBe('Tu progresses bien!');
    expect(body.threadId).toBe('thread-1');
    expect(body.usage.input_tokens).toBe(100);
    expect(body.usage.output_tokens).toBe(22);

    // Both user and assistant messages were persisted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const puts = ddbMock.commandCalls(PutCommand as any);
    expect(puts.length).toBeGreaterThanOrEqual(2);

    // Thread was updated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates = ddbMock.commandCalls(UpdateCommand as any);
    expect(updates).toHaveLength(1);
  });
});
