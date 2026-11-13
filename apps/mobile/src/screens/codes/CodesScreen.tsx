import { useRouter } from 'expo-router';
import { CloudOff, Ticket } from 'lucide-react-native';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { OfferImage } from '@/components/offers/OfferImage';
import {
  Appear,
  Button,
  Card,
  EmptyState,
  Screen,
  SectionHeader,
  Skeleton,
  StatusPill,
  Text,
} from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useMyVouchers } from '@/features/vouchers/queries';
import {
  pastSummary,
  seatsText,
  splitVouchers,
  voucherStatusInfo,
  voucherWhenText,
  type Voucher,
} from '@/features/vouchers/voucher-logic';
import { errorMessage, isOffline } from '@/lib/api-error';
import { useT } from '@/lib/i18n/context';
import { colors, radius, space, textStyle } from '@/theme';

function VoucherCard({ voucher }: { voucher: Voucher }) {
  const router = useRouter();
  const { locale } = useT();
  const status = voucherStatusInfo(voucher, locale);
  const active = voucher.status === 'aktiv';
  const line = active
    ? voucherWhenText(voucher, undefined, locale)
    : pastSummary(voucher, undefined, locale);

  return (
    <Card
      onPress={() => router.push({ pathname: '/code/[id]', params: { id: voucher.id } })}
      accessibilityLabel={`${voucher.offer_title}, ${status.label}, ${line}`}
      elevation={active ? 'raised' : 'flat'}
      style={[styles.card, !active && styles.cardPast]}
    >
      <OfferImage
        path={voucher.cover_image_path}
        style={[styles.thumb, !active && styles.thumbPast]}
        accessibilityLabel=""
      />
      <View style={styles.cardText}>
        <StatusPill label={status.label} tone={status.tone} />
        <Text variant="headline" numberOfLines={2}>
          {voucher.offer_title}
        </Text>
        <Text variant="footnote" color="secondary" numberOfLines={2}>
          {line}
        </Text>
        <Text variant="footnote" color="tertiary" numberOfLines={1}>
          {seatsText(voucher.seats, locale)} · {voucher.company_name}
        </Text>
        {active ? <Text style={styles.code}>{voucher.short_code}</Text> : null}
      </View>
    </Card>
  );
}

function Header() {
  const { t } = useT();
  return (
    <View style={styles.header}>
      <Text variant="overline" color="accent">
        {t.screens.codes.overline}
      </Text>
      <Text variant="title1" accessibilityRole="header">
        {t.screens.codes.title}
      </Text>
    </View>
  );
}

/** Tab „Meine Codes“: aktive Codes oben, darunter der Verlauf. */
export function CodesScreen() {
  const router = useRouter();
  const { t } = useT();
  const m = t.screens.codes;
  const { ready, userId } = useAuth();
  const { data, error, isPending, isRefetching, refetch } = useMyVouchers();

  if (!ready) {
    return (
      <Screen>
        <Header />
        <Skeleton height={132} radius={radius.card} />
      </Screen>
    );
  }

  if (userId === null) {
    return (
      <Screen>
        <Header />
        <EmptyState icon={Ticket} title={m.signedOutTitle} message={m.signedOutText} />
        <Button
          label={t.common.signIn}
          size="lg"
          fullWidth
          onPress={() => router.push('/anmelden')}
        />
      </Screen>
    );
  }

  const { active, past } = splitVouchers(data ?? []);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={colors.accent.strong}
          colors={[colors.accent.strong]}
        />
      }
    >
      <Header />

      {isPending ? (
        <View style={styles.list} accessible accessibilityLabel={m.loading}>
          <Skeleton height={132} radius={radius.card} />
          <Skeleton height={132} radius={radius.card} />
        </View>
      ) : error ? (
        <EmptyState
          tone="error"
          icon={CloudOff}
          title={isOffline(error) ? t.common.noNetwork : t.common.failed}
          message={errorMessage(error)}
          actionLabel={t.common.retry}
          onAction={() => void refetch()}
        />
      ) : active.length === 0 && past.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={m.emptyTitle}
          message={m.emptyText}
          actionLabel={m.discover}
          onAction={() => router.navigate('/')}
        />
      ) : (
        <>
          {active.length > 0 ? (
            <View style={styles.list}>
              <SectionHeader title={m.active} detail={String(active.length)} />
              {active.map((voucher, index) => (
                <Appear key={voucher.id} index={index}>
                  <VoucherCard voucher={voucher} />
                </Appear>
              ))}
            </View>
          ) : (
            <EmptyState
              icon={Ticket}
              title={m.noActiveTitle}
              message={m.noActiveText}
              actionLabel={m.discover}
              onAction={() => router.navigate('/')}
            />
          )}
          {past.length > 0 ? (
            <View style={styles.list}>
              <SectionHeader title={m.past} detail={String(past.length)} />
              {past.map((voucher, index) => (
                <Appear key={voucher.id} index={active.length + index}>
                  <VoucherCard voucher={voucher} />
                </Appear>
              ))}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space[1] },
  list: { gap: space[3] },
  card: { flexDirection: 'row', gap: space[3], padding: space[3] },
  cardPast: { backgroundColor: colors.background.subtle },
  thumb: { width: 96, alignSelf: 'stretch', minHeight: 108, borderRadius: radius.image },
  thumbPast: { opacity: 0.6 },
  cardText: { flex: 1, gap: space[1], justifyContent: 'center' },
  code: { ...textStyle('bodyStrong'), color: colors.text.accent, letterSpacing: 1.5 },
});
