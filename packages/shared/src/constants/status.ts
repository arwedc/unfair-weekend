import { Constants, type Enums } from '../types';

/** Rollen (Postgres-Enum `app_role`). */
export const APP_ROLES = Constants.public.Enums.app_role;
export type AppRole = Enums<'app_role'>;

export const APP_ROLE_LABELS = {
  nutzer: 'Nutzer',
  standort: 'Standort',
  admin: 'Admin',
} as const satisfies Record<AppRole, string>;

/** Status eines Gutscheincodes (Postgres-Enum `voucher_status`). */
export const VOUCHER_STATUSES = Constants.public.Enums.voucher_status;
export type VoucherStatus = Enums<'voucher_status'>;

export const VOUCHER_STATUS_LABELS = {
  aktiv: 'Aktiv',
  storniert: 'Storniert',
  eingeloest: 'Eingelöst',
  no_show: 'Nicht erschienen',
  abgelaufen: 'Abgelaufen',
} as const satisfies Record<VoucherStatus, string>;

export type VoucherCancelReason = Enums<'voucher_cancel_reason'>;

export const VOUCHER_CANCEL_REASON_LABELS = {
  nutzer: 'Selbst storniert',
  angebot_abgesagt: 'Angebot wurde abgesagt',
  angebot_entfernt: 'Angebot wurde entfernt',
  konto_geloescht: 'Konto gelöscht',
} as const satisfies Record<VoucherCancelReason, string>;

/** Freischaltung eines Standorts (Postgres-Enum `location_status`). */
export const LOCATION_STATUSES = Constants.public.Enums.location_status;
export type LocationStatus = Enums<'location_status'>;

export const LOCATION_STATUS_LABELS = {
  pending: 'In Prüfung',
  approved: 'Freigeschaltet',
  rejected: 'Abgelehnt',
} as const satisfies Record<LocationStatus, string>;

export type NotificationType = Enums<'notification_type'>;
export type PushPlatform = Enums<'push_platform'>;
export type EventType = Enums<'event_type'>;

/** Feste Regeln, die nicht in den Admin-Einstellungen stehen. */
export const VOUCHER_RULES = {
  /** Einzeltermin: Einlösen ab so vielen Minuten vor Beginn. */
  redeemLeadMinutes: 60,
  /** Einzeltermin: No-Show bis so viele Stunden nach Ende, danach „abgelaufen“. */
  noShowGraceHours: 48,
} as const;

/**
 * Storage-Buckets. Pfade: offer-images/<location_id>/…, company-logos/<company_id>/…,
 * avatars/<user_id>/… (privat, nur über signierte URLs lesbar).
 */
export const STORAGE_BUCKETS = {
  offerImages: 'offer-images',
  companyLogos: 'company-logos',
  avatars: 'avatars',
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

export const STORAGE_LIMITS = {
  offerImageMaxBytes: 5 * 1024 * 1024,
  companyLogoMaxBytes: 2 * 1024 * 1024,
  avatarMaxBytes: 2 * 1024 * 1024,
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const;
