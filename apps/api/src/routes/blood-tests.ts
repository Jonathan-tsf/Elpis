import { Hono } from 'hono';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { BloodTestInput } from '@lifeos/shared';
import { bloodTestKey, USER_PK } from '../services/keys';
import { putItem, queryItems, getDocClient } from '../services/dynamodb-client';
import { getS3Client, photosBucket } from '../services/s3-client';

type BloodTestItem = {
  PK: string;
  SK: string;
  type: 'BLOOD_TEST';
  id: string;
  date: string;
  lab?: string;
  notes?: string;
  markers: unknown[];
  pdf_key?: string;
  created_at: number;
};

export function bloodTestsRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();

  // POST /presign — presigned PUT for PDF upload
  app.post('/presign', async (c) => {
    const bodyRaw = await c.req.json().catch(() => null);
    const contentType = (bodyRaw as { contentType?: string })?.contentType ?? 'application/pdf';
    const id = crypto.randomUUID();
    const key = `blood-reports/${id}.pdf`;
    const Bucket = photosBucket();
    const uploadUrl = await getSignedUrl(
      getS3Client(),
      new PutObjectCommand({ Bucket, Key: key, ContentType: contentType }),
      { expiresIn: 300 },
    );
    return c.json({ key, uploadUrl });
  });

  // POST / — persist blood test
  app.post('/', async (c) => {
    const bodyRaw = await c.req.json().catch(() => null);
    const parsed = BloodTestInput.safeParse(bodyRaw);
    if (!parsed.success) return c.json({ error: 'invalid body', issues: parsed.error.issues }, 400);

    const input = parsed.data;
    const id = crypto.randomUUID();
    const { pk, sk } = bloodTestKey(input.date, id);
    const created_at = Date.now();

    const item: BloodTestItem = {
      PK: pk,
      SK: sk,
      type: 'BLOOD_TEST',
      id,
      date: input.date,
      lab: input.lab,
      notes: input.notes,
      markers: input.markers,
      pdf_key: input.pdf_key,
      created_at,
    };

    const doc = getDocClient();
    await putItem(doc, item);

    return c.json({ id, ...input, created_at });
  });

  // GET / — list all blood tests
  app.get('/', async (c) => {
    const doc = getDocClient();
    const items = await queryItems<BloodTestItem>(doc, { pk: USER_PK, skBegins: 'BLOOD#' });
    const sorted = [...items].sort((a, b) => (a.date < b.date ? 1 : -1));
    return c.json({
      items: sorted.map((i) => ({
        id: i.id, date: i.date, lab: i.lab, notes: i.notes,
        markers: i.markers, pdf_key: i.pdf_key, created_at: i.created_at,
      })),
    });
  });

  // GET /:id — fetch one blood test + presigned PDF URL if present
  app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const doc = getDocClient();
    const items = await queryItems<BloodTestItem>(doc, { pk: USER_PK, skBegins: 'BLOOD#' });
    const found = items.find((i) => i.id === id);
    if (!found) return c.json({ error: 'not found' }, 404);

    let pdf_url: string | undefined;
    if (found.pdf_key) {
      pdf_url = await getSignedUrl(
        getS3Client(),
        new GetObjectCommand({ Bucket: photosBucket(), Key: found.pdf_key }),
        { expiresIn: 300 },
      );
    }

    return c.json({
      id: found.id, date: found.date, lab: found.lab, notes: found.notes,
      markers: found.markers, pdf_key: found.pdf_key, pdf_url, created_at: found.created_at,
    });
  });

  return app;
}
