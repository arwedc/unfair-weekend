import { formatPrice } from '@repo/shared';
import * as Brightness from 'expo-brightness';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import {
  CalendarClock,
  CloudOff,
  CreditCard,
  MapPin,
  SearchX,
  Star,
  Ticket,
  Users,
} from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import {
  Button,
  EmptyState,
  ListRow,
  Sheet,
  Skeleton,
  StatusPill,
  Text,
  type SheetRef,
} from '@/components/ui';
import { ReviewSheet } from '@/components/reviews/ReviewSheet';
import { Stars } from '@/components/reviews/Stars';
import { useAuth } from '@/features/auth/auth-context';
import { bookingForVoucher } from '@/features/payments/checkout-logic';
import { useCancelPaidBooking, useMyPaidBookings } from '@/features/payments/queries';
import { useMyReviewForLocation } from '@/features/reviews/queries';
import { useCancelVoucher, useMyVouchers } from '@/features/vouchers/queries';
import {
  cancelHint,
  pastSummary,
  seatsText,
  voucherStatusInfo,
  voucherWhenText,
} from '@/features/vouchers/voucher-logic';
import { errorMessage, isOffline } from '@/lib/api-error';
import { useT } from '@/lib/i18n/context';
import { openInMaps } from '@/lib/open-external';
import { colors, layout, radius, shadow, soft, space, textStyle } from '@/theme';

const QR_SIZE = 232;

/** Bildschirm hell stellen, solange der QR-Code gezeigt wird, damit der Scanner ihn gut liest. */
function useMaxBrightness(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let previous: number | null = null;
    let cancelled = false;
    void (async () => {
      try {
        previous = await Brightness.getBrightnessAsync();
        if (!cancelled) await Brightness.setBrightnessAsync(1);
      } catch {
        // Helligkeit ist nur Komfort. Wenn es nicht geht, bleibt alles wie es ist.
      }
    })();
    return () => {
      cancelled = true;
      const restore =
        Platform.OS === 'android'
          ? Brightness.restoreSystemBrightnessAsync()
          : previous !== null
            ? Brightness.setBrightnessAsync(previous)
            : Promise.resolve();
      void restore.catch(() => undefined);
    };
  }, [enabled]);
}

