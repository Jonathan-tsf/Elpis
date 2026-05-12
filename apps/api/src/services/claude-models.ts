/**
 * Bedrock model IDs for Claude inference.
 * Use the `us.` prefix for cross-region inference profiles (routes within US regions).
 *
 * Override via Lambda env vars if AWS updates the IDs:
 *   CLAUDE_SONNET_MODEL_ID, CLAUDE_HAIKU_MODEL_ID
 */
export const CLAUDE_SONNET_4_6 =
  process.env['CLAUDE_SONNET_MODEL_ID'] ?? 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';

export const CLAUDE_HAIKU_4_5 =
  process.env['CLAUDE_HAIKU_MODEL_ID'] ?? 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
