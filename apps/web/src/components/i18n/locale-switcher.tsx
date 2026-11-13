'use client';

import { LOCALE_NAMES, LOCALES } from '@repo/shared/i18n';
import { setLocaleAction } from '@/lib/i18n/actions';
import { useT } from '@/lib/i18n/context';

/** Umschalter Deutsch/Englisch. Zeigt beide Sprachen, die aktive ist markiert. */
export function LocaleSwitcher() {
  const { locale, t } = useT();
  return (
    <form
      action={setLocaleAction}
      role="group"
      aria-label={t.common.locale.label}
      className="flex items-center rounded-button border border-border-default p-0.5"
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="submit"
          name="locale"
          value={l}
          lang={l}
          aria-pressed={l === locale}
          title={t.common.locale.switchTo(LOCALE_NAMES[l])}
          className={`min-h-8 rounded-button px-2.5 text-footnote font-semibold uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus ${
            l === locale
              ? 'bg-background-muted text-text-primary'
              : 'cursor-pointer text-text-tertiary hover:text-text-primary'
          }`}
        >
          {l}
        </button>
      ))}
    </form>
  );
}
