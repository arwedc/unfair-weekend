import { OFFER_CATEGORIES, type OfferCategory } from '@repo/shared';
import { Check } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { CATEGORY_EMOJIS } from '@/components/feed/category-emojis';
import { CATEGORY_ICONS } from '@/components/offers/category-icons';
import { PressableScale, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { useT } from '@/lib/i18n/context';
import { colors, fonts, fun, MAX_FONT_SCALE, radii, radius, space } from '@/theme';

export interface InterestPickerProps {
  selected: readonly OfferCategory[];
  onToggle: (category: OfferCategory) => void;
}

const STICKER = space[6];

/**
 * Kategorien als bunte Kacheln zum Antippen, z. B. bei der Registrierung.
 * Mehrere gleichzeitig möglich. Gewählt: dunkler Ring und ein Haken-Sticker an der Ecke.
 */
export function InterestPicker({ selected, onToggle }: InterestPickerProps) {
  const { labels } = useT();

  return (
    <View style={styles.grid}>
      {OFFER_CATEGORIES.map((category) => {
        const active = selected.includes(category);
        const tone = fun[CATEGORY_EMOJIS[category].tint];
        const Icon = CATEGORY_ICONS[category];
        const label = labels.offerCategory[category];
        return (
          <PressableScale
            key={category}
            accessibilityRole="checkbox"
            accessibilityLabel={label}
            accessibilityState={{ checked: active }}
            pressedScale={0.96}
            onPress={() => {
              haptics.selection();
              onToggle(category);
            }}
            style={[styles.tile, { backgroundColor: tone.bg }, active ? styles.tileSelected : null]}
          >
            <Icon size={26} color={tone.ink} strokeWidth={2} />
            <Text
              variant="subhead"
              numberOfLines={2}
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              style={[styles.label, { color: tone.ink }]}
            >
              {label}
            </Text>
            {active ? (
              <View style={styles.sticker}>
                <Check size={14} color={colors.accent.onSolid} strokeWidth={3} />
              </View>
            ) : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  tile: {
    flexGrow: 1,
    flexBasis: '40%',
    minHeight: space[20],
    padding: space[4],
    gap: space[2],
    justifyContent: 'space-between',
    borderRadius: radius.card,
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  tileSelected: { borderColor: colors.text.primary },
  label: { fontFamily: fonts.semibold },
  // Sticker ragt über die Ecke der Kachel.
  sticker: {
    position: 'absolute',
    top: -space[2],
    right: -space[2],
    width: STICKER,
    height: STICKER,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent.solid,
    borderWidth: 2,
    borderColor: colors.background.default,
  },
});
