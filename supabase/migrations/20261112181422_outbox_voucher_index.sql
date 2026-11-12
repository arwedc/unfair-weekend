-- Index für den Fremdschlüssel notification_outbox.voucher_id
-- (Advisor „unindexed_foreign_keys“: der Unique-Index (type, voucher_id) deckt ihn nicht ab).
create index if not exists notification_outbox_voucher_id_idx on public.notification_outbox (voucher_id);
