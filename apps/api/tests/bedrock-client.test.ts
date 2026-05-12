import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { invokeClaude, runWithTools } from '../src/services/bedrock-client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bedrockMock = mockClient(BedrockRuntimeClient as any);

function encodeResponse(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj));
}

beforeEach(() => {
  bedrockMock.reset();
});

describe('invokeClaude', () => {
  it('builds the correct body and parses the response', async () => {
    const fakeResponse = {
      content: [{ type: 'text', text: 'Hello!' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
    };
    bedrockMock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on(InvokeModelCommand as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolves({ body: encodeResponse(fakeResponse) } as any);

    const result = await invokeClaude({
      model: 'test-model',
      system: 'You are a test assistant.',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 100,
      temperature: 0.5,
    });

    expect(result.stop_reason).toBe('end_turn');
    expect(result.content[0]).toEqual({ type: 'text', text: 'Hello!' });
    expect(result.usage.input_tokens).toBe(10);
    expect(result.usage.output_tokens).toBe(5);

    // Verify the command was called once
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = bedrockMock.commandCalls(InvokeModelCommand as any);
    expect(calls).toHaveLength(1);
    const sentInput = calls[0]?.args[0].input as Record<string, unknown>;
    expect(sentInput['modelId']).toBe('test-model');
    const parsedBody = JSON.parse(sentInput['body'] as string) as Record<string, unknown>;
    expect(parsedBody['anthropic_version']).toBe('bedrock-2023-05-31');
    expect(parsedBody['max_tokens']).toBe(100);
    expect(parsedBody['temperature']).toBe(0.5);
    expect(parsedBody['system']).toBe('You are a test assistant.');
  });
});

describe('runWithTools', () => {
  it('returns finalText when stop_reason is not tool_use (single-shot)', async () => {
    const fakeResponse = {
      content: [{ type: 'text', text: 'Final answer' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 20, output_tokens: 10 },
    };
    bedrockMock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on(InvokeModelCommand as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolves({ body: encodeResponse(fakeResponse) } as any);

    const result = await runWithTools({
      model: 'test-model',
      messages: [{ role: 'user', content: 'Tell me something' }],
      tools: [
        {
          name: 'get_data',
          description: 'Get some data',
          input_schema: { type: 'object', properties: {} },
        },
      ],
      toolHandlers: {
        get_data: async () => ({ value: 42 }),
      },
    });

    expect(result.finalText).toBe('Final answer');
    expect(result.usage.input_tokens).toBe(20);
    expect(result.usage.output_tokens).toBe(10);
    // Only 1 invocation — no tool call
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(bedrockMock.commandCalls(InvokeModelCommand as any)).toHaveLength(1);
  });

  it('handles 1 tool call then text: invokes handler, appends tool_result, gets final text', async () => {
    const toolUseResponse = {
      content: [
        { type: 'tool_use', id: 'tool-1', name: 'get_data', input: { range_days: 7 } },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 30, output_tokens: 15 },
    };
    const finalResponse = {
      content: [{ type: 'text', text: 'Based on the data, you did great!' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 50, output_tokens: 20 },
    };
    bedrockMock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on(InvokeModelCommand as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolvesOnce({ body: encodeResponse(toolUseResponse) } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolvesOnce({ body: encodeResponse(finalResponse) } as any);

    let handlerCalled = false;
    const result = await runWithTools({
      model: 'test-model',
      messages: [{ role: 'user', content: 'Analyse my week' }],
      tools: [
        {
          name: 'get_data',
          description: 'Get data',
          input_schema: { type: 'object', properties: { range_days: { type: 'integer' } } },
        },
      ],
      toolHandlers: {
        get_data: async (input) => {
          handlerCalled = true;
          expect((input as { range_days: number }).range_days).toBe(7);
          return [{ date: '2026-05-10', sleep: 480 }];
        },
      },
    });

    expect(handlerCalled).toBe(true);
    expect(result.finalText).toBe('Based on the data, you did great!');
    // Total usage: 30+50 input, 15+20 output
    expect(result.usage.input_tokens).toBe(80);
    expect(result.usage.output_tokens).toBe(35);
    // 2 invocations total
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(bedrockMock.commandCalls(InvokeModelCommand as any)).toHaveLength(2);

    // The second message in allMessages should be the tool_result
    const toolResultMsg = result.allMessages.find(
      (m) =>
        Array.isArray(m.content) &&
        (m.content as Array<{ type: string }>).some((b) => b.type === 'tool_result'),
    );
    expect(toolResultMsg).toBeDefined();
  });

  it('throws after maxIters when tool_use never resolves', async () => {
    const toolUseResponse = {
      content: [{ type: 'tool_use', id: 'tool-1', name: 'get_data', input: {} }],
      stop_reason: 'tool_use',
      usage: { input_tokens: 10, output_tokens: 5 },
    };
    bedrockMock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on(InvokeModelCommand as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolves({ body: encodeResponse(toolUseResponse) } as any);

    await expect(
      runWithTools({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [
          {
            name: 'get_data',
            description: 'Get data',
            input_schema: { type: 'object', properties: {} },
          },
        ],
        toolHandlers: {
          get_data: async () => 'result',
        },
        maxIters: 3,
      }),
    ).rejects.toThrow('Claude tool loop exceeded 3 iterations');
  });
});
