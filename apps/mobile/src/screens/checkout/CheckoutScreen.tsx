import {
  bookingAmountCents,
  clockOffsetMs,
  formatCountdown,
  formatPrice,
  reservationSecondsLeft,
} from '@repo/shared';
import { PaymentSheet, PaymentSheetError, useStripe } from '@stripe/stripe-react-native';
import { Stack, useRouter } from 'expo-router';
import { CircleCheck, CloudOff, CreditCard, Lock, TimerOff, Undo2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Button, EmptyState, ListRow, Skeleton, Text } from '@/components/ui';
import { cancelPolicyText, offerWhenText } from '@/features/offers/feed-logic';
import { useOffer, useSettings } from '@/features/offers/queries';
import { cancelPaidBooking, type StartedPaidBooking } from '@/features/payments/api';
import {
  checkoutPhase,
  isTimerUrgent,
  shouldReleaseOnLeave,
} from '@/features/payments/checkout-logic';
import {
  useLivePaidBooking,
  useRefreshAfterBooking,
  useStartPaidBooking,
} from '@/features/payments/queries';
import { paymentsAvailable, stripeReturnUrl } from '@/features/payments/stripe-provider';
import { askForPushAfterClaim } from '@/features/push/push';
import { seatsText } from '@/features/vouchers/voucher-logic';
import { errorMessage, isOffline } from '@/lib/api-error';
import { haptics } from '@/lib/haptics';
import { useT } from '@/lib/i18n/context';
import { colors, layout, radii, radius, shadow, space, textStyle } from '@/theme';

/** Sekündlich tickende Uhr, solange `active` ist (für den Reservierungs-Timer). */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/**
 * Bezahlen (Variante B): Plätze reservieren, Timer, PaymentSheet, dann live auf die
 * Bestätigung durch den Webhook warten und zum Code springen.
 */
