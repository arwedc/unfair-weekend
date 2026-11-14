/** Reine Logik für den Tab „Favoriten“: was es an den Lieblingsorten gerade gibt und in welcher Reihenfolge. */

/** Was ein Angebot für die Übersicht mitbringen muss. */
export interface FavoriteOfferInput {
  id: string;
  location_id: string;
  relevant_at: string;
  cover_image_path: string;
  free_seats: number;
}

/** Angebote an einem Lieblingsort. */
export interface FavoriteOfferSummary<T extends FavoriteOfferInput> {
  /** Angebote mit freien Plätzen. */
  count: number;
  /** Das nächste Angebot mit freien Plätzen (frühester `relevant_at`). */
  next: T | null;
}

/**
 * Fasst die Angebote je Lieblingsort zusammen. Ausgebuchte Angebote zählen nicht,
 * Orte ohne Angebot bekommen `{ count: 0, next: null }`.
 */
export function summarizeFavoriteOffers<T extends FavoriteOfferInput>(
  offers: readonly T[],
  locationIds: readonly string[],
): Map<string, FavoriteOfferSummary<T>> {
  const summary = new Map<string, FavoriteOfferSummary<T>>(
    locationIds.map((id) => [id, { count: 0, next: null }]),
  );
  for (const offer of offers) {
    const entry = summary.get(offer.location_id);
    if (!entry || offer.free_seats <= 0) continue;
    entry.count += 1;
    if (!entry.next || Date.parse(offer.relevant_at) < Date.parse(entry.next.relevant_at)) {
      entry.next = offer;
    }
  }
  return summary;
}

/** Bild für die Karte: erstes Foto der Standortgalerie, sonst das Titelbild des nächsten Angebots. */
export function favoriteCoverPath(
  galleryPaths: readonly string[] | null | undefined,
  next: Pick<FavoriteOfferInput, 'cover_image_path'> | null,
): string | null {
  const gallery = galleryPaths?.find((path) => path.trim() !== '');
  if (gallery) return gallery;
  const cover = next?.cover_image_path.trim();
  return cover ? cover : null;
}

/**
 * Reihenfolge der Karten: Orte mit freien Angeboten zuerst (das bald Nächste oben),
 * danach die übrigen alphabetisch nach Firmenname.
 */
export function sortFavorites<L extends { id: string; company_name: string }>(
  locations: readonly L[],
  summary: ReadonlyMap<string, FavoriteOfferSummary<FavoriteOfferInput>>,
  locale = 'de',
): L[] {
  const nextAt = (id: string): number => {
    const next = summary.get(id)?.next;
    return next ? Date.parse(next.relevant_at) : Number.POSITIVE_INFINITY;
  };
  return [...locations].sort((a, b) => {
    const atA = nextAt(a.id);
    const atB = nextAt(b.id);
    if (atA !== atB) return atA < atB ? -1 : 1;
    return a.company_name.localeCompare(b.company_name, locale);
  });
}
