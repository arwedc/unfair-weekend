import { bookingMode } from '@repo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth, userKeys } from '@/features/auth/auth-context';
import { offerKeys } from '@/features/offers/queries';
import { supabase } from '@/lib/supabase';

import {
  cancelPaidBooking,
  fetchMyPaidBookings,
  fetchPaidBooking,
  fetchPaymentSettings,
  startPaidBooking,
} from './api';
import type { PaidBooking } from './checkout-logic';

export const paymentKeys = {
  settings: ['payment-settings'] as const,
  booking: (bookingId: string) => ['paid-booking', bookingId] as const,
  mine: (userId: string) => [...userKeys.all, userId, 'paid-bookings'] as const,
};

export function usePaymentSettings() {
  return useQuery({
    queryKey: paymentKeys.settings,
    queryFn: fetchPaymentSettings,
    staleTime: 60_000,
  });
}

/**
 * „code“ (Variante A) oder „bezahlung“ (Variante B). Solange die Einstellungen laden oder
 * fehlen, gilt Variante A. Der Server entscheidet trotzdem selbst.
 */
export function useBookingMode() {
  const { data } = usePaymentSettings();
  return bookingMode(data);
}

/** Eigene bezahlte Buchungen, z. B. für „Bezahlt“ in der Code-Ansicht. */
export function useMyPaidBookings(options: { enabled?: boolean } = {}) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: paymentKeys.mine(userId ?? 'anon'),
    queryFn: fetchMyPaidBookings,
    enabled: (options.enabled ?? true) && userId !== null,
  });
}

/**
 * Eine Buchung live beobachten. Realtime meldet Änderungen sofort; solange wir auf den
 * Webhook warten, fragt die App zusätzlich alle paar Sekunden nach (falls Realtime hängt).
 */
export function useLivePaidBooking(bookingId: string | null, options: { poll: boolean }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: paymentKeys.booking(bookingId ?? ''),
    queryFn: () => fetchPaidBooking(bookingId ?? ''),
    enabled: bookingId !== null,
    // Nachfragen nur, solange die Bestätigung aussteht.
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return options.poll &&
        (status === undefined || status === 'reserviert' || status === 'abgelaufen')
        ? 3000
        : false;
    },
  });

  useEffect(() => {
    if (!bookingId) return;
    const channel = supabase
      .channel(`paid-booking:${bookingId}`)
      .on<PaidBooking>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'paid_bookings', filter: `id=eq.${bookingId}` },
        (payload) => {
          queryClient.setQueryData(paymentKeys.booking(bookingId), payload.new);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bookingId, queryClient]);

  return query;
}

/** Nach Buchen oder Stornieren ändern sich Codes, freie Plätze und Buchungen. */
function useRefreshAfterBooking() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: userKeys.all }),
      queryClient.invalidateQueries({ queryKey: offerKeys.all }),
    ]);
}

export function useStartPaidBooking() {
  return useMutation({
    mutationFn: ({ offerId, seats }: { offerId: string; seats: number }) =>
      startPaidBooking(offerId, seats),
  });
}

export function useCancelPaidBooking() {
  const queryClient = useQueryClient();
  const refresh = useRefreshAfterBooking();
  return useMutation({
    mutationFn: cancelPaidBooking,
    onSettled: (_data, _error, bookingId) =>
      Promise.all([
        refresh(),
        queryClient.invalidateQueries({ queryKey: paymentKeys.booking(bookingId) }),
      ]),
  });
}

export { useRefreshAfterBooking };
