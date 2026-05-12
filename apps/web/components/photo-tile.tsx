'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { Photo } from '@lifeos/shared';

export function PhotoTile({ photo }: { photo: Photo }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ url: string }>(`/photos/${photo.id}/url`)
      .then((r) => setUrl(r.url))
      .catch(() => setUrl(null));
  }, [photo.id]);

  return (
    <div className="rounded-lg overflow-hidden border border-bg-strong bg-bg-subtle">
      <div className="aspect-square bg-bg-strong relative">
        {url ? (
          <img
            src={url}
            alt={photo.tags.join(', ')}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted text-2xl">
            📷
          </div>
        )}
      </div>
      <div className="p-2 text-xs text-text-muted">
        <div className="font-mono">{photo.date}</div>
        <div className="truncate mt-0.5 text-text-DEFAULT/70">
          {photo.tags.join(' • ')}
        </div>
      </div>
    </div>
  );
}
