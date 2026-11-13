import { formatDateTime, formatPrice } from '@repo/shared';
import { Card } from '@/components/ui';
import { PaymentSettingsForm } from './payment-settings-form';
import { getAdminPaymentData } from '@/lib/zahlungen/queries';
import { getT } from '@/lib/i18n/locale';

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

function DataTable({
  children,
  minWidth = 'min-w-[700px]',
}: {
  children: React.ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-border-subtle bg-surface-raised shadow-card">
      <table className={`${minWidth} w-full text-left text-footnote`}>{children}</table>
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

const DISPUTE_STATUS_EN: Record<string, string> = {
  needs_response: 'Response required',
  warning_needs_response: 'Response required',
  under_review: 'Under review',
  warning_under_review: 'Under review',
  won: 'Won',
  lost: 'Lost',
  charge_refunded: 'Payment refunded',
  prevented: 'Prevented',
};

const DISPUTE_REASON_EN: Record<string, string> = {
  duplicate: 'Duplicate payment',
  fraudulent: 'Suspected fraud',
  product_not_received: 'Service not received',
  product_unacceptable: 'Service unacceptable',
  subscription_canceled: 'Subscription canceled',
  unrecognized: 'Unrecognized payment',
  credit_not_processed: 'Credit not processed',
  general: 'General',
  other: 'Other',
};

const DISPUTE_STATUS_DE: Record<string, string> = {
  needs_response: 'Antwort erforderlich',
  warning_needs_response: 'Antwort erforderlich',
  under_review: 'Wird geprüft',
  warning_under_review: 'Wird geprüft',
  won: 'Gewonnen',
  lost: 'Verloren',
  charge_refunded: 'Zahlung erstattet',
  prevented: 'Verhindert',
};

const DISPUTE_REASON_DE: Record<string, string> = {
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
  const [data, { locale, t, labels }] = await Promise.all([getAdminPaymentData(), getT()]);
  const a = t.admin;
  const bookingById = new Map(data.bookings.map((booking) => [booking.booking_id, booking]));
  const date = (value: string) => formatDateTime(value, new Date(), locale);
  const price = (value: number) => formatPrice(value, { locale });
  const weekStart = (value: string) => date(`${value}T12:00:00Z`);
  const disputeStatus = locale === 'en' ? DISPUTE_STATUS_EN : DISPUTE_STATUS_DE;
  const disputeReason = locale === 'en' ? DISPUTE_REASON_EN : DISPUTE_REASON_DE;

  return (
    <>
      <h1 className="text-title2 text-text-primary">{a.title}</h1>
      <p className="mb-6 mt-1 text-callout text-text-secondary">{a.intro}</p>

      <Section title={a.settings} description={a.settingsDescription}>
        <Card className="p-5">
          <PaymentSettingsForm
            paymentsEnabled={data.settings.payments_enabled}
            commissionBps={data.settings.commission_bps}
            offersWithoutPayoutAccount={data.metrics.current.offers_without_payout_account}
          />
        </Card>
      </Section>

      <Section
        title={a.weeklyOverview}
        description={a.period(weekStart(data.metrics.range.from), weekStart(data.metrics.range.to))}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label={a.bookings} value={String(data.metrics.totals.bookings)} />
          <SummaryCard label={a.revenue} value={price(data.metrics.totals.gross_cents)} />
          <SummaryCard label={a.refunded} value={price(data.metrics.totals.refunded_cents)} />
          <SummaryCard label={a.paidOut} value={price(data.metrics.totals.paid_out_cents)} />
          <SummaryCard label={a.commission} value={price(data.metrics.totals.commission_cents)} />
        </div>
        {data.metrics.by_week.length ? (
          <DataTable minWidth="mt-4 min-w-[720px]">
            <TableHead>
              <tr>
                {[a.weekStarting, a.bookings, a.revenue, a.refunded, a.paidOut, a.commission].map(
                  (label) => (
                    <th key={label} scope="col" className="px-4 py-3 font-semibold">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </TableHead>
            <tbody className="divide-y divide-border-subtle">
              {data.metrics.by_week.map((week) => (
                <tr key={week.week_start}>
                  <td className="whitespace-nowrap px-4 py-3 text-text-primary">
                    {weekStart(week.week_start)}
                  </td>
                  <td className="px-4 py-3">{week.bookings}</td>
                  <td className="px-4 py-3">{price(week.gross_cents)}</td>
                  <td className="px-4 py-3">{price(week.refunded_cents)}</td>
                  <td className="px-4 py-3">{price(week.paid_out_cents)}</td>
                  <td className="px-4 py-3">{price(week.commission_cents)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <EmptyRows>{a.emptyPeriod}</EmptyRows>
        )}
      </Section>

      <Section title={a.payments} description={a.latestBookings}>
        {data.bookings.length ? (
          <DataTable minWidth="min-w-[850px]">
            <TableHead>
              <tr>
                {[a.venueAndOffer, a.payment, a.amounts, a.refund, a.payout].map((label) => (
                  <th key={label} scope="col" className="px-4 py-3 font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </TableHead>
            <tbody className="divide-y divide-border-subtle">
              {data.bookings.map((booking) => (
                <tr key={booking.booking_id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-text-primary">{booking.location_name}</p>
                    <p className="text-text-secondary">{booking.offer_title}</p>
                    <p className="mt-1 text-text-tertiary">
                      {booking.short_code ? `${a.code(booking.short_code)} · ` : ''}
                      {labels.bookingStatus[booking.status]}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                    {booking.paid_at ? date(booking.paid_at) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <p className="font-semibold text-text-primary">
                      {a.gross(price(booking.amount_cents))}
                    </p>
                    <p className="text-text-secondary">
                      {a.commission} {price(booking.commission_cents)}
                    </p>
                    <p className="text-text-secondary">{a.net(price(booking.payout_cents))}</p>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {booking.refund_status ? labels.refundStatus[booking.refund_status] : '—'}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {booking.transfer_status ? labels.transferStatus[booking.transfer_status] : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <EmptyRows>{a.noPaidBookings}</EmptyRows>
        )}
      </Section>

      <Section title={a.refunds}>
        {data.refunds.length ? (
          <DataTable>
            <TableHead>
              <tr>
                {[a.booking, a.reason, a.amount, a.status, a.time].map((label) => (
                  <th key={label} scope="col" className="px-4 py-3 font-semibold">
                    {label}
                  </th>
                ))}
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
                    {labels.bookingCancelReason[refund.reason]}
                  </td>
                  <td className="px-4 py-3">{price(refund.amount_cents)}</td>
                  <td className="px-4 py-3">
                    {labels.refundStatus[refund.status]}
                    {refund.last_error ? (
                      <p className="mt-1 max-w-sm break-words text-status-error-text">
                        {refund.last_error}
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                    {date(refund.refunded_at ?? refund.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <EmptyRows>{a.noRefunds}</EmptyRows>
        )}
      </Section>

      <Section title={a.transfers}>
        {data.transfers.length ? (
          <DataTable minWidth="min-w-[650px]">
            <TableHead>
              <tr>
                {[a.venue, a.booking, a.amount, a.status, a.time].map((label) => (
                  <th key={label} scope="col" className="px-4 py-3 font-semibold">
                    {label}
                  </th>
                ))}
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
                  <td className="px-4 py-3">{price(transfer.amount_cents)}</td>
                  <td className="px-4 py-3">
                    {labels.transferStatus[transfer.status]}
                    {transfer.last_error ? (
                      <p className="mt-1 max-w-sm break-words text-status-error-text">
                        {transfer.last_error}
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                    {date(transfer.transferred_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <EmptyRows>{a.noTransfers}</EmptyRows>
        )}
      </Section>

      <Section title={a.disputes} description={a.disputeDescription}>
        {data.disputes.length ? (
          <DataTable minWidth="min-w-[800px]">
            <TableHead>
              <tr>
                {[a.statusAndReason, a.amount, a.paymentOrCode, a.redeemed, a.evidenceDeadline].map(
                  (label) => (
                    <th key={label} scope="col" className="px-4 py-3 font-semibold">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </TableHead>
            <tbody className="divide-y divide-border-subtle">
              {data.disputes.map((dispute) => {
                const evidence = dispute.booking_id ? data.evidence[dispute.booking_id] : undefined;
                return (
                  <tr key={dispute.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-text-primary">
                        {disputeStatus[dispute.stripe_status] ??
                          a.stripeStatus(dispute.stripe_status)}
                      </p>
                      <p className="text-text-secondary">
                        {dispute.reason
                          ? (disputeReason[dispute.reason] ?? a.genericReason(dispute.reason))
                          : a.unspecifiedReason}
                      </p>
                      <p className="mt-1 text-caption text-text-tertiary">
                        {dispute.stripe_dispute_id}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{price(dispute.amount_cents)}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {evidence?.paidAt ? date(evidence.paidAt) : a.paidAtUnavailable}
                      <p className="mt-1">
                        {evidence?.shortCode ? a.code(evidence.shortCode) : a.noCodeLinked}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                      {evidence?.redeemedAt ? date(evidence.redeemedAt) : a.notRedeemed}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                      {dispute.evidence_due_by ? date(dispute.evidence_due_by) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        ) : (
          <EmptyRows>{a.noDisputes}</EmptyRows>
        )}
      </Section>

      <Section title={a.failedJobs}>
        {data.failedJobs.length ? (
          <DataTable>
            <TableHead>
              <tr>
                {[a.job, a.booking, a.attempts, a.error, a.time].map((label) => (
                  <th key={label} scope="col" className="px-4 py-3 font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </TableHead>
            <tbody className="divide-y divide-border-subtle">
              {data.failedJobs.map((job) => (
                <tr key={job.id} className="align-top">
                  <td className="px-4 py-3">
                    {labels.paymentJobKind[job.kind]}
                    <p className="text-text-tertiary">{labels.paymentJobStatus[job.status]}</p>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {bookingById.get(job.booking_id)?.short_code ?? job.booking_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">{job.attempts}</td>
                  <td className="max-w-md break-words px-4 py-3 text-status-error-text">
                    {job.last_error ?? a.noErrorDetails}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                    {date(job.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <EmptyRows>{a.noFailedJobs}</EmptyRows>
        )}
      </Section>
    </>
  );
}
