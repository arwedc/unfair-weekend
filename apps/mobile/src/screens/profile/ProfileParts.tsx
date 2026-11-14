/** Bausteine des Profils: Kopf mit Avatar, Bilanz mit Stempelkarte, Interessen und Lieblingsorte. */
import { formatPrice, OFFER_CATEGORIES, STORAGE_BUCKETS, berlinParts } from '@repo/shared';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pencil, Store } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CATEGORY_EMOJIS } from '@/components/feed/category-emojis';
import { OfferImage } from '@/components/offers/OfferImage';
import { Button, IconButton, PressableScale, SectionHeader, Skeleton, Text } from '@/components/ui';
import type { Account } from '@/features/auth/account';
import { useAuth } from '@/features/auth/auth-context';
import {
  useFavoriteCategories,
  useFavoriteLocations,
  useToggleFavoriteCategory,
} from '@/features/favorites/queries';
import { initials } from '@/features/profile/profile-logic';
import { useProfileStats } from '@/features/profile/use-profile-stats';
import { useSeenStamps } from '@/features/profile/use-seen-stamps';
import { errorMessage } from '@/lib/api-error';
import { useT } from '@/lib/i18n/context';
import { colors, fonts, fun, MAX_FONT_SCALE, radii, radius, space } from '@/theme';

import { ProfileAvatar } from './ProfileAvatar';
import { StampCard } from './StampCard';

/** Kopf: Profilbild (oder bunte Initialen), Name, „Dabei seit …“ und Bearbeiten-Knopf. */
export function ProfileHero({
  account,
  email,
  memberSince,
}: {
  account: Account;
  email: string | null;
  memberSince: string | null;
}) {
  const router = useRouter();
  const { t } = useT();
  const p = t.common.profile;
  const name = `${account.firstName} ${account.lastName}`.trim();

  let since: string | null = null;
  if (memberSince) {
    const { month, year } = berlinParts(memberSince);
    since = p.memberSince(p.months[month - 1] ?? '', year);
  }

  return (
    <View style={styles.hero}>
      <ProfileAvatar account={account} />
      <View style={styles.heroText}>
        <Text variant="title1" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
          {name || p.yourProfile}
        </Text>
        {since ? (
          <Text variant="subhead" color="secondary">
            {since}
          </Text>
        ) : null}
        {email ? (
          <Text variant="footnote" color="tertiary" numberOfLines={1}>
            {email}
          </Text>
        ) : null}
      </View>
      <IconButton
        icon={Pencil}
        variant="plain"
        accessibilityLabel={p.editProfile}
        onPress={() => router.push('/name')}
        style={styles.editButton}
      />
    </View>
  );
}