/** Ein Code im Detail: großer QR-Code, Kurzcode, Status und Stornieren. */
export function CodeDetailScreen({ voucherId }: { voucherId: string }) {
  const router = useRouter();
  const { t, locale } = useT();
  const m = t.screens.code;
  const cancelSheet = useRef<SheetRef>(null);
  const { ready, userId } = useAuth();
  const { data, error, isPending, isRefetching, refetch } = useMyVouchers();
  const cancelCode = useCancelVoucher();
  const cancelPaid = useCancelPaidBooking();
  const { data: paidBookings } = useMyPaidBookings();
  const paidBooking = bookingForVoucher(paidBookings, voucherId);
  // Bezahlte Codes storniert die Function: Sie erstattet sofort statt erst per Worker.
  const cancel = paidBooking ? cancelPaid : cancelCode;

  const voucher = data?.find((entry) => entry.id === voucherId) ?? null;
  const reviewSheet = useRef<SheetRef>(null);
  const myReview = useMyReviewForLocation(voucher?.location_id ?? '');
  const active = voucher?.status === 'aktiv';
  useMaxBrightness(active);

  const header = <Stack.Screen options={{ title: t.common.screens.code }} />;

  if (ready && userId === null) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState
          icon={Ticket}
          title={m.signInTitle}
          message={m.signInText}
          actionLabel={t.common.signIn}
          onAction={() => router.push('/anmelden')}
        />
      </View>
    );
  }

  if (!ready || isPending) {
    return (
      <View style={[styles.screen, styles.content]} accessible accessibilityLabel={m.loading}>
        {header}
        <Skeleton height={QR_SIZE + space[12]} radius={radius.card} />
        <Skeleton width="70%" height={28} />
        <Skeleton height={56} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState
          tone="error"
          icon={CloudOff}
          title={isOffline(error) ? t.common.noNetwork : t.common.failed}
          message={errorMessage(error)}
          actionLabel={t.common.retry}
          onAction={() => void refetch()}
        />
      </View>
    );
  }

  if (!voucher) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState
          icon={SearchX}
          title={m.notFoundTitle}
          message={m.notFoundText}
          actionLabel={m.toCodes}
          onAction={() => router.navigate('/codes')}
        />
      </View>
    );
  }

  const status = voucherStatusInfo(voucher, locale);
  const hint = cancelHint(voucher, undefined, locale);

  const paidAmount = paidBooking ? formatPrice(paidBooking.amount_cents, { locale }) : null;
  const paidLabel =
    paidBooking && paidAmount
      ? paidBooking.status === 'erstattet'
        ? m.refunded(paidAmount)
        : m.paid(paidAmount)
      : null;

  const confirmCancel = () => {
    cancel.mutate(paidBooking?.id ?? voucher.id, {
      onSuccess: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        cancelSheet.current?.dismiss();
      },
      onError: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      },
    });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={colors.accent.strong}
          colors={[colors.accent.strong]}
        />
      }
    >
      {header}

      <View style={[styles.ticket, !active && styles.ticketPast]}>
        <StatusPill label={status.label} tone={status.tone} />
        {active ? (
          <>
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={m.qrAria}
              style={styles.qr}
            >
              <QRCode
                value={voucher.token}
                size={QR_SIZE}
                color={colors.text.primary}
                backgroundColor={colors.surface.default}
                ecl="M"
              />
            </View>
            <View style={styles.codeBlock}>
              <Text variant="caption" color="secondary">
                {m.orSay}
              </Text>
              <Text
                selectable
                style={styles.shortCode}
                accessibilityLabel={m.shortCodeAria(voucher.short_code.split('').join(' '))}
              >
                {voucher.short_code}
              </Text>
            </View>
            <Text variant="footnote" color="secondary" align="center">
              {m.showOnSite}
            </Text>
          </>
        ) : (
          <Text variant="body" color="secondary" align="center">
            {pastSummary(voucher, undefined, locale)}
          </Text>
        )}
      </View>

      <Text variant="title2" accessibilityRole="header">
        {voucher.offer_title}
      </Text>

      <View>
        <ListRow icon={CalendarClock} title={voucherWhenText(voucher, undefined, locale)} />
        <ListRow icon={Users} title={seatsText(voucher.seats, locale)} />
        {paidLabel ? <ListRow icon={CreditCard} title={paidLabel} /> : null}
        <ListRow
          icon={MapPin}
          title={voucher.location_name || voucher.company_name}
          detail={voucher.address}
          onPress={() =>
            void openInMaps({
              label: voucher.location_name || voucher.company_name,
              address: voucher.address,
              lat: voucher.lat,
              lng: voucher.lng,
            })
          }
        />
        <ListRow
          icon={Ticket}
          title={m.toOffer}
          onPress={() =>
            router.push({ pathname: '/angebot/[id]', params: { id: voucher.offer_id } })
          }
        />
      </View>

      {voucher.status === 'eingeloest' ? (
        <View style={styles.reviewCard}>
          {myReview ? (
            <>
              <Stars value={myReview.rating} size={20} />
              <Text variant="callout" color="secondary">
                {m.thanks(voucher.location_name || voucher.company_name)}
              </Text>
            </>
          ) : (
            <>
              <Text variant="headline">{m.howWasIt}</Text>
              <Text variant="callout" color="secondary">
                {m.helpOthers(voucher.location_name || voucher.company_name)}
              </Text>
              <Button
                label={m.rateNow}
                icon={Star}
                fullWidth
                onPress={() => reviewSheet.current?.present()}
              />
            </>
          )}
        </View>
      ) : null}

      {active ? (
        <View style={styles.cancelBlock}>
          {hint ? (
            <Text variant="footnote" color="secondary" align="center">
              {hint}
            </Text>
          ) : null}
          {voucher.can_cancel ? (
            <Button
              label={m.cancelCode}
              variant="outline"
              fullWidth
              onPress={() => {
                cancelCode.reset();
                cancelPaid.reset();
                cancelSheet.current?.present();
              }}
            />
          ) : null}
        </View>
      ) : null}

      {voucher.status === 'eingeloest' && !myReview ? (
        <ReviewSheet
          sheetRef={reviewSheet}
          voucherId={voucher.id}
          locationName={voucher.location_name || voucher.company_name}
        />
      ) : null}

      <Sheet ref={cancelSheet} title={m.cancelTitle}>
        <Text variant="body" color="secondary">
          {m.cancelText(seatsText(voucher.seats, locale), voucher.offer_title, voucher.seats === 1)}
          {paidAmount ? ` ${m.refundText(paidAmount)}` : ''}
        </Text>
        {cancel.error ? (
          <Text
            variant="callout"
            accessibilityLiveRegion="polite"
            style={{ color: colors.status.error.text }}
          >
            {errorMessage(cancel.error)}
          </Text>
        ) : null}
        <Button
          label={m.confirmCancel}
          variant="danger"
          size="lg"
          fullWidth
          loading={cancel.isPending}
          onPress={confirmCancel}
        />
        <Button
          label={m.keep}
          variant="secondary"
          fullWidth
          disabled={cancel.isPending}
          onPress={() => cancelSheet.current?.dismiss()}
        />
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  reviewCard: {
    gap: space[3],
    padding: space[4],
    borderRadius: radius.card,
    backgroundColor: soft.tint,
  },
  screen: { flex: 1, backgroundColor: colors.background.default },
  content: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space[4],
    paddingBottom: space[12],
    gap: space[5],
  },
  ticket: {
    alignItems: 'center',
    gap: space[4],
    padding: space[5],
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: colors.surface.default,
    boxShadow: shadow.card,
  },
  ticketPast: { backgroundColor: colors.background.subtle, boxShadow: undefined },
  qr: { padding: space[3], backgroundColor: colors.surface.default, borderRadius: radius.image },
  codeBlock: { alignItems: 'center', gap: space[1] },
  shortCode: { ...textStyle('voucherCode'), color: colors.text.primary },
  cancelBlock: { gap: space[3], marginTop: space[2] },
});
