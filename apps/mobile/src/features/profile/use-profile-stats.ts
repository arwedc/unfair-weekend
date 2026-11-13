/** Bilanz fürs Profil: gespart, erlebt, bewertet. Lädt nur, wenn jemand angemeldet ist. */
import { useQueries } from '@tanstack/react-query';

import { fetchOffer } from '@/features/offers/api';
import { offerKeys } from '@/features/offers/queries';
import { useMyReviews } from '@/features/reviews/queries';
import { useMyVouchers } from '@/features/vouchers/queries';

import { redeemedVouchers, savedCents } from './profile-logic';

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

  return {
    isPending: vouchers.isPending || reviews.isPending,
    savedCents: savedCents(redeemed, prices),
    experienced: redeemed.length,
    reviewed: reviews.data?.length ?? 0,
  };
}
