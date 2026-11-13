import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radii, shadow } from '@/theme';

export interface GlassSurfaceProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Einmal pro App-Start prüfen: iOS 26 hat das echte „Liquid Glass“ der Tab-Leiste.
const LIQUID_GLASS = isLiquidGlassAvailable();

/**
 * Schwebende Kachel mit demselben Glas wie die native Tab-Leiste.
 * - iOS 26: echtes Liquid Glass (expo-glass-effect)
 * - ältere iOS-Versionen: System-Milchglas (expo-blur)
 * - Android: fast deckendes Weiß, weil Unschärfe dort unzuverlässig ist
 */
export function GlassSurface({ children, style }: GlassSurfaceProps) {
  return (
    <View style={[styles.base, !LIQUID_GLASS && styles.framed, style]}>
      {LIQUID_GLASS ? (
        <GlassView style={StyleSheet.absoluteFill} glassEffectStyle="regular" />
      ) : Platform.OS === 'ios' ? (
        <BlurView
          style={StyleSheet.absoluteFill}
          tint="systemChromeMaterialLight"
          intensity={100}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.androidFill]} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radii.full, borderCurve: 'continuous', overflow: 'hidden' },
  // Ohne Liquid Glass fehlt die eingebaute Kante: feine Linie und weicher Schatten.
  framed: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(10, 10, 10, 0.08)',
    boxShadow: shadow.card,
  },
  androidFill: { backgroundColor: 'rgba(255, 255, 255, 0.94)' },
});
