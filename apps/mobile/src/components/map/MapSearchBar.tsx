import { OFFER_CATEGORY_LABELS, type OfferCategory } from '@repo/shared';
import * as Haptics from 'expo-haptics';
import { Search, X } from 'lucide-react-native';
import { useRef, useState, type ReactNode } from 'react';
import { Keyboard, Pressable, StyleSheet, View, type TextInputInstance } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';

import { CATEGORY_ICONS } from '@/components/offers/category-icons';
import { Input, PressableScale, Text } from '@/components/ui';
import { categorySuggestions, toggleCategory } from '@/features/offers/feed-logic';
import { useOfferFilters } from '@/features/offers/filters-context';
import { colors, duration, layout, radii, shadow, space } from '@/theme';

export interface MapSearchBarProps {
  /** Die Filterleiste darunter. Sie verschwindet, solange gesucht wird. */
  children?: ReactNode;
}

const fade = {
  entering: FadeIn.duration(duration.fast).reduceMotion(ReduceMotion.System),
  exiting: FadeOut.duration(duration.fast).reduceMotion(ReduceMotion.System),
};

/**
 * Suchleiste über der Karte. Beim Antippen schlägt sie Kategorien vor und blendet die
 * Filterleiste aus. Das graue Kreuz am Ende leert die Suche und schließt sie wieder.
 * Nutzt denselben Filterstand wie der Feed (Suchtext und Kategorie).
 */
export function MapSearchBar({ children }: MapSearchBarProps) {
  const { filters, setFilters } = useOfferFilters();
  const input = useRef<TextInputInstance>(null);
  const [searching, setSearching] = useState(false);
  const suggestions = searching ? categorySuggestions(filters.query) : [];

  const closeSearch = () => {
    setFilters({ query: '' });
    input.current?.blur();
    Keyboard.dismiss();
    setSearching(false);
  };

  const pickCategory = (category: OfferCategory) => {
    void Haptics.selectionAsync();
    // Kategorie an- oder abwählen; der getippte Text weicht, sonst filtert beides gleichzeitig.
    // Die Vorschläge bleiben offen, damit man mehrere Kategorien wählen kann.
    setFilters({ categories: toggleCategory(filters.categories, category), query: '' });
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.inset}>
        <Input
          ref={input}
          shape="pill"
          elevated
          icon={Search}
          placeholder="Deals & Kurse suchen"
          accessibilityLabel="Angebote durchsuchen"
          value={filters.query}
          onChangeText={(query) => setFilters({ query })}
          trailing={
            searching || filters.query !== '' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Suche schließen"
                onPress={closeSearch}
                hitSlop={12}
                style={styles.close}
              >
                <X size={22} color={colors.text.tertiary} strokeWidth={2.25} />
              </Pressable>
            ) : null
          }
          onFocus={() => setSearching(true)}
          onBlur={() => setSearching(false)}
          returnKeyType="search"
          autoCorrect={false}
        />

        {suggestions.length > 0 ? (
          <Animated.View {...fade} style={styles.suggestions}>
            <Text variant="overline" color="tertiary" style={styles.suggestionsTitle}>
              Kategorien
            </Text>
            {suggestions.map((category) => {
              const Icon = CATEGORY_ICONS[category];
              const active = filters.categories.includes(category);
              return (
                <PressableScale
                  key={category}
                  accessibilityRole="button"
                  accessibilityLabel={`Kategorie ${OFFER_CATEGORY_LABELS[category]}`}
                  accessibilityState={{ selected: active }}
                  pressedScale={0.99}
                  onPress={() => pickCategory(category)}
                  style={styles.suggestion}
                >
                  <View style={[styles.suggestionIcon, active && styles.suggestionIconActive]}>
                    <Icon
                      size={18}
                      color={active ? colors.accent.onSolid : colors.accent.solid}
                      strokeWidth={2.25}
                    />
                  </View>
                  <Text variant="bodyStrong">{OFFER_CATEGORY_LABELS[category]}</Text>
                </PressableScale>
              );
            })}
          </Animated.View>
        ) : null}
      </View>

      {/* Während der Suche nur Suchfeld und Vorschläge, die Filterleiste macht Platz. */}
      {!searching && children ? <Animated.View {...fade}>{children}</Animated.View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space[2] },
  inset: { paddingHorizontal: layout.screenPaddingX },
  close: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  suggestions: {
    marginTop: space[2],
    paddingVertical: space[2],
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    backgroundColor: colors.surface.raised,
    boxShadow: shadow.floating,
  },
  suggestionsTitle: { paddingHorizontal: space[4], paddingVertical: space[1] },
  suggestion: {
    minHeight: layout.minTouchTarget + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
  },
  suggestionIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent.subtle,
  },
  suggestionIconActive: { backgroundColor: colors.accent.solid },
});
