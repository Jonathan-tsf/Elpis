import { getDocClient, putItem } from './dynamodb-client';
import { USER_PK, dateString } from './keys';
import { runWithTools, type ClaudeResponse } from './bedrock-client';
import { CLAUDE_HAIKU_4_5 } from './claude-models';
import { buildReadTools, buildReadHandlers } from './ai-tools';

const SYSTEM_PROMPT = `Tu es le coach personnel de Jonathan dans LifeOS, une app de suivi physique gamifiée.
Tu génères un briefing du matin court (3-5 lignes max), direct, motivant mais pas mielleux.
Tu mentionnes 1 observation factuelle sur la semaine + le focus du jour + 1 alerte si pertinente.
Tu réponds en français. Pas d'émojis, sauf 1 max au début si tu juges pertinent.`;

export interface BriefingResult {
  text: string;
  date: string;
  model: string;
  usage: ClaudeResponse['usage'];
}

export async function generateBriefing(): Promise<BriefingResult> {
  const today = dateString();
  const doc = getDocClient();
  const tools = buildReadTools();
  const handlers = buildReadHandlers(doc);

  const userMessage = `Génère le briefing du matin pour aujourd'hui (${today}). Utilise les outils pour récupérer le contexte. Garde le message court.`;

  const { finalText, usage } = await runWithTools({
    model: CLAUDE_HAIKU_4_5,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    tools,
    toolHandlers: handlers,
    maxIters: 4,
  });

  await putItem(doc, {
    PK: USER_PK,
    SK: `BRIEF#${today}`,
    type: 'BRIEFING',
    date: today,
    text: finalText,
    model: CLAUDE_HAIKU_4_5,
    usage,
    created_at: Date.now(),
  });

  return { text: finalText, date: today, model: CLAUDE_HAIKU_4_5, usage };
}
