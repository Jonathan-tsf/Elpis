import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { getDocClient, putItem, queryItems, updateItem } from '../services/dynamodb-client';
import { USER_PK } from '../services/keys';
import { runWithTools, type ClaudeMessage } from '../services/bedrock-client';
import { CLAUDE_SONNET_4_6 } from '../services/claude-models';
import { buildReadTools, buildReadHandlers } from '../services/ai-tools';

const SYSTEM_PROMPT = `Tu es le coach personnel de Jonathan, expert en performance physique, santé, looksmax.
Tu as accès aux données via tool use. Utilise-les avant de répondre.
Réponds en français, ton direct mais bienveillant. Pas de bullshit.`;

const MAX_HISTORY = 30;

interface ThreadItem {
  PK: string;
  SK: string;
  type: 'AI_THREAD';
  id: string;
  title: string;
  created_at: number;
  last_message_at: number;
}

interface MessageItem {
  PK: string;
  SK: string;
  type: 'AI_MSG';
  threadId: string;
  ts: number;
  role: 'user' | 'assistant';
  content: unknown;
}

export function coachRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();

  // POST /threads — create a new thread
  app.post('/threads', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { title?: string };
    const id = randomUUID();
    const now = Date.now();
    const item: ThreadItem = {
      PK: USER_PK,
      SK: `THREAD#${id}`,
      type: 'AI_THREAD',
      id,
      title: body.title ?? 'Nouvelle conversation',
      created_at: now,
      last_message_at: now,
    };
    const doc = getDocClient();
    await putItem(doc, item as unknown as Record<string, unknown>);
    return c.json(item, 201);
  });

  // GET /threads — list all threads sorted by last_message_at desc
  app.get('/threads', async (c) => {
    const doc = getDocClient();
    const items = await queryItems<ThreadItem>(doc, {
      pk: USER_PK,
      skBegins: 'THREAD#',
    });
    const sorted = [...items].sort((a, b) => b.last_message_at - a.last_message_at);
    return c.json(sorted);
  });

  // GET /threads/:id/messages — list messages for a thread sorted by ts asc
  app.get('/threads/:id/messages', async (c) => {
    const threadId = c.req.param('id');
    const doc = getDocClient();
    const items = await queryItems<MessageItem>(doc, {
      pk: USER_PK,
      skBegins: `MSG#${threadId}#`,
    });
    const sorted = [...items].sort((a, b) => a.ts - b.ts);
    return c.json(sorted);
  });

  // POST /threads/:id/messages — send a user message, get AI reply
  app.post('/threads/:id/messages', async (c) => {
    const threadId = c.req.param('id');
    const body = await c.req.json().catch(() => null) as { text?: string } | null;
    if (!body?.text) return c.json({ error: 'text is required' }, 400);

    const doc = getDocClient();
    const now = Date.now();

    // Persist user message
    const userMsg: MessageItem = {
      PK: USER_PK,
      SK: `MSG#${threadId}#${now}`,
      type: 'AI_MSG',
      threadId,
      ts: now,
      role: 'user',
      content: body.text,
    };
    await putItem(doc, userMsg as unknown as Record<string, unknown>);

    // Load thread history (last MAX_HISTORY messages)
    const history = await queryItems<MessageItem>(doc, {
      pk: USER_PK,
      skBegins: `MSG#${threadId}#`,
    });
    const sortedHistory = [...history].sort((a, b) => a.ts - b.ts).slice(-MAX_HISTORY);

    // Build claude messages from history
    const messages: ClaudeMessage[] = sortedHistory.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));

    const tools = buildReadTools();
    const handlers = buildReadHandlers(doc);

    const { finalText, usage } = await runWithTools({
      model: CLAUDE_SONNET_4_6,
      system: SYSTEM_PROMPT,
      messages,
      tools,
      toolHandlers: handlers,
      maxIters: 6,
    });

    const replyTs = Date.now();
    const assistantMsg: MessageItem = {
      PK: USER_PK,
      SK: `MSG#${threadId}#${replyTs}`,
      type: 'AI_MSG',
      threadId,
      ts: replyTs,
      role: 'assistant',
      content: finalText,
    };
    await putItem(doc, assistantMsg as unknown as Record<string, unknown>);

    // Update thread last_message_at
    await updateItem(doc, USER_PK, `THREAD#${threadId}`, {
      last_message_at: replyTs,
    });

    return c.json({ ...assistantMsg, usage });
  });

  return app;
}
