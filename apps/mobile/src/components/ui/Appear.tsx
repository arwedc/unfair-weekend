import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { duration } from '@/theme';

export interface AppearProps {
  children: ReactNode;
  /** Position in einer Liste. Spätere Einträge kommen leicht verzögert (höchstens 6 Stufen). */
  index?: number;
  style?: StyleProp<ViewStyle>;
}

const STAGGER_MS = 40;
const MAX_STAGGER_STEPS = 6;

/**
 * Sanftes Einblenden von unten, z. B. für Karten in Listen.
 * Bei „Bewegung reduzieren“ im System erscheint der Inhalt sofort.
 */
export function Appear({ children, index = 0, style }: AppearProps) {
  const entering = FadeInDown.duration(duration.slow)
    .delay(Math.min(index, MAX_STAGGER_STEPS) * STAGGER_MS)
    .reduceMotion(ReduceMotion.System);

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
