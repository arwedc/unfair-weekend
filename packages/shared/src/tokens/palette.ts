/**
 * Rohpalette. Komponenten verwenden diese Werte nicht direkt, sondern die
 * semantischen Tokens aus `themes.ts`. So kann später ein Dunkelmodus
 * dieselben Namen mit anderen Werten belegen.
 */

export const white = '#FFFFFF';
export const black = '#0A0A0A';

/** Neutrale Grauskala, fein abgestuft. */
export const gray = {
  25: '#FAFAFA',
  50: '#F5F5F5',
  100: '#EDEDED',
  200: '#E0E0E0',
  300: '#CFCFCF',
  400: '#B4B4B4',
  500: '#8F8F8F',
  600: '#6E6E6E',
  700: '#525252',
  800: '#383838',
  900: '#222222',
  950: '#141414',
} as const;

/**
 * Akzentfarbe „Gold“: warmes Goldgelb, Markenton #FCC753 (Stufe 400). Gilt für App und Website.
 * - 400 ist der Markenton für Flächen (Buttons, Chips, Badges, Sterne). Darauf nur
 *   schwarzer Text, weißer Text wäre zu schwach (1,6:1).
 * - 600 ist der Fokus-Rahmen.
 * - 700 ist der Arbeitston für Akzent-Text, Links, Icons und Linien auf Weiß (≥ 4,5:1).
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

/**
 * Frühere Akzentfarbe „Glut“ (bis 14.11.2026): warmes, mattes Orange. Nicht mehr im Theme,
 * bleibt nur als Rohpalette erhalten.
 *
 * Wärmer und weniger grell als ein reines Signal-Orange, damit es das Auge nicht angreift.
 * - 500 ist der Markenton (große Flächen, Illustrationen, große fette Zahlen).
 * - 600 ist der Arbeitston für Flächen mit weißem Text (Buttons, Deal-Badges)
 *   und für Akzent-Text auf Weiß: Kontrast ≥ 4,5:1 (WCAG AA), auch auf 50.
 * - 50–200 sind zarte Flächen (Hintergründe, Formen, Avatare).
 */
export const glut = {
  50: '#FDF6F0',
  100: '#F8E2D2',
  200: '#F1C4A5',
  300: '#E8A378',
  400: '#E0874F',
  500: '#D9733A',
  600: '#B0531D',
  700: '#96461A',
  800: '#783817',
  900: '#5E2D14',
  950: '#34180A',
} as const;

/** Erfolg: Grün. */
export const green = {
  50: '#E7F6EC',
  600: '#15803D',
  800: '#11632F',
} as const;

/** Warnung: Bernstein-Gelb, bewusst weit weg vom Orange-Rot des Akzents. */
export const amber = {
  50: '#FFF6D6',
  400: '#F5B800',
  800: '#6B4E00',
} as const;

/** Fehler: Karmin. Kühler als der Akzent, damit Fehler nicht wie Deals aussehen. */
export const crimson = {
  50: '#FDECEF',
  600: '#BE123C',
  800: '#9F1239',
} as const;

export const palette = { white, black, gray, gold, glut, green, amber, crimson } as const;
