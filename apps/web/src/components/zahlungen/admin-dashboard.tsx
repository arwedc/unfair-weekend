import {
  BOOKING_CANCEL_REASON_LABELS,
  BOOKING_STATUS_LABELS,
  PAYMENT_JOB_KIND_LABELS,
  PAYMENT_JOB_STATUS_LABELS,
  REFUND_STATUS_LABELS,
  TRANSFER_STATUS_LABELS,
  formatDateTime,
  formatPrice,
} from '@repo/shared';
import { Card } from '@/components/ui';
import { PaymentSettingsForm } from './payment-settings-form';
import { getAdminPaymentData } from '@/lib/zahlungen/queries';

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-footnote text-text-secondary">{label}</p>
      <p className="mt-1 text-title3 text-text-primary">{value}</p>
    </Card>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10" aria-label={title}>
      <div className="mb-4">
        <h2 className="text-headline text-text-primary">{title}</h2>
        {description ? (
          <p className="mt-1 text-callout text-text-secondary">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function EmptyRows({ children }: { children: string }) {
  return (
    <p className="rounded-card border border-border-subtle bg-surface-raised p-5 text-callout text-text-secondary">
      {children}
    </p>
  );
}

function TableFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border-subtle bg-surface-raised shadow-card">
      {children}
    </div>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-border-subtle bg-background-muted text-text-secondary">
      {children}
    </thead>
  );
}

const DISPUTE_STATUS_LABELS: Record<string, string> = {
  needs_response: 'Antwort erforderlich',
  warning_needs_response: 'Antwort erforderlich',
  under_review: 'Wird geprüft',
  warning_under_review: 'Wird geprüft',
  won: 'Gewonnen',
  lost: 'Verloren',
  charge_refunded: 'Zahlung erstattet',
  prevented: 'Verhindert',
};

const DISPUTE_REASON_LABELS: Record<string, string> = {
  duplicate: 'Doppelte Zahlung',
  fraudulent: 'Verdacht auf Betrug',
  product_not_received: 'Leistung nicht erhalten',
  product_unacceptable: 'Leistung nicht akzeptabel',
  subscription_canceled: 'Abonnement gekündigt',
  unrecognized: 'Zahlung nicht erkannt',
  credit_not_processed: 'Gutschrift nicht verarbeitet',
  general: 'Allgemeiner Grund',
  other: 'Sonstiger Grund',
};

