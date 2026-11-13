import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { PressableScale } from '@/components/ui';
import { buildMiniMapHtml } from '@/features/map/mini-map-html';
import { env } from '@/lib/env';
import { colors, radii } from '@/theme';

export interface MiniMapProps {
  lat: number;
  lng: number;
  /** Für Screenreader, z. B. der Name des Ortes. */
  label: string;
  onPress: () => void;
  height?: number;
}

/** Kleine Kartenvorschau mit einem Pin. Ein Tipp öffnet die Karten-App. */
export function MiniMap({ lat, lng, label, onPress, height = 168 }: MiniMapProps) {
  const html = buildMiniMapHtml({
    styleUrl: env.mapStyleUrl,
    lat,
    lng,
    pinColor: colors.background.inverse,
    background: colors.background.muted,
  });

  return (
    <View style={[styles.frame, { height }]}>
      <WebView
        source={{ html }}
        originWhitelist={['*']}
        style={styles.map}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Karte: ${label}`}
        accessibilityHint="Öffnet die Adresse in deiner Karten-App"
        onPress={onPress}
        pressedScale={0.99}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.background.muted },
  map: { flex: 1, backgroundColor: colors.background.muted },
});
