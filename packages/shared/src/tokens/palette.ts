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
 * Akzentfarbe „Glut“: energiegeladenes Orange-Rot.
 * - 500 ist der Markenton (große Flächen, Illustrationen, große fette Zahlen).
 * - 600 ist der Arbeitston für Flächen mit weißem Text (Buttons, Deal-Badges)
 *   und für Akzent-Text auf Weiß: Kontrast ≥ 4,5:1 (WCAG AA).
 */
export const glut = {
  50: '#FFF3EE',
  100: '#FFE3D6',
  200: '#FFC4AA',
  300: '#FF9C75',
  400: '#FF7745',
  500: '#FF5A1F',
  600: '#D63A0A',
  700: '#B0300A',
  800: '#8A280C',
  900: '#6E220D',
  950: '#3D0F06',
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

export const palette = { white, black, gray, glut, green, amber, crimson } as const;
