import { OFFER_CATEGORIES } from '@repo/shared';
import * as Haptics from 'expo-haptics';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PressableScale, Text } from '@/components/ui';
import { toggleCategory } from '@/features/offers/feed-logic';
import { useOfferFilters } from '@/features/offers/filters-context';
import { useT } from '@/lib/i18n/context';
import { colors, fun, layout, MAX_FONT_SCALE, radii, space } from '@/theme';

import { CATEGORY_EMOJIS } from './category-emojis';

const SIZE = 68;

/**
 * Kategorien als runde Kacheln mit Emoji, zum Antippen direkt im Feed.
 * Mehrere gleichzeitig möglich; ein zweiter Tipp wählt ab.
 */
export function CategoryCircles() {
  const { filters, setFilters } = useOfferFilters();
  const { t, labels } = useT();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {OFFER_CATEGORIES.map((category) => {
        const selected = filters.categories.includes(category);
        const { emoji, tint } = CATEGORY_EMOJIS[category];
        const short = t.parts.categoryShort[category];
        return (
          <PressableScale
            key={category}
            accessibilityRole="button"
            accessibilityLabel={labels.offerCategory[category]}
            accessibilityState={{ selected }}
            accessibilityHint={
              selected ? t.screens.feed.categoryHintOff : t.screens.feed.categoryHintOn
            }
            pressedScale={0.92}
            onPress={() => {
              void Haptics.selectionAsync();
              setFilters({ categories: toggleCategory(filters.categories, category) });
            }}
            style={styles.item}
          >
            <View
              style={[
                styles.circle,
                { backgroundColor: fun[tint].bg },
                selected && styles.circleSelected,
              ]}
            >
              <Text style={styles.emoji} maxFontSizeMultiplier={1.2}>
                {emoji}
              </Text>
            </View>
            <Text
              variant="footnote"
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              style={[styles.label, selected && styles.labelSelected]}
            >
              {short}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: layout.screenPaddingX, gap: space[3] },
  item: { alignItems: 'center', gap: space[1.5], width: SIZE + space[2] },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  // Gewählt: schwarzer Ring um die bunte Kachel.
  circleSelected: { borderColor: colors.text.primary },
  emoji: { fontSize: 32, lineHeight: 40 },
  label: { color: colors.text.secondary },
  labelSelected: { color: colors.text.primary, fontWeight: '700' },
});
