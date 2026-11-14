/**
 * Das Bildzeichen von Kiepn: ein K aus Kartennadel (oben links), Fuß (unten links) und
 * Winkel (rechts). Als Zeichenpfade, damit es überall scharf bleibt: in der Karte (WebView,
 * `Path2D`) und später in der App (react-native-svg) aus derselben Quelle.
 *
 * Raster: 100 × 111,25 Einheiten, nachgezeichnet vom Logo-Entwurf. Fuß und Winkel sind
 * nach innen versetzt und werden zusätzlich mit runder Linie (`roundStroke`) nachgezogen;
 * so bekommen sie die weichen Ecken des Logos, ohne dass jede Ecke einzeln gebogen werden muss.
 */

export interface LogoMarkShape {
  /** SVG-Pfad im Raster von `LOGO_MARK.width` × `LOGO_MARK.height`. */
  d: string;
  /** `evenodd`, damit das Loch im Nadelkopf frei bleibt. */
  fillRule: 'nonzero' | 'evenodd';
  /** Breite der runden Linie, die die Form nachzieht (0 = nur Fläche). */
  roundStroke: number;
}

export const LOGO_MARK = {
  width: 100,
  height: 111.25,
  shapes: [
    // Kartennadel mit Loch im Kopf
    {
      d: 'M5.62 39.09A23.75 23.75 0 1 1 41.88 39.09L25.17 58.82Q23.75 60.5 22.33 58.82Z M33 24.75A9.5 9.5 0 1 0 14 24.75A9.5 9.5 0 1 0 33 24.75Z',
      fillRule: 'evenodd',
      roundStroke: 0,
    },
    // Fuß unter der Nadel
    {
      d: 'M6.25 108.25L6.25 71Q6.25 68 9.5 68Q29 82 34.3 108.25Z',
      fillRule: 'nonzero',
      roundStroke: 5,
    },
    // Winkel „<“
    {
      d: 'M76 27.75L95.1 27.75L61 68.9L94 109L74 109L40.5 69Z',
      fillRule: 'nonzero',
      roundStroke: 5,
    },
  ] satisfies readonly LogoMarkShape[],
} as const;
