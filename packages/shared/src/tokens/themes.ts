import { radius, shadow, space } from './layout';
import { amber, black, crimson, gold, gray, green, white } from './palette';

/** Farben für einen Status (Erfolg, Warnung, Fehler). */
export interface StatusColors {
  /** Volle Fläche, z. B. Banner oder Button. */
  solid: string;
  /** Text und Icons auf `solid`. */
  onSolid: string;
  /** Dezente Hintergrundfläche, z. B. Hinweisbox. */
  subtle: string;
  /** Text auf `subtle`. */
  onSubtle: string;
  /** Farbiger Text auf normalem Hintergrund. */
  text: string;
}

/** Farben eines Badges. */
export interface BadgeColors {
  background: string;
  foreground: string;
}

/**
 * Semantische Farb-Tokens. Komponenten nutzen nur diese Namen.
 * Ein Dunkelmodus braucht später nur ein zweites Objekt mit derselben Form.
 */
export interface ThemeColors {
  background: { default: string; subtle: string; muted: string; inverse: string };
  surface: { default: string; raised: string; sunken: string; overlay: string };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    inverse: string;
    /** Akzentfarbiger Text auf hellem Grund (z. B. Deal-Preis). */
    accent: string;
    /** Text auf Akzentflächen. */
    onAccent: string;
    link: string;
  };
  border: { default: string; subtle: string; strong: string; focus: string };
  accent: {
    /** Haupt-Buttons, aktive Elemente. Text darauf nur in `onSolid`. */
    solid: string;
    solidPressed: string;
    /** Leuchtender Markenton für große Flächen, Sterne und große, fette Zahlen. */
    vivid: string;
    /** Akzent für Icons, Linien und Auswahlrahmen auf Weiß (gut sichtbar, ≥ 4,5:1). */
    strong: string;
    subtle: string;
    onSubtle: string;
    onSolid: string;
  };
  status: { success: StatusColors; warning: StatusColors; error: StatusColors };
  /** Badge-Stufe, vor allem für Deal-Badges auf Fotos. */
  badge: {
    /** Rabatt, z. B. „−40 %“. */
    deal: BadgeColors;
    /** Dringlichkeit, z. B. „startet in 2 Std.“ oder „Nur noch 2 Plätze“. */
    urgent: BadgeColors;
    /** Neutrale Info auf Fotos, z. B. Kategorie. */
    neutral: BadgeColors;
    soldOut: BadgeColors;
  };
  /** Verlauf über Fotos, damit Text und Badges lesbar bleiben (oben → unten). */
  imageScrim: { from: string; to: string };
}

export const lightTheme = {
  background: {
    default: white,
    subtle: gray[25],
    muted: gray[50],
    inverse: black,
  },
  surface: {
    default: white,
    raised: white,
    sunken: gray[50],
    overlay: 'rgba(10, 10, 10, 0.5)',
  },
  text: {
    primary: black,
    secondary: gray[700],
    tertiary: gray[600],
    disabled: gray[400],
    inverse: white,
    accent: gold[700],
    onAccent: black,
    link: gold[700],
  },
  border: {
    default: gray[200],
    subtle: gray[100],
    strong: gray[300],
    focus: gold[600],
  },
  accent: {
    solid: gold[400],
    solidPressed: gold[500],
    vivid: gold[400],
    strong: gold[700],
    subtle: gold[50],
    onSubtle: gold[800],
    onSolid: black,
  },
  status: {
    success: {
      solid: green[600],
      onSolid: white,
      subtle: green[50],
      onSubtle: green[800],
      text: green[600],
    },
    warning: {
      solid: amber[400],
      onSolid: black,
      subtle: amber[50],
      onSubtle: amber[800],
      text: amber[800],
    },
    error: {
      solid: crimson[600],
      onSolid: white,
      subtle: crimson[50],
      onSubtle: crimson[800],
      text: crimson[600],
    },
  },
  badge: {
    deal: { background: gold[400], foreground: black },
    urgent: { background: black, foreground: white },
    neutral: { background: 'rgba(255, 255, 255, 0.92)', foreground: black },
    soldOut: { background: gray[800], foreground: white },
  },
  imageScrim: {
    from: 'rgba(10, 10, 10, 0)',
    to: 'rgba(10, 10, 10, 0.55)',
  },
} as const satisfies ThemeColors;

/**
 * Alle Farbmodi. Für den Dunkelmodus später `dark: darkTheme` ergänzen,
 * `darkTheme` muss dabei ebenfalls `ThemeColors` erfüllen.
 */
export const themes = {
  light: lightTheme,
} as const satisfies Record<string, ThemeColors>;

export type ColorMode = keyof typeof themes;

/** Geometrie der Deal-Badges (unabhängig vom Farbmodus). */
export const badge = {
  radius: radius.badge,
  paddingX: space[2],
  paddingY: space[1],
  gap: space[1],
  /** Abstand des Badges vom Bildrand. */
  inset: space[3],
  textStyle: { fontSize: 12, lineHeight: 16, fontWeight: 800, letterSpacing: 0.2 },
  shadow: shadow.badge,
  /** Größere Variante, z. B. auf dem Titelbild der Detailseite. */
  large: {
    paddingX: space[3],
    paddingY: space[1.5],
    textStyle: { fontSize: 15, lineHeight: 20, fontWeight: 800, letterSpacing: 0 },
  },
} as const;
