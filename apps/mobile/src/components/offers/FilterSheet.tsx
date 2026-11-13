import { OFFER_CATEGORIES, type OfferCategory } from '@repo/shared';
import * as Haptics from 'expo-haptics';
import { Check, LayoutGrid, type LucideIcon } from 'lucide-react-native';
import { useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, PressableScale, Sheet, Text, type SheetRef } from '@/components/ui';
import { offersInCity } from '@/features/offers/cities';
import { countByCategory, filterOffers, toggleCategory } from '@/features/offers/feed-logic';
import { useOfferFilters } from '@/features/offers/filters-context';
import { useOffers } from '@/features/offers/queries';
import { useT } from '@/lib/i18n/context';
import { colors, layout, radii, soft, space } from '@/theme';

import { CATEGORY_ICONS } from './category-icons';

export interface FilterSheetProps {
  sheetRef: RefObject<SheetRef | null>;
}

/**
 * Kategorie-Kachel: Name und Anzahl oben links, ein großes Icon ragt unten rechts
 * angeschnitten aus der Kachel (flache, überlappende Form). Aktiv: in Akzentfarbe gefüllt.
 */
function CategoryTile({
  label,
  detail,
  icon: Icon,
  selected,
  muted,
  wide = false,
  onPress,
}: {
  label: string;
  detail: string;
  icon: LucideIcon;
  selected: boolean;
  muted: boolean;
  wide?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${detail}`}
      accessibilityState={{ selected }}
      pressedScale={0.96}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[
        styles.tile,
        wide ? styles.tileWide : styles.tileHalf,
        selected ? styles.tileSelected : styles.tileIdle,
        muted && !selected && styles.tileMuted,
      ]}
    >
      <View style={styles.tileIcon} pointerEvents="none">
        <Icon
          size={TILE_ICON_SIZE}
          strokeWidth={1.5}
          color={colors.accent.strong}
          fill={selected ? colors.accent.solidPressed : soft.tint}
        />
      </View>
      <View style={styles.tileText}>
        <Text
          variant="bodyStrong"
          numberOfLines={2}
          style={{ color: selected ? colors.accent.onSolid : colors.text.primary }}
        >
          {label}
        </Text>
        <Text
          variant="caption"
          style={{ color: selected ? colors.accent.onSolid : colors.text.secondary }}
        >
          {detail}
        </Text>
      </View>
      {selected ? (
        <View style={styles.check}>
          <Check size={14} strokeWidth={3} color={colors.accent.solid} />
        </View>
      ) : null}
    </PressableScale>
  );
}

/** Je zwei Kategorien pro Zeile. */
const CATEGORY_ROWS: OfferCategory[][] = [];
for (let i = 0; i < OFFER_CATEGORIES.length; i += 2) {
  CATEGORY_ROWS.push(OFFER_CATEGORIES.slice(i, i + 2));
}

/** Kategorien als große Kacheln. Die Tage stehen schon oben in der Filterzeile. */
export function FilterSheet({ sheetRef }: FilterSheetProps) {
  const { t, labels } = useT();
  const m = t.parts.filter;
  const countLabel = m.count;
  const { filters, setFilters, cityId } = useOfferFilters();
  const { data } = useOffers();

  // Entwurf, solange das Sheet offen ist. Erst beim Schließen geht die Auswahl an Feed und
  // Karte. Sonst rendern beide Tabs (inkl. aller Kartennadeln) bei jedem Tipp neu, und das
  // Sheet ruckelt, vor allem beim Zurück auf „Alles zeigen“. null = kein Entwurf.
  const [draft, setDraft] = useState<OfferCategory[] | null>(null);
  const categories = draft ?? filters.categories;
  const draftFilters = { ...filters, categories };

  const cityOffers = offersInCity(data ?? [], cityId);
  // Die Zahlen folgen dem gewählten Tag (und der Suche), nicht der Kategorie.
  const forCounts = filterOffers(cityOffers, { ...filters, categories: [] });
  const counts = countByCategory(forCounts);
  const resultCount = filterOffers(cityOffers, draftFilters).length;

  // Mehrere Kategorien gleichzeitig: Jede Kachel schaltet ihre Kategorie an oder aus,
  // „Alles zeigen“ leert die Auswahl.
  const choose = (category: OfferCategory | null) =>
    setDraft(category === null ? [] : toggleCategory(categories, category));

  // Gilt für den Knopf und fürs Wegwischen.
  const apply = () => {
    if (draft !== null) setFilters({ categories: draft });
    setDraft(null);
  };

  return (
    <Sheet ref={sheetRef} title={m.title} onDismiss={apply}>
      <Text variant="footnote" color="secondary">
        {m.multi}
      </Text>
      {/* Feste Zeilen statt flexWrap mit Prozent-Breiten: Im nativen Sheet greifen Prozente
          nicht, die Kacheln wurden dann nach Textlänge breit und das Sheet zu hoch. */}
      <View style={styles.grid}>
        <CategoryTile
          wide
          label={m.showAll}
          detail={countLabel(forCounts.length)}
          icon={LayoutGrid}
          selected={categories.length === 0}
          muted={false}
          onPress={() => choose(null)}
        />
        {CATEGORY_ROWS.map((row) => (
          <View key={row.join()} style={styles.row}>
            {row.map((category) => (
              <CategoryTile
                key={category}
                label={labels.offerCategory[category]}
                detail={countLabel(counts[category])}
                icon={CATEGORY_ICONS[category]}
                selected={categories.includes(category)}
                muted={counts[category] === 0}
                onPress={() => choose(category)}
              />
            ))}
            {row.length === 1 ? <View style={styles.tileHalf} /> : null}
          </View>
        ))}
      </View>

      <Button
        label={resultCount === 0 ? m.none : m.show(countLabel(resultCount))}
        size="lg"
        fullWidth
        disabled={resultCount === 0}
        onPress={() => {
          apply();
          sheetRef.current?.dismiss();
        }}
      />
    </Sheet>
  );
}

const TILE_ICON_SIZE = space[16] + space[4];

const styles = StyleSheet.create({
  grid: { gap: space[2] },
  row: { flexDirection: 'row', gap: space[2] },
  tile: {
    minHeight: layout.minTouchTarget * 2,
    padding: space[3],
    borderRadius: radii.xl,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  tileHalf: { flex: 1 },
  tileWide: { alignSelf: 'stretch', minHeight: layout.minTouchTarget + space[6] },
  // Gleicher Rand in beiden Zuständen, sonst bricht der Text beim Antippen anders um.
  tileIdle: { backgroundColor: soft.warm, borderWidth: 1, borderColor: soft.tint },
  tileSelected: {
    backgroundColor: colors.accent.solid,
    borderWidth: 1,
    borderColor: colors.accent.solid,
  },
  tileMuted: { opacity: 0.5 },
  tileIcon: {
    position: 'absolute',
    right: -space[4],
    bottom: -space[4],
    transform: [{ rotate: '-12deg' }],
  },
  tileText: { gap: space[0.5], paddingRight: space[8] },
  check: {
    position: 'absolute',
    top: space[2],
    right: space[2],
    width: space[6],
    height: space[6],
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent.onSolid,
  },
});
