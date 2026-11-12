-- ============================================================================
-- Fundament: Extensions, Schemas, Standardrechte, Enums
-- ============================================================================

-- pg_cron für zeitgesteuerte Aufgaben (Codes ablaufen lassen, Erinnerungen).
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- pgcrypto (gen_random_bytes) ist in Supabase-Projekten bereits im Schema
-- "extensions" installiert. Zur Sicherheit:
create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------
-- Schema "private": Helfer, die nicht über die Data API erreichbar sind.
-- RLS-Policies rufen einige dieser Helfer auf, deshalb USAGE für die
-- API-Rollen. EXECUTE wird pro Funktion einzeln vergeben.
-- ----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Sicher per Standard: Neue Tabellen, Sequenzen und Funktionen, die "postgres"
-- (also unsere Migrationen) anlegt, sind für anon/authenticated NICHT
-- automatisch freigegeben. Jede Migration vergibt Rechte ausdrücklich.
-- service_role behält ihre Standardrechte (Skripte, Edge Functions).
-- ----------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
-- EXECUTE für PUBLIC ist ein globaler Standard und lässt sich nur global entziehen.
alter default privileges for role postgres
  revoke execute on functions from public;

-- ----------------------------------------------------------------------------
-- Enums. Neue Werte nur anhängen (alter type … add value), nie umbenennen.
-- Gleiche Werte stehen als Konstanten in packages/shared.
-- ----------------------------------------------------------------------------

-- Rolle eines Kontos
create type public.app_role as enum ('nutzer', 'standort', 'admin');

-- Freischaltung eines Standorts
create type public.location_status as enum ('pending', 'approved', 'rejected');

-- Angebotsart
create type public.offer_type as enum ('einzeltermin', 'zeitraum');

-- Lebenszyklus eines Angebots ("beendet" ergibt sich aus der Zeit, kein Status)
create type public.offer_status as enum ('aktiv', 'abgesagt', 'entfernt');

-- Feste Kategorien (deutsche Labels in packages/shared)
create type public.offer_category as enum (
  'kochen_essen',
  'sport_bewegung',
  'kreativ_workshops',
  'wellness_beauty',
  'kultur_events',
  'sonstiges'
);

-- Status eines Gutscheincodes
create type public.voucher_status as enum ('aktiv', 'storniert', 'eingeloest', 'no_show', 'abgelaufen');

-- Warum ein Code storniert wurde
create type public.voucher_cancel_reason as enum (
  'nutzer',
  'angebot_abgesagt',
  'angebot_entfernt',
  'konto_geloescht'
);

-- Benachrichtigungen in der Outbox
create type public.notification_type as enum ('angebot_abgesagt', 'erinnerung');
create type public.notification_status as enum ('pending', 'processing', 'sent', 'failed');

-- Kennzahlen-Events
create type public.event_type as enum (
  'angebot_angesehen',
  'code_geholt',
  'code_storniert',
  'code_eingeloest',
  'no_show'
);

-- Plattform eines Push-Tokens
create type public.push_platform as enum ('ios', 'android', 'web');
