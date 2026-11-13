-- ============================================================================
-- Lieblingsangebote: Nutzer merken sich Angebote mit einem Herz.
--
-- Wie favorite_locations: Die App liest, legt an und löscht nur eigene Zeilen
-- direkt (RLS). Die Angebotsdaten selbst kommen weiter über list_offers/get_offer,
-- vergangene oder entfernte Angebote zeigt die App einfach nicht mehr an.
-- Kontolöschung löscht die Zeilen mit (Kaskade über profiles).
-- ============================================================================

create table public.favorite_offers (
  user_id uuid not null references public.profiles (id) on delete cascade,
  offer_id uuid not null references public.offers (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, offer_id)
);
comment on table public.favorite_offers is
  'Gemerkte Angebote (Herz). Nutzer lesen, anlegen und löschen nur eigene Zeilen.';

-- FK-Index (user_id ist über den Primärschlüssel abgedeckt)
create index favorite_offers_offer_id_idx on public.favorite_offers (offer_id);

alter table public.favorite_offers enable row level security;

revoke all on table public.favorite_offers from anon, authenticated;
grant select, insert, delete on table public.favorite_offers to authenticated;

create policy "favorite_offers: eigene lesen" on public.favorite_offers
  for select to authenticated using (user_id = (select auth.uid()));
create policy "favorite_offers: eigene anlegen" on public.favorite_offers
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "favorite_offers: eigene löschen" on public.favorite_offers
  for delete to authenticated using (user_id = (select auth.uid()));
