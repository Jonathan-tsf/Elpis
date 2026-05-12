import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { type Stats } from '@lifeos/shared';
import { getItem, putItem } from './dynamodb-client';
import { xpEventKey, statsKey, USER_PK } from './keys';
import { type XpDelta, applyDeltasToStats } from './xp-engine';

export async function persistXpEvents(
  doc: DynamoDBDocumentClient,
  deltas: XpDelta[],
  source: string,
): Promise<void> {
  for (const delta of deltas) {
    const ts = Date.now();
    const id = crypto.randomUUID();
    const { pk, sk } = xpEventKey(ts, id);
    await putItem(doc, {
      PK: pk,
      SK: sk,
      id,
      ts,
      source,
      amount: delta.amount,
      stat: delta.stat,
      reason: delta.reason,
    });
  }
}

type StatsItem = {
  PK: string;
  SK: string;
  type: 'STATS';
  stats: Stats;
};

export async function readStats(doc: DynamoDBDocumentClient): Promise<Stats | null> {
  const { pk, sk } = statsKey();
  const item = await getItem<StatsItem>(doc, pk, sk);
  return item?.stats ?? null;
}

export async function writeStats(doc: DynamoDBDocumentClient, stats: Stats): Promise<void> {
  const { pk, sk } = statsKey();
  await putItem(doc, {
    PK: pk,
    SK: sk,
    type: 'STATS' as const,
    stats,
  });
}

export async function awardXp(
  doc: DynamoDBDocumentClient,
  deltas: XpDelta[],
  source: string,
): Promise<Stats> {
  const current = await readStats(doc);
  const newStats = applyDeltasToStats(current, deltas);
  await writeStats(doc, newStats);
  await persistXpEvents(doc, deltas, source);
  return newStats;
}
