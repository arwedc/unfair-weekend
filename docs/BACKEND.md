# Backend-Vertrag

Für die App-Session (`apps/mobile`) und die Website-Session (`apps/web`). Hier steht alles, was ihr vom Supabase-Backend wissen müsst: Tabellen, RPCs mit Parametern, Rückgaben und Fehlercodes, die Rechte pro Rolle, Auth, Storage, Edge Functions, Cron, Outbox, Testzugänge und Befehle.

Die Quelle der Wahrheit bleibt der Code: `supabase/migrations/` (Schema), `packages/shared/src/types/database.types.ts` (generierte Typen) und `supabase/tests/` (erwartetes Verhalten). Ändert sich etwas, wird dieses Dokument im selben PR angepasst.

## Inhalt

1. [Grundprinzipien](#1-grundprinzipien)
2. [Client einrichten](#2-client-einrichten)
3. [Rollen und Auth](#3-rollen-und-auth)
4. [Tabellen](#4-tabellen)
5. [Rechte pro Rolle (RLS)](#5-rechte-pro-rolle-rls)
6. [RPCs](#6-rpcs)
7. [Fehlercodes](#7-fehlercodes)
8. [Storage](#8-storage)
9. [Edge Functions](#9-edge-functions)
10. [Cron und Benachrichtigungen (Outbox)](#10-cron-und-benachrichtigungen-outbox)
11. [Seed und Testzugänge](#11-seed-und-testzugänge)
12. [Befehle und Ablauf bei Schemaänderungen](#12-befehle-und-ablauf-bei-schemaänderungen)
13. [Umzug auf ein Live-Projekt](#13-umzug-auf-ein-live-projekt)

---

## 1. Grundprinzipien

- **Lesen:** Eigene Daten liest man direkt aus den Tabellen, RLS filtert. Öffentliche Daten (Feed, Angebotsdetail) gibt es nur über RPCs. `anon` hat außer `settings` keinen Tabellenzugriff.
- **Schreiben:** ausschließlich über RPCs. Sie prüfen alle Geschäftsregeln serverseitig. Einzige Ausnahme sind Favoriten (eigene Zeilen anlegen und löschen).
- **Geld:** ganze Cent (`*_cents`, Integer). Anzeige mit `formatPrice()`.
- **Zeit:** `timestamptz`. Clients senden ISO-Strings mit Offset (`2026-11-20T18:00:00+01:00` oder `…Z`). Anzeige immer in Europe/Berlin mit den Helfern aus `@repo/shared`.
- **IDs:** UUIDs (Tabellen-IDs), Push-Tokens und Events haben `bigint`.
- **Fehler:** RPCs werfen feste Codes, siehe [Abschnitt 7](#7-fehlercodes). Nie auf freie Texte prüfen.
- **Tabellen-Funktionen** (Rückgabe `TABLE(...)`) liefern über supabase-js ein Array. Für genau eine Zeile `.single()` nutzen, für 0 oder 1 Zeile `.maybeSingle()`.

## 2. Client einrichten

**Umgebungsvariablen** (nie den Secret Key in Apps oder `NEXT_PUBLIC_`):

| App                             | Variablen                                                          |
| ------------------------------- | ------------------------------------------------------------------ |
| Website (`apps/web/.env.local`) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| App (`apps/mobile/.env`)        | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |

Die Werte stehen in der Root-`.env` (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`).

```ts
import { createClient } from '@supabase/supabase-js';
import {
  type Database,
  parseRpcError,
  toRpcArgs,
  claimVoucherSchema,
  storageImageUrl,
  STORAGE_BUCKETS,
} from '@repo/shared';

const supabase = createClient<Database>(url, publishableKey);

// Feed (auch ohne Login)
const { data: offers } = await supabase.rpc('list_offers', { p_category: 'kochen_essen' });
const cover = storageImageUrl(url, STORAGE_BUCKETS.offerImages, offers![0].cover_image_path);

// Code holen mit Eingabeprüfung und Fehlerübersetzung
const input = claimVoucherSchema.parse({ offer_id: offerId, seats: 2 });
const { data, error } = await supabase.rpc('claim_voucher', toRpcArgs(input)).single();
const failure = parseRpcError(error); // { code: 'AUSGEBUCHT', message: 'Es sind nur noch 1 Plätze frei.' } | null
```

Typ-Kurzformen aus `@repo/shared`: `Tables<'offers'>`, `Enums<'voucher_status'>`, `RpcArgs<'create_offer'>`, `RpcRow<'list_offers'>`.

## 3. Rollen und Auth

### Rollen

| Rolle (`profiles.role`) | Wer                              | Wie entsteht sie                                                                  |
| ----------------------- | -------------------------------- | --------------------------------------------------------------------------------- |
| `nutzer`                | App-Nutzer                       | Standard für jedes neue Konto                                                     |
| `standort`              | ein Login pro Standort (Website) | Sign-up mit `options.data.account_type = 'standort'`                              |
| `admin`                 | Betreiber (Website)              | nur per SQL oder Seed: `update public.profiles set role = 'admin' where id = '…'` |

Ein Trigger legt für jedes neue Auth-Konto ein Profil an. Er übernimmt `first_name`/`last_name` aus den Metadaten (auch `given_name`/`family_name`/`full_name` von Apple und Google) sowie optional `age` und `interests`. Über Metadaten lässt sich niemand zum Admin machen. Rollen werden bei jedem RPC-Aufruf frisch aus der Tabelle gelesen, nicht aus dem JWT, deshalb wirken Änderungen sofort.

### Abläufe

**Nutzer (App), E-Mail und Passwort:**

```ts
await supabase.auth.signUp({
  email,
  password,
  options: { data: { age, interests }, emailRedirectTo },
});
await supabase.auth.signInWithPassword({ email, password });
const { data: account } = await supabase.rpc('get_my_account');
if (!account.profile_complete) {
  await supabase.rpc('update_my_profile', { p_first_name, p_last_name });
}
```

`age` und `interests` sind optional. `interests` sind Werte aus `offer_category` und werden als `favorite_categories` gespeichert. Das Bestätigen der Registrierungs-E-Mail setzt die App-Session über `auth/callback`. Vor- und Nachname können später ergänzt werden und sind erst für `claim_voucher` erforderlich (`PROFIL_UNVOLLSTAENDIG`).

Google und Apple laufen weiterhin über OAuth bzw. `signInWithIdToken`.

**Standort (Website), zweistufig:**

1. `supabase.auth.signUp({ email, password, options: { data: { account_type: 'standort' }, emailRedirectTo } })`
2. E-Mail bestätigen, einloggen
3. `register_company(...)` legt Unternehmen und ersten Standort an (`pending`)
4. Der Admin schaltet frei (`approve_location`). Erst dann sind `create_offer`, `update_offer`, `redeem_voucher` und `mark_no_show` erlaubt.

Mit `get_my_account()` entscheidet die Website, was sie anzeigt: `role`, `location.status` (`pending` / `approved` / `rejected`), `location.status_reason`.

**Weitere Standorte desselben Unternehmens** registrieren sich genauso. Beim Freischalten ordnet der Admin sie mit `approve_location(id, p_merge_into_company_id)` dem bestehenden Unternehmen zu. Das leere Unternehmen der Registrierung wird dabei gelöscht.

### Auth-Einstellungen im Dashboard (Checkliste)

Diese Einstellungen sind Projekt-Konfiguration, kein Schema. Sie werden im Dashboard unter **Authentication** gesetzt und gehören zur jeweiligen Session.

| Einstellung                 | Wert                                                                                                                            | Zuständig                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Sign In / Providers → Email | aktiviert, „Confirm email“ an                                                                                                   | erledigt (Standard)                  |
| E-Mail-Bestätigung          | Bestätigungsvorlage verwendet `{{ .ConfirmationURL }}` und Redirect-URLs enthalten das App-Schema                               | App-Session                          |
| Eigenes SMTP                | **nötig** für Registrierungsbestätigungen an beliebige Adressen; Standard-SMTP ist für Tests begrenzt (z. B. Brevo oder Resend) | vor öffentlichen App-Registrierungen |
| Apple, Google               | Client-IDs und Secrets eintragen                                                                                                | App-Session                          |
| URL Configuration           | Site URL der Website; Redirect-URLs: `http://localhost:3000/**`, Live-Domain, `unfairweekend://**` und für Expo Go `exp://**`   | Web- bzw. App-Session                |
| Passwort                    | min. 8 Zeichen, max. 72 Zeichen (gleich wie `passwordSchema`)                                                                   | App und Web                          |

### Testkonten mit Passwort in der App

Die Seed-Nutzer haben ein Passwort, weil E-Mails an `example.com` nicht ankommen. In Entwicklungs-Builds gibt es zusätzlich einen Dev-Login mit `signInWithPassword`.

## 4. Tabellen

Alle Tabellen liegen in `public`, alle mit RLS. „Schreiben“ heißt immer: über die genannten RPCs.

| Tabelle               | Inhalt                                | Wichtige Spalten                                                                                                                                                                                                                                                                                                                            | Schreiben über                                                                                               |
| --------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `profiles`            | ein Profil pro Auth-Konto             | `role`, `age` (optional), `first_name`, `last_name`, `avatar_path` (optional), `no_show_count`, `blocked_until`                                                                                                                                                                                                                             | Trigger, `update_my_profile`, `update_my_avatar`, `mark_no_show`                                             |
| `companies`           | Unternehmen                           | `name`, `description`, `logo_path`                                                                                                                                                                                                                                                                                                          | `register_company`, `update_my_company`, `approve_location`                                                  |
| `locations`           | Standort, 1 Login (`account_user_id`) | `company_id`, `name`, `street`, `postal_code`, `city`, `lat`/`lng` (optional), `phone`, `website`, `image_paths` (0–5, erstes = Hauptbild), `status`, `status_reason`                                                                                                                                                                       | `register_company`, `update_my_location`, `update_my_location_images`, `approve_location`, `reject_location` |
| `settings`            | genau eine Zeile                      | `min_discount_percent` (20), `cancel_deadline_hours` (3), `no_show_limit` (2), `block_days` (30), `reminder_hours_before` (2)                                                                                                                                                                                                               | `update_settings`                                                                                            |
| `offers`              | Angebote                              | `location_id`, `title`, `description`, `category`, `image_paths` (Legacy-Feld; öffentliche Bilder kommen aus `locations.image_paths`), `original_price_cents`, `deal_price_cents`, `capacity`, `seats_taken`, `max_per_user`, `address`, `lat`, `lng`, `type`, `starts_at`, `ends_at`, `relevant_at` (berechnet), `status`, `status_reason` | `create_offer`, `update_offer`, `cancel_offer`, `remove_offer`                                               |
| `vouchers`            | Gutscheincodes                        | `offer_id`, `user_id` (null nach Kontolöschung), `seats`, `token` (QR, 43 Zeichen), `short_code` (`K7Q-4MX`), `status`, `claimed_at`, `cancelled_at`, `cancel_reason`, `redeemed_at`, `no_show_at`, `expired_at`                                                                                                                            | `claim_voucher`, `cancel_voucher`, `redeem_voucher`, `mark_no_show`, Cron                                    |
| `favorite_locations`  | Lieblingsstandorte                    | `user_id`, `location_id`                                                                                                                                                                                                                                                                                                                    | direkt (insert/delete eigener Zeilen)                                                                        |
| `favorite_categories` | Lieblingskategorien                   | `user_id`, `category`                                                                                                                                                                                                                                                                                                                       | direkt (insert/delete eigener Zeilen)                                                                        |
| `favorite_offers`     | Lieblingsangebote (Herz)              | `user_id`, `offer_id`, `created_at`                                                                                                                                                                                                                                                                                                         | direkt (insert/delete eigener Zeilen)                                                                        |
| `push_tokens`         | Geräte eines Nutzers                  | `user_id`, `token` (eindeutig), `platform` (`ios`/`android`/`web`), `last_seen_at`                                                                                                                                                                                                                                                          | `register_push_token`, `unregister_push_token`, delete eigener Zeilen                                        |
| `reviews`             | Bewertungen von Standorten            | `location_id`, `user_id`, `voucher_id` (eingelöster Code, eindeutig), `rating` (1–5), `comment` (optional, max. 1000), `hidden_at`/`hidden_by`/`hidden_reason` (Admin). Eindeutig pro `user_id` + `location_id`                                                                                                                             | `create_review`, `set_review_hidden`                                                                         |
| `offer_templates`     | Angebotsvorlagen eines Standorts      | `location_id`, `name` (intern, 2–60, eindeutig je Standort), `title`, `description`, `category`, `image_paths` (Legacy-Feld), `original_price_cents`, `deal_price_cents`, `capacity`, `max_per_user`, `type`, `duration_minutes` (Ende = Beginn + Dauer). Keine Adresse, kein Zeitpunkt                                                     | `create_offer_template`, `update_offer_template`, `delete_offer_template`                                    |
| `notification_outbox` | ausstehende Benachrichtigungen        | siehe [Abschnitt 10](#10-cron-und-benachrichtigungen-outbox)                                                                                                                                                                                                                                                                                | Funktionen, Cron, Worker (service_role)                                                                      |
| `events`              | Rohdaten für Kennzahlen               | `type`, `offer_id`, `location_id`, `category`, `user_id`, `voucher_id`, `seats`, `created_at`                                                                                                                                                                                                                                               | Funktionen                                                                                                   |
| `geocode_cache`       | Adresse → Koordinaten                 | `query`, `lat`, `lng`, `display_name`, `provider`                                                                                                                                                                                                                                                                                           | Edge Function `geocode`                                                                                      |

**Enums** (als Konstanten mit deutschen Labels in `@repo/shared`):

| Enum                    | Werte                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `app_role`              | `nutzer`, `standort`, `admin`                                                                          |
| `location_status`       | `pending`, `approved`, `rejected`                                                                      |
| `offer_type`            | `einzeltermin` (Start und Ende), `zeitraum` (einlösbar von–bis)                                        |
| `offer_status`          | `aktiv`, `abgesagt`, `entfernt` („beendet“ ergibt sich aus der Zeit)                                   |
| `offer_category`        | `kochen_essen`, `sport_bewegung`, `kreativ_workshops`, `wellness_beauty`, `kultur_events`, `sonstiges` |
| `voucher_status`        | `aktiv`, `storniert`, `eingeloest`, `no_show`, `abgelaufen`                                            |
| `voucher_cancel_reason` | `nutzer`, `angebot_abgesagt`, `angebot_entfernt`, `konto_geloescht`                                    |
| `notification_type`     | `angebot_abgesagt`, `erinnerung`                                                                       |
| `notification_status`   | `pending`, `processing`, `sent`, `failed`                                                              |
| `event_type`            | `angebot_angesehen`, `code_geholt`, `code_storniert`, `code_eingeloest`, `no_show`                     |
| `push_platform`         | `ios`, `android`, `web`                                                                                |

**Harte Grenzen in der Datenbank:** `seats_taken <= capacity` (CHECK, Überbuchung ist unmöglich), höchstens ein aktiver Code pro Nutzer und Angebot (Unique-Index), `deal_price_cents < original_price_cents`, `ends_at > starts_at`.

## 5. Rechte pro Rolle (RLS)

| Tabelle                                          | anon              | Nutzer                         | Standort                                                     | Admin                  |
| ------------------------------------------------ | ----------------- | ------------------------------ | ------------------------------------------------------------ | ---------------------- |
| `profiles`                                       | –                 | eigenes lesen                  | eigenes lesen                                                | alle lesen             |
| `companies`                                      | –                 | –                              | eigenes Unternehmen lesen                                    | alle lesen             |
| `locations`                                      | –                 | –                              | eigenen Standort lesen                                       | alle lesen             |
| `settings`                                       | lesen             | lesen                          | lesen                                                        | lesen (ändern per RPC) |
| `offers`                                         | – (Feed per RPC)  | – (per RPC)                    | eigene lesen                                                 | alle lesen             |
| `vouchers`                                       | –                 | eigene lesen                   | Codes eigener Angebote lesen                                 | alle lesen             |
| `favorite_*`                                     | –                 | eigene lesen, anlegen, löschen | –                                                            | –                      |
| `push_tokens`                                    | –                 | eigene lesen, löschen          | –                                                            | –                      |
| `reviews`                                        | – (Liste per RPC) | eigene lesen                   | Bewertungen des eigenen Standorts lesen (auch ausgeblendete) | alle lesen             |
| `offer_templates`                                | –                 | –                              | Vorlagen des eigenen Standorts lesen                         | alle lesen             |
| `notification_outbox`, `events`, `geocode_cache` | –                 | –                              | –                                                            | – (nur service_role)   |

`favorite_*` umfasst `favorite_locations`, `favorite_categories` und `favorite_offers`. Kein Client darf Tabellen direkt ändern (außer Favoriten und eigene Push-Tokens löschen). Versuche enden mit `42501 permission denied`.

## 6. RPCs

Aufruf: `supabase.rpc('<name>', { p_…: … })`. Bei allen RPCs für Angemeldete kann zusätzlich `NICHT_ANGEMELDET` kommen.

### Öffentlich (anon und angemeldet)

#### `list_offers(p_category?, p_location_ids?, p_only_available = false, p_limit = 50, p_offset = 0)`

Feed: aktive Angebote freigeschalteter Standorte, die man gerade holen kann (Einzeltermin noch nicht begonnen, Zeitraum noch nicht vorbei). Sortiert nach `relevant_at` (Einzeltermin: Beginn, Zeitraum: Ende), dann `id`. `p_limit` liegt zwischen 1 und 100. Ausgebuchte Angebote erscheinen mit `free_seats = 0`, außer `p_only_available = true`.

Rückgabe pro Zeile: `id, title, category, cover_image_path, image_paths, original_price_cents, deal_price_cents, discount_percent, type, starts_at, ends_at, relevant_at, capacity, free_seats, max_per_user, address, lat, lng, location_id, location_name, company_id, company_name, company_logo_path`

`cover_image_path` und `image_paths` kommen aus dem Standort. Alle Aktivitäten eines Standorts verwenden dieselbe Galerie; das erste Bild ist das Hauptbild.

Bilder sind optional: Ohne Bild ist `image_paths` leer und `cover_image_path` ist `null`. Die Clients zeigen dann einen Platzhalter.

Weitere Filter gehen per PostgREST, z. B. `.rpc('list_offers').gte('discount_percent', 30)`. Entfernung kann der Client aus `lat`/`lng` berechnen.

#### `get_offer(p_offer_id)` → 0 oder 1 Zeile

Detail mit allen Feldern von `list_offers` plus `description, status, status_reason, is_claimable, location_street, location_postal_code, location_city, location_phone, location_website, company_description`. Sichtbar, wenn das Angebot aktiv ist und der Standort freigeschaltet. Außerdem immer für den eigenen Standort, für Admins und für Nutzer mit einem Code dafür (auch nach Absage). Sonst ist das Ergebnis leer.

#### `log_offer_view(p_offer_id)` → void

Zählt einen Aufruf der Detailseite. Derselbe angemeldete Nutzer zählt höchstens einmal in 30 Minuten. Wirft nie Fehler.

#### `get_settings()` → `settings`

Die Admin-Einstellungen (z. B. `min_discount_percent` für das Angebotsformular).

#### `get_locations_public(p_location_ids)` → 0 bis n Zeilen

Freigeschaltete Standorte mit Unternehmensinfo, für die Standortseite der App (eine ID) und die Liste der Lieblingsorte (mehrere IDs). Sortiert nach `name`, dann `id`. Unbekannte und nicht freigeschaltete IDs fehlen im Ergebnis. Pro Aufruf zählen höchstens die ersten 100 IDs.

Rückgabe pro Zeile: `id, name, street, postal_code, city, lat, lng, phone, website, company_id, company_name, company_description, company_logo_path`

Die Angebote eines Standorts liefert `list_offers(p_location_ids => [id])`.

#### `list_offer_created_at(p_offer_ids)` → 0 bis n Zeilen

Veröffentlichungszeit zu Angeboten aus `list_offers`, für den Abschnitt „Neu dabei“ der App. Gleiche Sichtbarkeit wie `list_offers` (nur holbare Angebote), neueste zuerst. Pro Aufruf zählen höchstens die ersten 100 IDs.

Rückgabe pro Zeile: `id, created_at`

#### `list_location_reviews(p_location_id, p_limit = 20, p_offset = 0)` → 0 bis n Zeilen

Sichtbare Bewertungen eines freigeschalteten Standorts, neueste zuerst. Höchstens 50 pro Seite. Ausgeblendete fehlen.

Rückgabe pro Zeile: `id, rating, comment, created_at, author_name` („Mia K.“, ohne Namen „Gast“), `offer_title` (das eingelöste Angebot)

#### `get_location_ratings(p_location_ids)` → 0 bis n Zeilen

Anzahl und Durchschnitt sichtbarer Bewertungen je freigeschaltetem Standort, z. B. für Standort- und Angebotsseite. Standorte ohne Bewertung fehlen im Ergebnis (in der App als „Noch keine Bewertungen“ zeigen). Pro Aufruf zählen höchstens die ersten 100 IDs.

Rückgabe pro Zeile: `location_id, review_count, average_rating` (eine Nachkommastelle, z. B. `4.7`)

### Nutzer (App)

| RPC                     | Parameter                                                                                                                     | Rückgabe                                                                                                                                                                                                                                                                                                                                               | Fehlercodes                                                                                                                                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_my_account()`      | –                                                                                                                             | jsonb: `user_id, role, first_name, last_name, age, interests, profile_complete, no_show_count, blocked_until, is_blocked, location, avatar_path` (`{id, name, status, status_reason, company_id, company_name}` oder null)                                                                                                                             | `KEIN_PROFIL`                                                                                                                                                                                                                    |
| `update_my_profile`     | `p_first_name, p_last_name` (je 1–50 Zeichen, getrimmt)                                                                       | `profiles`                                                                                                                                                                                                                                                                                                                                             | `UNGUELTIGE_EINGABE`                                                                                                                                                                                                             |
| `update_my_avatar`      | `p_path` (Pfad im Bucket `avatars`, eigener Ordner `<user_id>/<datei>`, Datei muss hochgeladen sein; `null` = Bild entfernen) | text: neuer Pfad oder null                                                                                                                                                                                                                                                                                                                             | `UNGUELTIGE_EINGABE`                                                                                                                                                                                                             |
| `claim_voucher`         | `p_offer_id, p_seats = 1`                                                                                                     | 1 Zeile: `id, offer_id, seats, token, short_code, status, claimed_at`                                                                                                                                                                                                                                                                                  | `NUR_NUTZER`, `PROFIL_UNVOLLSTAENDIG`, `GESPERRT`, `UNGUELTIGE_PLATZANZAHL`, `ANGEBOT_NICHT_GEFUNDEN`, `ANGEBOT_NICHT_AKTIV`, `ANGEBOT_BEGONNEN`, `ANGEBOT_ABGELAUFEN`, `ZU_VIELE_PLAETZE`, `BEREITS_AKTIVER_CODE`, `AUSGEBUCHT` |
| `cancel_voucher`        | `p_voucher_id`                                                                                                                | 1 Zeile: `id, offer_id, seats, status, cancelled_at`                                                                                                                                                                                                                                                                                                   | `CODE_NICHT_GEFUNDEN`, `CODE_NICHT_AKTIV`, `FRIST_ABGELAUFEN`, `ANGEBOT_ABGELAUFEN`                                                                                                                                              |
| `get_my_vouchers()`     | –                                                                                                                             | Zeilen: `id, status, seats, token, short_code, claimed_at, cancelled_at, cancel_reason, redeemed_at, can_cancel, cancel_deadline, offer_id, offer_title, offer_type, offer_status, starts_at, ends_at, cover_image_path, address, lat, lng, location_id, location_name, company_name`. Aktive zuerst (nach Termin), dann die übrigen (neueste zuerst). | –                                                                                                                                                                                                                                |
| `register_push_token`   | `p_token, p_platform`                                                                                                         | void. Ein Token gehört immer dem zuletzt angemeldeten Konto auf dem Gerät.                                                                                                                                                                                                                                                                             | `UNGUELTIGE_EINGABE`                                                                                                                                                                                                             |
| `unregister_push_token` | `p_token`                                                                                                                     | void (z. B. beim Logout)                                                                                                                                                                                                                                                                                                                               | –                                                                                                                                                                                                                                |
| `create_review`         | `p_voucher_id, p_rating` (1–5), `p_comment?` (max. 1000 Zeichen, getrimmt, leer = ohne Text)                                  | 1 Zeile: `id, location_id, voucher_id, rating, comment, created_at`                                                                                                                                                                                                                                                                                    | `CODE_NICHT_GEFUNDEN`, `BEWERTUNG_NICHT_MOEGLICH`, `BEREITS_BEWERTET`, `UNGUELTIGE_EINGABE`                                                                                                                                      |
| `delete_my_account()`   | –                                                                                                                             | void. Danach `supabase.auth.signOut()`.                                                                                                                                                                                                                                                                                                                | `KONTO_NICHT_LOESCHBAR` (Standort/Admin)                                                                                                                                                                                         |

**Regeln hinter `claim_voucher`:** Nur Nutzerkonten mit Vor- und Nachnamen, nicht gesperrt. Das Angebot muss aktiv sein und der Standort freigeschaltet. Einzeltermin: noch nicht begonnen. Zeitraum: noch nicht vorbei (schon vor „von“ holbar). Höchstens `max_per_user` Plätze, höchstens ein aktiver Code pro Angebot, genug freie Plätze. Die Funktion sperrt die Angebotszeile (`FOR UPDATE`), parallele Anfragen warten also aufeinander.

**Stornieren:** Beim Einzeltermin bis `cancel_deadline_hours` vor Beginn, beim Zeitraum bis zum Ende. Die Plätze gehen zurück. Danach kann man erneut einen Code holen.

**Bewerten:** Nur mit einem eigenen, eingelösten Code (`status = 'eingeloest'`). Bewertet wird der Standort des Angebots, pro Nutzer und Standort genau einmal (auch bei mehreren Besuchen). Ob ein Code schon bewertet ist, liest die App direkt: `supabase.from('reviews').select('voucher_id, location_id')` (RLS zeigt nur eigene). Bewertungen lassen sich nicht ändern. Beim Löschen des Kontos verschwinden sie mit.

**Konto löschen:** Aktive Codes werden storniert (Plätze zurück, Grund `konto_geloescht`). Profil, Favoriten, Push-Tokens und Benachrichtigungen werden gelöscht, das Auth-Konto ebenfalls. Codes und Events bleiben ohne Personenbezug für die Kennzahlen. In der Teilnehmerliste erscheint dann „Gelöschtes Konto“.

### Standort (Website)

| RPC                         | Parameter                                                                                                                                                                            | Rückgabe                                                                                                                                           | Fehlercodes                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `register_company`          | `p_company_name, p_location_name, p_street, p_postal_code, p_city, p_company_description?, p_lat?, p_lng?, p_phone?, p_website?`                                                     | jsonb `{company_id, location_id, status: 'pending'}`                                                                                               | `KEIN_STANDORTKONTO`, `STANDORT_EXISTIERT_BEREITS`, `UNGUELTIGE_EINGABE`                                                                                                                               |
| `update_my_location`        | `p_name, p_street, p_postal_code, p_city, p_lat?, p_lng?, p_phone?, p_website?` (alle Werte, ersetzt)                                                                                | `locations`                                                                                                                                        | `KEIN_STANDORTKONTO`, `UNGUELTIGE_EINGABE`                                                                                                                                                             |
| `update_my_location_images` | `p_image_paths` (0–5 Storage-Pfade aus dem eigenen Standortordner; erstes Bild ist das Hauptbild)                                                                                    | `text[]`                                                                                                                                           | `KEIN_STANDORTKONTO`, `BILDER_UNGUELTIG`                                                                                                                                                               |
| `update_my_company`         | `p_name, p_description?, p_logo_path?` (alle Werte, ersetzt)                                                                                                                         | `companies`                                                                                                                                        | `KEIN_STANDORTKONTO`, `UNGUELTIGE_EINGABE`                                                                                                                                                             |
| `create_offer`              | `p_title, p_description, p_category, p_image_paths, p_original_price_cents, p_deal_price_cents, p_capacity, p_max_per_user, p_address, p_lat, p_lng, p_type, p_starts_at, p_ends_at` | `offers` (sofort live)                                                                                                                             | `KEIN_STANDORTKONTO`, `STANDORT_NICHT_FREIGESCHALTET`, `UNGUELTIGE_EINGABE`, `BILDER_UNGUELTIG`, `PREIS_UNGUELTIG`, `RABATT_ZU_GERING`, `ADRESSE_UNGUELTIG`, `ZEIT_UNGUELTIG`, `ZEIT_IN_VERGANGENHEIT` |
| `update_offer`              | `p_offer_id` + alle Felder wie `create_offer` (ersetzt)                                                                                                                              | `offers`                                                                                                                                           | wie `create_offer`, dazu `ANGEBOT_NICHT_GEFUNDEN`, `ANGEBOT_NICHT_AKTIV`, `FELD_GESPERRT`, `KONTINGENT_ZU_KLEIN`                                                                                       |
| `cancel_offer`              | `p_offer_id, p_reason?` (≤ 500 Zeichen)                                                                                                                                              | jsonb `{offer_id, status: 'abgesagt', cancelled_vouchers}`                                                                                         | `KEIN_STANDORTKONTO`, `ANGEBOT_NICHT_GEFUNDEN`, `ANGEBOT_NICHT_AKTIV`, `UNGUELTIGE_EINGABE`                                                                                                            |
| `redeem_voucher`            | `p_code` (QR-Token oder Kurzcode; Groß/Klein, Leerzeichen, Bindestrich egal)                                                                                                         | 1 Zeile: `id, short_code, seats, status, redeemed_at, offer_id, offer_title, first_name, last_initial`                                             | `KEIN_STANDORTKONTO`, `STANDORT_NICHT_FREIGESCHALTET`, `CODE_NICHT_GEFUNDEN`, `FALSCHER_STANDORT`, `BEREITS_EINGELOEST`, `CODE_NICHT_AKTIV`, `EINLOESUNG_ZU_FRUEH`, `EINLOESUNG_ZU_SPAET`              |
| `mark_no_show`              | `p_voucher_id`                                                                                                                                                                       | 1 Zeile: `id, status, no_show_at, user_blocked, blocked_until`                                                                                     | `KEIN_STANDORTKONTO`, `STANDORT_NICHT_FREIGESCHALTET`, `CODE_NICHT_GEFUNDEN`, `NO_SHOW_NUR_EINZELTERMIN`, `CODE_NICHT_AKTIV`, `NO_SHOW_ZU_FRUEH`, `NO_SHOW_ZU_SPAET`                                   |
| `get_offer_participants`    | `p_offer_id`                                                                                                                                                                         | Zeilen: `voucher_id, short_code, seats, status, claimed_at, redeemed_at, no_show_at, first_name, last_initial`. Ohne E-Mail. Aktive zuerst.        | `ANGEBOT_NICHT_GEFUNDEN`                                                                                                                                                                               |
| `create_offer_template`     | `p_name, p_title, p_description, p_category, p_image_paths, p_original_price_cents, p_deal_price_cents, p_capacity, p_max_per_user, p_type, p_duration_minutes`                      | `offer_templates`                                                                                                                                  | `KEIN_STANDORTKONTO`, `STANDORT_NICHT_FREIGESCHALTET`, `UNGUELTIGE_EINGABE`, `BILDER_UNGUELTIG`, `PREIS_UNGUELTIG`, `RABATT_ZU_GERING`, `ZEIT_UNGUELTIG`, `VORLAGENNAME_VERGEBEN`, `VORLAGEN_LIMIT`    |
| `update_offer_template`     | `p_template_id` + alle Felder wie `create_offer_template` (ersetzt)                                                                                                                  | `offer_templates`                                                                                                                                  | wie `create_offer_template` ohne `VORLAGEN_LIMIT`, dazu `VORLAGE_NICHT_GEFUNDEN`                                                                                                                       |
| `delete_offer_template`     | `p_template_id`                                                                                                                                                                      | void                                                                                                                                               | `KEIN_STANDORTKONTO`, `VORLAGE_NICHT_GEFUNDEN`                                                                                                                                                         |
| `list_my_reviews`           | `p_rating?` (1–5, Filter), `p_limit = 20` (max. 50), `p_offset = 0`, `p_sort = 'neueste'` (`neueste`, `aelteste`, `beste`, `schlechteste`), `p_since?` (nur ab diesem Zeitpunkt)     | Zeilen: `id, rating, comment, created_at, author_name` („Mia K.“), `offer_id, offer_title, is_hidden`. Sortiert nach `p_sort`, auch ausgeblendete. | `KEIN_STANDORTKONTO`, `UNGUELTIGE_EINGABE`                                                                                                                                                             |
| `get_my_review_summary`     | –                                                                                                                                                                                    | 1 Zeile: `review_count, average_rating` (null ohne Bewertung), `rating_1` … `rating_5`, `hidden_count`, `last_30_days`                             | `KEIN_STANDORTKONTO`                                                                                                                                                                                   |

**Eigene Angebote und Codes lesen:** direkt, z. B. `supabase.from('offers').select('*').order('starts_at')` und `supabase.from('vouchers').select('*').eq('offer_id', id)`. RLS zeigt nur den eigenen Standort. Freie Plätze = `capacity − seats_taken`.

**Bewertungen des eigenen Standorts:** `reviews` ist per RLS lesbar, die Namen der Verfasser aber nicht. `list_my_reviews` liefert Liste, Anzeigename und Angebot; `get_my_review_summary` die Übersicht. Ausgeblendete Bewertungen erscheinen mit `is_hidden = true`, zählen aber nicht in Durchschnitt oder Verteilung. Antworten auf Bewertungen gibt es noch nicht.

**Regeln für Angebote:**

- **Felder:** Titel 3–80 Zeichen, Beschreibung 10–2000 Zeichen, 0–5 Bilder (optional), Kontingent 1–1000, Plätze pro Person 1–20 und ≤ Kontingent, Originalpreis bis 100.000 €.
- **Rabatt:** Deal-Preis < Original, und der Rabatt ist mindestens `min_discount_percent`. Die Regel lautet `(Original − Deal) × 100 ≥ Minimum × Original` und steht auch in `meetsMinDiscount()`.
- **Zeit:** Dauer höchstens 90 Tage, Beginn höchstens 1 Jahr in der Zukunft. Neu angelegt bzw. bei geänderter Zeit: Einzeltermin mit Beginn in der Zukunft, Zeitraum mit Ende in der Zukunft.
- **Nach Code-Vergabe** (es gibt Codes in `aktiv`, `eingeloest` oder `no_show`):
  - Art, Zeit, Adresse/Koordinaten und Preise sind gesperrt (`FELD_GESPERRT`).
  - Titel, Beschreibung, Bilder, Kategorie und Plätze pro Person bleiben änderbar.
  - Das Kontingent darf nicht unter `seats_taken` fallen.
- **Absage:** jederzeit möglich, auch nach Beginn.
  - Alle aktiven Codes werden storniert (`angebot_abgesagt`), es entstehen keine No-Shows.
  - Jeder betroffene Inhaber bekommt einen Outbox-Eintrag.
  - Eingelöste Codes bleiben, wie sie sind.

**Angebotsvorlagen:** Damit ein Standort bei einer kurzfristigen Lücke schnell ein Angebot anlegen kann.

- **Lesen:** direkt, `supabase.from('offer_templates').select('*').order('name')`. RLS zeigt nur den eigenen Standort.
- **Inhalt:** alles, was ein Angebot braucht, außer Adresse und Zeitpunkt. Statt Beginn und Ende steht die Dauer in Minuten (1 Minute bis 90 Tage). Es gelten dieselben Grenzen wie bei Angeboten, auch der Mindestrabatt.
- **Name:** interner Name (2–60 Zeichen), nur für den Standort sichtbar, eindeutig je Standort. Höchstens 30 Vorlagen je Standort.
- **Angebot aus Vorlage:** Es gibt dafür keine eigene RPC. Der Client füllt das Formular mit den Werten der Vorlage, der Standort wählt nur noch den Beginn (Ende = Beginn + Dauer), dann läuft wie immer `create_offer`. Vorlage und Angebot sind danach unabhängig: Ändern oder Löschen der Vorlage ändert keine Angebote.
- **Bilder:** dieselben Dateien im Bucket `offer-images` wie bei Angeboten. Beim Löschen einer Vorlage bleiben die Dateien liegen.

**Bewertungen des eigenen Standorts:** `reviews` ist per RLS lesbar, die Namen der Verfasser aber nicht. Deshalb gibt es `list_my_reviews` (Liste mit Anzeigename und Angebot) und `get_my_review_summary` (Übersicht).

- Durchschnitt, Verteilung und `last_30_days` zählen wie öffentlich nur sichtbare Bewertungen.
- Vom Admin ausgeblendete Bewertungen stehen mit `is_hidden = true` in der Liste und zählen in `hidden_count`. Der Grund des Admins wird nicht angezeigt.
- **Sortierung** (`p_sort`): `neueste` (Standard), `aelteste`, `beste`, `schlechteste`. Bei Gleichstand gilt neueste zuerst. Unbekannte Werte: `UNGUELTIGE_EINGABE`.
- **Zeitraum** (`p_since`): nur Bewertungen mit `created_at >= p_since`. Der Client rechnet z. B. „letzte 30 Tage“ selbst aus. Die Übersicht (`get_my_review_summary`) zählt immer alle Bewertungen.
- Antworten auf Bewertungen gibt es (noch) nicht.

**Einlösen:** nur am eigenen, freigeschalteten Standort.

- **Zeitfenster:** beim Einzeltermin ab 1 Std. vor Beginn bis zum Ende, beim Zeitraum innerhalb des Zeitraums.
- **Antwort** für die Bestätigungsanzeige: Vorname, Initial, Plätze, Titel.

**No-Show:**

- nur Einzeltermine, nur der eigene Standort
- ab Beginn bis 48 Std. nach Ende
- **Sperre:** Ab `no_show_limit` No-Shows ist der Nutzer `block_days` Tage gesperrt, danach steht der Zähler wieder auf 0. `user_blocked` sagt, ob gerade gesperrt wurde.

### Admin (Website)

Admins lesen alle Tabellen direkt (z. B. `locations` mit `status = 'pending'` für die Freischalt-Liste).

| RPC                             | Parameter                                                                                                                                       | Rückgabe                                                                        | Fehlercodes                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `get_pending_location_contacts` | –                                                                                                                                               | Zeilen: `location_id, contact_email` für offene Anträge. Nur Admin.             | `KEIN_ZUGRIFF`                                                                              |
| `approve_location`              | `p_location_id, p_merge_into_company_id?`                                                                                                       | `locations`                                                                     | `KEIN_ZUGRIFF`, `STANDORT_NICHT_GEFUNDEN`, `STATUS_UNGUELTIG`, `UNTERNEHMEN_NICHT_GEFUNDEN` |
| `reject_location`               | `p_location_id, p_reason?`                                                                                                                      | jsonb `{location_id, status: 'rejected', cancelled_offers, cancelled_vouchers}` | `KEIN_ZUGRIFF`, `STANDORT_NICHT_GEFUNDEN`, `STATUS_UNGUELTIG`, `UNGUELTIGE_EINGABE`         |
| `remove_offer`                  | `p_offer_id, p_reason?`                                                                                                                         | jsonb `{offer_id, status: 'entfernt', cancelled_vouchers}`                      | `KEIN_ZUGRIFF`, `ANGEBOT_NICHT_GEFUNDEN`, `ANGEBOT_NICHT_AKTIV`, `UNGUELTIGE_EINGABE`       |
| `update_settings`               | `p_min_discount_percent (0–100), p_cancel_deadline_hours (0–168), p_no_show_limit (1–20), p_block_days (1–365), p_reminder_hours_before (0–72)` | `settings`                                                                      | `KEIN_ZUGRIFF`, `UNGUELTIGE_EINGABE`                                                        |
| `set_review_hidden`             | `p_review_id, p_hidden, p_reason?` (max. 500 Zeichen)                                                                                           | 1 Zeile: `id, hidden_at, hidden_reason`                                         | `KEIN_ZUGRIFF`, `BEWERTUNG_NICHT_GEFUNDEN`, `UNGUELTIGE_EINGABE`                            |
| `get_admin_metrics`             | `p_from?, p_to?` (Datum, Berliner Kalendertage; Standard: letzte 12 Wochen, max. 2 Jahre)                                                       | jsonb, siehe unten                                                              | `KEIN_ZUGRIFF`, `UNGUELTIGE_EINGABE`                                                        |

- `approve_location` funktioniert für `pending` und `rejected`.
- `get_pending_location_contacts` liest die Login-E-Mail aus `auth.users` nur für Admins und nur für offene Anträge. Die E-Mail wird nicht zusätzlich gespeichert.
- `reject_location` funktioniert auch nach der Freischaltung, als Sperre. Aktive Angebote des Standorts werden dann abgesagt und die Inhaber benachrichtigt. Ein abgelehnter Standort kann keine Angebote mehr anlegen.
- `set_review_hidden(…, true)` blendet eine Bewertung aus (Liste und Durchschnitt), `false` blendet sie wieder ein. Zum Moderieren liest der Admin `reviews` direkt.
- `remove_offer` wirkt wie eine Absage: Codes werden storniert (`angebot_entfernt`) und die Inhaber benachrichtigt.

**`get_admin_metrics`:**

```jsonc
{
  "range": { "from": "2026-08-21", "to": "2026-11-12" },
  "totals": {
    "views": 0,
    "claims": 0,
    "claimed_seats": 0,
    "cancellations": 0,
    "redemptions": 0,
    "redeemed_seats": 0,
    "no_shows": 0,
    "redemption_rate": 0.667,
  },
  "by_week": [{ "week_start": "2026-11-09", "...": "gleiche Felder" }], // Montag, Berliner Zeit
  "by_location": [{ "location_id": "…", "location_name": "…", "company_name": "…", "...": "…" }],
  "by_category": [{ "category": "kochen_essen", "...": "…" }],
  "current": {
    "active_offers": 15,
    "pending_locations": 1,
    "approved_locations": 8,
    "users": 3,
    "blocked_users": 0,
    "as_of": "2026-11-12",
  },
}
```

Einlösequote = `redemptions / (claims − cancellations)`, auf 3 Stellen gerundet. Ohne Daten ist sie `null`.

### Zahlungen (Variante B, hinter dem Flag `payments_enabled`)

Seit 13.11.2026 im Dev-Projekt, **Flag steht auf aus**. Solange es aus ist, ändert sich für Variante A nichts. Regeln und Annahmen: [SPEC-PAYMENTS.md](SPEC-PAYMENTS.md). Die vollständige Beschreibung (Edge Functions, Webhooks, Testanleitung) folgt in `docs/PAYMENTS.md`. Clients sprechen Stripe nur über Edge Functions an, nie direkt.

**Tabellen** (alle mit RLS, schreiben nur Funktionen bzw. service_role):

| Tabelle                 | Inhalt                                                                                                                                                                                          | Lesen                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `payment_settings`      | eine Zeile: `payments_enabled` (false), `commission_bps` (1500 = 15 %), `reservation_minutes` (10), `payout_delay_hours` (24)                                                                   | alle (auch anon)                                                        |
| `stripe_accounts`       | Stripe-Connect-Konto pro Standort, `is_ready` = Transfers und Auszahlungen aktiv                                                                                                                | eigener Standort, Admin                                                 |
| `paid_bookings`         | Buchung: `status` (`reserviert`, `abgelaufen`, `bezahlt`, `storniert`, `erstattet`, `eingeloest`, `no_show`, `ausgezahlt`), Beträge, Provision, `reserved_until`, `voucher_id`, `payout_due_at` | eigene (Nutzer), Buchungen eigener Angebote (Standort), Admin. Realtime |
| `payment_refunds`       | höchstens eine Vollerstattung pro Buchung                                                                                                                                                       | wie die Buchung                                                         |
| `payment_transfers`     | Transfer an den Standort (`source_transaction` = Charge der Buchung)                                                                                                                            | eigener Standort, Admin                                                 |
| `payment_disputes`      | Rückbuchungen                                                                                                                                                                                   | Admin                                                                   |
| `stripe_webhook_events` | verarbeitete Event-IDs (Idempotenz)                                                                                                                                                             | Admin                                                                   |
| `payment_jobs`          | Arbeitsliste des Stripe-Workers (`pi_abbrechen`, `erstatten`, `auszahlen`, `auszahlung_zurueckholen`)                                                                                           | Admin                                                                   |

**RPCs für Clients:**

| RPC                                                             | Wer             | Zweck                                                                                                                                                 |
| --------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_payment_settings()`                                        | alle            | Flag und Provision. Auswertung in den Clients nur über `bookingMode()` aus `@repo/shared`                                                             |
| `start_paid_booking(p_offer_id, p_seats)`                       | Nutzer          | Plätze reservieren (Row-Lock wie `claim_voucher`). Aufruf über die Edge Function `stripe-create-booking`, die den PaymentIntent anlegt                |
| `cancel_paid_booking(p_booking_id)`                             | Nutzer          | Reservierung abbrechen bzw. bezahlte Buchung stornieren (Fristen wie `cancel_voucher`). Aufruf über `stripe-cancel-booking`, die sofort erstattet     |
| `get_offer_participants_paid(p_offer_id)`                       | Standort        | wie `get_offer_participants`, dazu `is_paid`, `booking_id`, `booking_status`, `amount_cents`                                                          |
| `mark_paid_no_show(p_voucher_id)`                               | Standort        | No-Show für bezahlte Codes, ohne Zähler und Sperre. `mark_no_show` lehnt bezahlte Codes ab (`NO_SHOW_BEZAHLT`)                                        |
| `get_location_bookings(p_location_id?, p_limit, p_offset)`      | Standort, Admin | bezahlte Buchungen mit Brutto, Provision, Netto, Erstattungs- und Auszahlungsstatus                                                                   |
| `update_payment_settings(p_payments_enabled, p_commission_bps)` | Admin           | Flag und Provision (0–5000 Basispunkte)                                                                                                               |
| `get_admin_payment_metrics(p_from?, p_to?)`                     | Admin           | Umsatz, Erstattungen, Auszahlungen, Provision pro Woche und aktuelle Bestände (z. B. `offers_without_payout_account` als Warnung vor dem Einschalten) |

Die übrigen neuen Funktionen (`attach_payment_intent`, `confirm_paid_booking`, `record_webhook_event`, `claim_payment_jobs` …) sind nur für `service_role` (Edge Functions).

**Was sich bei Flag an ändert** (drei neue Trigger, die bestehenden Funktionen bleiben unverändert):

- `claim_voucher` liefert `ZAHLUNG_ERFORDERLICH`. Codes entstehen nur noch aus bezahlten Buchungen und sind normale Codes in `vouchers` (QR, Kurzcode, Einlösen wie bisher).
- `create_offer` liefert `AUSZAHLUNGEN_EINRICHTEN`, solange das Stripe-Konto des Standorts nicht bereit ist.
- Wird ein bezahlter Code storniert (`cancel_voucher`, `cancel_offer`, `remove_offer`, `reject_location`, `delete_my_account` vor der Frist), wird die Vollerstattung automatisch vorgemerkt. Der Absage-Push kommt wie bisher über die Outbox.

**Cron:** `unfair-pay-maintenance` (jede Minute) gibt abgelaufene Reservierungen frei und merkt fällige Auszahlungen vor.

## 7. Fehlercodes

**Format:** Die RPCs werfen `SQLSTATE P0001`. In supabase-js kommt `error.message = '<CODE>'` und `error.details = '<genauer deutscher Text>'` an. `parseRpcError(error)` macht daraus `{ code, message }` und nimmt bevorzugt den genaueren Text vom Server (z. B. „Es sind nur noch 2 Plätze frei.“). Unbekannte Fehler werden zu `UNBEKANNT`.

Die vollständige Liste mit Standardtexten steht in `packages/shared/src/constants/errors.ts` (`RPC_ERROR_MESSAGES`). Ein Test stellt sicher, dass SQL und `packages/shared` dieselben 55 Codes kennen.

| Bereich            | Codes                                                                                                                                                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Konto              | `NICHT_ANGEMELDET`, `KEIN_ZUGRIFF`, `KEIN_PROFIL`, `NUR_NUTZER`, `PROFIL_UNVOLLSTAENDIG`, `GESPERRT`, `KONTO_NICHT_LOESCHBAR`                                                                                                                                                                                                                    |
| Angebote           | `ANGEBOT_NICHT_GEFUNDEN`, `ANGEBOT_NICHT_AKTIV`, `ANGEBOT_BEGONNEN`, `ANGEBOT_ABGELAUFEN`, `AUSGEBUCHT`, `ZU_VIELE_PLAETZE`, `UNGUELTIGE_PLATZANZAHL`, `BEREITS_AKTIVER_CODE`, `RABATT_ZU_GERING`, `PREIS_UNGUELTIG`, `ZEIT_UNGUELTIG`, `ZEIT_IN_VERGANGENHEIT`, `BILDER_UNGUELTIG`, `ADRESSE_UNGUELTIG`, `KONTINGENT_ZU_KLEIN`, `FELD_GESPERRT` |
| Codes              | `CODE_NICHT_GEFUNDEN`, `CODE_NICHT_AKTIV`, `BEREITS_EINGELOEST`, `FALSCHER_STANDORT`, `EINLOESUNG_ZU_FRUEH`, `EINLOESUNG_ZU_SPAET`, `FRIST_ABGELAUFEN`, `NO_SHOW_NUR_EINZELTERMIN`, `NO_SHOW_ZU_FRUEH`, `NO_SHOW_ZU_SPAET`                                                                                                                       |
| Bewertungen        | `BEWERTUNG_NICHT_MOEGLICH`, `BEREITS_BEWERTET`, `BEWERTUNG_NICHT_GEFUNDEN`                                                                                                                                                                                                                                                                       |
| Angebotsvorlagen   | `VORLAGE_NICHT_GEFUNDEN`, `VORLAGENNAME_VERGEBEN`, `VORLAGEN_LIMIT`                                                                                                                                                                                                                                                                              |
| Zahlungen          | `ZAHLUNGEN_AUS`, `ZAHLUNG_ERFORDERLICH`, `ANBIETER_NICHT_BEREIT`, `AUSZAHLUNGEN_EINRICHTEN`, `BETRAG_ZU_GERING`, `BUCHUNG_NICHT_GEFUNDEN`, `BUCHUNG_NICHT_AKTIV`, `RESERVIERUNG_ABGELAUFEN`, `NO_SHOW_BEZAHLT`                                                                                                                                   |
| Standorte, Admin   | `KEIN_STANDORTKONTO`, `STANDORT_NICHT_FREIGESCHALTET`, `STANDORT_EXISTIERT_BEREITS`, `STANDORT_NICHT_GEFUNDEN`, `UNTERNEHMEN_NICHT_GEFUNDEN`, `STATUS_UNGUELTIG`                                                                                                                                                                                 |
| Allgemein          | `UNGUELTIGE_EINGABE`                                                                                                                                                                                                                                                                                                                             |
| nur Edge Functions | `ADRESSE_NICHT_GEFUNDEN`, `GEOCODING_NICHT_VERFUEGBAR` (`FUNCTION_ERROR_MESSAGES`)                                                                                                                                                                                                                                                               |

**Neuer Code:** gleichzeitig in der Migration (`private.raise_error('CODE', 'Text')`) und in `RPC_ERROR_MESSAGES` ergänzen. Fehlt er auf einer Seite, wird `pnpm test` rot.

## 8. Storage

| Bucket          | Öffentlich lesbar        | Max. Größe | Typen           | Pfad                    | Schreiben                                              |
| --------------- | ------------------------ | ---------- | --------------- | ----------------------- | ------------------------------------------------------ |
| `offer-images`  | ja                       | 5 MB       | JPEG, PNG, WebP | `<location_id>/<datei>` | eigener Standort, Admin                                |
| `company-logos` | ja                       | 2 MB       | JPEG, PNG, WebP | `<company_id>/<datei>`  | Standorte des Unternehmens, Admin                      |
| `avatars`       | **nein** (signierte URL) | 2 MB       | JPEG, PNG, WebP | `<user_id>/<datei>`     | Nutzer im eigenen Ordner (lesen: Nutzer selbst, Admin) |

- In der DB stehen nur die Pfade **ohne** Bucket-Namen (`offers.image_paths`, `companies.logo_path`). Seed-Daten enthalten stattdessen absolute Platzhalter-URLs. `storageImageUrl()` kann beides.
- **Upload (Website):** Standortgalerie: `supabase.storage.from('offer-images').upload(`${locationId}/${crypto.randomUUID()}.jpg`, file)`. Upsert ist erlaubt, die SELECT-Policy dafür ist vorhanden. Der Partner speichert bis zu fünf Pfade über `update_my_location_images`; der erste ist das Hauptbild für alle Aktivitäten des Standorts.
- **Profilbild (App):** `supabase.storage.from('avatars').upload(`${userId}/${randomUUID()}.jpg`, arrayBuffer, { contentType: 'image/jpeg' })`, dann `update_my_avatar(path)`. Anzeigen über `createSignedUrl(path, …)`, weil der Bucket privat ist. Das alte Bild löscht die App danach selbst (`remove([alterPfad])`), ebenso alle Bilder vor `delete_my_account()`; direktes Löschen in `storage.objects` per SQL ist in Supabase gesperrt.
- Bilder, die nirgends mehr referenziert werden, räumt bisher niemand auf. Das ist für den MVP unkritisch.

## 9. Edge Functions

### `geocode`

Adresse → Koordinaten für Standort-Accounts und Admins.

```ts
const { data, error } = await supabase.functions.invoke('geocode', {
  body: { street: 'Prinzipalmarkt 13', postal_code: '48143', city: 'Münster' },
});
// data: { lat: 51.9613, lng: 7.6279, display_name: '…', cached: false }
```

- **Fehler** (HTTP-Status, Body `{ error: { code, message } }`): 400 `UNGUELTIGE_EINGABE`, 403 `KEIN_ZUGRIFF`, 404 `ADRESSE_NICHT_GEFUNDEN`, 502 `GEOCODING_NICHT_VERFUEGBAR`.
- **Ablauf:** erst Nominatim (OpenStreetMap), das aus der Supabase-Cloud aktuell mit 403 abgelehnt wird, dann Photon (komoot). Ergebnisse landen in `geocode_cache`.
- **Last:** Beide Dienste sind für wenig Last gedacht. Formulare deshalb erst beim Speichern bzw. auf Knopfdruck geocoden, nicht bei jedem Tastendruck.
- **Deploy:** `pnpm supabase functions deploy geocode --use-api` (ohne Docker, nur nach Bestätigung).

### `send-push`

Verschickt fällige Einträge der `notification_outbox` über die Expo-Push-API (iOS und Android). Nicht für Clients.

- **Aufruf:** nur durch pg_cron (`private.invoke_push_worker()`, jede Minute, nur wenn etwas fällig ist) per `pg_net` mit dem Secret Key im `apikey`-Header. `verify_jwt = false`, die Function prüft den Key selbst mit `withSupabase({ auth: 'secret' })`.
- **Ablauf:** `claim_push_batch(100)` → Texte bauen → Expo in Paketen zu 100 → `finish_push_batch(...)`. Bis zu 5 Runden pro Aufruf.
- **Fehler:** `DeviceNotRegistered` löscht den Token. `MessageTooBig`, `InvalidCredentials`, `MismatchSenderId` sind endgültig (`failed`). Alles andere wird mit Backoff (Versuche² Minuten) wiederholt, ab 5 Versuchen `failed`.
- **Deep Links** stehen in `data.url`: `/angebot/<id>` (neues Angebot), `/code/<voucher_id>` (Erinnerung, Absage).
- **Optional:** Ist in Expo „Enhanced Security for Push“ aktiv, das Access Token als Function-Secret `EXPO_ACCESS_TOKEN` hinterlegen.
- **Einrichtung pro Projekt** (einmalig, nur nach Bestätigung):
  1. Migrationen `push_typ` und `push_versand` per `db push`.
  2. `pnpm db:push-secrets` legt die Vault-Secrets `project_url` und `push_worker_key` aus der Root-`.env` an. Ohne sie ruft der Cron-Job nichts auf.
  3. `pnpm supabase functions deploy send-push --use-api --no-verify-jwt`.
- **Stand Dev-Projekt:** Die Vault-Secrets sind seit 13.11.2026 angelegt (auch für den Stripe-Worker).

### Zahlungen: `stripe-*` (Variante B, hinter dem Flag)

Alle Stripe-Aufrufe laufen nur hier, nie in App oder Website. Antwort bei Fehlern wie bei `geocode`: `{ error: { code, message } }`. Die Codes sind die RPC-Codes (z. B. `AUSGEBUCHT`, `FRIST_ABGELAUFEN`) bzw. `STRIPE_NICHT_ERREICHBAR`, `KEIN_STRIPE_KONTO` (`FUNCTION_ERROR_MESSAGES`).

| Function                    | Wer         | Body                                                | Antwort                                                                             |
| --------------------------- | ----------- | --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `stripe-connect-onboarding` | Standort    | `{ action: 'onboarding', return_url, refresh_url }` | `{ url }`: Stripe-gehostetes Onboarding (Accounts v2, Express-Dashboard)            |
|                             |             | `{ action: 'dashboard' }`                           | `{ url }`: Login-Link zum Express-Dashboard (erst nach dem Onboarding)              |
|                             |             | `{ action: 'status' }`                              | `{ account }`: Stand bei Stripe abfragen, in `stripe_accounts` speichern            |
| `stripe-create-booking`     | Nutzer      | `{ offer_id, seats }`                               | `{ booking_id, client_secret, amount_cents, currency, reserved_until, server_now }` |
| `stripe-cancel-booking`     | Nutzer      | `{ booking_id }`                                    | `{ booking_id, status, refund_amount_cents, refund_status }`                        |
| `stripe-webhook`            | nur Stripe  | Stripe-Event (Signatur Pflicht)                     | 200 bzw. 400/500                                                                    |
| `stripe-worker`             | nur pg_cron | –                                                   | `{ done, retry, failed }`                                                           |

- **Ob bezahlt wurde**, entscheidet nur der Webhook. Die App beobachtet ihre Zeile in `paid_bookings` per Realtime.
- **`return_url`/`refresh_url`** müssen zu `PAYMENTS_RETURN_ORIGINS` gehören (Function-Secret, Standard `http://localhost:3000`).
- **Secrets** (nur als Supabase-Secrets): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (Plattform-Events), `STRIPE_CONNECT_WEBHOOK_SECRET` (Konto-Events, Thin Events). Optional `STRIPE_PAYMENT_METHOD_TYPES` (Standard `card`).
- **Cron:** `unfair-pay-worker` (jede Minute, nur wenn Jobs fällig sind) ruft `stripe-worker` auf, mit denselben Vault-Secrets wie `send-push`.
- **Deploy** (nur nach Bestätigung): `pnpm supabase functions deploy <name> --use-api`, für `stripe-webhook` und `stripe-worker` zusätzlich `--no-verify-jwt`.
- **Test gegen die Sandbox:** `pnpm pay:e2e` (echte Testzahlungen, Webhook und Worker, räumt danach auf). Das Flag wird dabei nicht eingeschaltet.

## 10. Cron und Benachrichtigungen (Outbox)

**Cron-Jobs** (pg_cron):

| Job                        | Takt   | Funktion                       | Wirkung                                                                                                                                                         |
| -------------------------- | ------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unfair-expire-vouchers`   | 5 Min. | `private.expire_vouchers()`    | aktive Codes → `abgelaufen`: Zeitraum nach dem Ende, Einzeltermin 48 Std. nach dem Ende (bis dahin sind No-Shows möglich). Keine Strafe.                        |
| `unfair-enqueue-reminders` | 5 Min. | `private.enqueue_reminders()`  | Einzeltermine: `reminder_hours_before` vor Beginn ein Eintrag `erinnerung` pro aktivem Code. Nicht für Codes, die erst innerhalb dieses Fensters geholt wurden. |
| `unfair-send-push`         | 1 Min. | `private.invoke_push_worker()` | ruft die Edge Function `send-push` auf, wenn Einträge fällig sind und die Vault-Secrets existieren                                                              |

**Neue Angebote an Favoriten:** Ein Trigger auf `offers` (nach `insert`, nur `aktiv` an einem freigegebenen Standort) legt `neues_angebot` für jeden Nutzer an, der den Standort oder die Kategorie favorisiert hat. Höchstens ein Eintrag pro Nutzer und Angebot (Unique-Index auf `recipient_user_id, offer_id` für diesen Typ). Wer beides favorisiert hat, bekommt den Grund `standort`.

### Outbox-Vertrag (für den Push-Versand der App-Session)

`notification_outbox` enthält eine Zeile pro Benachrichtigung. Eindeutig ist die Kombination aus `type` und `voucher_id`, bei `neues_angebot` (ohne Code) die Kombination aus Empfänger und Angebot.

| Spalte                                                 | Bedeutung                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                                                 | `angebot_abgesagt` (Absage oder Entfernen eines Angebots, Sperre des Standorts), `erinnerung` oder `neues_angebot` (Favorit hat ein neues Angebot)                                                                                                                                                                                                  |
| `recipient_user_id`                                    | Empfänger. Seine Geräte stehen in `push_tokens`.                                                                                                                                                                                                                                                                                                    |
| `offer_id`, `voucher_id`                               | Bezug                                                                                                                                                                                                                                                                                                                                               |
| `payload`                                              | `angebot_abgesagt`: `offer_title, offer_type, starts_at, ends_at, location_name, message` (Begründung oder null). `erinnerung`: `offer_title, starts_at, ends_at, address, location_name, short_code, seats`. `neues_angebot`: `offer_title, offer_type, starts_at, ends_at, location_name, discount_percent, reason` (`standort` oder `kategorie`) |
| `status`                                               | `pending` → `processing` → `sent` bzw. `failed`                                                                                                                                                                                                                                                                                                     |
| `attempts`, `last_error`, `next_attempt_at`, `sent_at` | für Wiederholungen                                                                                                                                                                                                                                                                                                                                  |

**Worker-RPCs** (nur `service_role`, genutzt von `send-push`):

- `claim_push_batch(p_limit = 100)` → Einträge mit den Push-Tokens des Empfängers (`tokens text[]`). Holt fällige `pending`-Einträge und hängengebliebene `processing`-Einträge mit `FOR UPDATE SKIP LOCKED`, setzt sie auf `processing`, zählt `attempts` hoch und reserviert sie 10 Minuten. Sortiert vorher aus (`failed`): ohne Gerät (`KEIN_GERAET`), Erinnerung nach Beginn oder neues Angebot älter als 24 Std. (`ZU_SPAET`), fünfmal abgeholt ohne Rückmeldung (`ABGEBROCHEN`).
- `finish_push_batch(p_sent_ids bigint[], p_failed jsonb, p_invalid_tokens text[])` → void. `p_failed` ist ein Array aus `{ id, error, permanent }`. Erfolg: `sent`, `sent_at`. Fehler: zurück auf `pending` mit Backoff, endgültig oder ab 5 Versuchen `failed`. Ungültige Tokens werden gelöscht.

## 11. Seed und Testzugänge

Seit dem 12.11.2026 im Dev-Projekt. **Alle Konten haben dasselbe Passwort: `SEED_TEST_PASSWORD` aus der `.env`.** Das Repo ist öffentlich, das Passwort steht deshalb nicht hier. Ben gibt es direkt weiter.

| E-Mail                               | Rolle                             | Besonderheit                                                                   |
| ------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------ |
| `seed-admin@example.com`             | Admin                             |                                                                                |
| `seed-mia@example.com`               | Nutzerin Mia Becker               | 2 aktive Codes, 1 eingelöst, 1 storniert, Favoriten                            |
| `seed-jonas@example.com`             | Nutzer Jonas Wagner               | 2 aktive Codes, 1 No-Show (`no_show_count = 1`)                                |
| `seed-lea@example.com`               | Nutzerin Lea Hoffmann             | 2 aktive Codes, 1 abgelaufen, 1 durch Absage storniert                         |
| `seed-kochwerk-altstadt@example.com` | Standort Kochwerk Altstadt        | Angebote mit eingelöstem Code und No-Show (Tapas-Abend)                        |
| `seed-kochwerk-hafen@example.com`    | Standort Kochwerk am Hafen        | gleiches Unternehmen wie Altstadt; Kurs „startet in 3 Std.“ (relativ zum Seed) |
| `seed-yoga-kreuzviertel@example.com` | Standort Yoga & Move Kreuzviertel |                                                                                |
| `seed-yoga-suedviertel@example.com`  | Standort Yoga & Move Südviertel   | gleiches Unternehmen                                                           |
| `seed-farbraum@example.com`          | Standort Atelier Farbraum         |                                                                                |
| `seed-kulturkeller@example.com`      | Standort Kulturkeller             | abgesagtes Angebot „Jazz im Keller“                                            |
| `seed-glow@example.com`              | Standort Glow Beauty Lounge       | „Maniküre Last Minute“ mit nur 1 freien Platz                                  |
| `seed-radlager@example.com`          | Standort Radlager Werkstatt       |                                                                                |
| `seed-morgenrot@example.com`         | Standort Bäckerei Morgenrot       | `pending` (zum Testen der Freischaltung)                                       |
| `seed-partybus@example.com`          | Standort Partybus                 | `rejected` mit Begründung                                                      |

**Umfang:**

- 8 Unternehmen und 10 Standorte an echten Adressen in Münster
- 18 Angebote (15 im Feed, alle Kategorien, beide Arten)
- 11 Codes in allen 5 Status
- etwa 250 Kennzahlen-Events

Die Zeiten sind relativ zum Einspielen, nach einigen Wochen läuft der Feed deshalb leer. Seed-Daten nicht von Hand ändern. Eigene Testdaten mit Präfix anlegen („TEST Ben …“, „TEST Arwed …“).

**Seed-IDs** beginnen mit `5eed0000-0000-4000-8000-…`, z. B. Kochwerk Altstadt `…000000000201`, Pasta-Abend `…000000000301`.

## 12. Befehle und Ablauf bei Schemaänderungen

Voraussetzung: Root-`.env` ausgefüllt, `pnpm supabase login` und `pnpm supabase link --project-ref <ref>` einmal ausgeführt. **Kein Docker.**

| Befehl                                                                    | Zweck                                                                        |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm supabase migration new <name> < /dev/null`                          | neue Migrationsdatei                                                         |
| `pnpm db:check`                                                           | offene Migrationen in einer Transaktion probeweise einspielen, dann Rollback |
| `pnpm db:test`                                                            | dazu alle SQL-Tests (324 Prüfungen) und den Sperr-Test, alles zurückgerollt  |
| `pnpm db:test -- claim`                                                   | nur bestimmte Testdateien                                                    |
| `pnpm db:test:race`                                                       | Wettrennen um den letzten Platz (temporäre Daten, danach aufgeräumt)         |
| `set -a && source .env && set +a && pnpm supabase db push --remote --yes` | Migrationen ins Dev-Projekt                                                  |
| `pnpm db:types`                                                           | Typen nach `packages/shared/src/types/database.types.ts`                     |
| `pnpm db:seed`                                                            | Seed (idempotent, nur nach Absprache)                                        |
| `pnpm supabase functions deploy <name> --use-api`                         | Edge Function deployen (nur nach Absprache)                                  |
| `pnpm supabase migration list --remote`                                   | welche Migrationen im Projekt sind                                           |

**Ablauf (feste Regel, Details in `CLAUDE.md`):**

1. Migration schreiben
2. `pnpm db:check` (und `pnpm db:test`)
3. `db push` ins Dev-Projekt
4. `pnpm db:types`
5. Commit auf `db/<kurzname>`, PR, Ben merged
6. Zwei-Satz-Info an den anderen

Bestehende Migrationen nie ändern. Umbenennen oder Löschen nur nach Absprache.

**Neue Tabelle, Checkliste:** RLS aktivieren, Grants ausdrücklich setzen (Standardrechte für `anon`/`authenticated` sind entzogen), Policies mit `(select auth.uid())`, Indizes auf Policy- und FK-Spalten, Tests in `supabase/tests/`, Abschnitt hier ergänzen.

**Neue Funktion, Checkliste:** `security definer` + `set search_path = ''`, voll qualifizierte Namen, `revoke all … from public` und gezielt `grant execute … to authenticated` (bzw. `anon`), Fehler über `private.raise_error`. Danach mit dem MCP-Tool `get_advisors` prüfen.

## 13. Umzug auf ein Live-Projekt

1. Neues Supabase-Projekt in **Frankfurt (eu-central-1)** anlegen. Das Dev-Projekt liegt in Paris.
2. Neue `.env`-Werte (URL, Keys, DB-Passwort, Pooler-URL), `pnpm supabase link --project-ref <live-ref>`.
3. Migrationen einspielen: `pnpm db:check`, dann `db push`, **nur mit Bens ausdrücklichem OK**.
4. **Keinen** Seed einspielen. Ersten Admin per SQL setzen.
5. Auth-Checkliste aus [Abschnitt 3](#auth-einstellungen-im-dashboard-checkliste) umsetzen (eigenes SMTP ist Pflicht).
6. Edge Functions `geocode` und `send-push` deployen, `pnpm db:push-secrets` mit den Live-Werten ausführen. Für mehr Last einen Geocoding-Anbieter mit Schlüssel einbauen.
7. App und Website auf die neuen Werte umstellen (eigene `.env`/Build-Profile).
8. Legacy-API-Keys (`anon`/`service_role`) deaktiviert lassen. Wir nutzen nur Publishable- und Secret-Keys.
