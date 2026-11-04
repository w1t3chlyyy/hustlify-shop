-- Выполнить в Supabase → SQL Editor (дополняет таблицы из README: products, news, projects, partners, requisites)
create table if not exists public.orders (
  id text primary key,
  items jsonb not null default '[]',
  contact text default '',
  items_total numeric default 0,
  total numeric not null default 0,
  promo_code text,
  discount_percent numeric default 0,
  status text not null default 'pending',
  payment jsonb,
  paid_at timestamptz,
  updated_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.promocodes (
  code text primary key,
  discount int not null,
  type text not null default 'single',
  max_uses int,
  expires_at timestamptz,
  used_count int not null default 0,
  used boolean not null default false,
  active boolean not null default true,
  note text default '',
  order_id text,
  created_at timestamptz not null default now()
);
create table if not exists public.settings (
  id int primary key default 1,
  roulette_hidden boolean not null default false,
  updated_at timestamptz default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- Закрываем таблицы от публичного (anon) ключа. Сервер ходит через service_role и RLS обходит.
alter table public.orders enable row level security;
alter table public.promocodes enable row level security;
alter table public.settings enable row level security;
alter table public.products enable row level security;
alter table public.news enable row level security;
alter table public.projects enable row level security;
alter table public.partners enable row level security;
alter table public.requisites enable row level security;
