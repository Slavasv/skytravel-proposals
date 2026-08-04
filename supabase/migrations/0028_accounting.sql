-- 0028_accounting.sql
-- Кабинет бухгалтера: инвойсы поставщиков + приход-расход (платежи).
-- Привязка к брони ОБЯЗАТЕЛЬНА. Валюты не смешиваем — у инвойса и платежа своя валюта,
-- независимая от валюты брони. Новая роль accountant.

-- ============ 1) Роль бухгалтера ============
alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role = any (array['superadmin','owner','admin','manager','accountant']));

-- хелпер: текущий пользователь — бухгалтер
create or replace function public.is_accountant() returns boolean
  language sql stable security definer
  set search_path to 'public'
  as $$
    select exists (
      select 1 from profiles
      where id = auth.uid() and role = 'accountant'
    );
  $$;

-- ============ 2) Инвойсы поставщиков ============
-- Счета, которые нам выставили отели/партнёры. Заводит менеджер по своей брони.
-- Статус (не оплачен/частично/оплачен) НЕ храним — считаем из платежей.
create table public.supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,  -- привязка обязательна
  partner_id uuid references public.partners(id) on delete set null,           -- поставщик
  invoice_number text,
  amount numeric not null,
  currency text not null default 'EUR',                                         -- своя валюта инвойса
  issue_date date,
  due_date date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index supplier_invoices_company_idx on public.supplier_invoices (company_id);
create index supplier_invoices_booking_idx on public.supplier_invoices (booking_id);
create index supplier_invoices_partner_idx on public.supplier_invoices (partner_id);

-- ============ 3) Приход-расход (платежи) ============
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,  -- привязка обязательна
  direction text not null,   -- 'in' приход | 'out' расход
  category text not null,    -- client_payment | hotel_commission | supplier_payment | other
  invoice_id uuid references public.supplier_invoices(id) on delete set null, -- расход по конкретному инвойсу
  client_id uuid references public.clients(id) on delete set null,             -- приход от клиента
  partner_id uuid references public.partners(id) on delete set null,           -- поставщик/отель
  amount numeric not null,
  currency text not null default 'EUR',                                         -- своя валюта платежа
  paid_on date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_direction_check check (direction in ('in','out')),
  constraint transactions_category_check
    check (category in ('client_payment','hotel_commission','supplier_payment','other'))
);
create index transactions_company_idx on public.transactions (company_id);
create index transactions_booking_idx on public.transactions (booking_id);
create index transactions_invoice_idx on public.transactions (invoice_id);

-- ============ 4) RLS ============
alter table public.supplier_invoices enable row level security;
alter table public.transactions enable row level security;

-- Инвойсы: заводит/правит менеджер по СВОЕЙ брони (или admin); видят также бухгалтер и owner/admin.
create policy supplier_invoices_select on public.supplier_invoices
  for select using (
    company_id = my_company_id()
    and (
      is_admin() or is_accountant()
      or exists (select 1 from bookings b where b.id = booking_id and b.owner_id = auth.uid())
    )
  );
create policy supplier_invoices_insert on public.supplier_invoices
  for insert with check (
    company_id = my_company_id()
    and (
      is_admin()
      or exists (select 1 from bookings b where b.id = booking_id and b.owner_id = auth.uid())
    )
  );
create policy supplier_invoices_update on public.supplier_invoices
  for update using (
    company_id = my_company_id()
    and (
      is_admin()
      or exists (select 1 from bookings b where b.id = booking_id and b.owner_id = auth.uid())
    )
  );
create policy supplier_invoices_delete on public.supplier_invoices
  for delete using (
    company_id = my_company_id()
    and (
      is_admin()
      or exists (select 1 from bookings b where b.id = booking_id and b.owner_id = auth.uid())
    )
  );

-- Приход-расход: ведут бухгалтер и owner/admin (в пределах своего бренда).
create policy transactions_all on public.transactions
  for all
  using (company_id = my_company_id() and (is_admin() or is_accountant()))
  with check (company_id = my_company_id() and (is_admin() or is_accountant()));