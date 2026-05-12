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
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  batchGet,
  deleteItem,
  getItem,
  putItem,
  queryItems,
  updateItem,
} from '../src/services/dynamodb-client';

const TABLE = 'test-table';

// Type cast needed: aws-sdk-client-mock ships @smithy/types@3 while the
// installed @aws-sdk packages pull @smithy/types@4. Runtime behaviour is
// identical; the cast silences the structural version mismatch.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ddbMock = mockClient(DynamoDBDocumentClient as any);

beforeEach(() => {
  process.env['TABLE_NAME'] = TABLE;
  ddbMock.reset();
});

afterEach(() => {
  delete process.env['TABLE_NAME'];
});

function makeDoc(): DynamoDBDocumentClient {
  // mockClient stubs send() on all DynamoDBDocumentClient instances.
  // We still need a real DynamoDBClient to pass to the constructor.
  return DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
}

describe('putItem', () => {
  it('sends PutCommand with TableName and Item', async () => {
    ddbMock.on(PutCommand as never).resolves({});
    const item = { PK: 'USER#me', SK: 'DAY#2024-01-01', value: 42 };
    await putItem(makeDoc(), item);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = ddbMock.commandCalls(PutCommand as any);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0].input as Record<string, unknown>;
    expect(input['TableName']).toBe(TABLE);
    expect(input['Item']).toEqual(item);
  });
});

describe('getItem', () => {
  it('returns null when response has no Item', async () => {
    ddbMock.on(GetCommand as never).resolves({});
    const result = await getItem(makeDoc(), 'USER#me', 'PROFILE');
    expect(result).toBeNull();
  });

  it('returns the item when present', async () => {
    const stored = { PK: 'USER#me', SK: 'PROFILE', name: 'Jon' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(GetCommand as never).resolves({ Item: stored } as any);
    const result = await getItem<typeof stored>(makeDoc(), 'USER#me', 'PROFILE');
    expect(result).toEqual(stored);
  });
});

describe('queryItems', () => {
  it('base case: pk + skBegins builds correct KeyConditionExpression', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [] } as any);
    await queryItems(makeDoc(), { pk: 'USER#me', skBegins: 'DAY#' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = ddbMock.commandCalls(QueryCommand as any);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0].input as Record<string, unknown>;
    expect(input['TableName']).toBe(TABLE);
    expect(input['IndexName']).toBeUndefined();
    expect(input['KeyConditionExpression']).toBe('#pk = :pk AND begins_with(#sk, :sk)');
    expect(input['ExpressionAttributeNames']).toMatchObject({ '#pk': 'PK', '#sk': 'SK' });
    expect(input['ExpressionAttributeValues']).toMatchObject({ ':pk': 'USER#me', ':sk': 'DAY#' });
  });

  it('GSI1: uses IndexName=GSI1 and gsi1pk/gsi1sk attribute names', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [] } as any);
    await queryItems(makeDoc(), {
      pk: 'USER#me',
      gsi: 'GSI1',
      gsiPk: 'TYPE#workout',
      gsiSkBegins: '2024-',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = ddbMock.commandCalls(QueryCommand as any);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0].input as Record<string, unknown>;
    expect(input['IndexName']).toBe('GSI1');
    expect(input['ExpressionAttributeNames']).toMatchObject({ '#pk': 'gsi1pk', '#sk': 'gsi1sk' });
    expect(input['ExpressionAttributeValues']).toMatchObject({
      ':pk': 'TYPE#workout',
      ':sk': '2024-',
    });
    expect(input['KeyConditionExpression']).toBe('#pk = :pk AND begins_with(#sk, :sk)');
  });

  it('returns items from response', async () => {
    const items = [{ PK: 'USER#me', SK: 'DAY#2024-01-01' }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: items } as any);
    const result = await queryItems(makeDoc(), { pk: 'USER#me' });
    expect(result).toEqual(items);
  });
});

describe('updateItem', () => {
  it('builds SET expression for 2 updates', async () => {
    ddbMock.on(UpdateCommand as never).resolves({});
    await updateItem(makeDoc(), 'USER#me', 'PROFILE', { name: 'Jon', age: 30 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = ddbMock.commandCalls(UpdateCommand as any);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0].input as Record<string, unknown>;
    expect(input['TableName']).toBe(TABLE);
    expect(input['Key']).toEqual({ PK: 'USER#me', SK: 'PROFILE' });
    expect(input['UpdateExpression']).toBe('SET #k0 = :v0, #k1 = :v1');
    expect(input['ExpressionAttributeNames']).toMatchObject({ '#k0': 'name', '#k1': 'age' });
    expect(input['ExpressionAttributeValues']).toMatchObject({ ':v0': 'Jon', ':v1': 30 });
  });
});

describe('deleteItem', () => {
  it('sends DeleteCommand with correct TableName and Key', async () => {
    ddbMock.on(DeleteCommand as never).resolves({});
    await deleteItem(makeDoc(), 'USER#me', 'PROFILE');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = ddbMock.commandCalls(DeleteCommand as any);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0].input as Record<string, unknown>;
    expect(input['TableName']).toBe(TABLE);
    expect(input['Key']).toEqual({ PK: 'USER#me', SK: 'PROFILE' });
  });
});

describe('batchGet', () => {
  it('returns empty array for empty keys', async () => {
    const result = await batchGet(makeDoc(), []);
    expect(result).toEqual([]);
  });

  it('sends BatchGetCommand and returns items', async () => {
    const items = [{ PK: 'USER#me', SK: 'PROFILE' }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(BatchGetCommand as never).resolves({ Responses: { [TABLE]: items } } as any);
    const result = await batchGet(makeDoc(), [{ pk: 'USER#me', sk: 'PROFILE' }]);
    expect(result).toEqual(items);
  });
});
