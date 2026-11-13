import { OFFER_CATEGORY_LABELS, type OfferCategory } from '@repo/shared';
import { ChevronDown, CloudOff, MapPin, Search, SearchX, Sparkles, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { FlatList, Keyboard, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CityMenu, fallbackCity } from '@/components/offers/CityMenu';
import { FilterBar } from '@/components/offers/FilterBar';
import { COMPACT_CARD_WIDTH, OfferCard, OfferCardSkeleton } from '@/components/offers/OfferCard';
import { Appear, EmptyState, IconButton, Input, SectionHeader, Text } from '@/components/ui';
import { getCity, offersInCity } from '@/features/offers/cities';
import {
  buildSections,
  filterOffers,
  hasActiveFilters,
  isListMode,
  sectionsByCategory,
  type FeedSection,
} from '@/features/offers/feed-logic';
import { useFavoriteOfferIds } from '@/features/favorites/queries';
import { useOfferFilters } from '@/features/offers/filters-context';
import { useOffers } from '@/features/offers/queries';
import { useCityFromLocation } from '@/features/offers/use-location-city';
import type { FeedOffer } from '@/features/offers/types';
import { errorMessage, isOffline } from '@/lib/api-error';
import { colors, layout, radii, space } from '@/theme';

function Carousel({
  section,
  onShowAll,
}: {
  section: FeedSection;
  onShowAll?: (category: OfferCategory) => void;
}) {
  const category = section.category;
  return (
    <View style={styles.section}>
      <SectionHeader
        title={section.title}
        inset
        actionLabel={category && onShowAll ? 'Alle' : undefined}
        actionAccessibilityLabel={`Alle Angebote aus ${section.title}`}
        onAction={category && onShowAll ? () => onShowAll(category) : undefined}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
        decelerationRate="fast"
        snapToInterval={COMPACT_CARD_WIDTH + space[3]}
        snapToAlignment="start"
      >
        {section.offers.map((offer, index) => (
          <Appear key={offer.id} index={index}>
            <OfferCard offer={offer} variant="compact" />
          </Appear>
        ))}
      </ScrollView>
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.loading} accessibilityLabel="Angebote werden geladen" accessible>
      <View style={styles.carousel}>
        <OfferCardSkeleton variant="compact" />
        <OfferCardSkeleton variant="compact" />
      </View>
      <View style={styles.inset}>
        <OfferCardSkeleton />
      </View>
    </View>
  );
}

/**
 * Tab „Entdecken“: oben fest Stadt, Suche und Filter, darunter nur Abschnitte als Karussells
 * (Favoriten, Zeit, Themen, Kategorien). Eine Liste gibt es nur bei Kategorie oder Suche.
 *
 * Die Kopfzeile steht bewusst vor der Liste: So findet die native Tab-Leiste auf iOS keine
 * ScrollView in der „ersten Kette“ und setzt oben keinen zweiten Abstand. Die Liste regelt
 * ihren Abstand zur Tab-Leiste unten selbst (`contentInsetAdjustmentBehavior`).
 */
