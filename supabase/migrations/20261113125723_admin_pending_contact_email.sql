-- Liefert die Login-E-Mail nur für offene Anträge an Admins.
-- Die Adresse bleibt ansonsten ausschließlich in auth.users.
create function public.get_pending_location_contacts()
returns table (location_id uuid, contact_email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();

  return query
  select l.id, u.email::text
  from public.locations l
  join auth.users u on u.id = l.account_user_id
  where l.status = 'pending';
end;
$$;

comment on function public.get_pending_location_contacts is
  'Admin: Login-E-Mail-Adressen der offenen Standortanträge für die Kontaktaufnahme.';

revoke all on function public.get_pending_location_contacts() from public;
grant execute on function public.get_pending_location_contacts() to authenticated;
