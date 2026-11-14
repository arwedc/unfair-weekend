/** Bilanz fürs Profil: gespart, erlebt, bewertet, Stempel. Lädt nur, wenn jemand angemeldet ist. */
import type { OfferCategory } from '@repo/shared';
import { useQueries } from '@tanstack/react-query';

import { fetchOffer } from '@/features/offers/api';
import { offerKeys } from '@/features/offers/queries';
import { useMyReviews } from '@/features/reviews/queries';
import { useMyVouchers } from '@/features/vouchers/queries';

import { redeemedVouchers, savedCents, stampOrder } from './profile-logic';

/** Ein Stempel auf der Karte: ein eingelöster Code und die Kategorie seines Angebots. */
export interface Stamp {
  id: string;
  /** null, solange das Angebot noch lädt oder nicht mehr sichtbar ist */
  category: OfferCategory | null;
}

export function useProfileStats() {
  const vouchers = useMyVouchers();
  const reviews = useMyReviews();

  const redeemed = redeemedVouchers(vouchers.data ?? []);
  // Preise der eingelösten Angebote. get_offer zeigt Angebote, zu denen man einen Code hat,
  // auch wenn sie schon vorbei sind. Gleiche Angebote nur einmal laden.
  const offerIds = [...new Set(redeemed.map((voucher) => voucher.offer_id))];
  const offers = useQueries({
    queries: offerIds.map((id) => ({
      queryKey: offerKeys.detail(id),
      queryFn: () => fetchOffer(id),
      staleTime: 10 * 60_000,
    })),
  });

  const prices = new Map(
    offers.flatMap((query) => (query.data ? [[query.data.id, query.data] as const] : [])),
  );

  const stamps: Stamp[] = stampOrder(vouchers.data ?? []).map((voucher) => ({
    id: voucher.id,
    category: prices.get(voucher.offer_id)?.category ?? null,
  }));

  return {
    isPending: vouchers.isPending || reviews.isPending,
    stamps,
    savedCents: savedCents(redeemed, prices),
    experienced: redeemed.length,
    reviewed: reviews.data?.length ?? 0,
  };
}
