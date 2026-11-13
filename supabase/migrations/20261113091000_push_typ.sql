-- ============================================================================
-- Push, Teil 1: neuer Benachrichtigungstyp und pg_net
--
-- Eigene Datei, weil ein neuer Enum-Wert erst nach dem Commit benutzt werden
-- darf. Teil 2 verwendet 'neues_angebot' nur in PL/pgSQL-Rümpfen (zur Laufzeit).
-- ============================================================================

-- Neues Angebot eines Lieblingsorts oder in einer Lieblingskategorie
alter type public.notification_type add value if not exists 'neues_angebot';

-- HTTP-Aufrufe aus der Datenbank (pg_cron ruft damit die Edge Function send-push auf)
create extension if not exists pg_net with schema extensions;
