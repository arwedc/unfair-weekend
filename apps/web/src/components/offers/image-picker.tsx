'use client';

import { useRef, useState } from 'react';
import { OFFER_LIMITS, STORAGE_BUCKETS, STORAGE_LIMITS } from '@repo/shared';
import { storageImageUrl } from '@repo/shared/utils';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/context';
import { SUPABASE_URL } from '@/lib/supabase/env';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Bilder fürs Angebot: lädt direkt in den Bucket `offer-images` unter `<location_id>/…`
 * und gibt die Pfade als versteckte Felder `image_paths` ans Formular. Das erste Bild ist das Titelbild.
 */
export function ImagePicker({
  locationId,
  initialPaths,
  error,
}: {
  locationId: string;
  initialPaths: string[];
  error?: string;
}) {
  const { t } = useT();
  const m = t.offers.images;
  const [paths, setPaths] = useState<string[]>(initialPaths);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const remaining = OFFER_LIMITS.imagesMax - paths.length;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    const selected = Array.from(files).slice(0, remaining);
    const allowed: readonly string[] = STORAGE_LIMITS.allowedImageTypes;

    for (const file of selected) {
      if (!allowed.includes(file.type)) {
        setUploadError(m.onlyTypes);
        return;
      }
      if (file.size > STORAGE_LIMITS.offerImageMaxBytes) {
        setUploadError(m.tooLarge);
        return;
      }
    }

    setUploading(true);
    const supabase = createClient();
    const uploaded: string[] = [];
    for (const file of selected) {
      const path = `${locationId}/${crypto.randomUUID()}.${EXTENSIONS[file.type] ?? 'jpg'}`;
      const { error: err } = await supabase.storage
        .from(STORAGE_BUCKETS.offerImages)
        .upload(path, file, { contentType: file.type });
      if (err) {
        setUploadError(m.uploadFailed);
        break;
      }
      uploaded.push(path);
    }
    setPaths((prev) => [...prev, ...uploaded]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  const makeCover = (index: number) =>
    setPaths((prev) => [prev[index]!, ...prev.filter((_, i) => i !== index)]);
  const remove = (index: number) => setPaths((prev) => prev.filter((_, i) => i !== index));

  const shownError = uploadError ?? error;

  return (
    <div>
      <p className="mb-1.5 text-subhead text-text-primary">
        {m.label} <span className="text-text-tertiary">{t.common.optional}</span>
      </p>
      {paths.map((p) => (
        <input key={p} type="hidden" name="image_paths" value={p} />
      ))}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {paths.map((p, i) => (
          <figure
            key={p}
            className="group relative aspect-[4/3] overflow-hidden rounded-image border border-border-subtle bg-background-muted"
          >
            {/* Bilder liegen in Supabase Storage, next/image bräuchte dafür extra Konfiguration. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={storageImageUrl(SUPABASE_URL, STORAGE_BUCKETS.offerImages, p)}
              alt={i === 0 ? m.cover : m.imageN(i + 1)}
              className="h-full w-full object-cover"
            />
            {i === 0 ? (
              <span className="absolute left-1.5 top-1.5 rounded-badge bg-badge-deal-background px-1.5 py-0.5 text-caption text-badge-deal-foreground">
                {m.cover}
              </span>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-background-inverse/60 p-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              {i > 0 ? (
                <button
                  type="button"
                  onClick={() => makeCover(i)}
                  className="rounded-badge px-1.5 py-0.5 text-caption text-text-inverse hover:bg-background-inverse/60"
                >
                  {m.makeCover}
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded-badge px-1.5 py-0.5 text-caption text-text-inverse hover:bg-background-inverse/60"
                aria-label={m.removeN(i + 1)}
              >
                {m.remove}
              </button>
            </div>
          </figure>
        ))}

        {remaining > 0 ? (
          <label
            className={`flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-image border border-dashed p-2 text-center transition-colors ${
              shownError
                ? 'border-status-error-solid'
                : 'border-border-strong hover:border-accent-vivid hover:bg-accent-subtle'
            } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
          >
            <span className="text-title3 text-text-tertiary" aria-hidden>
              +
            </span>
            <span className="text-footnote text-text-secondary">
              {uploading ? m.uploading : m.add}
            </span>
            <input
              ref={inputRef}
              type="file"
              accept={STORAGE_LIMITS.allowedImageTypes.join(',')}
              multiple
              className="sr-only"
              disabled={uploading}
              onChange={(e) => void handleFiles(e.target.files)}
            />
          </label>
        ) : null}
      </div>

      {shownError ? (
        <p className="mt-1.5 text-footnote text-status-error-text">{shownError}</p>
      ) : (
        <p className="mt-1.5 text-footnote text-text-tertiary">{m.hint(OFFER_LIMITS.imagesMax)}</p>
      )}
    </div>
  );
}
