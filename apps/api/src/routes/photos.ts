import { Hono } from 'hono';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PhotoPresignInput, PhotoConfirmInput, type PhotoTag, type PhotoAnalysis } from '@lifeos/shared';
import { photoKey, USER_PK, dateString, photoAnalysisKey } from '../services/keys';
import { putItem, queryItems, getDocClient } from '../services/dynamodb-client';
import { deltasForPhoto } from '../services/xp-engine';
import { awardXp } from '../services/xp-persistence';
import { getS3Client, photosBucket } from '../services/s3-client';
import { invokeClaude } from '../services/bedrock-client';
import { CLAUDE_SONNET_4_6 } from '../services/claude-models';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type PhotoItem = {
  PK: string;
  SK: string;
  type: 'PHOTO';
  id: string;
  date: string;
  s3_key: string;
  tags: PhotoTag[];
  conditions?: Record<string, unknown>;
  notes?: string;
  created_at: number;
};

function extFromContentType(ct: string): string {
  if (ct === 'image/jpeg') return '.jpg';
  if (ct === 'image/png') return '.png';
  if (ct === 'image/webp') return '.webp';
  if (ct === 'image/heic') return '.heic';
  return '';
}

export function photosRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();

  // POST /presign — generate presigned upload URL
  app.post('/presign', async (c) => {
    const bodyRaw = await c.req.json().catch(() => null);
    const parsed = PhotoPresignInput.safeParse(bodyRaw);
    if (!parsed.success) return c.json({ error: 'invalid body', issues: parsed.error.issues }, 400);

    const { contentType } = parsed.data;
    const photoId = crypto.randomUUID();
    const ext = extFromContentType(contentType);
    const key = `photos/${dateString()}/${photoId}${ext}`;

    const Bucket = photosBucket();
    const uploadUrl = await getSignedUrl(
      getS3Client(),
      new PutObjectCommand({ Bucket, Key: key, ContentType: contentType }),
      { expiresIn: 300 },
    );

    return c.json({ photoId, key, uploadUrl });
  });

  // POST / — confirm upload, persist photo
  app.post('/', async (c) => {
    const bodyRaw = await c.req.json().catch(() => null);
    const parsed = PhotoConfirmInput.safeParse(bodyRaw);
    if (!parsed.success) return c.json({ error: 'invalid body', issues: parsed.error.issues }, 400);

    const input = parsed.data;
    const { pk, sk } = photoKey(input.date, input.photoId);
    const created_at = Date.now();

    const item: PhotoItem = {
      PK: pk,
      SK: sk,
      type: 'PHOTO',
      id: input.photoId,
      date: input.date,
      s3_key: input.key,
      tags: input.tags,
      conditions: input.conditions,
      notes: input.notes,
      created_at,
    };

    const doc = getDocClient();
    await putItem(doc, item);

    const deltas = deltasForPhoto(input);
    const stats = await awardXp(doc, deltas, `photo:${input.photoId}`);

    return c.json({
      id: item.id,
      date: item.date,
      s3_key: item.s3_key,
      tags: item.tags,
      conditions: item.conditions,
      notes: item.notes,
      created_at: item.created_at,
      xp_deltas: deltas,
      stats,
    });
  });

  // GET / — list photos with optional filters
  app.get('/', async (c) => {
    const tagFilter = c.req.query('tag');
    const from = c.req.query('from');
    const to = c.req.query('to');

    const doc = getDocClient();
    const items = await queryItems<PhotoItem>(doc, {
      pk: USER_PK,
      skBegins: 'PHOTO#',
    });

    const filtered = items.filter((i) => {
      if (from && i.date < from) return false;
      if (to && i.date > to) return false;
      if (tagFilter && !i.tags.includes(tagFilter as PhotoTag)) return false;
      return true;
    });

    return c.json({
      items: filtered.map((i) => ({
        id: i.id,
        date: i.date,
        s3_key: i.s3_key,
        tags: i.tags,
        conditions: i.conditions,
        notes: i.notes,
        created_at: i.created_at,
      })),
    });
  });

  // POST /:id/analyze — analyze photo with Claude vision
  app.post('/:id/analyze', async (c) => {
    const id = c.req.param('id');
    const bodyRaw = await c.req.json().catch(() => ({}));
    const scope = (bodyRaw as { scope?: string }).scope ?? 'auto';

    const doc = getDocClient();
    const items = await queryItems<PhotoItem>(doc, { pk: USER_PK, skBegins: 'PHOTO#' });
    const found = items.find((i) => i.id === id);
    if (!found) return c.json({ error: 'not found' }, 404);

    const Bucket = photosBucket();
    const obj = await getS3Client().send(new GetObjectCommand({ Bucket, Key: found.s3_key }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of obj.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return c.json({ error: 'image too large (>5MB)' }, 400);
    }
    const b64 = buffer.toString('base64');
    const ct = obj.ContentType ?? 'image/jpeg';

    const scopeLabels: Record<string, string> = {
      face: 'visage et traits du visage',
      body: 'composition corporelle et proportions',
      posture: 'posture et alignement',
      fit: 'tenue vestimentaire et style',
      auto: 'tous les aspects visibles',
    };
    const scopeLabel = scopeLabels[scope] ?? 'tous les aspects visibles';

    const system =
      'Tu es un analyste looksmax francophone, expert pragmatique en physical aesthetics. Tu donnes des évaluations honnêtes mais constructives. Note les points forts. Suggère 3-5 axes d\'amélioration concrets. Si demandé tu peux estimer des ratios (jawline angle, face thirds, eye area, philtrum). Sois en markdown.';

    const res = await invokeClaude({
      model: CLAUDE_SONNET_4_6,
      system,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: ct, data: b64 } },
            { type: 'text', text: `Analyse cette photo. Scope: ${scopeLabel}. Donne ton analyse en markdown structuré.` },
          ],
        },
      ],
      max_tokens: 1500,
    });

    const markdown = res.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    const analysisId = crypto.randomUUID();
    const today = dateString();
    const { pk, sk } = photoAnalysisKey(today, analysisId);
    const analysis: PhotoAnalysis = {
      id: analysisId,
      photo_id: id,
      date: today,
      scope: scope as PhotoAnalysis['scope'],
      markdown,
      model: CLAUDE_SONNET_4_6,
      created_at: Date.now(),
    };
    await putItem(doc, { PK: pk, SK: sk, type: 'PHOTO_ANALYSIS', ...analysis });

    return c.json(analysis);
  });

  // GET /:id/analyses — list past analyses for a photo
  app.get('/:id/analyses', async (c) => {
    const id = c.req.param('id');
    const doc = getDocClient();
    const items = await queryItems<PhotoAnalysis & { PK: string; SK: string }>(doc, {
      pk: USER_PK,
      skBegins: 'PHOTOAN#',
    });
    const forPhoto = items.filter((i) => i.photo_id === id);
    return c.json({ analyses: forPhoto });
  });

  // GET /:id/url — get signed download URL
  app.get('/:id/url', async (c) => {
    const id = c.req.param('id');

    const doc = getDocClient();
    const items = await queryItems<PhotoItem>(doc, {
      pk: USER_PK,
      skBegins: 'PHOTO#',
    });

    const found = items.find((i) => i.id === id);
    if (!found) return c.json({ error: 'not found' }, 404);

    const Bucket = photosBucket();
    const url = await getSignedUrl(
      getS3Client(),
      new GetObjectCommand({ Bucket, Key: found.s3_key }),
      { expiresIn: 300 },
    );

    return c.json({ url });
  });

  return app;
}
