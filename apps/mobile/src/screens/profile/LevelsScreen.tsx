/**
 * Seite „Stufen“ (aus dem Profil über die Stempelkarte): oben die aktuelle Stufe groß mit
 * Abzeichen, der aktuellen Stempelkarte und dem Satz, was bis zur nächsten fehlt. Darunter
 * alle Stufen als Liste, erreichte farbig, kommende grau. Passt ohne Scrollen auf einen Bildschirm.
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
import { colors, fonts, layout, space } from '@/theme';

import { LevelBadge, StampRow, useLevelTexts } from './StampCard';

const HERO_BADGE = 88;
const ROW_BADGE = 40;

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
          <Skeleton width="60%" height={38} />
          <Skeleton height={40} />
        </View>
      ) : (
        <View style={styles.hero}>
          <LevelBadge emoji={level.emoji} size={HERO_BADGE} />
          <View style={styles.heroTitle}>
            <Text variant="caption" color="secondary" align="center">
              {step}
            </Text>
            <Text variant="title1" align="center" accessibilityRole="header">
              {name}
            </Text>
          </View>
          <View
            style={styles.card}
            accessible
            accessibilityLabel={`${card.stamps.length}/${STAMPS_PER_CARD}. ${hint}`}
          >
            {/* Hier nichts animieren: Neue Stempel landen auf der Karte im Profil. */}
            <StampRow
              entries={card.stamps}
              seen={count}
              goalEmoji={level.nextEmoji}
              size="medium"
            />
          </View>
          <Text variant="subhead" color="secondary" align="center" importantForAccessibility="no">
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
                <Text
                  variant="callout"
                  color={reached ? 'primary' : 'tertiary'}
                  style={styles.rowName}
                >
                  {p.levels[item.key]}
                </Text>
                <Text variant="footnote" color={reached ? 'secondary' : 'tertiary'}>
                  {detail}
                </Text>
              </View>
              {reached && !isCurrent ? <Check size={18} color={colors.text.accent} /> : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.default },
  content: { paddingHorizontal: layout.screenPaddingX, paddingTop: space[1], gap: space[6] },
  hero: { alignItems: 'center', gap: space[3] },
  heroTitle: { alignItems: 'center', gap: space[0.5] },
  card: { alignSelf: 'stretch', paddingHorizontal: space[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
  },
  rowText: { flex: 1 },
  rowName: { fontFamily: fonts.semibold },
});
