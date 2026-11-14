/**
 * Seite „Stufen“ (aus dem Profil über die Stempelkarte): oben die aktuelle Stufe groß mit
 * Abzeichen, der aktuellen Stempelkarte und dem Satz, was bis zur nächsten fehlt. Darunter
 * alle Stufen als Liste, erreichte farbig, kommende grau. Links an der Liste läuft eine Leiste:
 * durchgezogen bis zum aktuellen Stand, gestrichelt bis zur höchsten Stufe, mit einem goldenen
 * Punkt an jeder Stufe. Passt ohne Scrollen auf einen Bildschirm.
 */
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line } from 'react-native-svg';
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
/** Breite der Leiste links neben der Liste. */
const TRACK_WIDTH = space[4];
const TRACK_X = TRACK_WIDTH / 2;
const TRACK_STROKE = 2;
const DOT_RADIUS = 5;
const DOT_CURRENT_RADIUS = 7;
const DOT_HALO_RADIUS = TRACK_X;

/**
 * Wo die durchgezogene Leiste endet: am Punkt der aktuellen Stufe plus der Anteil der Stempel
 * bis zur nächsten. Auf der höchsten Stufe am letzten Punkt.
 */
function progressY(centers: readonly number[], levelIndex: number, count: number): number | null {
  const here = centers[levelIndex];
  if (here === undefined) return null;
  const from = EXPLORER_LEVELS[levelIndex]?.from;
  const next = EXPLORER_LEVELS[levelIndex + 1];
  const nextCenter = centers[levelIndex + 1];
  if (from === undefined || !next || nextCenter === undefined) return here;
  const share = Math.min(1, Math.max(0, (count - from) / (next.from - from)));
  return here + share * (nextCenter - here);
}

/** Senkrechte Leiste mit Punkten an den Mittelpunkten der Zeilen. Nur Deko, für Screenreader stumm. */
function LevelTrack({
  centers,
  levelIndex,
  count,
  pending,
}: {
  centers: readonly number[];
  levelIndex: number;
  count: number;
  pending: boolean;
}) {
  const first = centers[0];
  const last = centers[EXPLORER_LEVELS.length - 1];
  if (first === undefined || last === undefined || centers.length < EXPLORER_LEVELS.length) {
    return null;
  }
  const filledTo = pending ? first : (progressY(centers, levelIndex, count) ?? first);

  return (
    <Svg
      style={styles.track}
      width={TRACK_WIDTH}
      height={last + DOT_HALO_RADIUS}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {filledTo < last ? (
        <Line
          x1={TRACK_X}
          x2={TRACK_X}
          y1={filledTo}
          y2={last}
          stroke={colors.accent.solid}
          strokeWidth={TRACK_STROKE}
          strokeDasharray="4 5"
          strokeLinecap="round"
        />
      ) : null}
      {filledTo > first ? (
        <Line
          x1={TRACK_X}
          x2={TRACK_X}
          y1={first}
          y2={filledTo}
          stroke={colors.accent.solid}
          strokeWidth={TRACK_STROKE}
          strokeLinecap="round"
        />
      ) : null}
      {centers.map((y, index) => {
        const reached = !pending && index <= levelIndex;
        const isCurrent = !pending && index === levelIndex;
        return (
          <G key={EXPLORER_LEVELS[index]?.key ?? index}>
            {isCurrent ? (
              <Circle cx={TRACK_X} cy={y} r={DOT_HALO_RADIUS} fill={colors.accent.subtle} />
            ) : null}
            <Circle
              cx={TRACK_X}
              cy={y}
              r={isCurrent ? DOT_CURRENT_RADIUS : DOT_RADIUS}
              fill={reached ? colors.accent.solid : colors.background.default}
              stroke={colors.accent.solid}
              strokeWidth={TRACK_STROKE}
            />
          </G>
        );
      })}
    </Svg>
  );
}

export function LevelsScreen() {
  const { t } = useT();
  const p = t.common.profile;
  const insets = useSafeAreaInsets();
  const stats = useProfileStats();
  const count = stats.stamps.length;
  const level = levelProgress(count);
  const card = currentCard(stats.stamps);
  const { name, step, hint } = useLevelTexts(level, count);
  // Mittelpunkte der Stufen-Zeilen, damit die Leiste ihre Punkte genau auf Höhe der Zeilen setzt.
  const [centers, setCenters] = useState<number[]>([]);
  const setCenter = (index: number, y: number) =>
    setCenters((prev) => {
      if (prev[index] === y) return prev;
      const next = [...prev];
      next[index] = y;
      return next;
    });

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

      <View style={styles.list}>
        <LevelTrack
          centers={centers}
          levelIndex={level.index}
          count={count}
          pending={stats.isPending}
        />
        {EXPLORER_LEVELS.map((item, index) => {
          const reached = !stats.isPending && index <= level.index;
          const isCurrent = !stats.isPending && index === level.index;
          let detail = p.levelFrom(item.from);
          if (isCurrent) detail = p.stampsCollected(count);
          return (
            <View
              key={item.key}
              style={styles.row}
              onLayout={(event) => {
                const { y, height } = event.nativeEvent.layout;
                setCenter(index, y + height / 2);
              }}
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
  list: { paddingLeft: TRACK_WIDTH + space[3] },
  track: { position: 'absolute', left: 0, top: 0 },
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
