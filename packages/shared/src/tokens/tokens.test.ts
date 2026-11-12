import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import { colorCssVariables, tailwindThemeCss, toCssVariables } from './css';
import { white } from './palette';
import { lightTheme, themes } from './themes';

const AA_NORMAL_TEXT = 4.5;

describe('contrastRatio', () => {
  it('liefert die bekannten Grenzwerte', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('lehnt ungültige Farben ab', () => {
    expect(() => contrastRatio('rot', '#FFFFFF')).toThrow();
  });
});

describe('Hellmodus erfüllt WCAG AA (4,5:1) für Text', () => {
  const t = lightTheme;
  const pairs: [name: string, foreground: string, background: string][] = [
    ['Text primär auf Hintergrund', t.text.primary, t.background.default],
    ['Text sekundär auf Hintergrund', t.text.secondary, t.background.default],
    ['Text tertiär auf Hintergrund', t.text.tertiary, t.background.default],
    ['Text tertiär auf gedämpftem Hintergrund', t.text.tertiary, t.background.muted],
    ['Akzent-Text auf Hintergrund', t.text.accent, t.background.default],
    ['Button-Text auf Akzent', t.accent.onSolid, t.accent.solid],
    ['Button-Text auf Akzent (gedrückt)', t.accent.onSolid, t.accent.solidPressed],
    ['Text auf dezentem Akzent', t.accent.onSubtle, t.accent.subtle],
    ['Deal-Badge', t.badge.deal.foreground, t.badge.deal.background],
    ['Dringlichkeits-Badge', t.badge.urgent.foreground, t.badge.urgent.background],
    ['Ausverkauft-Badge', t.badge.soldOut.foreground, t.badge.soldOut.background],
    ['Neutrales Badge (auf Weiß gerechnet)', t.badge.neutral.foreground, white],
    ...(['success', 'warning', 'error'] as const).flatMap((status): [string, string, string][] => [
      [`${status}: Text auf Fläche`, t.status[status].onSolid, t.status[status].solid],
      [`${status}: Text auf dezenter Fläche`, t.status[status].onSubtle, t.status[status].subtle],
      [`${status}: farbiger Text`, t.status[status].text, t.background.default],
    ]),
  ];

  it.each(pairs)('%s', (_name, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});

describe('CSS-Variablen', () => {
  it('erzeugt Farbvariablen aus den semantischen Tokens', () => {
    const vars = colorCssVariables('light');
    expect(vars['--color-accent-solid']).toBe(lightTheme.accent.solid);
    expect(vars['--color-badge-deal-background']).toBe(lightTheme.badge.deal.background);
    expect(vars['--color-status-success-on-solid']).toBe(lightTheme.status.success.onSolid);
  });

  it('erzeugt Tailwind-v4-Namensräume', () => {
    const vars = toCssVariables();
    expect(vars['--spacing']).toBe('4px');
    expect(vars['--radius-card']).toBe('16px');
    expect(vars['--text-title1']).toBe('32px');
    expect(vars['--text-title1--line-height']).toBe('38px');
    expect(vars['--color-glut-500']).toBe('#FF5A1F');
    expect(vars['--font-sans']).toContain('Inter');
  });

  it('erzeugt einen @theme-Block', () => {
    const css = tailwindThemeCss();
    expect(css.startsWith('@theme {\n')).toBe(true);
    expect(css).toContain(`  --color-accent-solid: ${lightTheme.accent.solid};`);
  });

  it('hat für jeden Farbmodus dieselben Variablennamen', () => {
    const reference = Object.keys(colorCssVariables('light')).sort();
    for (const mode of Object.keys(themes) as (keyof typeof themes)[]) {
      expect(Object.keys(colorCssVariables(mode)).sort()).toEqual(reference);
    }
  });
});
