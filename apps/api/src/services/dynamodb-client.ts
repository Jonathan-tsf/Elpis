import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

let _docClient: DynamoDBDocumentClient | undefined;

export function getDocClient(): DynamoDBDocumentClient {
  if (!_docClient) {
    _docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _docClient;
}

export function tableName(): string {
  const name = process.env['TABLE_NAME'];
  if (!name) throw new Error('TABLE_NAME env var is not set');
  return name;
}

export async function putItem(
  doc: DynamoDBDocumentClient,
  item: Record<string, unknown>,
): Promise<void> {
  await doc.send(new PutCommand({ TableName: tableName(), Item: item }));
}

export async function getItem<T>(
  doc: DynamoDBDocumentClient,
  pk: string,
  sk: string,
): Promise<T | null> {
  const res = await doc.send(
    new GetCommand({ TableName: tableName(), Key: { PK: pk, SK: sk } }),
  );
  return res.Item != null ? (res.Item as T) : null;
}

export type QueryOpts = {
  pk: string;
  skBegins?: string;
  gsi?: 'GSI1' | 'GSI2';
  gsiPk?: string;
  gsiSkBegins?: string;
  limit?: number;
  scanIndexForward?: boolean;
};

export async function queryItems<T>(
  doc: DynamoDBDocumentClient,
  opts: QueryOpts,
): Promise<T[]> {
  const { pk, skBegins, gsi, gsiPk, gsiSkBegins, limit, scanIndexForward } = opts;

  let IndexName: string | undefined;
  let KeyConditionExpression: string;
  const ExpressionAttributeNames: Record<string, string> = {};
  const ExpressionAttributeValues: Record<string, unknown> = {};

  if (gsi) {
    IndexName = gsi;
    const pkAttr = gsi === 'GSI1' ? 'gsi1pk' : 'gsi2pk';
    const skAttr = gsi === 'GSI1' ? 'gsi1sk' : 'gsi2sk';
    ExpressionAttributeNames['#pk'] = pkAttr;
    ExpressionAttributeValues[':pk'] = gsiPk ?? pk;
    if (gsiSkBegins != null) {
      ExpressionAttributeNames['#sk'] = skAttr;
      ExpressionAttributeValues[':sk'] = gsiSkBegins;
      KeyConditionExpression = '#pk = :pk AND begins_with(#sk, :sk)';
    } else {
      KeyConditionExpression = '#pk = :pk';
    }
  } else {
    ExpressionAttributeNames['#pk'] = 'PK';
    ExpressionAttributeValues[':pk'] = pk;
    if (skBegins != null) {
      ExpressionAttributeNames['#sk'] = 'SK';
      ExpressionAttributeValues[':sk'] = skBegins;
      KeyConditionExpression = '#pk = :pk AND begins_with(#sk, :sk)';
    } else {
      KeyConditionExpression = '#pk = :pk';
    }
  }

  const res = await doc.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName,
      KeyConditionExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      Limit: limit,
      ScanIndexForward: scanIndexForward,
    }),
  );

  return (res.Items ?? []) as T[];
}

export async function updateItem(
  doc: DynamoDBDocumentClient,
  pk: string,
  sk: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const keys = Object.keys(updates);
  const ExpressionAttributeNames: Record<string, string> = {};
  const ExpressionAttributeValues: Record<string, unknown> = {};
  const setParts: string[] = [];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key == null) continue;
    ExpressionAttributeNames[`#k${i}`] = key;
    ExpressionAttributeValues[`:v${i}`] = updates[key];
    setParts.push(`#k${i} = :v${i}`);
  }

  await doc.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { PK: pk, SK: sk },
      UpdateExpression: `SET ${setParts.join(', ')}`,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
    }),
  );
}

export async function deleteItem(
  doc: DynamoDBDocumentClient,
  pk: string,
  sk: string,
): Promise<void> {
  await doc.send(new DeleteCommand({ TableName: tableName(), Key: { PK: pk, SK: sk } }));
}

export async function batchGet<T>(
  doc: DynamoDBDocumentClient,
  keys: { pk: string; sk: string }[],
): Promise<T[]> {
  if (keys.length === 0) return [];
  const table = tableName();
  const res = await doc.send(
    new BatchGetCommand({
      RequestItems: {
        [table]: { Keys: keys.map(({ pk, sk }) => ({ PK: pk, SK: sk })) },
      },
    }),
  );
  const responses = res.Responses;
  if (responses == null) return [];
  const items = responses[table];
  return (items ?? []) as T[];
}
