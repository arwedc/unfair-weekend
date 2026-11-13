import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { duration } from '@/theme';

/**
 * Stil und Animation liegen direkt auf der Pressable. So wirken Layout-Stile wie
 * `position: 'absolute'`, `flex: 1` oder `alignSelf` auf das antippbare Element selbst.
 * (Vorher lagen sie auf einer inneren Ansicht: absolut platzierte Knöpfe landeten
 * außerhalb des Bildschirms und `flex: 1` an Buttons hatte keine Wirkung.)
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Wie stark das Element beim Drücken schrumpft (1 = gar nicht). */
  pressedScale?: number;
}

/** Grundbaustein für alles Antippbare: sanftes Eindrücken, respektiert „Bewegung reduzieren“. */
export function PressableScale({
  style,
  pressedScale = 0.97,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  // get()/set() statt .value, damit der React Compiler die Shared Values akzeptiert.
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      onPressIn={(event) => {
        if (!reduceMotion) scale.set(withTiming(pressedScale, { duration: duration.fast }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withTiming(1, { duration: duration.base }));
        onPressOut?.(event);
      }}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
