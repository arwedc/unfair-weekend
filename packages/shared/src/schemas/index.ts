/**
 * Zod-Schemas für alle Eingaben. Sie spiegeln die Prüfungen der Datenbank,
 * damit Formulare sofort Feedback geben. Die Wahrheit bleibt der Server.
 *
 * Feldnamen = RPC-Parameter ohne `p_`. Mit `toRpcArgs()` wird daraus das
 * Argument-Objekt für `supabase.rpc(...)`.
 *
 * @example
 *   const input = offerInputSchema.parse(formValues);
 *   await supabase.rpc('create_offer', toRpcArgs(input));
 */
import * as z from 'zod';
import {
  OFFER_CATEGORIES,
  OFFER_LIMITS,
  OFFER_TEMPLATE_LIMITS,
  OFFER_TYPES,
} from '../constants/offers';
import { Constants } from '../types';
import { meetsMinDiscount } from '../utils/money';

const MS_PER_DAY = 86_400_000;

/** Hängt `p_` vor jeden Schlüssel: `{ title }` → `{ p_title }`. */
export function toRpcArgs<T extends Record<string, unknown>>(
  input: T,
): { [K in keyof T & string as `p_${K}`]: T[K] } {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [`p_${key}`, value])) as {
    [K in keyof T & string as `p_${K}`]: T[K];
  };
}

const text = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} fehlt.` })
    .trim()
    .min(min, { error: `${label}: mindestens ${min} Zeichen.` })
    .max(max, { error: `${label}: höchstens ${max} Zeichen.` });

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label}: höchstens ${max} Zeichen.` })
    .optional()
    .transform((value) => (value ? value : undefined));

const cents = (label: string) =>
  z
    .number({ error: `${label} fehlt.` })
    .int({ error: `${label} muss in ganzen Cent angegeben werden.` })
    .min(0, { error: `${label} darf nicht negativ sein.` });

export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);
export const postalCodeSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{5}$/, { error: 'Die Postleitzahl muss 5 Ziffern haben.' });

// ---------------------------------------------------------------------------
// Konto und Profil
// ---------------------------------------------------------------------------

export const emailSchema = z.email({ error: 'Bitte gib eine gültige E-Mail-Adresse an.' });

export const passwordSchema = z
  .string()
  .min(8, { error: 'Das Passwort braucht mindestens 8 Zeichen.' })
  .max(72, { error: 'Das Passwort darf höchstens 72 Zeichen haben.' });

/** E-Mail-OTP-Login in der App */
export const otpRequestSchema = z.object({ email: emailSchema });
export const otpVerifySchema = z.object({
  email: emailSchema,
  token: z
    .string()
    .trim()
    .regex(/^[0-9]{6,8}$/, { error: 'Bitte gib den Code aus der E-Mail ein.' }),
});

/** update_my_profile */
export const profileSchema = z.object({
  first_name: text(1, 50, 'Vorname'),
  last_name: text(1, 50, 'Nachname'),
});
export type ProfileInput = z.infer<typeof profileSchema>;

/** Registrierung eines Standort-Kontos (Schritt 1: supabase.auth.signUp) */
export const locationSignUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type LocationSignUpInput = z.infer<typeof locationSignUpSchema>;

/** Stammdaten eines Standorts (update_my_location) */
export const locationSchema = z
  .object({
    name: text(2, 100, 'Standortname'),
    street: text(2, 120, 'Straße und Hausnummer'),
    postal_code: postalCodeSchema,
    city: text(2, 80, 'Ort'),
    lat: latitudeSchema.optional(),
    lng: longitudeSchema.optional(),
    phone: optionalText(40, 'Telefon'),
    website: optionalText(300, 'Website'),
  })
  .refine((value) => (value.lat === undefined) === (value.lng === undefined), {
    error: 'Bitte beide Koordinaten angeben oder keine.',
    path: ['lat'],
  });
export type LocationInput = z.infer<typeof locationSchema>;

/** Stammdaten eines Unternehmens (update_my_company) */
export const companySchema = z.object({
  name: text(2, 100, 'Unternehmensname'),
  description: optionalText(2000, 'Beschreibung'),
  logo_path: optionalText(500, 'Logo-Pfad'),
});
export type CompanyInput = z.infer<typeof companySchema>;

/** Registrierung Schritt 2: register_company (Unternehmen + erster Standort) */
export const registerCompanySchema = z
  .object({
    company_name: text(2, 100, 'Unternehmensname'),
    company_description: optionalText(2000, 'Beschreibung'),
    location_name: text(2, 100, 'Standortname'),
    street: text(2, 120, 'Straße und Hausnummer'),
    postal_code: postalCodeSchema,
    city: text(2, 80, 'Ort'),
    lat: latitudeSchema.optional(),
    lng: longitudeSchema.optional(),
    phone: optionalText(40, 'Telefon'),
    website: optionalText(300, 'Website'),
  })
  .refine((value) => (value.lat === undefined) === (value.lng === undefined), {
    error: 'Bitte beide Koordinaten angeben oder keine.',
    path: ['lat'],
  });
