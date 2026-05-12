import { describe, expect, it } from 'vitest';
import { PhotoPresignInput, PhotoConfirmInput, Photo } from '../src/photo';

describe('Photo schemas', () => {
  it('accepts a valid presign request', () => {
    const result = PhotoPresignInput.parse({ contentType: 'image/jpeg', tag: 'face' });
    expect(result.contentType).toBe('image/jpeg');
  });

  it('rejects PhotoConfirmInput with empty tags array (min 1)', () => {
    expect(() =>
      PhotoConfirmInput.parse({
        photoId: 'ph_abc',
        key: 'photos/abc.jpg',
        date: '2026-05-11',
        tags: [],
      }),
    ).toThrow();
  });

  it('accepts a valid PhotoConfirmInput', () => {
    const result = PhotoConfirmInput.parse({
      photoId: 'ph_abc',
      key: 'photos/abc.jpg',
      date: '2026-05-11',
      tags: ['face', 'smile'],
    });
    expect(result.tags).toHaveLength(2);
  });

  it('accepts a full Photo object', () => {
    const result = Photo.parse({
      id: 'ph_abc',
      date: '2026-05-11',
      s3_key: 'photos/abc.jpg',
      tags: ['body_front'],
      created_at: 1715430000000,
    });
    expect(result.id).toBe('ph_abc');
  });
});
