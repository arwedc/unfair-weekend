import type { Enums } from '@repo/shared';
import { getLabels, type Locale } from '@repo/shared/i18n';

const STATUS_CLASS: Record<Enums<'voucher_status'>, string> = {
  aktiv: 'bg-accent-subtle text-accent-on-subtle',
  eingeloest: 'bg-status-success-subtle text-status-success-on-subtle',
  no_show: 'bg-status-warning-subtle text-status-warning-on-subtle',
  storniert: 'bg-background-muted text-text-secondary',
  abgelaufen: 'bg-background-muted text-text-secondary',
};

export function VoucherStatusBadge({
  status,
  locale,
}: {
  status: Enums<'voucher_status'>;
  locale: Locale;
}) {
  return (
    <span className={`rounded-badge px-1.5 py-0.5 text-caption ${STATUS_CLASS[status]}`}>
      {getLabels(locale).voucherStatus[status]}
    </span>
  );
}