export async function AdminDashboard() {
  const data = await getAdminPaymentData();
  const bookingById = new Map(data.bookings.map((booking) => [booking.booking_id, booking]));
  const weekStart = (date: string) => formatDateTime(date + 'T12:00:00Z');

  return (
    <>
      <h1 className="text-title2 text-text-primary">Zahlungen</h1>
      <p className="mb-6 mt-1 text-callout text-text-secondary">
        Einstellungen und Überblick zu bezahlten Buchungen, Erstattungen und Auszahlungen.
      </p>

      <Section
        title="Einstellungen"
        description="Das Flag betrifft neue Buchungen. Bereits bezahlte Buchungen laufen weiter."
      >
        <Card className="p-5">
          <PaymentSettingsForm
            paymentsEnabled={data.settings.payments_enabled}
            commissionBps={data.settings.commission_bps}
            offersWithoutPayoutAccount={data.metrics.current.offers_without_payout_account}
          />
        </Card>
      </Section>

      <Section
        title="Wochenübersicht"
        description={
          'Zeitraum ' +
          weekStart(data.metrics.range.from) +
          ' bis ' +
          weekStart(data.metrics.range.to) +
          '.'
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Buchungen" value={String(data.metrics.totals.bookings)} />
          <SummaryCard label="Umsatz" value={formatPrice(data.metrics.totals.gross_cents)} />
          <SummaryCard label="Erstattet" value={formatPrice(data.metrics.totals.refunded_cents)} />
          <SummaryCard label="Ausgezahlt" value={formatPrice(data.metrics.totals.paid_out_cents)} />
          <SummaryCard
            label="Provision"
            value={formatPrice(data.metrics.totals.commission_cents)}
          />
        </div>
        {data.metrics.by_week.length > 0 ? (
          <TableFrame>
            <table className="mt-4 min-w-[720px] w-full text-left text-footnote">
              <TableHead>
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Woche ab
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Buchungen
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Umsatz
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Erstattet
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Ausgezahlt
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Provision
                  </th>
                </tr>
              </TableHead>
              <tbody className="divide-y divide-border-subtle">
                {data.metrics.by_week.map((week) => (
                  <tr key={week.week_start}>
                    <td className="whitespace-nowrap px-4 py-3 text-text-primary">
                      {weekStart(week.week_start)}
                    </td>
                    <td className="px-4 py-3">{week.bookings}</td>
                    <td className="px-4 py-3">{formatPrice(week.gross_cents)}</td>
                    <td className="px-4 py-3">{formatPrice(week.refunded_cents)}</td>
                    <td className="px-4 py-3">{formatPrice(week.paid_out_cents)}</td>
                    <td className="px-4 py-3">{formatPrice(week.commission_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        ) : (
          <EmptyRows>Im ausgewählten Zeitraum gibt es noch keine Zahlungen.</EmptyRows>
        )}
      </Section>

      <Section title="Zahlungen" description="Die letzten 500 Buchungen aus dem Backend.">
        {data.bookings.length > 0 ? (
          <TableFrame>
            <table className="min-w-[850px] w-full text-left text-footnote">
              <TableHead>
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Standort und Angebot
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Zahlung
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Beträge
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Erstattung
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Auszahlung
                  </th>
                </tr>
              </TableHead>
              <tbody className="divide-y divide-border-subtle">
                {data.bookings.map((booking) => (
                  <tr key={booking.booking_id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-text-primary">{booking.location_name}</p>
                      <p className="text-text-secondary">{booking.offer_title}</p>
                      <p className="mt-1 text-text-tertiary">
                        {booking.short_code ? 'Code ' + booking.short_code + ' · ' : ''}
                        {BOOKING_STATUS_LABELS[booking.status]}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                      {booking.paid_at ? formatDateTime(booking.paid_at) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="font-semibold text-text-primary">
                        Brutto {formatPrice(booking.amount_cents)}
                      </p>
                      <p className="text-text-secondary">
                        Provision {formatPrice(booking.commission_cents)}
                      </p>
                      <p className="text-text-secondary">
                        Netto {formatPrice(booking.payout_cents)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {booking.refund_status ? REFUND_STATUS_LABELS[booking.refund_status] : '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {booking.transfer_status
                        ? TRANSFER_STATUS_LABELS[booking.transfer_status]
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        ) : (
          <EmptyRows>Noch keine bezahlten Buchungen.</EmptyRows>
        )}
      </Section>

      <Section title="Erstattungen">
        {data.refunds.length > 0 ? (
          <TableFrame>
            <table className="min-w-[700px] w-full text-left text-footnote">
              <TableHead>
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Buchung
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Grund
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Betrag
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Zeitpunkt
                  </th>
                </tr>
              </TableHead>
              <tbody className="divide-y divide-border-subtle">
                {data.refunds.map((refund) => (
                  <tr key={refund.id}>
                    <td className="px-4 py-3 text-text-primary">
                      {bookingById.get(refund.booking_id)?.short_code ??
                        refund.booking_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {BOOKING_CANCEL_REASON_LABELS[refund.reason]}
                    </td>
                    <td className="px-4 py-3">{formatPrice(refund.amount_cents)}</td>
                    <td className="px-4 py-3">
                      {REFUND_STATUS_LABELS[refund.status]}
                      {refund.last_error ? (
                        <p className="mt-1 max-w-sm break-words text-status-error-text">
                          {refund.last_error}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                      {formatDateTime(refund.refunded_at ?? refund.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        ) : (
          <EmptyRows>Noch keine Erstattungen.</EmptyRows>
        )}
      </Section>

      <Section title="Auszahlungen an Standorte">
        {data.transfers.length > 0 ? (
          <TableFrame>
            <table className="min-w-[650px] w-full text-left text-footnote">
              <TableHead>
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Standort
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Buchung
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Betrag
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Zeitpunkt
                  </th>
                </tr>
              </TableHead>
              <tbody className="divide-y divide-border-subtle">
                {data.transfers.map((transfer) => (
                  <tr key={transfer.id}>
                    <td className="px-4 py-3 text-text-primary">
                      {bookingById.get(transfer.booking_id)?.location_name ??
                        transfer.location_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {bookingById.get(transfer.booking_id)?.short_code ??
                        transfer.booking_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">{formatPrice(transfer.amount_cents)}</td>
                    <td className="px-4 py-3">
                      {TRANSFER_STATUS_LABELS[transfer.status]}
                      {transfer.last_error ? (
                        <p className="mt-1 max-w-sm break-words text-status-error-text">
                          {transfer.last_error}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                      {formatDateTime(transfer.transferred_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        ) : (
          <EmptyRows>Noch keine Auszahlungen.</EmptyRows>
        )}
      </Section>

      <Section
        title="Rückbuchungen"
        description="Belege für eine Antwort reichst du im Stripe-Dashboard ein."
      >
        {data.disputes.length > 0 ? (
          <TableFrame>
            <table className="min-w-[800px] w-full text-left text-footnote">
              <TableHead>
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status und Grund
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Betrag
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Zahlung / Code
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Eingelöst
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Belegfrist
                  </th>
                </tr>
              </TableHead>
              <tbody className="divide-y divide-border-subtle">
                {data.disputes.map((dispute) => {
                  const evidence = dispute.booking_id
                    ? data.evidence[dispute.booking_id]
                    : undefined;
                  return (
                    <tr key={dispute.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-text-primary">
                          {DISPUTE_STATUS_LABELS[dispute.stripe_status] ??
                            'Stripe-Status: ' + dispute.stripe_status}
                        </p>
                        <p className="text-text-secondary">
                          {dispute.reason
                            ? (DISPUTE_REASON_LABELS[dispute.reason] ?? 'Grund: ' + dispute.reason)
                            : 'Grund nicht angegeben'}
                        </p>
                        <p className="mt-1 text-caption text-text-tertiary">
                          {dispute.stripe_dispute_id}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatPrice(dispute.amount_cents)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {evidence?.paidAt
                          ? formatDateTime(evidence.paidAt)
                          : 'Zahlzeit nicht verfügbar'}
                        <p className="mt-1">
                          {evidence?.shortCode
                            ? 'Code ' + evidence.shortCode
                            : 'Kein Code verknüpft'}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                        {evidence?.redeemedAt
                          ? formatDateTime(evidence.redeemedAt)
                          : 'Nicht eingelöst'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                        {dispute.evidence_due_by ? formatDateTime(dispute.evidence_due_by) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableFrame>
        ) : (
          <EmptyRows>Keine Rückbuchungen erfasst.</EmptyRows>
        )}
      </Section>

      <Section title="Fehlgeschlagene Hintergrundjobs">
        {data.failedJobs.length > 0 ? (
          <TableFrame>
            <table className="min-w-[700px] w-full text-left text-footnote">
              <TableHead>
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Job
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Buchung
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Versuche
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Fehler
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Zeitpunkt
                  </th>
                </tr>
              </TableHead>
              <tbody className="divide-y divide-border-subtle">
                {data.failedJobs.map((job) => (
                  <tr key={job.id} className="align-top">
                    <td className="px-4 py-3">
                      {PAYMENT_JOB_KIND_LABELS[job.kind]}
                      <p className="text-text-tertiary">{PAYMENT_JOB_STATUS_LABELS[job.status]}</p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {bookingById.get(job.booking_id)?.short_code ?? job.booking_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">{job.attempts}</td>
                    <td className="max-w-md break-words px-4 py-3 text-status-error-text">
                      {job.last_error ?? 'Keine Fehlerdetails'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                      {formatDateTime(job.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        ) : (
          <EmptyRows>Keine fehlgeschlagenen Jobs.</EmptyRows>
        )}
      </Section>
    </>
  );
}
