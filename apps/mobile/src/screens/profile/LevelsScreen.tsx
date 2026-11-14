/**
 * Seite „Stufen“ (aus dem Profil über die Stempelkarte): oben die aktuelle Stufe groß mit
 * Abzeichen, der aktuellen Stempelkarte und dem Satz, was bis zur nächsten fehlt. Darunter
 * alle Stufen als Liste, erreichte farbig, kommende grau.
 */
import { Check } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Skeleton, Text } from '@/components/ui';
import {
  currentCard,
  EXPLORER_LEVELS,
  levelProgress,
  STAMPS_PER_CARD,
} from '@/features/profile/profile-logic';
import { useProfileStats } from '@/features/profile/use-profile-stats';
import { useT } from '@/lib/i18n/context';
import { colors, layout, space } from '@/theme';

import { LevelBadge, StampRow, useLevelTexts } from './StampCard';

const HERO_BADGE = 128;
const ROW_BADGE = 52;

export function LevelsScreen() {
  const { t } = useT();
  const p = t.common.profile;
  const insets = useSafeAreaInsets();
  const stats = useProfileStats();
  const count = stats.stamps.length;
  const level = levelProgress(count);
  const card = currentCard(stats.stamps);
  const { name, step, hint } = useLevelTexts(level, count);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[8] }]}
    >
      {stats.isPending ? (
        <View style={styles.hero}>
          <Skeleton width={HERO_BADGE} height={HERO_BADGE} radius={HERO_BADGE / 2} />
          <Skeleton width="60%" height={40} />
          <Skeleton height={48} />
        </View>
      ) : (
        <View style={styles.hero}>
          <LevelBadge emoji={level.emoji} size={HERO_BADGE} />
          <View style={styles.heroTitle}>
            <Text variant="caption" color="secondary" align="center">
              {step}
            </Text>
            <Text variant="display" align="center" accessibilityRole="header">
              {name}
            </Text>
          </View>
          <View
            style={styles.card}
            accessible
            accessibilityLabel={`${card.stamps.length}/${STAMPS_PER_CARD}. ${hint}`}
          >
            {/* Hier nichts animieren: Neue Stempel landen auf der Karte im Profil. */}
            <StampRow entries={card.stamps} seen={count} goalEmoji={level.nextEmoji} size="large" />
          </View>
          <Text variant="callout" color="secondary" align="center" importantForAccessibility="no">
            {hint}
          </Text>
        </View>
      )}

      <View>
        {EXPLORER_LEVELS.map((item, index) => {
          const reached = !stats.isPending && index <= level.index;
          const isCurrent = !stats.isPending && index === level.index;
          let detail = p.levelFrom(item.from);
          if (isCurrent) detail = p.stampsCollected(count);
          return (
            <View
              key={item.key}
              style={styles.row}
              accessible
              accessibilityLabel={`${p.levels[item.key]}, ${detail}${isCurrent ? `. ${p.levelCurrent}` : ''}`}
              accessibilityState={{ selected: isCurrent }}
            >
              <LevelBadge emoji={item.emoji} size={ROW_BADGE} locked={!reached} />
              <View style={styles.rowText}>
                <Text variant="headline" color={reached ? 'primary' : 'tertiary'}>
                  {p.levels[item.key]}
                </Text>
                <Text variant="subhead" color={reached ? 'secondary' : 'tertiary'}>
                  {detail}
                </Text>
              </View>
              {reached && !isCurrent ? <Check size={20} color={colors.text.accent} /> : null}
            </View>
          );
        })}
      </View>

      <Text variant="footnote" color="secondary" align="center">
        {p.levelIntro}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.default },
  content: { paddingHorizontal: layout.screenPaddingX, paddingTop: space[2], gap: space[8] },
  hero: { alignItems: 'center', gap: space[4] },
  heroTitle: { alignItems: 'center', gap: space[1] },
  card: { alignSelf: 'stretch', paddingHorizontal: space[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingVertical: space[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
  },
  rowText: { flex: 1, gap: space[0.5] },
});
