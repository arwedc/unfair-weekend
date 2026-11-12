import { duration, easing, layout, radii, radius, shadow, shadows, space } from './layout';
import { palette } from './palette';
import { badge, themes } from './themes';
import { fontFamily, fontWeight, nativeFontFamily, textStyles } from './typography';

export * from './contrast';
export * from './css';
export * from './layout';
export * from './palette';
export * from './themes';
export * from './typography';

/** Alle Design-Tokens in einem Objekt. */
export const tokens = {
  palette,
  themes,
  space,
  layout,
  radii,
  radius,
  shadows,
  shadow,
  duration,
  easing,
  fontFamily,
  fontWeight,
  nativeFontFamily,
  textStyles,
  badge,
} as const;

export type Tokens = typeof tokens;
