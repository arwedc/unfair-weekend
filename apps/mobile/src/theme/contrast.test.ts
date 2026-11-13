/**
 * Kontraste der Farbpaare, die nur die App so kombiniert.
 * Die Grundpaare (Text auf Weiß, Badges, Status) prüft schon packages/shared (tokens.test.ts).
 */
import { contrastRatio } from '@repo/shared/tokens';
import { describe, expect, it } from 'vitest';

import { colors, soft } from './index';

/** WCAG AA: Fließtext 4,5:1, Icons und große Schrift 3:1. */
const AA_TEXT = 4.5;
const AA_GRAPHICS = 3;

type Pair = [name: string, foreground: string, background: string];

const textPairs: Pair[] = [
  [
    'Status-Pill neutral (Text sekundär auf gedämpft)',
    colors.text.secondary,
    colors.background.muted,
  ],
  ['Zweit-Button (Text primär auf gedämpft)', colors.text.primary, colors.background.muted],
  [
    'Vergangene Codes: Kurzcode (Akzent-Text auf dezent)',
    colors.text.accent,
    colors.background.subtle,
  ],
  [
    'Vergangene Codes: Metazeile (Text tertiär auf dezent)',
    colors.text.tertiary,
    colors.background.subtle,
  ],
  [
    'Rechtliches: Fließtext (Text sekundär auf dezent)',
    colors.text.secondary,
    colors.background.subtle,
  ],
  ['Karte: Cluster-Zahl (invers auf invers)', colors.text.inverse, colors.background.inverse],
  ['Karte: Rabatt im Pin (auf Akzent)', colors.accent.onSolid, colors.accent.solid],
  ['Gefahr-Button (Konto löschen)', colors.status.error.onSolid, colors.status.error.solid],
  ['Kategorie-Pille und Avatar (dunkles Akzent auf Apricot)', colors.accent.onSubtle, soft.tint],
  ['„Du sparst“ (dunkles Akzent auf warmem Weiß)', colors.accent.onSubtle, soft.warm],
  ['Rabatt-Sticker (weiß auf Akzent)', colors.accent.onSolid, colors.accent.solid],
  ['Location-Karte: Text sekundär auf warmem Weiß', colors.text.secondary, soft.warm],
  ['Location-Karte: Akzent-Overline auf warmem Weiß', colors.text.accent, soft.warm],
  ['Fehlertext unter Eingabefeld', colors.status.error.text, colors.surface.default],
];

const graphicPairs: Pair[] = [
  ['Leerzustand-Icon neutral', colors.accent.onSubtle, colors.accent.subtle],
  ['Leerzustand-Icon Fehler', colors.status.error.text, colors.status.error.subtle],
  ['Aktives Herz / aktiver Tab', colors.accent.solid, colors.surface.raised],
  ['Rahmen des Eingabefelds im Fokus', colors.border.focus, colors.surface.default],
];

describe('Text in der App erfüllt WCAG AA (4,5:1)', () => {
  it.each(textPairs)('%s', (_name, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('Icons und Rahmen erfüllen WCAG AA für Grafiken (3:1)', () => {
  it.each(graphicPairs)('%s', (_name, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(AA_GRAPHICS);
  });
});
