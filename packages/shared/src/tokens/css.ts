/**
 * Wandelt die Tokens in CSS-Variablen um (für das Web und Tailwind v4).
 *
 * Tailwind v4 wird CSS-first über `@theme` konfiguriert. Die Website kann den
 * Block aus `tailwindThemeCss()` per kleinem Skript in eine CSS-Datei schreiben
 * und dort importieren. Die Namen folgen den Tailwind-Namensräumen
 * (`--color-*`, `--radius-*`, `--shadow-*`, `--text-*`, `--font-*`, `--spacing`),
 * sodass Klassen wie `bg-accent-solid`, `rounded-card` oder `text-title1` entstehen.
 */
import { radii, radius, shadow, shadows, spacingUnit } from './layout';
import { glut, gray } from './palette';
import { type ColorMode, themes } from './themes';
import { fontFamily, fontWeight, textStyles } from './typography';

function kebab(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function flattenColors(
  value: unknown,
  path: string[],
  out: Record<string, string>,
): Record<string, string> {
  if (typeof value === 'string') {
    out[`--color-${path.map(kebab).join('-')}`] = value;
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flattenColors(child, [...path, key], out);
    }
  }
  return out;
}

/** Nur die Farben eines Modus, z. B. für `:root` oder `[data-theme="dark"]`. */
export function colorCssVariables(mode: ColorMode = 'light'): Record<string, string> {
  return flattenColors(themes[mode], [], {});
}

/** Alle Tokens als CSS-Variablen (Name → Wert). */
export function toCssVariables(mode: ColorMode = 'light'): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const [step, hex] of Object.entries(gray)) vars[`--color-gray-${step}`] = hex;
  for (const [step, hex] of Object.entries(glut)) vars[`--color-glut-${step}`] = hex;
  Object.assign(vars, colorCssVariables(mode));

  vars['--spacing'] = `${spacingUnit}px`;

  for (const [name, px] of Object.entries(radii)) vars[`--radius-${name}`] = `${px}px`;
  for (const [name, px] of Object.entries(radius)) vars[`--radius-${name}`] = `${px}px`;

  for (const [name, value] of Object.entries(shadows)) vars[`--shadow-${name}`] = value;
  for (const [name, value] of Object.entries(shadow)) vars[`--shadow-${kebab(name)}`] = value;

  vars['--font-sans'] = fontFamily.web;
  for (const [name, weight] of Object.entries(fontWeight)) {
    vars[`--font-weight-${name}`] = String(weight);
  }

  for (const [name, style] of Object.entries(textStyles)) {
    const key = `--text-${kebab(name)}`;
    vars[key] = `${style.fontSize}px`;
    vars[`${key}--line-height`] = `${style.lineHeight}px`;
    vars[`${key}--font-weight`] = String(style.fontWeight);
    vars[`${key}--letter-spacing`] = `${style.letterSpacing}px`;
  }

  return vars;
}

function toDeclarations(vars: Record<string, string>, indent = '  '): string {
  return Object.entries(vars)
    .map(([name, value]) => `${indent}${name}: ${value};`)
    .join('\n');
}

/** CSS-Block für Tailwind v4: `@theme { … }`. */
export function tailwindThemeCss(mode: ColorMode = 'light'): string {
  return `@theme {\n${toDeclarations(toCssVariables(mode))}\n}\n`;
}

/** Beliebiger CSS-Block, z. B. `cssVariablesBlock(':root')`. */
export function cssVariablesBlock(selector: string, mode: ColorMode = 'light'): string {
  return `${selector} {\n${toDeclarations(toCssVariables(mode))}\n}\n`;
}
