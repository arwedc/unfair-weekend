import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth, userKeys } from '@/features/auth/auth-context';
import { offerKeys } from '@/features/offers/queries';

import { cancelVoucher, claimVoucher, fetchMyVouchers } from './api';

/** Eigene Codes. Lädt nur, wenn jemand angemeldet ist. */
export function useMyVouchers() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: userKeys.vouchers(userId ?? 'anon'),
    queryFn: fetchMyVouchers,
    enabled: userId !== null,
  });
}

/** Der aktive Code des Nutzers für ein Angebot, falls es einen gibt. */
export function useActiveVoucherForOffer(offerId: string) {
  const { data } = useMyVouchers();
  return (
    data?.find((voucher) => voucher.offer_id === offerId && voucher.status === 'aktiv') ?? null
  );
}

/** Nach Holen oder Stornieren ändern sich Codes, freie Plätze und evtl. die Sperre. */
function useRefreshAfterVoucherChange() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: userKeys.all }),
      queryClient.invalidateQueries({ queryKey: offerKeys.all }),
    ]);
}

export function useClaimVoucher() {
  const refresh = useRefreshAfterVoucherChange();
  return useMutation({
    mutationFn: ({ offerId, seats }: { offerId: string; seats: number }) =>
      claimVoucher(offerId, seats),
    // Auch bei Fehlern neu laden: „ausgebucht“ heißt, unsere Zahlen waren veraltet.
    onSettled: refresh,
  });
}

export function useCancelVoucher() {
  const refresh = useRefreshAfterVoucherChange();
  return useMutation({ mutationFn: cancelVoucher, onSettled: refresh });
}
