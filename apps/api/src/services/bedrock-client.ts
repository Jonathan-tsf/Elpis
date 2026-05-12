import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

let _client: BedrockRuntimeClient | undefined;

export function getBedrockRuntime(): BedrockRuntimeClient {
  if (!_client) {
    _client = new BedrockRuntimeClient({
      region: process.env['AWS_REGION'] ?? 'us-east-1',
    });
  }
  return _client;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContentBlock[];
}

export type ClaudeContentBlock =
  | { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface InvokeClaudeArgs {
  model: string;
  system?: string | { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }[];
  messages: ClaudeMessage[];
  tools?: ClaudeTool[];
  max_tokens?: number;
  temperature?: number;
}

export interface ClaudeResponse {
  content: ClaudeContentBlock[];
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export async function invokeClaude(args: InvokeClaudeArgs): Promise<ClaudeResponse> {
  const body = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: args.max_tokens ?? 4096,
    temperature: args.temperature ?? 0.7,
    system: args.system,
    messages: args.messages,
    tools: args.tools,
  };

  const cmd = new InvokeModelCommand({
    modelId: args.model,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(body),
  });

  const res = await getBedrockRuntime().send(cmd);
  const decoded = new TextDecoder().decode(res.body);
  return JSON.parse(decoded) as ClaudeResponse;
}

/**
 * Runs Claude in a tool-use loop: as long as the response has stop_reason='tool_use',
 * call the registered tools, append tool_result, re-invoke. Returns final text content.
 * Limits to maxIters iterations to avoid infinite loops.
 */
export async function runWithTools(args: {
  model: string;
  system?: InvokeClaudeArgs['system'];
  messages: ClaudeMessage[];
  tools: ClaudeTool[];
  toolHandlers: Record<string, (input: unknown) => Promise<unknown>>;
  maxIters?: number;
}): Promise<{
  finalText: string;
  allMessages: ClaudeMessage[];
  usage: ClaudeResponse['usage'];
}> {
  const messages = [...args.messages];
  const totalUsage = { input_tokens: 0, output_tokens: 0 };
  const maxIters = args.maxIters ?? 6;

  for (let i = 0; i < maxIters; i++) {
    const res = await invokeClaude({
      model: args.model,
      system: args.system,
      messages,
      tools: args.tools,
      max_tokens: 4096,
    });

    totalUsage.input_tokens += res.usage.input_tokens;
    totalUsage.output_tokens += res.usage.output_tokens;

    messages.push({ role: 'assistant', content: res.content });

    if (res.stop_reason !== 'tool_use') {
      const text = res.content
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      return { finalText: text, allMessages: messages, usage: totalUsage };
    }

    // Handle tool calls
    const toolResults: ClaudeContentBlock[] = [];
    for (const block of res.content) {
      if (block.type !== 'tool_use') continue;
      const handler = args.toolHandlers[block.name];
      if (!handler) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: `Error: unknown tool ${block.name}`,
          is_error: true,
        });
        continue;
      }
      try {
        const result = await handler(block.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      } catch (e) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: `Error: ${String(e)}`,
          is_error: true,
        });
      }
    }
    messages.push({ role: 'user', content: toolResults });
  }

  throw new Error(`Claude tool loop exceeded ${maxIters} iterations`);
}
