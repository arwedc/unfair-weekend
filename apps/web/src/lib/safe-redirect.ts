/** Name des Query-Parameters für den Rücksprung nach dem Login. */
export const NEXT_PARAM = 'weiter';

/**
 * Ziel nach dem Login, nur innerhalb der Website. Nimmt ausschließlich Pfade wie
 * `/einloesen/abc`, damit niemand über einen präparierten Link auf fremde Seiten umleitet.
 */
export function safeNext(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 300) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  if (value.startsWith('/login')) return null;
  return value;
}

/** `/login` mit Rücksprungziel (falls gültig) und optionalem Grund. */
export function loginUrl(next?: string | null, reason?: string): string {
  const params = new URLSearchParams();
  if (reason) params.set('grund', reason);
  const target = safeNext(next);
  if (target) params.set(NEXT_PARAM, target);
  const query = params.toString();
  return query ? `/login?${query}` : '/login';
}
