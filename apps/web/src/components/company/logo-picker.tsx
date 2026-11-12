'use client';

import { useRef, useState } from 'react';
import { STORAGE_BUCKETS, STORAGE_LIMITS } from '@repo/shared';
import { storageImageUrl } from '@repo/shared/utils';
import { createClient } from '@/lib/supabase/client';
import { SUPABASE_URL } from '@/lib/supabase/env';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Logo des Unternehmens: lädt direkt in den Bucket `company-logos` unter `<company_id>/…`
 * und gibt den Pfad als verstecktes Feld `logo_path` ans Formular. Gespeichert wird er erst
 * mit dem Formular (update_my_company).
 */
export function LogoPicker({
  companyId,
  companyName,
  initialPath,
  savedPath,
  error,
}: {
  companyId: string;
  companyName: string;
  /** Startwert im Formular (nach einem Fehler die letzte Eingabe). */
  initialPath: string;
  /** Logo, das gerade in der DB steht. */
  savedPath: string;
  error?: string;
}) {
  const [path, setPath] = useState(initialPath);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Noch nicht gespeicherten Upload wieder löschen, wenn er ersetzt oder entfernt wird. */
  function discardUnsaved(oldPath: string) {
    if (!oldPath || oldPath === savedPath || !oldPath.startsWith(`${companyId}/`)) return;
    void createClient().storage.from(STORAGE_BUCKETS.companyLogos).remove([oldPath]);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    const allowed: readonly string[] = STORAGE_LIMITS.allowedImageTypes;
    if (!allowed.includes(file.type)) {
      setUploadError('Nur JPEG, PNG oder WebP.');
      return;
    }
    if (file.size > STORAGE_LIMITS.companyLogoMaxBytes) {
      setUploadError('Das Logo darf höchstens 2 MB groß sein.');
      return;
    }

    setUploading(true);
    // Neuer Dateiname pro Upload, damit kein altes Logo aus dem Cache kommt.
    const newPath = `${companyId}/${crypto.randomUUID()}.${EXTENSIONS[file.type] ?? 'jpg'}`;
    const { error: err } = await createClient()
      .storage.from(STORAGE_BUCKETS.companyLogos)
      .upload(newPath, file, { contentType: file.type });
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
    if (err) {
      setUploadError('Hochladen hat nicht geklappt. Bitte erneut versuchen.');
      return;
    }
    discardUnsaved(path);
    setPath(newPath);
  }

  const shownError = uploadError ?? error;
  const changed = path !== savedPath;
  const initial = companyName.trim().charAt(0).toUpperCase() || '?';

  return (
    <div>
      <p className="mb-1.5 text-subhead text-text-primary">Logo</p>
      <input type="hidden" name="logo_path" value={path} />

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-image border border-border-subtle bg-background-muted">
          {path ? (
            // Logos liegen in Supabase Storage, next/image bräuchte dafür extra Konfiguration.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={storageImageUrl(SUPABASE_URL, STORAGE_BUCKETS.companyLogos, path)}
              alt={`Logo von ${companyName}`}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-title2 font-bold text-text-tertiary" aria-hidden>
              {initial}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <label
            className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-button border border-border-strong bg-surface-default px-5 text-subhead font-semibold text-text-primary transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-border-focus hover:bg-background-muted ${
              uploading ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            {uploading ? 'Lädt hoch …' : path ? 'Anderes Logo wählen' : 'Logo hochladen'}
            <input
              ref={inputRef}
              type="file"
              accept={STORAGE_LIMITS.allowedImageTypes.join(',')}
              className="sr-only"
              disabled={uploading}
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </label>
          {path ? (
            <button
              type="button"
              onClick={() => {
                discardUnsaved(path);
                setPath('');
                setUploadError(null);
              }}
              disabled={uploading}
              className="inline-flex min-h-11 items-center justify-center rounded-button px-5 text-subhead font-semibold text-text-secondary transition-colors hover:bg-background-muted hover:text-text-primary disabled:opacity-60"
            >
              Logo entfernen
            </button>
          ) : null}
        </div>
      </div>

      {shownError ? (
        <p className="mt-1.5 text-footnote text-status-error-text">{shownError}</p>
      ) : changed ? (
        <p className="mt-1.5 text-footnote text-text-accent">
          Wird mit „Änderungen speichern“ übernommen.
        </p>
      ) : (
        <p className="mt-1.5 text-footnote text-text-tertiary">
          Quadratisch wirkt am besten. JPEG, PNG oder WebP, höchstens 2 MB.
        </p>
      )}
    </div>
  );
}
