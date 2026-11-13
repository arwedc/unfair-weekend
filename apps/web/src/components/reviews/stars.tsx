import { useId } from 'react';
import { DEFAULT_LOCALE, type Locale } from '@repo/shared/i18n';
import { getMessages } from '@/lib/i18n/messages';
import { formatRating, starFill } from '@/lib/reviews/format';

const STAR_PATH = 'M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z';

function Star({ fill, size }: { fill: 'full' | 'half' | 'empty'; size: number }) {
  const clipId = useId();
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden className="shrink-0">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="10" height="20" />
        </clipPath>
      </defs>
      <path
        d={STAR_PATH}
        className={
          fill === 'empty'
            ? 'fill-transparent stroke-border-strong'
            : fill === 'full'
              ? 'fill-accent-vivid stroke-accent-vivid'
              : 'fill-transparent stroke-accent-vivid'
        }
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      {fill === 'half' ? (
        <path d={STAR_PATH} clipPath={`url(#${clipId})`} className="fill-accent-vivid" />
      ) : null}
    </svg>
  );
}

/** Fünf Sterne für einen Wert von 0 bis 5 (halbe Sterne möglich). */
export function Stars({
  value,
  size = 16,
  locale = DEFAULT_LOCALE,
}: {
  value: number;
  size?: number;
  locale?: Locale;
}) {
  return (
    <span
      role="img"
      aria-label={getMessages(locale).reviews.starsAria(formatRating(value, locale))}
      className="inline-flex items-center gap-0.5"
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} fill={starFill(value, i)} size={size} />
      ))}
    </span>
  );
}
