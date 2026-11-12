-- ============================================================================
-- Storage: Buckets für Angebotsbilder und Logos
--
-- Beide Buckets sind öffentlich lesbar (Bilder erscheinen im öffentlichen
-- Feed). Hochladen, Ersetzen und Löschen nur im eigenen Ordner:
--   offer-images/<location_id>/<datei>
--   company-logos/<company_id>/<datei>
-- Admins dürfen alles. Pfade werden in offers.image_paths bzw.
-- companies.logo_path gespeichert (ohne Bucket-Namen).
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('offer-images', 'offer-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('company-logos', 'company-logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- offer-images: Ordner = eigene location_id
-- SELECT-Policy ist nötig, damit Upsert (Ersetzen) funktioniert.
-- ----------------------------------------------------------------------------
create policy "offer-images: eigenen Ordner lesen" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'offer-images'
    and ((storage.foldername(name))[1] = (select private.my_location_id())::text or (select private.is_admin()))
  );

create policy "offer-images: in eigenen Ordner hochladen" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'offer-images'
    and ((storage.foldername(name))[1] = (select private.my_location_id())::text or (select private.is_admin()))
  );

create policy "offer-images: im eigenen Ordner ersetzen" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'offer-images'
    and ((storage.foldername(name))[1] = (select private.my_location_id())::text or (select private.is_admin()))
  )
  with check (
    bucket_id = 'offer-images'
    and ((storage.foldername(name))[1] = (select private.my_location_id())::text or (select private.is_admin()))
  );

create policy "offer-images: im eigenen Ordner löschen" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'offer-images'
    and ((storage.foldername(name))[1] = (select private.my_location_id())::text or (select private.is_admin()))
  );

-- ----------------------------------------------------------------------------
-- company-logos: Ordner = eigene company_id
-- ----------------------------------------------------------------------------
create policy "company-logos: eigenen Ordner lesen" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'company-logos'
    and ((storage.foldername(name))[1] = (select private.my_company_id())::text or (select private.is_admin()))
  );

create policy "company-logos: in eigenen Ordner hochladen" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'company-logos'
    and ((storage.foldername(name))[1] = (select private.my_company_id())::text or (select private.is_admin()))
  );

create policy "company-logos: im eigenen Ordner ersetzen" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'company-logos'
    and ((storage.foldername(name))[1] = (select private.my_company_id())::text or (select private.is_admin()))
  )
  with check (
    bucket_id = 'company-logos'
    and ((storage.foldername(name))[1] = (select private.my_company_id())::text or (select private.is_admin()))
  );

create policy "company-logos: im eigenen Ordner löschen" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'company-logos'
    and ((storage.foldername(name))[1] = (select private.my_company_id())::text or (select private.is_admin()))
  );
