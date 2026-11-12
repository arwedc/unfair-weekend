import { OFFER_STATUS_LABELS, type Enums, type Tables } from '@repo/shared';
import { formatDateRange, formatTimeRange } from '@repo/shared/utils';

export function OfferTime({
  offer,
}: {
  offer: Pick<Tables<'offers'>, 'type' | 'starts_at' | 'ends_at'>;
}) {
  return offer.type === 'einzeltermin'
    ? formatTimeRange(offer.starts_at, offer.ends_at)
    : formatDateRange(offer.starts_at, offer.ends_at);
}

const STATUS_CLASS: Record<Enums<'offer_status'>, string> = {
  aktiv: 'bg-status-success-subtle text-status-success-on-subtle',
  abgesagt: 'bg-status-error-subtle text-status-error-on-subtle',
  entfernt: 'bg-background-muted text-text-secondary',
};

export function OfferStatusBadge({ status }: { status: Enums<'offer_status'> }) {
  return (
    <span className={`rounded-badge px-1.5 py-0.5 text-caption ${STATUS_CLASS[status]}`}>
      {OFFER_STATUS_LABELS[status]}
    </span>
  );
}
