/**
 * Brücke zwischen den gemeinsamen Design-Tokens (@repo/shared) und React Native.
 * Komponenten importieren Farben, Abstände und Schriften nur von hier, nie als Hex-Wert.
 */
import {
  badge,
  black,
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
  type ThemeColors,
} from '@repo/shared/tokens';
import type { TextStyle } from 'react-native';

import { SATOSHI_AVAILABLE } from './satoshi.generated';

/**
 * Akzentfarbe der App „Gold“: warmes Goldgelb, Markenton #FCC753 (Stufe 400).
 * Gilt nur in der App; die Website nutzt weiter „Glut“ aus @repo/shared.
 * - 400 ist der Markenton für Flächen (Buttons, Chips, Badges, Nadeln). Darauf nur
 *   schwarzer Text, weißer Text wäre zu schwach (1,6:1).
 * - 700 ist der Arbeitston für Akzent-Text, Links und Icons auf Weiß (≥ 4,5:1).
 * - 50–200 sind zarte Flächen (Hintergründe, Formen, Avatare).
 */
export const gold = {
  50: '#FEF8EC',
  100: '#FDEDC9',
  200: '#FCDF9C',
  300: '#FCD173',
  400: '#FCC753',
  500: '#EDA71D',
  600: '#B87E14',
  700: '#885C11',
  800: '#66450F',
  900: '#4A310D',
  950: '#271A07',
} as const;

/** Farb-Tokens der App: wie in @repo/shared, dazu `accent.strong`. */
type AppThemeColors = ThemeColors & { accent: ThemeColors['accent'] & { strong: string } };

/** Farben der App: helles Theme aus den Tokens, Akzent auf Gold umgestellt. */
export const colors = {
  ...themes.light,
  text: {
    ...themes.light.text,
    accent: gold[700],
    onAccent: black,
    link: gold[700],
  },
  border: { ...themes.light.border, focus: gold[600] },
  accent: {
    solid: gold[400],
    solidPressed: gold[500],
    vivid: gold[400],
    /** Akzent für Icons, Linien und Text auf Weiß (aktives Herz, Tab, Ladekreis). */
    strong: gold[700],
    subtle: gold[50],
    onSubtle: gold[800],
    onSolid: black,
  },
  badge: { ...themes.light.badge, deal: { background: gold[400], foreground: black } },
} as const satisfies AppThemeColors;

/**
 * Zarte Akzent-Flächen aus der Gold-Palette, z. B. für Formen, Marker-Striche und Avatare.
 * Darauf nur dunkler Text oder `colors.accent.onSubtle`.
 */
export const soft = {
  /** fast weiß mit Wärme, für große Hintergründe */
  warm: gold[50],
  /** zartes Hellgold für Formen, Marker und Avatare */
  tint: gold[100],
  /** kräftigeres Hellgold für kleine Flächen */
  tintStrong: gold[200],
} as const;

/**
 * Bunte Töne für die Kategorie-Kacheln in „Entdecken“. Gold bleibt die Markenfarbe,
 * diese Töne machen den Feed lebendig. `ink` ist der lesbare Text auf `bg` (AA).
 */
export const fun = {
  peach: { bg: '#FFE4D6', ink: '#8A3A12' },
  mint: { bg: '#D5F4E4', ink: '#14593A' },
  lilac: { bg: '#E9E1FF', ink: '#4B2E91' },
  sky: { bg: '#DCEEFF', ink: '#1A4F80' },
  pink: { bg: '#FFE0EC', ink: '#8C1D4B' },
  lemon: { bg: gold[100], ink: gold[800] },
} as const;
export type FunTint = keyof typeof fun;

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

/**
 * Satoshi für Überschriften, Kartentitel und Preise; Fließtext bleibt Inter (ruhiger, gut lesbar).
 * Die Dateien lädt scripts/fetch-fonts.mjs beim Installieren. Fehlen sie, gilt überall Inter.
 */
export { SATOSHI_AVAILABLE };

/** Text-Stile in Satoshi (Überschriften, Titel, Preise, Codes). */
const DISPLAY_STYLES: ReadonlySet<TextStyleName> = new Set([
  'display',
  'title1',
  'title2',
  'title3',
  'headline',
  'price',
  'voucherCode',
]);

/** Satoshi-Schnitt zur Stärke des Tokens: kräftig bleibt kräftig, ohne zu fett zu wirken. */
export function displayFont(weight: number): string {
  if (!SATOSHI_AVAILABLE) return nativeFontFamily[weight as keyof typeof nativeFontFamily];
  if (weight >= 800) return 'Satoshi-Black';
  if (weight >= 600) return 'Satoshi-Bold';
  return 'Satoshi-Medium';
}

/** Wandelt einen Text-Token in einen React-Native-Stil um (Inter in der passenden Stärke). */
export function toTextStyle(token: TextStyleToken, display = false): TextStyle {
  return {
    // Bei eigenen Schriften wählt die Familie die Stärke; fontWeight würde auf Android stören.
    fontFamily: display ? displayFont(token.fontWeight) : nativeFontFamily[token.fontWeight],
    fontSize: token.fontSize,
    lineHeight: token.lineHeight,
    letterSpacing: token.letterSpacing,
    ...(token.textTransform ? { textTransform: token.textTransform } : {}),
    ...(token.tabularNums ? { fontVariant: ['tabular-nums'] } : {}),
  };
}

export function textStyle(name: TextStyleName): TextStyle {
  return toTextStyle(textStyles[name], DISPLAY_STYLES.has(name));
}

/** Obergrenze für die Systemschriftgröße, damit Layouts bei sehr großer Schrift nicht brechen. */
export const MAX_FONT_SCALE = 1.6;
