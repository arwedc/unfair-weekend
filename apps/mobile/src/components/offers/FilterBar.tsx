import { OFFER_CATEGORIES, OFFER_CATEGORY_LABELS, type OfferCategory } from '@repo/shared';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  CalendarDays,
  ChevronDown,
  Heart,
  LayoutGrid,
  Search,
  SlidersHorizontal,
  Sun,
  Users,
} from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, View, type TextInputInstance } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';

import { Button, Chip, Input, PressableScale, Sheet, Text, type SheetRef } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import {
  activeFilterCount,
  categorySuggestions,
  TIME_FILTER_LABELS,
  TIME_FILTERS,
  type OfferFilters,
} from '@/features/offers/feed-logic';
import { useOfferFilters } from '@/features/offers/filters-context';
import { colors, duration, layout, radii, shadow, space } from '@/theme';

import { CATEGORY_ICONS } from './category-icons';

export { CATEGORY_ICONS };

export interface FilterBarProps {
  /** „floating“ = schwebend über der Karte (Schatten statt Rahmen). */
  variant?: 'inline' | 'floating';
}

/**
 * Suche, Filter-Knopf und Schnellfilter. Feed und Karte teilen sich denselben Stand.
 *
 * Tippt man ins Suchfeld, schlagen wir Kategorien vor. Unter dem Suchfeld öffnet „Filter“
 * alle Optionen als Bottom Sheet; daneben stehen die häufigsten Filter zum Antippen.
 */
export function FilterBar({ variant = 'inline' }: FilterBarProps) {
  const router = useRouter();
  const { userId } = useAuth();
  const { filters, setFilters, resetFilters } = useOfferFilters();
  const input = useRef<TextInputInstance>(null);
  const sheet = useRef<SheetRef>(null);
  const [searching, setSearching] = useState(false);

  const floating = variant === 'floating';
  const count = activeFilterCount(filters);
  const suggestions = searching ? categorySuggestions(filters.query) : [];

  const pickCategory = (category: OfferCategory) => {
    void Haptics.selectionAsync();
    // Kategorie ersetzt den getippten Text, sonst filtert beides gleichzeitig.
    setFilters({ category, query: '' });
    input.current?.blur();
    Keyboard.dismiss();
  };

  const toggleFavorites = () => {
    if (!userId) {
      router.push('/anmelden');
      return;
    }
    setFilters({ favoritesOnly: !filters.favoritesOnly });
  };

  const toggleTime = (time: OfferFilters['time']) =>
    setFilters({ time: filters.time === time ? 'alle' : time });

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.inset}>
        <Input
          ref={input}
          shape="pill"
          elevated={floating}
          icon={Search}
          placeholder="Deals & Kurse suchen"
          accessibilityLabel="Angebote durchsuchen"
          value={filters.query}
          onChangeText={(query) => setFilters({ query })}
          onClear={() => setFilters({ query: '' })}
          onFocus={() => setSearching(true)}
          onBlur={() => setSearching(false)}
          returnKeyType="search"
          autoCorrect={false}
        />

        {suggestions.length > 0 ? (
          <Animated.View
            entering={FadeIn.duration(duration.fast).reduceMotion(ReduceMotion.System)}
            exiting={FadeOut.duration(duration.fast).reduceMotion(ReduceMotion.System)}
            style={styles.suggestions}
          >
            <Text variant="overline" color="tertiary" style={styles.suggestionsTitle}>
              Kategorien
            </Text>
            {suggestions.map((category) => {
              const Icon = CATEGORY_ICONS[category];
              const active = filters.category === category;
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
        style={styles.rowScroller}
      >
        <Chip
          label={count > 0 ? `Filter · ${count}` : 'Filter'}
          icon={SlidersHorizontal}
          trailingIcon={ChevronDown}
          selected={count > 0}
          elevated={floating}
          accessibilityLabel={count > 0 ? `Filter, ${count} aktiv` : 'Filter'}
          accessibilityHint="Öffnet alle Filter"
          onPress={() => sheet.current?.present()}
        />
        <Chip
          label="Heute"
          icon={Sun}
          selected={filters.time === 'heute'}
          elevated={floating}
          onPress={() => toggleTime('heute')}
        />
        <Chip
          label="Wochenende"
          icon={CalendarDays}
          selected={filters.time === 'wochenende'}
          elevated={floating}
          onPress={() => toggleTime('wochenende')}
        />
        <Chip
          label={filters.category ? OFFER_CATEGORY_LABELS[filters.category] : 'Kategorie'}
          icon={filters.category ? CATEGORY_ICONS[filters.category] : LayoutGrid}
          trailingIcon={ChevronDown}
          selected={filters.category !== null}
          elevated={floating}
          accessibilityHint="Kategorien vorschlagen"
          onPress={() => input.current?.focus()}
        />
        <Chip
          label="Freie Plätze"
          icon={Users}
          selected={filters.onlyAvailable}
          elevated={floating}
          onPress={() => setFilters({ onlyAvailable: !filters.onlyAvailable })}
        />
        <Chip
          label="Lieblingsorte"
          icon={Heart}
          selected={filters.favoritesOnly}
          elevated={floating}
          accessibilityHint={userId ? undefined : 'Dafür meldest du dich an'}
          onPress={toggleFavorites}
        />
      </ScrollView>

      <Sheet ref={sheet} title="Filter">
        <View style={styles.group}>
          <Text variant="headline" accessibilityRole="header">
            Wann
          </Text>
          <View style={styles.wrap}>
            {TIME_FILTERS.map((time) => (
              <Chip
                key={time}
                label={TIME_FILTER_LABELS[time]}
                selected={filters.time === time}
                onPress={() => setFilters({ time })}
              />
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <Text variant="headline" accessibilityRole="header">
            Kategorie
          </Text>
          <View style={styles.wrap}>
            <Chip
              label="Alle"
              selected={filters.category === null}
              onPress={() => setFilters({ category: null })}
            />
            {OFFER_CATEGORIES.map((category) => (
              <Chip
                key={category}
                label={OFFER_CATEGORY_LABELS[category]}
                icon={CATEGORY_ICONS[category]}
                selected={filters.category === category}
                onPress={() =>
                  setFilters({ category: filters.category === category ? null : category })
                }
              />
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <Text variant="headline" accessibilityRole="header">
            Mehr
          </Text>
          <View style={styles.wrap}>
            <Chip
              label="Nur mit freien Plätzen"
              icon={Users}
              selected={filters.onlyAvailable}
              onPress={() => setFilters({ onlyAvailable: !filters.onlyAvailable })}
            />
            <Chip
              label="Nur Lieblingsorte"
              icon={Heart}
              selected={filters.favoritesOnly}
              onPress={() => {
                if (!userId) sheet.current?.dismiss();
                toggleFavorites();
              }}
            />
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            label="Zurücksetzen"
            variant="ghost"
            disabled={count === 0 && filters.query === ''}
            onPress={resetFilters}
          />
          <Button label="Fertig" style={styles.done} onPress={() => sheet.current?.dismiss()} />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space[3] },
  inset: { paddingHorizontal: layout.screenPaddingX },
  rowScroller: { flexGrow: 0, overflow: 'visible' },
  // Etwas Luft oben und unten, damit die Schatten schwebender Chips nicht abgeschnitten werden.
  row: { paddingHorizontal: layout.screenPaddingX, paddingVertical: space[1], gap: space[2] },
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
  group: { gap: space[3] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space[2],
  },
  done: { minWidth: 140 },
});
