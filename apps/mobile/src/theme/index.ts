/**
 * Brücke zwischen den gemeinsamen Design-Tokens (@repo/shared) und React Native.
 * Komponenten importieren Farben, Abstände und Schriften nur von hier, nie als Hex-Wert.
 */
import {
  badge,
  duration,
  layout,
  nativeFontFamily,
  radii,
  radius,
  shadow,
  space,
  textStyles,
  themes,
  type TextStyleName,
  type TextStyleToken,
} from '@repo/shared/tokens';
import type { TextStyle } from 'react-native';

/** Die App hat vorerst nur ein helles Theme (wie die Tokens). */
export const colors = themes.light;

export { badge, duration, layout, radii, radius, shadow, space };
export type { TextStyleName };

/** Inter-Schnitte nach Stärke, z. B. um einen Text-Token gezielt fetter zu machen. */
export const fonts = {
  regular: nativeFontFamily[400],
  medium: nativeFontFamily[500],
  semibold: nativeFontFamily[600],
  bold: nativeFontFamily[700],
  extrabold: nativeFontFamily[800],
} as const;

/** Wandelt einen Text-Token in einen React-Native-Stil um (Inter in der passenden Stärke). */
export function toTextStyle(token: TextStyleToken): TextStyle {
  return {
    // Bei eigenen Schriften wählt die Familie die Stärke; fontWeight würde auf Android stören.
    fontFamily: nativeFontFamily[token.fontWeight],
    fontSize: token.fontSize,
    lineHeight: token.lineHeight,
    letterSpacing: token.letterSpacing,
    ...(token.textTransform ? { textTransform: token.textTransform } : {}),
    ...(token.tabularNums ? { fontVariant: ['tabular-nums'] } : {}),
  };
}

export function textStyle(name: TextStyleName): TextStyle {
  return toTextStyle(textStyles[name]);
}

/** Obergrenze für die Systemschriftgröße, damit Layouts bei sehr großer Schrift nicht brechen. */
export const MAX_FONT_SCALE = 1.6;
