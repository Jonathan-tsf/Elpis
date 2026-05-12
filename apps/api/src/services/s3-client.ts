import { S3Client } from '@aws-sdk/client-s3';

let _client: S3Client | undefined;
export function getS3Client(): S3Client {
  if (!_client) _client = new S3Client({});
  return _client;
}

export function photosBucket(): string {
  const b = process.env['PHOTOS_BUCKET'];
  if (!b) throw new Error('PHOTOS_BUCKET env var not set');
  return b;
}
