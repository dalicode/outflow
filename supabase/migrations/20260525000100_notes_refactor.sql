do $$
begin
  if to_regclass('public.expenses') is not null then
    alter table public.expenses add column if not exists notes text;
    update public.expenses
    set notes = coalesce(notes, description, '')
    where notes is null;
    alter table public.expenses drop column if exists description;
  end if;

  if to_regclass('public.expense_splits') is not null then
    alter table public.expense_splits add column if not exists notes text;
    update public.expense_splits
    set notes = case
      when nullif(btrim(coalesce(notes, '')), '') is not null then notes
      when nullif(btrim(coalesce(description, '')), '') is not null
           and nullif(btrim(coalesce(note, '')), '') is not null then description
      else coalesce(description, note, '')
    end;
    alter table public.expense_splits drop column if exists description;
    alter table public.expense_splits drop column if exists note;
  end if;

  if to_regclass('public.schedules') is not null then
    alter table public.schedules add column if not exists notes text;
    update public.schedules
    set notes = coalesce(notes, note, '')
    where notes is null;
    alter table public.schedules drop column if exists note;
  end if;
end
$$;
