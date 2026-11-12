import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { duration } from '@/theme';

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
    <Pressable
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
      {(state) => (
        <Animated.View style={[style, animatedStyle]}>
          {typeof children === 'function' ? children(state) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}
