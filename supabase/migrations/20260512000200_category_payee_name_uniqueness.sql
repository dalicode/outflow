alter table public.categories
  drop constraint if exists categories_user_id_name_key;

alter table public.categories
  add constraint categories_user_id_name_key unique (user_id, name);

alter table public.payees
  drop constraint if exists payees_user_id_name_key;

alter table public.payees
  add constraint payees_user_id_name_key unique (user_id, name);
