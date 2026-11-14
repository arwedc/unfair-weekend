-- Aus supabase_migrations.schema_migrations des Dev-Projekts übernommen:
-- Die Migration war eingespielt, die Datei fehlte aber im Repo.

-- Aktive Angebote erhalten ein eigenes, thematisch passendes Titelbild,
-- falls sie bisher nur das gemeinsame Standortbild verwendet haben.
create function pg_temp.unsplash_image(p_photo_id text)
returns text
language sql
immutable
as $$
  select format('https://images.unsplash.com/%s?auto=format&fit=crop&w=1200&q=85', p_photo_id);
$$;

with offer_images (id, photo_id) as (values
  ('01767c1c-263a-4873-92af-aef3f9ee0643'::uuid, 'photo-1556911261-6bd341186b2f'),
  ('05cf9731-8f65-4a11-bcf7-2765682a3441'::uuid, 'photo-1579783902614-a3fb3927b6a5'),
  ('0779537f-aaef-4f75-a05a-3a039c82cb63'::uuid, 'photo-1777315168408-4e366dda1515'),
  ('0de968a5-be2e-495e-a48c-9e472b045ad4'::uuid, 'photo-1513364776144-60967b0f800f'),
  ('32b8fc25-5b23-443e-8f2a-5de1d7bba7fe'::uuid, 'photo-1565193566173-7a0ee3dbe261'),
  ('3f52671a-9200-41ad-bfdc-4a96285adcb9'::uuid, 'photo-1507035895480-2b3156c31fc8'),
  ('42ebfd18-32c1-4811-bab4-dc69a099addd'::uuid, 'photo-1556911220-bff31c812dba'),
  ('46c3610f-3c5e-4c90-b022-f0f80d92e424'::uuid, 'photo-1570172619644-dfd03ed5d881'),
  ('47aed2d5-9762-40a0-b468-3c8b4e69752b'::uuid, 'photo-1578749556568-bc2c40e68b61'),
  ('4f54d762-bf4f-4f19-8d74-0efc08cea5ed'::uuid, 'photo-1522163182402-834f871fd851'),
  ('545b5d9e-c591-4084-b99e-b63fa7c2d02d'::uuid, 'photo-1510812431401-41d2bd2722f3'),
  ('5947c247-414c-4c18-9b27-e9b6ed57b0e5'::uuid, 'photo-1506126613408-eca07ce68773'),
  ('6e56c788-0fec-4b9c-8bb6-c5bf307efa4f'::uuid, 'photo-1777315168408-4e366dda1515'),
  ('7031a13e-14fb-46bc-a409-ff40b47c9fe2'::uuid, 'photo-1518611012118-696072aa579a'),
  ('7470ca3d-c271-4f32-a52b-c7dafef7013a'::uuid, 'photo-1510812431401-41d2bd2722f3'),
  ('7c973d98-0c5e-4d71-9175-37543e43bd73'::uuid, 'photo-1570172619644-dfd03ed5d881'),
  ('85d622a9-9950-4a78-90c1-b61b5ad720d9'::uuid, 'photo-1753098498106-0319c1d646ca'),
  ('984b178a-63c5-483e-af78-b91d9cca6975'::uuid, 'photo-1485965120184-e220f721d03e'),
  ('9e47068f-9056-44bb-89db-e77cdd10f072'::uuid, 'photo-1517649763962-0c623066013b'),
  ('a4e5b2a7-e8cf-45fa-ba71-239cabacb86a'::uuid, 'photo-1544161515-4ab6ce6db874'),
  ('b4a415dc-fa8e-42f8-a75b-a5948084b460'::uuid, 'photo-1578749556568-bc2c40e68b61'),
  ('b8dd547b-0281-4401-8f5f-962cb4c6343f'::uuid, 'photo-1556911261-6bd341186b2f'),
  ('bf57791d-9538-4a62-963a-3f7fae50431f'::uuid, 'photo-1451187580459-43490279c0fa'),
  ('c58d7ea8-4f7e-49ce-b98e-7939011b3c0c'::uuid, 'photo-1506126613408-eca07ce68773'),
  ('c7aad1db-1acf-40ff-8df9-74b853e96988'::uuid, 'photo-1507035895480-2b3156c31fc8'),
  ('c7e7af0e-ef90-4b17-91c0-473267e58f49'::uuid, 'photo-1522163182402-834f871fd851'),
  ('cc53c7a0-0e9c-4882-84fb-ea7d8a92cfed'::uuid, 'photo-1579783902614-a3fb3927b6a5'),
  ('d50b7401-c807-4632-aa99-cfb2bf6bbe0f'::uuid, 'photo-1547592180-85f173990554'),
  ('d717b21d-e0c7-4486-9aaf-613069c7a8bb'::uuid, 'photo-1565193566173-7a0ee3dbe261'),
  ('d737d7f6-13fe-4f21-b287-1e28f8cad68e'::uuid, 'photo-1513364776144-60967b0f800f'),
  ('db71401e-a627-43a9-8a3c-e3c1b585a25b'::uuid, 'photo-1544161515-4ab6ce6db874'),
  ('dc97edec-460d-4887-8a10-2ea665d95804'::uuid, 'photo-1506126613408-eca07ce68773'),
  ('df4e0656-d44d-4da6-be8a-c064932cb993'::uuid, 'photo-1542751371-adc38448a05e'),
  ('e2d19371-b9ca-4a81-9df0-be84f8347089'::uuid, 'photo-1503095396549-807759245b35'),
  ('e6554eda-86da-4470-85d0-b7af0c927b10'::uuid, 'photo-1511512578047-dfb367046420'),
  ('f038478c-7fde-4135-85f2-6a9ca9230050'::uuid, 'photo-1653233797467-1a528819fd4f'),
  ('fc2b79f5-1652-4b25-a59b-f013bf87bac7'::uuid, 'photo-1578749556568-bc2c40e68b61'),
  ('fe0a8c70-fa8e-4bcb-9792-845f32a73a8e'::uuid, 'photo-1518611012118-696072aa579a')
)
update public.offers as o
set image_paths = array[pg_temp.unsplash_image(offer_images.photo_id)]
from offer_images
where o.id = offer_images.id
  and o.status = 'aktiv'
  and cardinality(coalesce(o.image_paths, array[]::text[])) = 0;