/** Ruhige Kachel: helles Grau, schwarze Zahl, graue Beschriftung. Farbe kommt nur vom Emoji. */
function StatTile({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statEmoji} maxFontSizeMultiplier={1.2}>
        {emoji}
      </Text>
      <Text variant="title2" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </Text>
      <Text variant="footnote" color="secondary" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Deine Bilanz: gespart, erlebt, bewertet, darunter die Stempelkarte mit der Stufe. */
export function StatsSection() {
  const { t, locale } = useT();
  const p = t.common.profile;
  const stats = useProfileStats();
  const { userId } = useAuth();
  const seen = useSeenStamps(userId, stats.isPending ? null : stats.stamps.length);

  return (
    <View style={styles.section}>
      <SectionHeader title={p.statsTitle} />
      {stats.isPending ? (
        <Skeleton height={112} radius={radius.card} />
      ) : (
        <>
          <View style={styles.stats}>
            <StatTile
              emoji="💸"
              label={p.statSaved}
              value={formatPrice(stats.savedCents, { omitZeroCents: true, locale })}
            />
            <StatTile emoji="🎟️" label={p.statExperienced} value={String(stats.experienced)} />
            <StatTile emoji="⭐" label={p.statReviewed} value={String(stats.reviewed)} />
          </View>
          {seen === null ? (
            <Skeleton height={STAMP_CARD_HEIGHT} radius={radius.card} />
          ) : (
            <StampCard stamps={stats.stamps} seen={seen} />
          )}
        </>
      )}
    </View>
  );
}

/** Interessen als runde Emoji-Kacheln wie in „Entdecken“. Steuern die Push-Nachrichten. */
export function InterestCircles() {
  const { data: selected } = useFavoriteCategories();
  const toggle = useToggleFavoriteCategory();
  const { t, labels } = useT();
  const p = t.common.profile;

  return (
    <View style={styles.section}>
      <SectionHeader title={p.interests} />
      <Text variant="footnote" color="secondary">
        {p.interestsHint}
      </Text>
      <View style={styles.circles}>
        {OFFER_CATEGORIES.map((category) => {
          const active = selected?.includes(category) ?? false;
          const { emoji, tint } = CATEGORY_EMOJIS[category];
          return (
            <PressableScale
              key={category}
              accessibilityRole="button"
              accessibilityLabel={labels.offerCategory[category]}
              accessibilityState={{ selected: active }}
              onPress={() => {
                void Haptics.selectionAsync();
                toggle.mutate({ item: category, favorite: !active });
              }}
              style={styles.circleItem}
            >
              <View
                style={[
                  styles.circle,
                  { backgroundColor: fun[tint].bg },
                  active && styles.circleActive,
                ]}
              >
                <Text style={styles.circleEmoji} maxFontSizeMultiplier={1.2}>
                  {emoji}
                </Text>
              </View>
              <Text
                variant="caption"
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_FONT_SCALE}
                style={active ? styles.circleLabelActive : styles.circleLabel}
              >
                {t.parts.categoryShort[category]}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      {toggle.error ? (
        <Text variant="footnote" style={{ color: colors.status.error.text }}>
          {errorMessage(toggle.error)}
        </Text>
      ) : null}
    </View>
  );
}

/** Lieblingsorte als Reihe runder Logos. „Alle“ führt zur Favoriten-Seite. */
export function FavoritePlacesRow() {
  const router = useRouter();
  const { locations, isPending } = useFavoriteLocations();
  const { t } = useT();
  const p = t.common.profile;

  return (
    <View style={styles.section}>
      <SectionHeader
        title={p.favoritePlaces}
        actionLabel={locations.length > 0 ? p.seeAll : undefined}
        onAction={locations.length > 0 ? () => router.push('/favoriten') : undefined}
      />
      {isPending ? (
        <Skeleton height={88} radius={radius.card} />
      ) : locations.length === 0 ? (
        <View style={styles.emptyPlaces}>
          <Store size={20} color={colors.text.tertiary} />
          <Text variant="footnote" color="secondary" style={styles.emptyText}>
            {p.placesEmpty}
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.places}
        >
          {locations.map((location) => (
            <PressableScale
              key={location.id}
              accessibilityRole="button"
              accessibilityLabel={location.company_name}
              onPress={() =>
                router.push({ pathname: '/standort/[id]', params: { id: location.id } })
              }
              style={styles.place}
            >
              <View style={styles.logo}>
                {location.company_logo_path ? (
                  <OfferImage
                    path={location.company_logo_path}
                    bucket={STORAGE_BUCKETS.companyLogos}
                    contentFit="contain"
                    style={styles.logoImage}
                  />
                ) : (
                  <Text variant="title3">{initials(location.company_name, '')}</Text>
                )}
              </View>
              <Text variant="caption" numberOfLines={1} style={styles.placeName}>
                {location.company_name}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** Ohne Konto: einladende Kachel statt leerem Profil. */
export function GuestCard() {
  const router = useRouter();
  const { t } = useT();
  const p = t.common.profile;
  return (
    <View style={[styles.guest, { backgroundColor: fun.lemon.bg }]}>
      <Text variant="title2" style={{ color: fun.lemon.ink }}>
        {p.guestTitle}
      </Text>
      <Text variant="callout" style={{ color: fun.lemon.ink }}>
        {p.guestText}
      </Text>
      <Button
        label={t.common.signIn}
        size="lg"
        fullWidth
        onPress={() => router.push('/anmelden')}
      />
    </View>
  );
}

const CIRCLE = 64;
/** Ungefähre Höhe der Stempelkarte, damit der Platzhalter nicht springt. */
const STAMP_CARD_HEIGHT = 60;

const styles = StyleSheet.create({
  section: { gap: space[3] },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  heroText: { flex: 1, gap: space[0.5] },
  editButton: { alignSelf: 'flex-start' },
  stats: { flexDirection: 'row', gap: space[2] },
  stat: {
    flex: 1,
    minHeight: 112,
    padding: space[3],
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: colors.background.subtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
    justifyContent: 'space-between',
    gap: space[1],
  },
  statEmoji: { fontSize: 22, lineHeight: 28 },
  circles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space[4],
  },
  circleItem: { width: '30%', alignItems: 'center', gap: space[1.5] },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  circleActive: { borderColor: colors.text.primary },
  circleEmoji: { fontSize: 28, lineHeight: 34 },
  circleLabel: { color: colors.text.secondary },
  circleLabelActive: { color: colors.text.primary, fontFamily: fonts.bold },
  emptyPlaces: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.background.subtle,
  },
  emptyText: { flex: 1 },
  places: { gap: space[4] },
  place: { width: 72, alignItems: 'center', gap: space[1.5] },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.default,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.default,
  },
  logoImage: { width: 64, height: 64 },
  placeName: { color: colors.text.secondary, textAlign: 'center' },
  guest: {
    gap: space[3],
    padding: space[5],
    borderRadius: radius.card,
    borderCurve: 'continuous',
  },
});
