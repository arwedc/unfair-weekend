/**
 * Abstände, Radien, Schatten und Bewegung.
 * Alle Längen sind Zahlen in px (Web) bzw. dp (React Native).
 */

/**
 * 4/8-pt-Raster. Der Schlüssel ist das Vielfache von 4 px, z. B. `space[4]` = 16.
 * Das entspricht der Tailwind-Logik (`p-4` = 16 px bei `--spacing: 4px`).
 */
export const space = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

/** Grundeinheit des Rasters in px. */
export const spacingUnit = 4;

/** Wiederkehrende Layout-Abstände, damit App und Web gleich „atmen“. */
export const layout = {
  /** Seitlicher Rand auf Mobilgeräten. */
  screenPaddingX: space[4],
  /** Innenabstand von Karten. */
  cardPadding: space[3],
  /** Abstand zwischen Karten in Listen und Rastern. */
  gridGap: space[3],
  /** Abstand zwischen Abschnitten einer Seite. */
  sectionGap: space[8],
  /** Mindestgröße für Touch-Ziele. */
  minTouchTarget: 44,
} as const;

/** Radien-Skala. */
export const radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 28,
  full: 9999,
} as const;

/** Semantische Radien für wiederkehrende Bausteine. */
export const radius = {
  badge: radii.sm,
  button: radii.full,
  input: radii.md,
  image: radii.md,
  card: radii.lg,
  sheet: radii['2xl'],
} as const;

/**
 * Schatten-Stufen als CSS-`box-shadow`-Strings.
 * Funktionieren im Web direkt und in React Native (ab 0.76, New Architecture)
 * über die Style-Eigenschaft `boxShadow`.
 */
export const shadows = {
  none: '0 0 0 rgba(0, 0, 0, 0)',
  xs: '0 1px 2px rgba(10, 10, 10, 0.06)',
  sm: '0 1px 3px rgba(10, 10, 10, 0.08), 0 1px 2px rgba(10, 10, 10, 0.04)',
  md: '0 4px 12px rgba(10, 10, 10, 0.08), 0 2px 4px rgba(10, 10, 10, 0.04)',
  lg: '0 12px 28px rgba(10, 10, 10, 0.12), 0 4px 8px rgba(10, 10, 10, 0.06)',
  xl: '0 24px 48px rgba(10, 10, 10, 0.16), 0 8px 16px rgba(10, 10, 10, 0.08)',
} as const;

/** Semantische Schatten. */
export const shadow = {
  card: shadows.sm,
  cardPressed: shadows.xs,
  floating: shadows.lg,
  sheet: shadows.xl,
  /** Deal-Badges auf Fotos: kräftiger, damit sie sich vom Bild lösen. */
  badge: '0 2px 6px rgba(10, 10, 10, 0.25)',
} as const;

/** Animationsdauern in ms. */
export const duration = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;

/** Kubische Bézier-Kurven als [x1, y1, x2, y2] (z. B. für Reanimated `Easing.bezier`). */
export const easing = {
  standard: [0.2, 0, 0, 1],
  emphasized: [0.3, 0, 0, 1],
  exit: [0.3, 0, 1, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;