export function CheckoutScreen({ offerId, seats }: { offerId: string; seats: number }) {
  const router = useRouter();
  const { t, locale } = useT();
  const m = t.parts.pay;
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { data: offer, error: offerError, isPending, refetch } = useOffer(offerId);
  const { data: settings } = useSettings();
  const start = useStartPaidBooking();
  const refresh = useRefreshAfterBooking();

  const [started, setStarted] = useState<StartedPaidBooking | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const bookingId = started?.booking_id ?? null;
  const live = useLivePaidBooking(bookingId, { poll: submitted });
  const booking = live.data ?? null;
  const reservedUntil = booking?.reserved_until ?? started?.reserved_until ?? null;
  const now = useNow(reservedUntil !== null && !submitted);
  const secondsLeft = reservedUntil ? reservationSecondsLeft(reservedUntil, now, offsetMs) : 0;
  // Bis die Zeile per Realtime/Abfrage da ist, gilt die Antwort der Function (reserviert).
  const phase = checkoutPhase({
    booking: booking ?? (started ? { status: 'reserviert', cancel_reason: null } : null),
    submitted,
    secondsLeft,
  });

  // Verlässt jemand den Screen mit offener Reservierung, werden die Plätze sofort frei
  // (sonst erst nach Ablauf des Timers per Cron).
  const leaveRef = useRef<{ bookingId: string | null; release: boolean }>({
    bookingId: null,
    release: false,
  });
  useEffect(() => {
    leaveRef.current = { bookingId, release: shouldReleaseOnLeave(phase) };
  }, [bookingId, phase]);
  useEffect(() => {
    const leave = leaveRef;
    return () => {
      const { bookingId: id, release } = leave.current;
      if (id && release) void cancelPaidBooking(id).catch(() => undefined);
    };
  }, []);

  // Bezahlt: Code anzeigen.
  const voucherId = booking?.voucher_id ?? null;
  useEffect(() => {
    if (phase !== 'bezahlt') return;
    haptics.success();
    void refresh();
    const id = setTimeout(() => {
      if (voucherId) router.replace({ pathname: '/code/[id]', params: { id: voucherId } });
      else router.replace('/codes');
      void askForPushAfterClaim();
    }, 1200);
    return () => clearTimeout(id);
  }, [phase, voucherId, refresh, router]);

  const openPaymentSheet = async (booking: StartedPaidBooking) => {
    setPresenting(true);
    setPayError(null);
    try {
      const init = await initPaymentSheet({
        paymentIntentClientSecret: booking.client_secret,
        merchantDisplayName: 'unfair weekend',
        returnURL: stripeReturnUrl(),
        allowsDelayedPaymentMethods: false,
        primaryButtonLabel: m.payNow(formatPrice(booking.amount_cents, { locale })),
        // Die App ist nur hell. Ohne feste Textfarben nimmt Stripe im Dark Mode weiße
        // Schrift, auf unseren weißen Feldern war dann nichts zu sehen.
        style: 'alwaysLight',
        // Link (Stripes „mit E-Mail speichern“) verwirrt im MVP nur. Karte reicht.
        link: { display: PaymentSheet.LinkDisplay.NEVER },
        appearance: {
          colors: {
            primary: colors.accent.strong,
            background: colors.surface.raised,
            componentBackground: colors.surface.default,
            componentBorder: colors.border.default,
            componentDivider: colors.border.default,
            primaryText: colors.text.primary,
            secondaryText: colors.text.secondary,
            componentText: colors.text.primary,
            placeholderText: colors.text.tertiary,
            icon: colors.text.secondary,
            error: colors.status.error.text,
          },
          shapes: { borderRadius: radius.input },
          primaryButton: {
            colors: { background: colors.accent.solid, text: colors.accent.onSolid },
            // radius.button ist „rund“ (9999); im PaymentSheet wirkt ein fester Wert sauberer.
            shapes: { borderRadius: radii.xl },
          },
        },
      });
      if (init.error) {
        setPayError(m.failed);
        return;
      }
      const { error } = await presentPaymentSheet();
      if (!error) {
        setSubmitted(true);
        return;
      }
      // Abbruch im Sheet: Reservierung bleibt, man kann innerhalb des Timers weitermachen.
      if (error.code !== PaymentSheetError.Canceled) {
        haptics.error();
        setPayError(m.failed);
      }
    } finally {
      setPresenting(false);
    }
  };

  const pay = () => {
    if (started) {
      void openPaymentSheet(started);
      return;
    }
    start.mutate(
      { offerId, seats },
      {
        onSuccess: (result) => {
          setStarted(result);
          setOffsetMs(clockOffsetMs(result.server_now));
          void refresh();
          void openPaymentSheet(result);
        },
        onError: () => {
          haptics.error();
        },
      },
    );
  };

  const restart = () => {
    setStarted(null);
    setSubmitted(false);
    setPayError(null);
    start.reset();
    void refresh();
  };

  const abort = () => {
    if (bookingId) void cancelPaidBooking(bookingId).catch(() => undefined);
    router.back();
  };

  const header = <Stack.Screen options={{ title: t.common.screens.checkout }} />;

  if (isPending) {
    return (
      <View style={[styles.screen, styles.content]} accessible accessibilityLabel={m.loading}>
        {header}
        <Skeleton height={160} radius={radius.card} />
        <Skeleton height={56} />
      </View>
    );
  }

  if (offerError || !offer) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState
          tone="error"
          icon={CloudOff}
          title={isOffline(offerError) ? t.common.noNetwork : t.common.failed}
          message={offerError ? errorMessage(offerError) : undefined}
          actionLabel={t.common.retry}
          onAction={() => void refetch()}
        />
      </View>
    );
  }

  if (!paymentsAvailable) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState icon={CreditCard} title={m.unavailableTitle} message={m.unavailableText} />
      </View>
    );
  }

  const total = started?.amount_cents ?? bookingAmountCents(offer.deal_price_cents, seats);
  const totalText = formatPrice(total, { locale });
  const ended = phase === 'abgelaufen' || phase === 'zu_spaet' || phase === 'abgebrochen';

  if (ended) {
    const info =
      phase === 'abgelaufen'
        ? { icon: TimerOff, title: m.expiredTitle, text: m.expiredText }
        : phase === 'zu_spaet'
          ? { icon: Undo2, title: m.lateTitle, text: m.lateText }
          : { icon: Undo2, title: m.cancelledTitle, text: m.cancelledText };
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState
          icon={info.icon}
          title={info.title}
          message={info.text}
          actionLabel={phase === 'zu_spaet' ? m.backToOffer : m.tryAgain}
          onAction={phase === 'zu_spaet' ? () => router.back() : restart}
        />
      </View>
    );
  }

  if (phase === 'bezahlt') {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState icon={CircleCheck} title={m.paidTitle} message={m.paidText} />
      </View>
    );
  }

  const urgent = isTimerUrgent(secondsLeft);
  const countdown = formatCountdown(secondsLeft);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      {header}

      <View style={styles.summary}>
        <Text variant="overline" color="secondary">
          {m.summary}
        </Text>
        <Text variant="title3">{offer.title}</Text>
        <Text variant="callout" color="secondary">
          {offer.location_name || offer.company_name} · {offerWhenText(offer, new Date(), locale)}
        </Text>
        <View style={styles.divider} />
        <View style={styles.line}>
          <Text variant="body" color="secondary">
            {m.seatsTimes(
              seatsText(seats, locale),
              formatPrice(offer.deal_price_cents, { locale }),
            )}
          </Text>
        </View>
        <View style={styles.line}>
          <Text variant="headline">{m.total}</Text>
          <Text variant="headline">{totalText}</Text>
        </View>
      </View>

      {phase === 'reserviert' ? (
        <View
          style={[styles.timer, urgent && styles.timerUrgent]}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={m.timerAria(countdown)}
        >
          <Text style={[styles.timerValue, urgent && styles.timerValueUrgent]}>{countdown}</Text>
          <View style={styles.timerText}>
            <Text variant="bodyStrong">{m.reservedFor(countdown)}</Text>
            <Text variant="footnote" color="secondary">
              {m.reservedHint}
            </Text>
          </View>
        </View>
      ) : null}

      {phase === 'bestaetigen' ? (
        <View style={styles.confirming} accessible accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.accent.strong} />
          <View style={styles.timerText}>
            <Text variant="bodyStrong">{m.confirming}</Text>
            <Text variant="footnote" color="secondary">
              {m.confirmingHint}
            </Text>
          </View>
        </View>
      ) : null}

      {phase === 'start' ? (
        <Text variant="footnote" color="secondary">
          {m.cancelRule(cancelPolicyText(offer.type, settings?.cancel_deadline_hours, locale))}
        </Text>
      ) : null}

      {start.error || payError ? (
        <Text
          variant="callout"
          align="center"
          accessibilityLiveRegion="polite"
          style={{ color: colors.status.error.text }}
        >
          {payError ?? errorMessage(start.error)}
        </Text>
      ) : null}

      {phase === 'start' || phase === 'reserviert' ? (
        <View style={styles.actions}>
          <Button
            label={phase === 'reserviert' ? m.payAgain : m.payNow(totalText)}
            icon={Lock}
            size="lg"
            fullWidth
            haptic
            loading={start.isPending || presenting}
            onPress={pay}
          />
          {phase === 'reserviert' ? (
            <Button label={m.abort} variant="ghost" fullWidth onPress={abort} />
          ) : null}
          <ListRow icon={Lock} title={m.secure} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.default },
  content: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space[4],
    paddingBottom: space[12],
    gap: space[5],
  },
  summary: {
    gap: space[2],
    padding: space[5],
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: colors.surface.default,
    boxShadow: shadow.card,
  },
  divider: { height: 1, backgroundColor: colors.border.subtle, marginVertical: space[2] },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    padding: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.accent.subtle,
  },
  timerUrgent: { backgroundColor: colors.status.warning.subtle },
  timerValue: {
    ...textStyle('title1'),
    color: colors.accent.onSubtle,
    fontVariant: ['tabular-nums'],
  },
  timerValueUrgent: { color: colors.status.warning.onSubtle },
  timerText: { flex: 1, gap: space[0.5] },
  confirming: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    padding: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.background.subtle,
  },
  actions: { gap: space[3] },
});
