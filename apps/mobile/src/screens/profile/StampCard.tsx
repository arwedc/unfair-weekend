/**
 * Entdecker-Stufe als Stempelkarte, wie man sie vom Café kennt: Jedes eingelöste Erlebnis
 * gibt einen Stempel mit dem Emoji seiner Kategorie, fünf Stempel = nächste Stufe.
 * Das letzte Feld zeigt blass das Ziel (Emoji der nächsten Stufe).
 *
 * Neue Stempel seit dem letzten Besuch landen mit einer kleinen Stempel-Animation.
 * Ist dabei eine Karte voll geworden, feiert ein Sheet den Aufstieg. Tippen öffnet `/stufen`.
 */
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { CATEGORY_EMOJIS } from '@/components/feed/category-emojis';
import { Button, PressableScale, Sheet, Text, type SheetRef } from '@/components/ui';
import {
  currentCard,
  EXPLORER_LEVELS,
  levelProgress,
  levelUpSince,
  STAMPS_PER_CARD,
  type LevelProgress,
} from '@/features/profile/profile-logic';
import type { Stamp } from '@/features/profile/use-profile-stats';
import { haptics } from '@/lib/haptics';
import { useT } from '@/lib/i18n/context';
import { colors, fonts, fun, radii, radius, soft, space } from '@/theme';

/** Feldgröße: klein im Profil, groß im Level-up-Sheet und auf der Stufen-Seite. */
const SLOT = { small: 26, large: 48 } as const;
type SlotSize = keyof typeof SLOT;
/** Jeder Stempel sitzt etwas schief, wie von Hand gestempelt. */
const TILTS = [-7, 4, -3, 6, -5] as const;
/** Wartezeit bis zum ersten Stempel und Abstand zwischen zwei Stempeln (ms). */
const STAMP_DELAY = 450;
const STAMP_STAGGER = 320;

export interface CardEntry {
  stamp: Stamp;
  number: number;
}

/** Ein gesetzter Stempel. `freshIndex` ≠ null: landet animiert als n-ter neuer Stempel. */
function StampMark({
  stamp,
  tilt,
  freshIndex,
  size,
}: {
  stamp: Stamp;
  tilt: number;
  freshIndex: number | null;
  size: SlotSize;
}) {
  const reduceMotion = useReducedMotion();
  const landed = useSharedValue(freshIndex === null || reduceMotion ? 1 : 0);
  const look = stamp.category ? CATEGORY_EMOJIS[stamp.category] : null;
  const tone = fun[look?.tint ?? 'lemon'];

  useEffect(() => {
    if (freshIndex === null || reduceMotion) {
      landed.set(1);
      return;
    }
    const delay = STAMP_DELAY + freshIndex * STAMP_STAGGER;
    landed.set(0);
    landed.set(withDelay(delay, withSpring(1, { damping: 12, stiffness: 220 })));
    // Ein weiches Aufsetzen, wenn der Stempel landet.
    const timer = setTimeout(haptics.land, delay + 90);
    return () => clearTimeout(timer);
  }, [freshIndex, landed, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    const value = landed.get();
    return {
      opacity: Math.min(1, value * 2),
      transform: [{ scale: 1.9 - 0.9 * value }, { rotate: `${tilt + (1 - value) * 25}deg` }],
    };
  });

  return (
    <Animated.View style={[styles.stamp, { backgroundColor: tone.bg }, animatedStyle]}>
      <Text style={emojiStyle[size]} maxFontSizeMultiplier={1}>
        {look?.emoji ?? '⭐'}
      </Text>
    </Animated.View>
  );
}

