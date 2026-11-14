import type { Tables } from '@repo/shared';

type ArchiveFields = Pick<Tables<'offers'>, 'status' | 'ends_at' | 'relevant_at'>;

export type OfferView = 'aktuell' | 'archiv';

/** `?ansicht=archiv` öffnet das Archiv, alles andere die aktuellen Angebote. */
export function parseOfferView(value: string | undefined): OfferView {
  return value === 'archiv' ? 'archiv' : 'aktuell';
}

/** Zeitlich vorbei: Einzeltermin zu Ende bzw. Zeitraum abgelaufen. */
export function isOfferEnded(offer: Pick<ArchiveFields, 'ends_at'>, now: Date): boolean {
  return Date.parse(offer.ends_at) <= now.getTime();
}

/** Ins Archiv gehören abgesagte, entfernte und beendete Angebote. */
export function isOfferArchived(offer: Pick<ArchiveFields, 'status' | 'ends_at'>, now: Date) {
  return offer.status !== 'aktiv' || isOfferEnded(offer, now);
}

/**
 * Teilt die Angebote auf. Aktuelle: als Nächstes relevant zuerst.
 * Archiv: zuletzt relevant zuerst.
 */
export function splitOffers<T extends ArchiveFields>(
  offers: readonly T[],
  now: Date,
): { current: T[]; archived: T[] } {
  // relevant_at ist generiert und daher im Typ nullable, ends_at als Rückfall.
  const at = (o: T) => Date.parse(o.relevant_at ?? o.ends_at);
  const byRelevance = (a: T, b: T) => at(a) - at(b);
  const current = offers.filter((o) => !isOfferArchived(o, now)).sort(byRelevance);
  const archived = offers.filter((o) => isOfferArchived(o, now)).sort((a, b) => byRelevance(b, a));
  return { current, archived };
}