export function FeedScreen() {
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<FeedOffer>>(null);
  const { filters, setFilters, resetFilters, cityId, setCityId } = useOfferFilters();
  const { data, error, isPending, isRefetching, refetch } = useOffers();
  const { data: favoriteIds } = useFavoriteOfferIds();
  const [searchOpen, setSearchOpen] = useState(false);
  // Beim App-Start die Stadt des eigenen Standorts wählen (danach von Hand änderbar).
  useCityFromLocation();

  const city = getCity(cityId);
  const cityOffers = offersInCity(data ?? [], cityId);
  const listMode = isListMode(filters);
  const filtering = hasActiveFilters(filters);
  const visible = filterOffers(cityOffers, filters);
  // Mehrere Kategorien (ohne Suche): je Kategorie eine Reihe zum Wischen, untereinander.
  const byCategory = filters.categories.length > 1 && filters.query.trim() === '';
  // Ohne Kategorie und Suche ist `visible` nur nach Zeit eingegrenzt: Die Abschnitte folgen dem Tag.
  const sections: FeedSection[] = isPending
    ? []
    : byCategory
      ? sectionsByCategory(visible, filters.categories).map(({ category, offers }) => ({
          key: `kategorie-${category}`,
          title: OFFER_CATEGORY_LABELS[category],
          offers,
        }))
      : listMode
        ? []
        : buildSections(visible, { cityName: city.name, favoriteIds: favoriteIds ?? [] });
  // Bei Kategorie-Reihen steht darunter keine zweite, lange Liste.
  // Ohne Kategorie und Suche nur Reihen; bei mehreren Kategorien eine Reihe pro Kategorie.
  const listItems = isPending || byCategory || !listMode ? [] : visible;
  const showSearch = searchOpen || filters.query !== '';

  const toggleSearch = () => {
    if (showSearch) {
      Keyboard.dismiss();
      setFilters({ query: '' });
      setSearchOpen(false);
    } else {
      setSearchOpen(true);
    }
  };

  const showCategory = (category: OfferCategory) => {
    setFilters({ categories: [category] });
    list.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const listTitle =
    filters.categories.length === 1 && filters.categories[0] && filters.query.trim() === ''
      ? OFFER_CATEGORY_LABELS[filters.categories[0]]
      : 'Passt zu dir';

  const top = (
    <View style={[styles.top, { paddingTop: insets.top + space[1] }]}>
      <View style={styles.titleRow}>
        <CityMenu style={styles.cityMenu}>
          <View
            style={styles.cityButton}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Stadt: ${city.name}`}
            accessibilityHint="Öffnet die Auswahl der Städte"
          >
            <Text variant="title2" numberOfLines={1} style={styles.cityName}>
              {city.name}
            </Text>
            <View style={styles.chevron}>
              <ChevronDown size={16} strokeWidth={2.75} color={colors.accent.strong} />
            </View>
          </View>
        </CityMenu>
        <IconButton
          variant="plain"
          icon={showSearch ? X : Search}
          accessibilityLabel={showSearch ? 'Suche schließen' : 'Angebote durchsuchen'}
          onPress={toggleSearch}
        />
      </View>

      {showSearch ? (
        <View style={styles.inset}>
          <Input
            shape="pill"
            icon={Search}
            placeholder="Kochkurs, Yoga, Keramik …"
            accessibilityLabel="Angebote durchsuchen"
            value={filters.query}
            onChangeText={(query) => setFilters({ query })}
            returnKeyType="search"
            autoCorrect={false}
            autoFocus={searchOpen}
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}

      <FilterBar />
    </View>
  );

  const header = (
    <View style={styles.header}>
      {isPending ? <LoadingState /> : null}

      {sections.map((section) => (
        <Carousel key={section.key} section={section} onShowAll={showCategory} />
      ))}

      {listItems.length > 0 ? (
        <SectionHeader
          title={listTitle}
          detail={`${visible.length} ${visible.length === 1 ? 'Angebot' : 'Angebote'}`}
          inset
        />
      ) : null}
    </View>
  );

  const empty = isPending ? null : error ? (
    <EmptyState
      tone="error"
      icon={CloudOff}
      title={isOffline(error) ? 'Kein Netz' : 'Das hat nicht geklappt'}
      message={errorMessage(error)}
      actionLabel="Nochmal versuchen"
      onAction={() => void refetch()}
    />
  ) : cityOffers.length === 0 && !city.launched ? (
    <EmptyState
      icon={MapPin}
      title={`Bald auch in ${city.name} ✨`}
      message="Hier suchen wir gerade die ersten Partner. Bis dahin findest du Angebote in den anderen Städten."
      actionLabel={`Zu ${fallbackCity(cityId).name} wechseln`}
      onAction={() => setCityId(fallbackCity(cityId).id)}
    />
  ) : filtering && cityOffers.length > 0 ? (
    <EmptyState
      icon={SearchX}
      title="Nichts gefunden"
      message="Für diese Auswahl gibt es gerade kein Angebot. Probier einen anderen Tag oder eine andere Kategorie."
      actionLabel="Filter zurücksetzen"
      onAction={() => {
        resetFilters();
        setSearchOpen(false);
      }}
    />
  ) : (
    <EmptyState
      icon={Sparkles}
      title="Gerade ist Ruhe ✨"
      message="Im Moment gibt es keine Angebote. Schau später nochmal rein, hier tut sich oft kurzfristig was."
    />
  );

  return (
    <View style={styles.screen}>
      {top}

      <FlatList
        ref={list}
        // Ohne Kategorie und Suche zeigt der Feed nur die Reihen, keine Liste darunter.
        data={listItems}
        keyExtractor={(offer) => offer.id}
        renderItem={({ item, index }) => (
          <Appear index={index} style={styles.inset}>
            <OfferCard offer={item} priority={index < 2 ? 'high' : 'normal'} />
          </Appear>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          (listMode && !byCategory) || sections.length === 0 ? (empty ?? undefined) : undefined
        }
        ItemSeparatorComponent={Separator}
        style={styles.list}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.accent.strong}
            colors={[colors.accent.strong]}
          />
        }
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.default },
  top: {
    gap: space[1],
    paddingBottom: space[1],
    backgroundColor: colors.background.default,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingLeft: layout.screenPaddingX,
    paddingRight: layout.screenPaddingX - space[2],
  },
  cityMenu: { flexShrink: 1 },
  cityButton: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  cityName: { flexShrink: 1 },
  chevron: {
    width: space[6],
    height: space[6],
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent.subtle,
  },
  list: { flex: 1, backgroundColor: colors.background.default },
  content: { paddingTop: space[5], paddingBottom: space[12] },
  header: { gap: space[6], paddingBottom: space[4] },
  inset: { paddingHorizontal: layout.screenPaddingX },
  section: { gap: space[3] },
  carousel: { flexDirection: 'row', paddingHorizontal: layout.screenPaddingX, gap: space[3] },
  loading: { gap: space[6] },
  separator: { height: space[8] },
});
