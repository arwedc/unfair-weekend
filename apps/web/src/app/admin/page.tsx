import type { Metadata } from 'next';
import { formatDateTime } from '@repo/shared';
import { logout } from '@/app/actions';
import { Button, Card, Field, inputClass } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { approveLocationAction, rejectLocationAction } from './actions';

export const metadata: Metadata = { title: 'Admin' };

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
  const supabase = await createClient();
  const { data: locations, error } = await supabase
    .from('locations')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Anträge konnten nicht geladen werden: ${error.message}`);
  if (!locations.length) {
    return (
      <Card className="p-6 text-callout text-text-secondary">
        Gerade gibt es keine offenen Anträge.
      </Card>
    );
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
  const [{ data: companies, error: companyError }, { data: profiles, error: profileError }] =
    await Promise.all([
      supabase.from('companies').select('*').in('id', companyIds),
      userIds.length
        ? supabase.from('profiles').select('id, first_name, last_name').in('id', userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (companyError || profileError) {
    throw new Error('Unternehmens- oder Kontaktdaten konnten nicht geladen werden.');
  }

  return (
    <div className="space-y-5">
      {contactResult.error ? (
        <p className="rounded-card bg-accent-subtle px-4 py-3 text-footnote text-accent-on-subtle">
          E-Mail-Kontakte sind noch nicht verfügbar. Die Telefonnummern bleiben sichtbar.
        </p>
      ) : null}
      {locations.map((location) => {
        const company = companies.find((entry) => entry.id === location.company_id);
        const profile = profiles.find((entry) => entry.id === location.account_user_id);
        const applicant = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
        const websiteUrl = safeWebsiteUrl(location.website);
        const phoneUrl = phoneHref(location.phone);

        return (
          <Card key={location.id} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-caption font-semibold uppercase tracking-wide text-accent-solid">
                  Eingang {formatDateTime(location.created_at)}
                </p>
                <h2 className="mt-1 text-title3 text-text-primary">
                  {company?.name ?? 'Unternehmen'}
                </h2>
                <p className="text-subhead text-text-secondary">Standort: {location.name}</p>
              </div>
              <span className="rounded-badge bg-accent-subtle px-2.5 py-1 text-caption font-semibold text-accent-on-subtle">
                In Prüfung
              </span>
            </div>

            <dl className="mt-5 grid gap-x-6 gap-y-3 text-callout sm:grid-cols-2">
              <div>
                <dt className="text-caption text-text-tertiary">Kontaktperson</dt>
                <dd className="text-text-primary">{applicant || 'Nicht angegeben'}</dd>
              </div>
              <div>
                <dt className="text-caption text-text-tertiary">Telefon</dt>
                <dd>
                  {phoneUrl ? (
                    <a className="text-accent-solid underline" href={phoneUrl}>
                      {location.phone}
                    </a>
                  ) : (
                    <span className="text-text-secondary">Nicht angegeben</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-text-tertiary">E-Mail</dt>
                <dd>
                  {contacts.get(location.id) ? (
                    <a
                      className="text-accent-solid underline"
                      href={`mailto:${contacts.get(location.id)}`}
                    >
                      {contacts.get(location.id)}
                    </a>
                  ) : (
                    <span className="text-text-secondary">Nicht verfügbar</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-text-tertiary">Adresse</dt>
                <dd className="text-text-primary">
                  {location.street}, {location.postal_code} {location.city}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-text-tertiary">Website</dt>
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
                    <span className="text-text-secondary">Keine angegeben</span>
                  )}
                </dd>
              </div>
              {company?.description ? (
                <div className="sm:col-span-2">
                  <dt className="text-caption text-text-tertiary">Kurzbeschreibung</dt>
                  <dd className="whitespace-pre-wrap text-text-primary">{company.description}</dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-6 grid gap-5 border-t border-border-subtle pt-5 lg:grid-cols-2">
              <form action={approveLocationAction} className="space-y-3">
                <input type="hidden" name="location_id" value={location.id} />
                <p className="text-footnote text-text-secondary">
                  Prüfe den Betrieb über Website oder öffentliche Präsenz, gleiche Adresse und
                  Telefonnummer ab und kläre mögliche Duplikate.
                </p>
                <Field
                  id={`merge-${location.id}`}
                  label="Gehört zu bestehendem Unternehmen?"
                  hint="Nur bei einem weiteren Standort desselben Unternehmens auswählen."
                >
                  <select
                    id={`merge-${location.id}`}
                    name="merge_company_id"
                    className={inputClass}
                    defaultValue=""
                  >
                    <option value="">Neues Unternehmen anlegen</option>
                    {companies
                      .filter((entry) => entry.id !== location.company_id)
                      .map((entry) => (
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
                  <span>Ich habe Unternehmen und Kontaktdaten geprüft.</span>
                </label>
                <Button type="submit">Prüfen und freischalten</Button>
              </form>

              <form action={rejectLocationAction} className="space-y-3">
                <input type="hidden" name="location_id" value={location.id} />
                <Field id={`reason-${location.id}`} label="Ablehnungsgrund für Antragsteller:in">
                  <textarea
                    id={`reason-${location.id}`}
                    name="reason"
                    required
                    minLength={3}
                    maxLength={500}
                    rows={2}
                    className={inputClass}
                    placeholder="Kurz erklären, warum es aktuell nicht passt."
                  />
                </Field>
                <Button type="submit" variant="secondary">
                  Antrag ablehnen
                </Button>
              </form>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export default function AdminPage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-caption font-semibold uppercase tracking-wide text-accent-solid">
            unfair weekend
          </p>
          <h1 className="mt-1 text-title1 text-text-primary">Unternehmen prüfen</h1>
          <p className="mt-2 text-callout text-text-secondary">
            Angaben prüfen und offene Partneranträge freischalten oder ablehnen.
          </p>
        </div>
        <form action={logout}>
          <Button type="submit" variant="ghost">
            Abmelden
          </Button>
        </form>
      </header>
      <PendingApplications />
    </main>
  );
}
