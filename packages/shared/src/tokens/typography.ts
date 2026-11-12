/**
 * Typografie auf Basis von Inter (Open Source, SIL OFL).
 * - Web: über `next/font/google` laden und `fontFamily.web` als Stack nutzen.
 * - App: über `@expo-google-fonts/inter` laden. Dort ist jedes Gewicht eine
 *   eigene Familie, siehe `nativeFontFamily`.
 */

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

export type FontWeight = (typeof fontWeight)[keyof typeof fontWeight];

export const fontFamily = {
  /** Logischer Name der Schrift. */
  sans: 'Inter',
  /** CSS-Font-Stack für das Web. */
  web: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const;

/** Familiennamen aus `@expo-google-fonts/inter`, je Gewicht. */
export const nativeFontFamily = {
  400: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
  800: 'Inter_800ExtraBold',
} as const satisfies Record<FontWeight, string>;

export interface TextStyleToken {
  fontSize: number;
  lineHeight: number;
  fontWeight: FontWeight;
  /** In px (Web) bzw. dp (React Native). */
  letterSpacing: number;
  textTransform?: 'uppercase';
  /** Gleich breite Ziffern, z. B. für Preise und Countdowns. */
  tabularNums?: boolean;
}

/**
 * Textstile. Große Überschriften sind eng gesetzt und fett (urban, plakativ),
 * Fließtext bleibt ruhig und gut lesbar.
 */
export const textStyles = {
  display: { fontSize: 40, lineHeight: 44, fontWeight: 800, letterSpacing: -0.8 },
  title1: { fontSize: 32, lineHeight: 38, fontWeight: 800, letterSpacing: -0.5 },
  title2: { fontSize: 24, lineHeight: 30, fontWeight: 700, letterSpacing: -0.3 },
  title3: { fontSize: 20, lineHeight: 26, fontWeight: 700, letterSpacing: -0.2 },
  headline: { fontSize: 17, lineHeight: 24, fontWeight: 600, letterSpacing: -0.1 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: 400, letterSpacing: 0 },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: 600, letterSpacing: 0 },
  callout: { fontSize: 15, lineHeight: 22, fontWeight: 400, letterSpacing: 0 },
  subhead: { fontSize: 14, lineHeight: 20, fontWeight: 500, letterSpacing: 0 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: 400, letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: 500, letterSpacing: 0.1 },
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  /** Deal-Preis in Karten. */
  price: { fontSize: 22, lineHeight: 26, fontWeight: 800, letterSpacing: -0.3, tabularNums: true },
  /** Gutschein-Kurzcode, z. B. „K7Q-4MX“. */
  voucherCode: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 800,
    letterSpacing: 2,
    tabularNums: true,
  },
} as const satisfies Record<string, TextStyleToken>;

export type TextStyleName = keyof typeof textStyles;
