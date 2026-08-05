-- 0036_payment_accounts.sql
-- Справочник счетов (касса/карта/банковский счёт) + привязка платежа к счёту.
-- У каждого счёта своя валюта. Платёж может ссылаться на счёт (account_id).

create table public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  currency text not null default 'EUR',
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index payment_accounts_company_idx on public.payment_accounts (company_id);

alter table public.transactions
  add column if not exists account_id uuid references public.payment_accounts(id) on delete set null;
create index if not exists transactions_account_idx on public.transactions (account_id);

alter table public.payment_accounts enable row level security;

create policy payment_accounts_all on public.payment_accounts
  for all
  using (company_id = my_company_id() and (is_admin() or is_accountant()))
  with check (company_id = my_company_id() and (is_admin() or is_accountant()));