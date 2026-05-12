'use client';
import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { showXpToast, type XpDelta } from '@/components/xp-toast';
import { PhotoTile } from '@/components/photo-tile';
import { apiFetch } from '@/lib/api-client';
import { todayStr } from '@/lib/dates';
import { AnalyseButton } from '@/components/analyse-button';
import type { Photo, PhotoTag } from '@lifeos/shared';

// ─── Photo tags ───────────────────────────────────────────────────────────────

const ALL_TAGS: PhotoTag[] = [
  'face',
  'profile_left',
  'profile_right',
  'three_quarter',
  'back',
  'posture',
  'skin',
  'hair',
  'smile',
  'fit',
  'outfit',
  'body_front',
  'body_back',
  'body_side',
];

const TAG_LABELS: Record<PhotoTag, string> = {
  face: 'Visage',
  profile_left: 'Profil gauche',
  profile_right: 'Profil droit',
  three_quarter: '3/4',
  back: 'Dos',
  posture: 'Posture',
  skin: 'Peau',
  hair: 'Cheveux',
  smile: 'Sourire',
  fit: 'Fit',
  outfit: 'Tenue',
  body_front: 'Corps (face)',
  body_back: 'Corps (dos)',
  body_side: 'Corps (profil)',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LooksmaxPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<PhotoTag[]>([]);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [filterTag, setFilterTag] = useState<PhotoTag | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = todayStr();

  // Load photos
  const loadPhotos = (tag: PhotoTag | null = filterTag) => {
    setLoadingPhotos(true);
    const query = tag ? `?tag=${tag}` : '';
    apiFetch<{ items: Photo[] }>(`/photos${query}`)
      .then((res) => setPhotos(res.items))
      .catch(() => setPhotos([]))
      .finally(() => setLoadingPhotos(false));
  };

  useEffect(() => {
    loadPhotos(filterTag);
  }, [filterTag]); // loadPhotos is stable within filter changes

  // File picker
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const toggleTag = (tag: PhotoTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleUpload = async () => {
    if (!file) return;
    if (selectedTags.length === 0) {
      toast.error('Sélectionne au moins un tag.');
      return;
    }
    setUploading(true);
    try {
      // 1. Get presigned upload URL
      const presign = await apiFetch<{ photoId: string; key: string; uploadUrl: string }>(
        '/photos/presign',
        {
          method: 'POST',
          body: JSON.stringify({ contentType: file.type, tag: selectedTags[0] }),
        },
      );

      // 2. PUT directly to S3 (no auth header, direct signed URL)
      const putRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!putRes.ok) throw new Error(`Upload S3 échoué: ${putRes.status}`);

      // 3. Confirm
      const photo = await apiFetch<Photo & { xp_deltas?: XpDelta[] }>('/photos', {
        method: 'POST',
        body: JSON.stringify({
          photoId: presign.photoId,
          key: presign.key,
          date: today,
          tags: selectedTags,
          ...(notes ? { notes } : {}),
        }),
      });

      if (photo.xp_deltas && photo.xp_deltas.length > 0) {
        const total = photo.xp_deltas.reduce((s, d) => s + d.amount, 0);
        showXpToast(photo.xp_deltas, total);
      } else {
        toast.success('Photo uploadée !');
      }

      // Reset
      setFile(null);
      setPreview(null);
      setSelectedTags([]);
      setNotes('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadPhotos(null);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'upload. Réessaie.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display tracking-widest text-2xl text-text-DEFAULT">Looksmax</h1>
        <AnalyseButton scope="looksmax" days={90} />
      </div>

      {/* ── Upload section ── */}
      <section className="rounded-lg border border-bg-strong bg-bg-subtle p-5 space-y-4">
        <h2 className="font-display tracking-widest text-xs text-accent-appearance uppercase">
          Nouvelle photo
        </h2>

        {/* File picker */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            id="photo-input"
          />
          <label
            htmlFor="photo-input"
            className="flex items-center justify-center gap-2 cursor-pointer rounded-lg border-2 border-dashed border-bg-strong hover:border-accent-appearance/50 transition-colors p-6 text-text-muted text-sm"
          >
            <Upload size={18} />
            {file ? file.name : 'Choisir une image…'}
          </label>
        </div>

        {/* Preview */}
        {preview && (
          <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-bg-strong">
            <img src={preview} alt="preview" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => { setFile(null); setPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="absolute top-1 right-1 bg-bg-DEFAULT/80 rounded-full p-0.5 text-text-muted hover:text-accent-force"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Tags */}
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Tags</p>
          <div className="flex flex-wrap gap-2">
            {ALL_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-accent-appearance text-bg-DEFAULT'
                    : 'bg-bg-strong text-text-muted hover:text-text-DEFAULT'
                }`}
              >
                {TAG_LABELS[tag]}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs text-text-muted uppercase tracking-wide">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contexte, éclairage…"
            className="mt-1 w-full rounded bg-bg-strong border border-bg-strong focus:border-accent-appearance/50 outline-none px-3 py-2 text-sm text-text-DEFAULT placeholder:text-text-muted"
          />
        </div>

        {/* Upload button */}
        <button
          type="button"
          disabled={!file || uploading}
          onClick={handleUpload}
          className="w-full rounded-lg bg-accent-appearance text-bg-DEFAULT font-bold py-2.5 text-sm tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {uploading && <Loader2 size={14} className="animate-spin" />}
          Uploader
        </button>
      </section>

      {/* ── Gallery ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display tracking-widest text-xs text-accent-appearance uppercase">
            Galerie
          </h2>
          {filterTag && (
            <button
              type="button"
              onClick={() => setFilterTag(null)}
              className="text-xs text-text-muted hover:text-text-DEFAULT flex items-center gap-1"
            >
              <X size={12} /> Effacer le filtre
            </button>
          )}
        </div>

        {/* Tag filter chips */}
        <div className="flex flex-wrap gap-2">
          {ALL_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setFilterTag(filterTag === tag ? null : tag)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                filterTag === tag
                  ? 'bg-accent-appearance text-bg-DEFAULT'
                  : 'bg-bg-strong text-text-muted hover:text-text-DEFAULT'
              }`}
            >
              {TAG_LABELS[tag]}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loadingPhotos ? (
          <div className="flex items-center justify-center h-40 text-text-muted">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : photos.length === 0 ? (
          <div className="rounded-lg border border-bg-strong bg-bg-subtle p-8 text-center">
            <div className="text-3xl mb-3">📷</div>
            <p className="text-text-muted text-sm">
              {filterTag
                ? `Aucune photo avec le tag "${TAG_LABELS[filterTag]}".`
                : 'Aucune photo enregistrée. Uploade ta première photo ci-dessus.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((p) => (
              <PhotoTile key={p.id} photo={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
