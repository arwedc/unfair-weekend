import { CloudOff, SearchX, Sparkles } from 'lucide-react-native';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterBar } from '@/components/offers/FilterBar';
import { COMPACT_CARD_WIDTH, OfferCard, OfferCardSkeleton } from '@/components/offers/OfferCard';
import { Appear, EmptyState, SectionHeader, Text } from '@/components/ui';
import { buildSections, filterOffers, hasActiveFilters } from '@/features/offers/feed-logic';
import { useOfferFilters } from '@/features/offers/filters-context';
import { useOffers } from '@/features/offers/queries';
import type { FeedOffer } from '@/features/offers/types';
import { errorMessage, isOffline } from '@/lib/api-error';
import { colors, layout, space } from '@/theme';

function Carousel({ title, offers }: { title: string; offers: FeedOffer[] }) {
  if (offers.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionHeader title={title} inset />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
        decelerationRate="fast"
        snapToInterval={COMPACT_CARD_WIDTH + space[3]}
        snapToAlignment="start"
      >
        {offers.map((offer, index) => (
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

/** Tab „Entdecken“: Suche, Filter, Abschnitte als Karussells und darunter alle Angebote. */
export function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { filters, resetFilters } = useOfferFilters();
  const { data, error, isPending, isRefetching, refetch } = useOffers();

  const offers = data ?? [];
  const filtering = hasActiveFilters(filters);
  const visible = filterOffers(offers, filters);
  const sections = buildSections(offers);

  const header = (
    <View style={styles.header}>
      <View style={styles.inset}>
        <Text variant="overline" color="accent">
          Münster
        </Text>
        <Text variant="title1" accessibilityRole="header">
          Was geht heute?
        </Text>
      </View>

      <FilterBar />

      {isPending ? <LoadingState /> : null}

      {!isPending && !filtering ? (
        <>
          <Carousel title="Heute in Münster" offers={sections.today} />
          <Carousel title="Startet bald" offers={sections.startingSoon} />
          <Carousel title="Neu dabei" offers={sections.newest} />
        </>
      ) : null}

      {!isPending && visible.length > 0 ? (
        <SectionHeader
          title={filtering ? 'Passt zu dir' : 'Alle Angebote'}
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
  ) : filtering ? (
    <EmptyState
      icon={SearchX}
      title="Nichts gefunden"
      message="Für diese Auswahl gibt es gerade kein Angebot. Probier einen anderen Tag oder eine andere Kategorie."
      actionLabel="Filter zurücksetzen"
      onAction={resetFilters}
    />
  ) : (
    <EmptyState
      icon={Sparkles}
      title="Gerade ist Ruhe ✨"
      message="Im Moment gibt es keine Angebote. Schau später nochmal rein, hier tut sich oft kurzfristig was."
    />
  );

  return (
    <FlatList
      data={isPending ? [] : visible}
      keyExtractor={(offer) => offer.id}
      renderItem={({ item, index }) => (
        <Appear index={index} style={styles.inset}>
          <OfferCard offer={item} priority={index < 2 ? 'high' : 'normal'} />
        </Appear>
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={empty ?? undefined}
      ItemSeparatorComponent={Separator}
      style={styles.list}
      contentContainerStyle={{ paddingTop: insets.top + space[4], paddingBottom: space[12] }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={colors.accent.solid}
          colors={[colors.accent.solid]}
        />
      }
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background.default },
  header: { gap: space[6], paddingBottom: space[4] },
  inset: { paddingHorizontal: layout.screenPaddingX },
  section: { gap: space[3] },
  carousel: { flexDirection: 'row', paddingHorizontal: layout.screenPaddingX, gap: space[3] },
  loading: { gap: space[6] },
  separator: { height: space[8] },
});
