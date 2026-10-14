-- ============================================================
-- Таблица промокодов для Supabase (PostgreSQL)
-- Используется админ-панелью: одноразовые, многоразовые и промокоды
-- со сроком действия.
--
-- Как применить:
--   Supabase Dashboard → SQL Editor → вставить этот скрипт → Run
--   (или: psql "$DATABASE_URL" -f promocodes.sql)
--
-- Работает вместе с index.js: если заданы SUPABASE_URL и
-- SUPABASE_SERVICE_ROLE_KEY — данные пишутся сюда, иначе — в
-- data/promocodes.json.
-- ============================================================

-- ВНИМАНИЕ: если таблица promocodes уже существует в другом виде
-- (например, без колонки "active"), этот скрипт её НЕ изменит —
-- используйте sql/promocodes_migrate.sql

create table if not exists public.promocodes (
  code         text primary key,                 -- сам промокод, напр. "NEWYEAR10"
  discount     integer not null default 0,       -- скидка в процентах (1..100)
  type         text not null default 'single'    -- 'single' = одноразовый,
                 check (type in ('single','multi')),           -- 'multi'  = многоразовый
  max_uses     integer,                          -- лимит активаций для multi (NULL = безлимит)
  used_count   integer not null default 0,       -- сколько раз уже использован
  used         boolean not null default false,   -- флаг "погашен" (одноразовые / исчерпанный лимит)
  active       boolean not null default true,    -- включён/выключен в админке
  expires_at   timestamptz,                      -- срок действия (NULL = бессрочный)
  created_at   timestamptz not null default now(),
  order_id     text,                             -- заказ, в котором применён
  note         text                              -- комментарий администратора
);

-- Индексы для быстрых проверок при оформлении заказа
create index if not exists promocodes_active_idx      on public.promocodes (active);
create index if not exists promocodes_expires_at_idx  on public.promocodes (expires_at);

-- Безопасность: таблицу видит только backend (service_role).
alter table public.promocodes enable row level security;

drop policy if exists "promocodes_service_only" on public.promocodes;
create policy "promocodes_service_only"
  on public.promocodes
  for all
  to service_role
  using (true)
  with check (true);

-- (Опционально) тестовые промокоды — можно раскомментировать:
-- insert into public.promocodes (code, discount, type, max_uses, expires_at, note) values
--   ('TESTSINGLE', 10, 'single', 1,  now() + interval '30 days', 'одноразовый на 30 дней'),
--   ('TESTMULTI',  15, 'multi',  5,  now() + interval '7 days',  '5 активаций на неделю'),
--   ('FOREVER20',  20, 'multi',  0,  null,                       'бессрочный безлимит');
