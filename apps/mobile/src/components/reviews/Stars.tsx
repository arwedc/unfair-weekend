import * as Haptics from 'expo-haptics';
import { Star, StarHalf } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui';
import { formatRating, starFill } from '@/features/reviews/review-logic';
import { useT } from '@/lib/i18n/context';
import { colors, layout, space } from '@/theme';

const STAR_INDEXES = [1, 2, 3, 4, 5] as const;

export interface StarsProps {
  /** 0–5, auch mit Nachkommastelle (wird auf halbe Sterne gerundet). */
  value: number;
  size?: number;
}

/** Fünf Sterne zur Anzeige. Für Screenreader: „4,7 von 5 Sternen“. */
export function Stars({ value, size = 16 }: StarsProps) {
  const { t, locale } = useT();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t.parts.review.starsAria(formatRating(value, locale))}
    >
      {STAR_INDEXES.map((index) => {
        const fill = starFill(value, index);
        return (
          <View key={index} style={{ width: size, height: size }}>
            <Star
              size={size}
              strokeWidth={1.75}
              color={fill === 'empty' ? colors.border.strong : colors.accent.vivid}
              fill={fill === 'full' ? colors.accent.vivid : 'transparent'}
            />
            {fill === 'half' ? (
              <View style={StyleSheet.absoluteFill}>
                <StarHalf
                  size={size}
                  strokeWidth={1.75}
                  color={colors.accent.vivid}
                  fill={colors.accent.vivid}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export interface StarInputProps {
  value: number;
  onChange: (value: number) => void;
}

/** Fünf große, antippbare Sterne zum Bewerten. */
export function StarInput({ value, onChange }: StarInputProps) {
  const { t } = useT();
  return (
    <View
      style={styles.inputRow}
      accessibilityRole="adjustable"
      accessibilityLabel={t.parts.review.stars}
    >
      {STAR_INDEXES.map((index) => {
        const active = value >= index;
        return (
          <PressableScale
            key={index}
            accessibilityRole="button"
            accessibilityLabel={index === 1 ? '1 Stern' : `${index} Sterne`}
            accessibilityState={{ selected: value === index }}
            pressedScale={0.85}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(index);
            }}
            style={styles.inputStar}
          >
            <Star
              size={36}
              strokeWidth={1.75}
              color={active ? colors.accent.vivid : colors.border.strong}
              fill={active ? colors.accent.vivid : 'transparent'}
            />
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[0.5] },
  inputRow: { flexDirection: 'row', justifyContent: 'center', gap: space[1] },
  inputStar: {
    width: layout.minTouchTarget + space[2],
    height: layout.minTouchTarget + space[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
