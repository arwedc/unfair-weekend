'use client';

import { useActionState, useRef, useState } from 'react';
import { OFFER_LIMITS, STORAGE_BUCKETS, STORAGE_LIMITS } from '@repo/shared';
import { storageImageUrl } from '@repo/shared/utils';
import { Button, Card } from '@/components/ui';
import { useT } from '@/lib/i18n/context';
import { createClient } from '@/lib/supabase/client';
import { SUPABASE_URL } from '@/lib/supabase/env';
import type { LocationImagesState } from '@/app/(portal)/profil/actions';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function LocationImages({
  locationId,
  initialPaths,
  action,
}: {
  locationId: string;
  initialPaths: string[];
  action: (prev: LocationImagesState, formData: FormData) => Promise<LocationImagesState>;
}) {
  const { t } = useT();
  const m = t.profile.locationImages;
  const [state, formAction, pending] = useActionState(action, { paths: initialPaths });
  const [pathsOverride, setPathsOverride] = useState<string[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const paths = pathsOverride ?? state.paths;
  const remaining = OFFER_LIMITS.imagesMax - paths.length;

  function updatePaths(update: (current: string[]) => string[]) {
    setPathsOverride((current) => update(current ?? state.paths));
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length || remaining <= 0) return;
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
      const { error } = await supabase.storage
        .from(STORAGE_BUCKETS.offerImages)
        .upload(path, file, { contentType: file.type });
      if (error) {
        setUploadError(m.uploadFailed);
        break;
      }
      uploaded.push(path);
    }
    updatePaths((current) => [...current, ...uploaded]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  function remove(path: string) {
    updatePaths((current) => current.filter((item) => item !== path));
    if (!initialPaths.includes(path)) {
      void createClient().storage.from(STORAGE_BUCKETS.offerImages).remove([path]);
    }
  }

  const error = uploadError ?? state.error;

  return (
    <form action={formAction}>
      <Card className="mt-6 space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-headline text-text-primary">{m.title}</h2>
          <p className="mt-1 text-subhead text-text-secondary">{m.intro}</p>
        </div>

        {paths.map((path) => (
          <input key={path} type="hidden" name="image_paths" value={path} />
        ))}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {paths.map((path, index) => (
            <figure
              key={path}
              className="group relative aspect-[4/3] overflow-hidden rounded-image border border-border-subtle bg-background-muted"
            >
              {/* Bilder liegen in Supabase Storage, next/image bräuchte dafür extra Konfiguration. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={storageImageUrl(SUPABASE_URL, STORAGE_BUCKETS.offerImages, path)}
                alt={index === 0 ? m.main : m.imageN(index + 1)}
                className="h-full w-full object-cover"
              />
              {index === 0 ? (
                <span className="absolute left-1.5 top-1.5 rounded-badge bg-badge-deal-background px-1.5 py-0.5 text-caption text-badge-deal-foreground">
                  {m.main}
                </span>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-background-inverse/60 p-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                {index > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      updatePaths((current) => [
                        current[index]!,
                        ...current.filter((_, pathIndex) => pathIndex !== index),
                      ])
                    }
                    className="rounded-badge px-1.5 py-0.5 text-caption text-text-inverse hover:bg-background-inverse/60"
                  >
                    {m.makeMain}
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => remove(path)}
                  className="rounded-badge px-1.5 py-0.5 text-caption text-text-inverse hover:bg-background-inverse/60"
                  aria-label={m.removeN(index + 1)}
                >
                  {m.remove}
                </button>
              </div>
            </figure>
          ))}

          {remaining > 0 ? (
            <label
              className={`flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-image border border-dashed p-2 text-center transition-colors ${
                error
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
                onChange={(event) => void handleFiles(event.target.files)}
              />
            </label>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-footnote text-status-error-text">
            {error}
          </p>
        ) : state.saved && paths.join('|') === state.paths.join('|') ? (
          <p role="status" className="text-footnote text-status-success-text">
            {m.saved}
          </p>
        ) : (
          <p className="text-footnote text-text-tertiary">{m.hint(OFFER_LIMITS.imagesMax)}</p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending || uploading}>
            {pending ? t.common.saving : m.save}
          </Button>
        </div>
      </Card>
    </form>
  );
}
