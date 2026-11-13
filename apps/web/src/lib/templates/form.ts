import type { Tables } from '@repo/shared';
import { berlinLocalToUtc } from '@/lib/offers/berlin-time';
import { centsToEuroInput, utcToBerlinInput, type OfferFormValues } from '@/lib/offers/form';

export type OfferTemplate = Tables<'offer_templates'>;

/** Namen der Formularfelder einer Vorlage. Die Dauer ist in Zahl und Einheit aufgeteilt. */
export const TEMPLATE_FORM_FIELDS = [
  'name',
  'title',
  'description',
  'category',
  'type',
  'duration_value',
  'duration_unit',
  'original_price',
  'deal_price',
  'capacity',
  'max_per_user',
] as const;

export type TemplateFormField = (typeof TEMPLATE_FORM_FIELDS)[number] | 'image_paths';

export type TemplateFormValues = Partial<Record<(typeof TEMPLATE_FORM_FIELDS)[number], string>> & {
  image_paths?: string[];
};

export interface TemplateFormState {
  errors: Partial<Record<TemplateFormField, string>>;
  formError?: string;
  /** Eingaben zum Wiederbefüllen nach einem Fehler. */
  values?: TemplateFormValues;
  /** Erfolgsmeldung beim Bearbeiten (die Seite bleibt offen). */
  saved?: boolean;
}

export const DURATION_UNITS = ['minuten', 'stunden', 'tage'] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];

export const DURATION_UNIT_LABELS: Record<DurationUnit, string> = {
  minuten: 'Minuten',
  stunden: 'Stunden',
  tage: 'Tage',
};

const UNIT_MINUTES: Record<DurationUnit, number> = { minuten: 1, stunden: 60, tage: 1440 };

/** „3“ + „stunden“ → 180. `NaN`, wenn keine ganze Zahl oder unbekannte Einheit. */
export function durationToMinutes(value: string | undefined, unit: string | undefined): number {
  if (!/^\d+$/.test(value ?? '')) return Number.NaN;
  const factor = UNIT_MINUTES[unit as DurationUnit];
  return factor ? Number(value) * factor : Number.NaN;
}

/** 180 → 3 Stunden, 2880 → 2 Tage, 90 → 90 Minuten (größte Einheit, die glatt aufgeht). */
export function minutesToDuration(minutes: number): { value: string; unit: DurationUnit } {
  if (minutes % 1440 === 0) return { value: String(minutes / 1440), unit: 'tage' };
  if (minutes % 60 === 0) return { value: String(minutes / 60), unit: 'stunden' };
  return { value: String(minutes), unit: 'minuten' };
}

/** Dauer zum Anzeigen: „3 Std.“, „1 Std. 30 Min.“, „2 Tage“. */
export function formatDuration(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(days === 1 ? '1 Tag' : `${days} Tage`);
  if (hours > 0) parts.push(`${hours} Std.`);
  if (mins > 0) parts.push(`${mins} Min.`);
  return parts.join(' ');
}

/** Formularwerte aus einer gespeicherten Vorlage (zum Bearbeiten). */
export function templateToFormValues(template: OfferTemplate): TemplateFormValues {
  const duration = minutesToDuration(template.duration_minutes);
  return {
    name: template.name,
    title: template.title,
    description: template.description,
    category: template.category,
    type: template.type,
    duration_value: duration.value,
    duration_unit: duration.unit,
    original_price: centsToEuroInput(template.original_price_cents),
    deal_price: centsToEuroInput(template.deal_price_cents),
    capacity: String(template.capacity),
    max_per_user: String(template.max_per_user),
    image_paths: template.image_paths,
  };
}

/** Vorbelegung einer neuen Vorlage aus einem bestehenden Angebot („Als Vorlage speichern“). */
export function offerToTemplateValues(offer: Tables<'offers'>): TemplateFormValues {
  const minutes = Math.max(
    1,
    Math.round((Date.parse(offer.ends_at) - Date.parse(offer.starts_at)) / 60_000),
  );
  const duration = minutesToDuration(minutes);
  return {
    name: offer.title.slice(0, 60),
    title: offer.title,
    description: offer.description,
    category: offer.category,
    type: offer.type,
    duration_value: duration.value,
    duration_unit: duration.unit,
    original_price: centsToEuroInput(offer.original_price_cents),
    deal_price: centsToEuroInput(offer.deal_price_cents),
    capacity: String(offer.capacity),
    max_per_user: String(offer.max_per_user),
    image_paths: offer.image_paths,
  };
}

/** Vorbelegung eines neuen Angebots aus einer Vorlage. Zeit und Adresse kommen dazu. */
export function templateToOfferValues(template: OfferTemplate): OfferFormValues {
  return {
    title: template.title,
    description: template.description,
    category: template.category,
    type: template.type,
    original_price: centsToEuroInput(template.original_price_cents),
    deal_price: centsToEuroInput(template.deal_price_cents),
    capacity: String(template.capacity),
    max_per_user: String(template.max_per_user),
    image_paths: template.image_paths,
  };
}

/**
 * Beginn („2026-11-14T18:00“, Berliner Ortszeit) + Dauer → Ende im selben Format.
 * Rechnet über UTC, damit auch Tage mit Zeitumstellung stimmen. `null` bei ungültigem Beginn.
 */
export function addMinutesToBerlinInput(start: string, minutes: number): string | null {
  const startUtc = berlinLocalToUtc(start);
  if (!startUtc) return null;
  return utcToBerlinInput(new Date(startUtc.getTime() + minutes * 60_000).toISOString());
}
