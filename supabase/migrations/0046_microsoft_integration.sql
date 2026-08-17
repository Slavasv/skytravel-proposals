-- 0046_microsoft_integration.sql
-- Подключение Microsoft (Graph) на уровне компании: храним refresh-токен
-- интеграционного аккаунта, его email/имя, tenant и (позже) id плана Planner.
-- Доступ ТОЛЬКО через service-role (серверный код) — RLS включена без политик,
-- чтобы refresh-токен никогда не утекал в клиент.

create table public.microsoft_integration (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  account_email text,
  account_name text,
  refresh_token text,
  tenant_id text,
  plan_id text,               -- план Planner для синхронизации (заполним позже)
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.microsoft_integration enable row level security;
-- политик нет специально: строку читает/пишет только сервер через service-role.