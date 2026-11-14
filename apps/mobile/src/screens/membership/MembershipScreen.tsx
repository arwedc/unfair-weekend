/**
 * Mitgliedschaft: kostenlos (kein Abo, keine Gebühren), seit wann dabei,
 * dazu die Entdecker-Stufe mit Fortschritt und allen Stufen.
 */
import { berlinParts } from '@repo/shared';
import { useRouter } from 'expo-router';
import { Check, UserRound } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import {
  EmptyState,
  ListGroup,
  ListRow,
  Page,
  ProgressBar,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import {
  currentCard,
  EXPLORER_LEVELS,
  levelProgress,
  STAMPS_PER_CARD,
} from '@/features/profile/profile-logic';
import { useProfileStats } from '@/features/profile/use-profile-stats';
import { useT } from '@/lib/i18n/context';
import { colors, radius, soft, space } from '@/theme';

function PlanCard() {
  const { memberSince } = useAuth();
  const { t } = useT();
  const m = t.profile.membership;
  const p = t.common.profile;
  let since: string | null = null;
  if (memberSince) {
    const { month, year } = berlinParts(memberSince);
    since = p.memberSince(p.months[month - 1] ?? '', year);
  }

  return (
    <View style={styles.plan}>
      <Text variant="overline" color="secondary">
        {m.planLabel}
      </Text>
      <Text variant="title1">{m.plan}</Text>
      <Text variant="callout" color="secondary">
        {m.planText}
      </Text>
      {since ? (
        <Text variant="footnote" color="tertiary">
          {since}
        </Text>
      ) : null}
    </View>
  );
}

function LevelSection() {
  const { t } = useT();
  const m = t.profile.membership;
  const stats = useProfileStats();

  if (stats.isPending) return <Skeleton height={160} radius={radius.card} />;

  const p = t.common.profile;
  const level = levelProgress(stats.stamps.length);
  const card = currentCard(stats.stamps);
  const progress = level.next === null ? 1 : card.stamps.length / STAMPS_PER_CARD;
  const name = p.levels[level.level];

  return (
    <View style={styles.section}>
      <SectionHeader title={m.levelTitle} detail={p.stampsCollected(stats.stamps.length)} />
      <Text variant="title3">{`${level.emoji} ${name}`}</Text>
      <ProgressBar value={progress} accessibilityLabel={name} />
      <Text variant="footnote" color="secondary">
        {level.next === null || level.left === null
          ? p.topLevel
          : p.stampsLeft(level.left, p.levels[level.next])}
      </Text>
      <Text variant="footnote" color="secondary">
        {p.levelIntro} {m.howText}
      </Text>

      <SectionHeader title={m.levelsTitle} />
      <ListGroup>
        {EXPLORER_LEVELS.map((item, index) => (
          <ListRow
            key={item.key}
            title={`${item.emoji} ${p.levels[item.key]}`}
            detail={p.levelFrom(item.from)}
            trailing={
              index <= level.index ? (
                <View style={styles.reached} accessibilityLabel={m.reached}>
                  <Check size={14} color={colors.text.onAccent} strokeWidth={3} />
                </View>
              ) : undefined
            }
          />
        ))}
      </ListGroup>
    </View>
  );
}

export function MembershipScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { t } = useT();
  const m = t.profile.membership;

  if (userId === null) {
    return (
      <EmptyState
        icon={UserRound}
        title={m.signInTitle}
        message={m.signInText}
        actionLabel={t.common.signIn}
        onAction={() => router.replace('/anmelden')}
      />
    );
  }

  return (
    <Page>
      <PlanCard />
      <LevelSection />
    </Page>
  );
}

const styles = StyleSheet.create({
  plan: {
    gap: space[1.5],
    padding: space[5],
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: soft.warm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: soft.tintStrong,
  },
  section: { gap: space[3] },
  reached: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent.solid,
  },
});
