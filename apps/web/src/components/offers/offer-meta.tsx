import { type Enums, type Tables } from '@repo/shared';
import { getLabels, type Locale } from '@repo/shared/i18n';
import { formatDateRange, formatTimeRange } from '@repo/shared/utils';

export function OfferTime({
  offer,
  locale,
}: {
  offer: Pick<Tables<'offers'>, 'type' | 'starts_at' | 'ends_at'>;
  locale: Locale;
}) {
  return offer.type === 'einzeltermin'
    ? formatTimeRange(offer.starts_at, offer.ends_at, undefined, locale)
    : formatDateRange(offer.starts_at, offer.ends_at, undefined, locale);
}

const STATUS_CLASS: Record<Enums<'offer_status'>, string> = {
  aktiv: 'bg-status-success-subtle text-status-success-on-subtle',
  abgesagt: 'bg-status-error-subtle text-status-error-on-subtle',
  entfernt: 'bg-background-muted text-text-secondary',
};

export function OfferStatusBadge({
  status,
  locale,
}: {
  status: Enums<'offer_status'>;
  locale: Locale;
}) {
  return (
    <span className={`rounded-badge px-1.5 py-0.5 text-caption ${STATUS_CLASS[status]}`}>
      {getLabels(locale).offerStatus[status]}
    </span>
  );
}
