import type { OfferCategory } from '@repo/shared';
import { ChevronDown, CloudOff, MapPin, Search, SearchX, Sparkles, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { FlatList, Keyboard, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryCircles } from '@/components/feed/CategoryCircles';
import { CityMenu, fallbackCity } from '@/components/offers/CityMenu';
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
import { useOfferFilters } from '@/features/offers/filters-context';
import { useOffers } from '@/features/offers/queries';
import { useCityFromLocation } from '@/features/offers/use-location-city';
import type { FeedOffer } from '@/features/offers/types';
import { useLocationRatings } from '@/features/reviews/queries';
import { errorMessage, isOffline } from '@/lib/api-error';
import { useT } from '@/lib/i18n/context';
import { colors, layout, radii, space } from '@/theme';

function Carousel({
  section,
  onShowAll,
}: {
  section: FeedSection;
  onShowAll?: (category: OfferCategory) => void;
}) {
  const { t } = useT();
  const category = section.category;
  return (
    <View style={styles.section}>
      <SectionHeader
        title={section.title}
        inset
        actionLabel={category && onShowAll ? t.common.all : undefined}
        actionAccessibilityLabel={t.screens.feed.showAllAria(section.title)}
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
  const { t } = useT();
  return (
    <View style={styles.loading} accessibilityLabel={t.screens.feed.loading} accessible>
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
 * (Zeit, Themen, Kategorien). Eine Liste gibt es nur bei Kategorie oder Suche.
 *
 * Die Kopfzeile steht bewusst vor der Liste: So findet die native Tab-Leiste auf iOS keine
 * ScrollView in der „ersten Kette“ und setzt oben keinen zweiten Abstand. Die Liste regelt
 * ihren Abstand zur Tab-Leiste unten selbst (`contentInsetAdjustmentBehavior`).
 */
export function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { t, locale, labels } = useT();
  const m = t.screens.feed;
  const list = useRef<FlatList<FeedOffer>>(null);
  const { filters, setFilters, resetFilters, cityId, setCityId } = useOfferFilters();
  const { data, error, isPending, isRefetching, refetch } = useOffers();
  const [searchOpen, setSearchOpen] = useState(false);
  // Beim App-Start die Stadt des eigenen Standorts wählen (danach von Hand änderbar).
  useCityFromLocation();

  const city = getCity(cityId);
  const cityOffers = offersInCity(data ?? [], cityId);
  const listMode = isListMode(filters);
  const filtering = hasActiveFilters(filters);
  const visible = filterOffers(cityOffers, filters);
  // Für „Community-Lieblinge“: Bewertungen der Anbieter in dieser Stadt.
  const { data: ratings } = useLocationRatings(cityOffers.map((offer) => offer.location_id));
  // Mehrere Kategorien (ohne Suche): je Kategorie eine Reihe zum Wischen, untereinander.
  const byCategory = filters.categories.length > 1 && filters.query.trim() === '';
  // Ohne Kategorie und Suche ist `visible` nur nach Zeit eingegrenzt: Die Abschnitte folgen dem Tag.
  const sections: FeedSection[] = isPending
    ? []
    : byCategory
      ? sectionsByCategory(visible, filters.categories).map(({ category, offers }) => ({
          key: `kategorie-${category}`,
          title: labels.offerCategory[category],
          offers,
        }))
      : listMode
        ? []
        : buildSections(visible, { locale, ratings, now: new Date() });
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
      ? labels.offerCategory[filters.categories[0]]
      : m.forYou;

  const top = (
    <View style={[styles.top, { paddingTop: insets.top + space[1] }]}>
      <View style={styles.titleRow}>
        <CityMenu style={styles.cityMenu}>
          <View
            style={styles.cityButton}
            accessible
            accessibilityRole="button"
            accessibilityLabel={m.cityAria(city.name)}
            accessibilityHint={m.cityHint}
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
          accessibilityLabel={showSearch ? m.closeSearch : m.search}
          onPress={toggleSearch}
        />
      </View>

      {showSearch ? (
        <View style={styles.inset}>
          <Input
            shape="pill"
            icon={Search}
            placeholder={m.searchPlaceholder}
            accessibilityLabel={m.search}
            value={filters.query}
            onChangeText={(query) => setFilters({ query })}
            returnKeyType="search"
            autoCorrect={false}
            autoFocus={searchOpen}
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}
    </View>
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.intro}>
        {cityOffers.length > 0 ? (
          <Text
            variant="title2"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={styles.inset}
          >
            {m.dealCount(cityOffers.length)}
          </Text>
        ) : null}
        <CategoryCircles />
      </View>

      {isPending ? <LoadingState /> : null}

      {sections.map((section) => (
        <Carousel key={section.key} section={section} onShowAll={showCategory} />
      ))}

      {listItems.length > 0 ? (
        <SectionHeader title={listTitle} detail={m.count(visible.length)} inset />
      ) : null}
    </View>
  );

  const empty = isPending ? null : error ? (
    <EmptyState
      tone="error"
      icon={CloudOff}
      title={isOffline(error) ? t.common.noNetwork : t.common.failed}
      message={errorMessage(error)}
      actionLabel={t.common.retry}
      onAction={() => void refetch()}
    />
  ) : cityOffers.length === 0 && !city.launched ? (
    <EmptyState
      icon={MapPin}
      title={m.comingSoonTitle(city.name)}
      message={m.comingSoonText}
      actionLabel={m.switchCity(fallbackCity(cityId).name)}
      onAction={() => setCityId(fallbackCity(cityId).id)}
    />
  ) : filtering && cityOffers.length > 0 ? (
    <EmptyState
      icon={SearchX}
      title={m.nothingFoundTitle}
      message={m.nothingFoundText}
      actionLabel={m.resetFilters}
      onAction={() => {
        resetFilters();
        setSearchOpen(false);
      }}
    />
  ) : (
    <EmptyState icon={Sparkles} title={m.quietTitle} message={m.quietText} />
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
  intro: { gap: space[3] },
  inset: { paddingHorizontal: layout.screenPaddingX },
  section: { gap: space[3] },
  carousel: { flexDirection: 'row', paddingHorizontal: layout.screenPaddingX, gap: space[3] },
  loading: { gap: space[6] },
  separator: { height: space[8] },
});
