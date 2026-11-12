import type { StorageBucket } from '../constants/status';

/**
 * Öffentliche URL eines Bildes. In der DB stehen Storage-Pfade
 * (z. B. `<location_id>/bild.jpg`); Seed-Daten enthalten absolute URLs.
 * Beides wird hier zu einer anzeigbaren URL.
 *
 * @example storageImageUrl(env.SUPABASE_URL, 'offer-images', offer.cover_image_path)
 */
export function storageImageUrl(
  supabaseUrl: string,
  bucket: StorageBucket,
  pathOrUrl: string,
): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = supabaseUrl.replace(/\/+$/, '');
  const path = pathOrUrl
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