export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;

// ---------------------------------------------------------------------------
// Angebote
// ---------------------------------------------------------------------------

const offerBaseSchema = z.object({
  title: text(OFFER_LIMITS.titleMin, OFFER_LIMITS.titleMax, 'Titel'),
  description: text(OFFER_LIMITS.descriptionMin, OFFER_LIMITS.descriptionMax, 'Beschreibung'),
  category: z.enum(OFFER_CATEGORIES, { error: 'Bitte eine Kategorie wählen.' }),
  image_paths: z
    .array(z.string().trim().min(1).max(500))
    .min(OFFER_LIMITS.imagesMin)
    .max(OFFER_LIMITS.imagesMax, { error: `Höchstens ${OFFER_LIMITS.imagesMax} Bilder.` }),
  original_price_cents: cents('Originalpreis')
    .min(1, { error: 'Der Originalpreis muss größer als 0 sein.' })
    .max(OFFER_LIMITS.originalPriceMaxCents),
  deal_price_cents: cents('Deal-Preis'),
  capacity: z
    .number()
    .int()
    .min(1, { error: 'Mindestens 1 Platz.' })
    .max(OFFER_LIMITS.capacityMax, { error: `Höchstens ${OFFER_LIMITS.capacityMax} Plätze.` }),
  max_per_user: z
    .number()
    .int()
    .min(1, { error: 'Mindestens 1 Platz pro Person.' })
    .max(OFFER_LIMITS.maxPerUserMax, {
      error: `Höchstens ${OFFER_LIMITS.maxPerUserMax} Plätze pro Person.`,
    }),
  address: text(OFFER_LIMITS.addressMin, OFFER_LIMITS.addressMax, 'Adresse'),
  lat: latitudeSchema,
  lng: longitudeSchema,
  type: z.enum(OFFER_TYPES, { error: 'Bitte die Art wählen.' }),
  starts_at: z.iso.datetime({ offset: true, error: 'Bitte einen gültigen Beginn angeben.' }),
  ends_at: z.iso.datetime({ offset: true, error: 'Bitte ein gültiges Ende angeben.' }),
});

/** Angebot anlegen/ändern. Regeln, die keine Einstellungen brauchen. */
export const offerInputSchema = offerBaseSchema.superRefine((value, ctx) => {
  if (value.deal_price_cents >= value.original_price_cents) {
    ctx.addIssue({
      code: 'custom',
      path: ['deal_price_cents'],
      message: 'Der Deal-Preis muss unter dem Originalpreis liegen.',
    });
  }
  if (value.max_per_user > value.capacity) {
    ctx.addIssue({
      code: 'custom',
      path: ['max_per_user'],
      message: 'Plätze pro Person dürfen das Kontingent nicht übersteigen.',
    });
  }
  const start = Date.parse(value.starts_at);
  const end = Date.parse(value.ends_at);
  if (end <= start) {
    ctx.addIssue({
      code: 'custom',
      path: ['ends_at'],
      message: 'Das Ende muss nach dem Beginn liegen.',
    });
  } else if (end - start > OFFER_LIMITS.maxDurationDays * MS_PER_DAY) {
    ctx.addIssue({
      code: 'custom',
      path: ['ends_at'],
      message: `Höchstens ${OFFER_LIMITS.maxDurationDays} Tage Dauer.`,
    });
  }
});
export type OfferInput = z.infer<typeof offerInputSchema>;

/**
 * Zusätzlich: Mindestrabatt (aus get_settings) und Zeitpunkt in der Zukunft.
 * Für neue Angebote und für Änderungen an Preisen bzw. Zeiten.
 */
export function createOfferInputSchema(options: { minDiscountPercent: number; now?: Date }) {
  return offerInputSchema.superRefine((value, ctx) => {
    if (
      value.deal_price_cents < value.original_price_cents &&
      !meetsMinDiscount(
        value.original_price_cents,
        value.deal_price_cents,
        options.minDiscountPercent,
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['deal_price_cents'],
        message: `Der Rabatt muss mindestens ${options.minDiscountPercent} % betragen.`,
      });
    }
    const now = (options.now ?? new Date()).getTime();
    const relevant = Date.parse(value.type === 'einzeltermin' ? value.starts_at : value.ends_at);
    if (relevant <= now) {
      ctx.addIssue({
        code: 'custom',
        path: [value.type === 'einzeltermin' ? 'starts_at' : 'ends_at'],
        message: 'Der Zeitpunkt liegt in der Vergangenheit.',
      });
    }
  });
}

/**
 * Angebotsvorlage (create_offer_template, update_offer_template): wie ein Angebot,
 * aber ohne Adresse und ohne Zeitpunkt. Statt Beginn und Ende nur die Dauer.
 */
