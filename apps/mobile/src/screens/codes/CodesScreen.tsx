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
import { colors, radius, space, textStyle } from '@/theme';

function VoucherCard({ voucher }: { voucher: Voucher }) {
  const router = useRouter();
  const status = voucherStatusInfo(voucher);
  const active = voucher.status === 'aktiv';
  const line = active ? voucherWhenText(voucher) : pastSummary(voucher);

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
          {seatsText(voucher.seats)} · {voucher.company_name}
        </Text>
        {active ? <Text style={styles.code}>{voucher.short_code}</Text> : null}
      </View>
    </Card>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Text variant="overline" color="accent">
        Deine Plätze
      </Text>
      <Text variant="title1" accessibilityRole="header">
        Meine Codes
      </Text>
    </View>
  );
}

/** Tab „Meine Codes“: aktive Codes oben, darunter der Verlauf. */
export function CodesScreen() {
  const router = useRouter();
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
        <EmptyState
          icon={Ticket}
          title="Hier landen deine Codes"
          message="Melde dich an, hol dir einen Code und zeig ihn vor Ort einfach vor."
        />
        <Button label="Anmelden" size="lg" fullWidth onPress={() => router.push('/anmelden')} />
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
          tintColor={colors.accent.solid}
          colors={[colors.accent.solid]}
        />
      }
    >
      <Header />

      {isPending ? (
        <View style={styles.list} accessible accessibilityLabel="Codes werden geladen">
          <Skeleton height={132} radius={radius.card} />
          <Skeleton height={132} radius={radius.card} />
        </View>
      ) : error ? (
        <EmptyState
          tone="error"
          icon={CloudOff}
          title={isOffline(error) ? 'Kein Netz' : 'Das hat nicht geklappt'}
          message={errorMessage(error)}
          actionLabel="Nochmal versuchen"
          onAction={() => void refetch()}
        />
      ) : active.length === 0 && past.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="Noch kein Code 🎟️"
          message="Such dir ein Angebot aus und sichere dir deinen Platz. Der Code erscheint dann hier."
          actionLabel="Angebote entdecken"
          onAction={() => router.navigate('/')}
        />
      ) : (
        <>
          {active.length > 0 ? (
            <View style={styles.list}>
              <SectionHeader title="Aktiv" detail={String(active.length)} />
              {active.map((voucher, index) => (
                <Appear key={voucher.id} index={index}>
                  <VoucherCard voucher={voucher} />
                </Appear>
              ))}
            </View>
          ) : (
            <EmptyState
              icon={Ticket}
              title="Gerade kein aktiver Code"
              message="Zeit für etwas Neues?"
              actionLabel="Angebote entdecken"
              onAction={() => router.navigate('/')}
            />
          )}
          {past.length > 0 ? (
            <View style={styles.list}>
              <SectionHeader title="Vergangen" detail={String(past.length)} />
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