/** Fünf Felder: gesetzte Stempel, leere gestrichelte Felder und ganz rechts das Ziel. */
export function StampRow({
  entries,
  seen,
  goalEmoji,
  size,
}: {
  entries: readonly CardEntry[];
  seen: number;
  goalEmoji: string | null;
  size: SlotSize;
}) {
  const firstFresh = entries.find((entry) => entry.number >= seen)?.number ?? 0;
  return (
    <View style={size === 'small' ? styles.slotsSmall : styles.slotsLarge}>
      {Array.from({ length: STAMPS_PER_CARD }, (_, slot) => {
        const entry = entries[slot];
        const goal = slot === STAMPS_PER_CARD - 1 ? goalEmoji : null;
        return (
          <View
            key={slot}
            style={[
              styles.slot,
              { width: SLOT[size], height: SLOT[size] },
              goal !== null && styles.slotGoal,
            ]}
          >
            {goal !== null ? (
              <Text style={[emojiStyle[size], styles.ghost]} maxFontSizeMultiplier={1}>
                {goal}
              </Text>
            ) : null}
            {entry ? (
              <StampMark
                key={entry.stamp.id}
                stamp={entry.stamp}
                tilt={TILTS[slot] ?? 0}
                freshIndex={entry.number >= seen ? entry.number - firstFresh : null}
                size={size}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** Name der Stufe, „Stufe 2 von 4“ und der Satz, wie viel bis zur nächsten fehlt. */
export function useLevelTexts(level: LevelProgress, stampCount: number) {
  const { t } = useT();
  const p = t.common.profile;
  let hint: string = p.topLevel;
  if (stampCount === 0) hint = p.firstStamp;
  else if (level.next !== null && level.left !== null) {
    hint = p.stampsLeft(level.left, p.levels[level.next]);
  }
  return {
    name: p.levels[level.level],
    step: p.levelStep(level.index + 1, EXPLORER_LEVELS.length),
    hint,
  };
}

/**
 * Stempelkarte fürs Profil als schmaler Streifen im Stil der Bilanz-Kacheln. `seen` = Stempel beim letzten Besuch (aus `useSeenStamps`);
 * alles darüber landet animiert. Tippen öffnet die Seite mit allen Stufen.
 */
export function StampCard({ stamps, seen }: { stamps: readonly Stamp[]; seen: number }) {
  const { t } = useT();
  const p = t.common.profile;
  const router = useRouter();
  const levelUpSheet = useRef<SheetRef>(null);
  /** Index der Stufe, die gerade gefeiert wird. */
  const [celebrating, setCelebrating] = useState<number | null>(null);

  const level = levelProgress(stamps.length);
  const card = currentCard(stamps);
  const { name, step, hint } = useLevelTexts(level, stamps.length);
  const levelUp = levelUpSince(seen, stamps.length);
  const levelUpIndex = levelUp?.index ?? null;

  const celebratedLevel =
    celebrating === null ? null : levelProgress(EXPLORER_LEVELS[celebrating]?.from ?? 0);

  // Nur beim Erreichen einer neuen Stufe, nicht bei jedem neuen Stempel.
  useEffect(() => {
    if (levelUpIndex === null) return;
    const timer = setTimeout(() => {
      setCelebrating(levelUpIndex);
      levelUpSheet.current?.present();
    }, 400);
    return () => clearTimeout(timer);
  }, [levelUpIndex]);

  return (
    <>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={p.stampCardA11y(step, name, card.stamps.length, STAMPS_PER_CARD, hint)}
        accessibilityHint={p.levelShowAll}
        onPress={() => router.push('/stufen')}
        style={styles.strip}
      >
        <StampRow entries={card.stamps} seen={seen} goalEmoji={level.nextEmoji} size="small" />
        <View style={styles.stripText}>
          <Text variant="footnote" numberOfLines={1} style={styles.semibold}>
            {name}
          </Text>
          <Text variant="caption" color="secondary" numberOfLines={2}>
            {hint}
          </Text>
        </View>
        <ChevronRight size={16} color={colors.text.tertiary} />
      </PressableScale>

      <Sheet ref={levelUpSheet} onDismiss={() => setCelebrating(null)}>
        {celebratedLevel ? (
          <LevelUpContent
            level={celebratedLevel}
            stamps={stamps}
            seen={seen}
            onDone={() => levelUpSheet.current?.dismiss()}
          />
        ) : null}
      </Sheet>
    </>
  );
}

/** Großer Sticker der neuen Stufe, ploppt nach den Stempeln auf. */
function PopSticker({ emoji, delay }: { emoji: string; delay: number }) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      haptics.success();
      return;
    }
    scale.set(withDelay(delay, withSpring(1, { damping: 9, stiffness: 160 })));
    const timer = setTimeout(() => haptics.success(), delay);
    return () => clearTimeout(timer);
  }, [delay, reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  return (
    <Animated.View style={[styles.popSticker, animatedStyle]}>
      <LevelBadge emoji={emoji} size={104} />
    </Animated.View>
  );
}

/** Inhalt des Level-up-Sheets: die volle Karte, auf die die letzten Stempel fallen, dann der Aufstieg. */
function LevelUpContent({
  level,
  stamps,
  seen,
  onDone,
}: {
  level: LevelProgress;
  stamps: readonly Stamp[];
  seen: number;
  onDone: () => void;
}) {
  const { t } = useT();
  const p = t.common.profile;
  const end = EXPLORER_LEVELS[level.index]?.from ?? stamps.length;
  const start = Math.max(0, end - STAMPS_PER_CARD);
  const entries = stamps
    .slice(start, end)
    .map((stamp, offset) => ({ stamp, number: start + offset }));
  const fresh = entries.filter((entry) => entry.number >= seen).length;
  const popDelay = STAMP_DELAY + fresh * STAMP_STAGGER + 150;

  return (
    <>
      <View style={styles.levelUp}>
        <PopSticker emoji={level.emoji} delay={popDelay} />
        <Text variant="title1" align="center" accessibilityRole="header">
          {p.levelUpTitle}
        </Text>
        <Text variant="body" color="secondary" align="center">
          {p.levelUpText(p.levels[level.level])}
        </Text>
      </View>
      <View style={styles.levelUpCard}>
        <StampRow entries={entries} seen={seen} goalEmoji={null} size="large" />
      </View>
      <Button label={p.levelUpButton} size="lg" fullWidth onPress={onDone} />
    </>
  );
}

/**
 * Abzeichen einer Stufe: zwei überlappende flache Formen in Gold (schräges Quadrat hinten,
 * Kreis vorne) mit dem Emoji der Stufe. Noch nicht erreichte Stufen sind grau und blass.
 */
export function LevelBadge({
  emoji,
  size,
  locked = false,
}: {
  emoji: string;
  size: number;
  locked?: boolean;
}) {
  const back = size * 0.78;
  const front = size * 0.84;
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      <View
        style={[
          styles.badgeBack,
          {
            width: back,
            height: back,
            borderRadius: size * 0.22,
            backgroundColor: locked ? colors.border.subtle : soft.tintStrong,
          },
        ]}
      />
      <View
        style={[
          styles.badgeFront,
          {
            width: front,
            height: front,
            backgroundColor: locked ? colors.background.subtle : soft.tint,
          },
        ]}
      >
        <Text
          style={[{ fontSize: size * 0.4, lineHeight: size * 0.5 }, locked && styles.ghost]}
          maxFontSizeMultiplier={1}
        >
          {emoji}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: colors.background.subtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
  },
  stripText: { flex: 1, gap: space[0.5] },
  slotsSmall: { flexDirection: 'row', gap: space[1] },
  slotsLarge: { flexDirection: 'row', justifyContent: 'space-between' },
  slot: {
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border.strong,
  },
  slotGoal: { borderColor: colors.accent.solid, backgroundColor: colors.surface.default },
  stamp: {
    position: 'absolute',
    // Etwas größer als das Feld, damit der gestrichelte Rand mit verdeckt ist.
    top: -1.5,
    left: -1.5,
    right: -1.5,
    bottom: -1.5,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: { opacity: 0.35 },
  levelUp: { alignItems: 'center', gap: space[2] },
  popSticker: { marginBottom: space[2] },
  badgeBack: { position: 'absolute', top: 0, right: 0, transform: [{ rotate: '14deg' }] },
  badgeFront: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelUpCard: {
    padding: space[4],
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: soft.warm,
  },
  semibold: { fontFamily: fonts.semibold },
});

const emojiStyle = StyleSheet.create({
  small: { fontSize: 13, lineHeight: 17 },
  large: { fontSize: 22, lineHeight: 28 },
});
