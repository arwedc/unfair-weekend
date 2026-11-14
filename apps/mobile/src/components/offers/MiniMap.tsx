import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

import { buildMiniMapHtml } from '@/features/map/mini-map-html';
import { env } from '@/lib/env';
import { useT } from '@/lib/i18n/context';
import { colors, radii } from '@/theme';

export interface MiniMapProps {
  lat: number;
  lng: number;
  /** Name des Ortes: Schild am Pin und Text für Screenreader. */
  label: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/** Kleine, nicht antippbare Kartenvorschau mit einem Pin und Namensschild. */
export function MiniMap({ lat, lng, label, height = 168, style }: MiniMapProps) {
  const { t } = useT();
  const html = buildMiniMapHtml({
    styleUrl: env.mapStyleUrl,
    lat,
    lng,
    pinColor: colors.accent.solid,
    background: colors.background.muted,
    label,
  });

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t.parts.card.mapPreview(label)}
      style={[styles.frame, { height }, style]}
    >
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
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.background.muted },
  map: { flex: 1, backgroundColor: colors.background.muted },
});
