import { ChevronRight, MapPin, Navigation } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { MiniMap } from '@/components/offers/MiniMap';
import { PressableScale, Text } from '@/components/ui';
import { useT } from '@/lib/i18n/context';
import { openInMaps } from '@/lib/open-external';
import { colors, fonts, radii, shadow, space } from '@/theme';

/** Höhe der Kartenvorschau: genug Platz für Straßen rund um den Pin. */
const MAP_HEIGHT = 200;

export interface LocationCardProps {
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

/**
 * Anfahrt-Kachel der Standortseite: Kartenvorschau, Name und Adresse.
 * Die ganze Kachel öffnet Apple Karten bzw. Google Maps. Ohne Koordinaten nur die Adresszeile.
 */
export function LocationCard({ name, address, lat, lng }: LocationCardProps) {
  const { t } = useT();
  const v = t.screens.venue;
  const hasCoords = lat !== null && lng !== null;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={v.openInMaps(address || name)}
      accessibilityHint={v.routeHint}
      onPress={() => void openInMaps({ label: name, address, lat, lng })}
      pressedScale={0.99}
      style={styles.card}
    >
      {hasCoords ? (
        <MiniMap lat={lat} lng={lng} label={name} height={MAP_HEIGHT} style={styles.map} />
      ) : null}
      <View style={styles.row}>
        <MapPin size={22} color={colors.accent.strong} strokeWidth={2} />
        <View style={styles.text}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {name}
          </Text>
          {address ? (
            <Text variant="footnote" color="secondary">
              {address}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={[styles.row, styles.routeRow]}>
        <Navigation size={18} color={colors.accent.strong} strokeWidth={2.25} />
        <Text variant="subhead" color="accent" style={[styles.text, styles.semibold]}>
          {v.openRoute}
        </Text>
        <ChevronRight size={20} color={colors.text.tertiary} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface.raised,
    boxShadow: shadow.card,
    overflow: 'hidden',
  },
  map: { borderRadius: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  routeRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
  },
  text: { flex: 1, gap: space[0.5] },
  semibold: { fontFamily: fonts.semibold },
});