export const offerTemplateSchema = offerBaseSchema
  .pick({
    title: true,
    description: true,
    category: true,
    image_paths: true,
    original_price_cents: true,
    deal_price_cents: true,
    capacity: true,
    max_per_user: true,
    type: true,
  })
  .extend({
    name: text(OFFER_TEMPLATE_LIMITS.nameMin, OFFER_TEMPLATE_LIMITS.nameMax, 'Name der Vorlage'),
    duration_minutes: z
      .number({ error: 'Bitte die Dauer angeben.' })
      .int({ error: 'Bitte die Dauer in ganzen Minuten angeben.' })
      .min(OFFER_TEMPLATE_LIMITS.durationMinMinutes, { error: 'Bitte die Dauer angeben.' })
      .max(OFFER_TEMPLATE_LIMITS.durationMaxMinutes, {
        error: `Höchstens ${OFFER_LIMITS.maxDurationDays} Tage Dauer.`,
      }),
  })
  .superRefine((value, ctx) => {
    if (value.deal_price_cents >= value.original_price_cents) {
      ctx.addIssue({
        code: 'custom',
        path: ['deal_price_cents'],
        message: 'Der Deal-Preis muss unter dem Originalpreis liegen.',
      });
    }
    if (value.max_per_user > value.capacity) {
      ctx.addIssue({
        code: 'custom',
        path: ['max_per_user'],
        message: 'Plätze pro Person dürfen das Kontingent nicht übersteigen.',
      });
    }
  });
export type OfferTemplateInput = z.infer<typeof offerTemplateSchema>;

/** Zusätzlich: Mindestrabatt (aus get_settings). */
export function createOfferTemplateSchema(options: { minDiscountPercent: number }) {
  return offerTemplateSchema.superRefine((value, ctx) => {
    if (
      value.deal_price_cents < value.original_price_cents &&
      !meetsMinDiscount(
        value.original_price_cents,
        value.deal_price_cents,
        options.minDiscountPercent,
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['deal_price_cents'],
        message: `Der Rabatt muss mindestens ${options.minDiscountPercent} % betragen.`,
      });
    }
  });
}

/** Absage bzw. Entfernen mit optionaler Begründung */
export const offerReasonSchema = z.object({
  reason: optionalText(500, 'Begründung'),
});

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------

/** claim_voucher */
export const claimVoucherSchema = z.object({
  offer_id: z.uuid(),
  seats: z
    .number()
    .int()
    .min(1, { error: 'Bitte mindestens einen Platz wählen.' })
    .max(OFFER_LIMITS.maxPerUserMax),
});

/** redeem_voucher: QR-Token oder Kurzcode (Groß/Klein und Bindestrich egal) */
export const redeemCodeSchema = z.object({
  code: z.string().trim().min(1, { error: 'Bitte einen Code eingeben oder scannen.' }).max(100),
});

/** Kurzcode wie „K7Q-4MX“ (zur Anzeige und Eingabehilfe) */
export const SHORT_CODE_PATTERN =
  /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{3}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{3}$/;

/** Eingabe vereinheitlichen: „k7q4mx“ → „K7Q-4MX“, sonst null */
export function normalizeShortCode(input: string): string | null {
  const cleaned = input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (cleaned.length !== 6) return null;
  const code = `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return SHORT_CODE_PATTERN.test(code) ? code : null;
}

// ---------------------------------------------------------------------------
// Admin und Geräte
// ---------------------------------------------------------------------------

/** update_settings */
export const settingsSchema = z.object({
  min_discount_percent: z.number().int().min(0).max(100),
  cancel_deadline_hours: z.number().int().min(0).max(168),
  no_show_limit: z.number().int().min(1).max(20),
  block_days: z.number().int().min(1).max(365),
  reminder_hours_before: z.number().int().min(0).max(72),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

/** register_push_token */
export const pushTokenSchema = z.object({
  token: z.string().min(1).max(500),
  platform: z.enum(Constants.public.Enums.push_platform),
});

// ---------------------------------------------------------------------------
// Zahlungen (Variante B)
// ---------------------------------------------------------------------------

/** start_paid_booking (über die Edge Function stripe-create-booking) */
export const startPaidBookingSchema = claimVoucherSchema;
export type StartPaidBookingInput = z.infer<typeof startPaidBookingSchema>;

/** cancel_paid_booking (über die Edge Function stripe-cancel-booking) */
export const cancelPaidBookingSchema = z.object({
  booking_id: z.uuid(),
});

/** update_payment_settings: Provision in Basispunkten (1500 = 15 %), höchstens 50 % */
export const paymentSettingsSchema = z.object({
  payments_enabled: z.boolean(),
  commission_bps: z
    .number()
    .int()
    .min(0, { error: 'Die Provision kann nicht negativ sein.' })
    .max(5000, { error: 'Die Provision darf höchstens 50 % betragen.' }),
});
export type PaymentSettingsInput = z.infer<typeof paymentSettingsSchema>;
