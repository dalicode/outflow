-- Enforce one canonical category/payee name per user in cloud storage.
-- Existing duplicate rows must be cleaned up before this migration can apply.

alter table public.categories
  add constraint categories_user_id_name_key unique (user_id, name);

alter table public.payees
  add constraint payees_user_id_name_key unique (user_id, name);
