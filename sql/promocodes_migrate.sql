-- ============================================================
-- МИГРАЦИЯ: если таблица promocodes УЖЕ существует, но в ней нет
-- колонки "active" (ошибка: 42703: column "active" does not exist)
--
-- Supabase Dashboard → SQL Editor → вставить → Run
-- Скрипт идемпотентен: добавляет только недостающие колонки.
-- ============================================================

do $$
begin
  if to_regclass('public.promocodes') is null then
    -- таблицы вообще нет — создаём с нуля
    create table public.promocodes (
      code         text primary key,
      discount     integer not null default 0,
      type         text not null default 'single' check (type in ('single','multi')),
      max_uses     integer,
      used_count   integer not null default 0,
      used         boolean not null default false,
      active       boolean not null default true,
      expires_at   timestamptz,
      created_at   timestamptz not null default now(),
      order_id     text,
      note         text
    );
  else
    -- таблица есть — добавляем недостающие колонки
    alter table public.promocodes add column if not exists discount   integer not null default 0;
    alter table public.promocodes add column if not exists type       text;
    alter table public.promocodes add column if not exists max_uses   integer;
    alter table public.promocodes add column if not exists used_count integer not null default 0;
    alter table public.promocodes add column if not exists used       boolean not null default false;
    alter table public.promocodes add column if not exists active     boolean not null default true;
    alter table public.promocodes add column if not exists expires_at timestamptz;
    alter table public.promocodes add column if not exists created_at timestamptz not null default now();
    alter table public.promocodes add column if not exists order_id   text;
    alter table public.promocodes add column if not exists note       text;
  end if;
end $$;

-- Приводим старые строки к корректным значениям
update public.promocodes set type = 'single' where type is null;
update public.promocodes set active = true where active is null;
update public.promocodes set used_count = 0 where used_count is null;

-- Индексы
create index if not exists promocodes_active_idx     on public.promocodes (active);
create index if not exists promocodes_expires_at_idx on public.promocodes (expires_at);

-- Безопасность: таблицу видит только backend (service_role)
alter table public.promocodes enable row level security;

drop policy if exists "promocodes_service_only" on public.promocodes;
create policy "promocodes_service_only"
  on public.promocodes
  for all
  to service_role
  using (true)
  with check (true);

-- Проверка: должно показать все колонки, включая active
-- select column_name, data_type from information_schema.columns
--   where table_name = 'promocodes' order by ordinal_position;
