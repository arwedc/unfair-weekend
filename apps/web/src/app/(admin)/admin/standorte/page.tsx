import type { Metadata } from 'next';
import { Suspense } from 'react';
import { formatDateTime } from '@repo/shared';
import { Button, Card, Field, inputClass } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { getT } from '@/lib/i18n/locale';
import { createClient } from '@/lib/supabase/server';
import { approveLocationAction, rejectLocationAction } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.onboarding.admin.title };
}

function safeWebsiteUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function phoneHref(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  return `tel:${value.trim().startsWith('+') ? '+' : ''}${digits}`;
}

async function PendingApplications() {
  await requireAdmin();
  const [supabase, { locale, t }] = await Promise.all([createClient(), getT()]);
  const a = t.onboarding.admin;
  const { data: locations, error } = await supabase
    .from('locations')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`${a.loadFailed} ${error.message}`);
  if (!locations.length) {
    return <Card className="p-6 text-callout text-text-secondary">{a.empty}</Card>;
  }

  const contactResult = await supabase.rpc('get_pending_location_contacts');
  const contacts = new Map(
    (contactResult.data ?? []).map((contact) => [contact.location_id, contact.contact_email]),
  );

  const companyIds = [...new Set(locations.map((location) => location.company_id))];
  const userIds = [
    ...new Set(
      locations.flatMap((location) => (location.account_user_id ? [location.account_user_id] : [])),
    ),
  ];
  // Alle Unternehmen laden: Die Auswahl „Gehört zu bestehendem Unternehmen?“ braucht auch die
  // bereits freigeschalteten, nicht nur die der offenen Anträge.
  const [{ data: companies, error: companyError }, { data: profiles, error: profileError }] =
    await Promise.all([
      supabase.from('companies').select('id, name, description').order('name'),
      userIds.length
        ? supabase.from('profiles').select('id, first_name, last_name').in('id', userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (companyError || profileError) throw new Error(a.detailsFailed);
  const now = new Date();

  return (
    <div className="space-y-5">
      {contactResult.error ? (
        <p className="rounded-card bg-accent-subtle px-4 py-3 text-footnote text-accent-on-subtle">
          {a.contactsUnavailable}
        </p>
      ) : null}
      {locations.map((location) => {
        const company = companies.find((entry) => entry.id === location.company_id);
        const profile = profiles.find((entry) => entry.id === location.account_user_id);
        const applicant = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
        const websiteUrl = safeWebsiteUrl(location.website);
        const phoneUrl = phoneHref(location.phone);
        const email = contacts.get(location.id);
        const mergeOptions = companies.filter(
          (entry) => entry.id !== location.company_id && companyIds.indexOf(entry.id) === -1,
        );

        return (
          <Card key={location.id} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-caption font-semibold uppercase tracking-wide text-accent-solid">
                  {a.received(formatDateTime(location.created_at, now, locale))}
                </p>
                <h2 className="mt-1 text-title3 text-text-primary">
                  {company?.name ?? a.companyFallback}
                </h2>
                <p className="text-subhead text-text-secondary">{a.location(location.name)}</p>
              </div>
              <span className="rounded-badge bg-accent-subtle px-2.5 py-1 text-caption font-semibold text-accent-on-subtle">
                {a.inReview}
              </span>
            </div>

            <dl className="mt-5 grid gap-x-6 gap-y-3 text-callout sm:grid-cols-2">
              <div>
                <dt className="text-caption text-text-tertiary">{a.contactPerson}</dt>
                <dd className="text-text-primary">{applicant || a.notProvided}</dd>
              </div>
              <div>
                <dt className="text-caption text-text-tertiary">{a.phone}</dt>
                <dd>
                  {phoneUrl ? (
                    <a className="text-accent-solid underline" href={phoneUrl}>
                      {location.phone}
                    </a>
                  ) : (
                    <span className="text-text-secondary">{a.notProvided}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-text-tertiary">{a.email}</dt>
                <dd>
                  {email ? (
                    <a className="text-accent-solid underline" href={`mailto:${email}`}>
                      {email}
                    </a>
                  ) : (
                    <span className="text-text-secondary">{a.notAvailable}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-text-tertiary">{a.address}</dt>
                <dd className="text-text-primary">
                  {location.street}, {location.postal_code} {location.city}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-text-tertiary">{a.website}</dt>
                <dd>
                  {websiteUrl ? (
                    <a
                      className="text-accent-solid underline"
                      href={websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {location.website}
                    </a>
                  ) : location.website ? (
                    <span className="text-text-secondary">{location.website}</span>
                  ) : (
                    <span className="text-text-secondary">{a.noWebsite}</span>
                  )}
                </dd>
              </div>
              {company?.description ? (
                <div className="sm:col-span-2">
                  <dt className="text-caption text-text-tertiary">{a.description}</dt>
                  <dd className="whitespace-pre-wrap text-text-primary">{company.description}</dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-6 grid gap-5 border-t border-border-subtle pt-5 lg:grid-cols-2">
              <form action={approveLocationAction} className="space-y-3">
                <input type="hidden" name="location_id" value={location.id} />
                <p className="text-footnote text-text-secondary">{a.checkHint}</p>
                <Field id={`merge-${location.id}`} label={a.mergeLabel} hint={a.mergeHint}>
                  <select
                    id={`merge-${location.id}`}
                    name="merge_company_id"
                    className={inputClass}
                    defaultValue=""
                  >
                    <option value="">{a.mergeNone}</option>
                    {mergeOptions.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <label className="flex items-start gap-2 text-footnote text-text-secondary">
                  <input
                    type="checkbox"
                    name="verified"
                    required
                    className="mt-1 accent-accent-solid"
                  />
                  <span>{a.verified}</span>
                </label>
                <Button type="submit">{a.approve}</Button>
              </form>

              <form action={rejectLocationAction} className="space-y-3">
                <input type="hidden" name="location_id" value={location.id} />
                <Field id={`reason-${location.id}`} label={a.rejectReason}>
                  <textarea
                    id={`reason-${location.id}`}
                    name="reason"
                    required
                    minLength={3}
                    maxLength={500}
                    rows={2}
                    className={inputClass}
                    placeholder={a.rejectPlaceholder}
                  />
                </Field>
                <Button type="submit" variant="secondary">
                  {a.reject}
                </Button>
              </form>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export default async function AdminLocationsPage() {
  const { t } = await getT();
  return (
    <>
      <h1 className="text-title2 text-text-primary">{t.onboarding.admin.title}</h1>
      <p className="mb-6 mt-1 text-callout text-text-secondary">{t.onboarding.admin.intro}</p>
      <Suspense fallback={<p className="text-callout text-text-tertiary">{t.common.loading}</p>}>
        <PendingApplications />
      </Suspense>
    </>
  );
}
