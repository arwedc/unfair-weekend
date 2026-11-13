import * as Brightness from 'expo-brightness';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { CalendarClock, CloudOff, MapPin, SearchX, Ticket, Users } from 'lucide-react-native';
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
import { useAuth } from '@/features/auth/auth-context';
import { useCancelVoucher, useMyVouchers } from '@/features/vouchers/queries';
import {
  cancelHint,
  pastSummary,
  seatsText,
  voucherStatusInfo,
  voucherWhenText,
} from '@/features/vouchers/voucher-logic';
import { errorMessage, isOffline } from '@/lib/api-error';
import { openInMaps } from '@/lib/open-external';
import { colors, layout, radius, shadow, space, textStyle } from '@/theme';

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
  const cancelSheet = useRef<SheetRef>(null);
  const { ready, userId } = useAuth();
  const { data, error, isPending, isRefetching, refetch } = useMyVouchers();
  const cancel = useCancelVoucher();

  const voucher = data?.find((entry) => entry.id === voucherId) ?? null;
  const active = voucher?.status === 'aktiv';
  useMaxBrightness(active);

  const header = <Stack.Screen options={{ title: 'Dein Code' }} />;

  if (ready && userId === null) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState
          icon={Ticket}
          title="Bitte anmelden"
          message="Deine Codes siehst du, sobald du angemeldet bist."
          actionLabel="Anmelden"
          onAction={() => router.push('/anmelden')}
        />
      </View>
    );
  }

  if (!ready || isPending) {
    return (
      <View
        style={[styles.screen, styles.content]}
        accessible
        accessibilityLabel="Code wird geladen"
      >
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
          title={isOffline(error) ? 'Kein Netz' : 'Das hat nicht geklappt'}
          message={errorMessage(error)}
          actionLabel="Nochmal versuchen"
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
          title="Code nicht gefunden"
          message="Diesen Code gibt es nicht (mehr) in deinem Konto."
          actionLabel="Zu meinen Codes"
          onAction={() => router.navigate('/codes')}
        />
      </View>
    );
  }

  const status = voucherStatusInfo(voucher);
  const hint = cancelHint(voucher);

  const confirmCancel = () => {
    cancel.mutate(voucher.id, {
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
          tintColor={colors.accent.solid}
          colors={[colors.accent.solid]}
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
              accessibilityLabel="QR-Code zum Vorzeigen beim Anbieter"
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
                Oder diesen Code nennen
              </Text>
              <Text
                selectable
                style={styles.shortCode}
                accessibilityLabel={`Kurzcode ${voucher.short_code.split('').join(' ')}`}
              >
                {voucher.short_code}
              </Text>
            </View>
            <Text variant="footnote" color="secondary" align="center">
              Zeig den Code vor Ort. Der Anbieter scannt ihn und du bist dabei.
            </Text>
          </>
        ) : (
          <Text variant="body" color="secondary" align="center">
            {pastSummary(voucher)}
          </Text>
        )}
      </View>

      <Text variant="title2" accessibilityRole="header">
        {voucher.offer_title}
      </Text>

      <View>
        <ListRow icon={CalendarClock} title={voucherWhenText(voucher)} />
        <ListRow icon={Users} title={seatsText(voucher.seats)} />
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
          title="Zum Angebot"
          onPress={() =>
            router.push({ pathname: '/angebot/[id]', params: { id: voucher.offer_id } })
          }
        />
      </View>

      {active ? (
        <View style={styles.cancelBlock}>
          {hint ? (
            <Text variant="footnote" color="secondary" align="center">
              {hint}
            </Text>
          ) : null}
          {voucher.can_cancel ? (
            <Button
              label="Code stornieren"
              variant="outline"
              fullWidth
              onPress={() => {
                cancel.reset();
                cancelSheet.current?.present();
              }}
            />
          ) : null}
        </View>
      ) : null}

      <Sheet ref={cancelSheet} title="Wirklich stornieren?">
        <Text variant="body" color="secondary">
          {seatsText(voucher.seats)} für „{voucher.offer_title}“{' '}
          {voucher.seats === 1 ? 'wird' : 'werden'} wieder frei. Das lässt sich nicht rückgängig
          machen.
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
          label="Ja, stornieren"
          variant="danger"
          size="lg"
          fullWidth
          loading={cancel.isPending}
          onPress={confirmCancel}
        />
        <Button
          label="Behalten"
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
