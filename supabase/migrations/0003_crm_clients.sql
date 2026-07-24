-- ============================================================
-- 0003: CRM — Clients
-- Дата: июль 2026
-- Зачем: первый этап CRM. Клиент = тот, кто заказывает и платит.
--        Структура снята с реального SharePoint Насти (Lists/Clients).
-- Статус: накачено на PROD + STAGING
-- ============================================================

create table public.clients (
  id uuid primary key default gen_random_uuid(),

  -- Кто
  name text not null,
  client_code text,                                  -- CL-001; авто, но можно переписать вручную
  client_type text not null default 'individual',    -- family | individual | company
  client_status text not null default 'new',         -- new | regular
  lead_source text,                                  -- personal_encounter | referral | ...

  -- Гео (массив — у клиента может быть несколько стран)
  countries text[] default '{}',

  -- Контакты
  phone text,
  email text,

  -- Финансы (пока вручную; автоматику подключим позже)
  balance_usd numeric default 0,
  balance_eur numeric default 0,

  -- Прочее
  notes text,

  -- Принадлежность (изоляция + владелец)
  company_id uuid references public.companies(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Индексы для списка и поиска
create index clients_company_idx on public.clients (company_id);
create index clients_owner_idx on public.clients (owner_id);
create index clients_name_idx on public.clients (lower(name));

-- Код клиента уникален в пределах компании (у Sky Travel и TIGU своя нумерация)
create unique index clients_code_per_company_idx
  on public.clients (company_id, client_code)
  where client_code is not null;


-- ---------- Автонумерация CL-001, CL-002... ----------
-- Считает максимум внутри компании и прибавляет 1.
-- Ручной ввод кода при этом не ломается.

create or replace function public.next_client_code(p_company_id uuid)
returns text
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  max_num int;
begin
  select coalesce(max(
    nullif(regexp_replace(client_code, '^CL-', ''), '')::int
  ), 0)
  into max_num
  from clients
  where company_id = p_company_id
    and client_code ~ '^CL-\d+$';

  return 'CL-' || lpad((max_num + 1)::text, 3, '0');
end;
$$;


-- ---------- RLS: изоляция по компании ----------
-- Менеджер видит своих; admin/owner — всех в своей компании.
-- Логика идентична политикам proposals.

alter table public.clients enable row level security;

create policy clients_select on public.clients
  for select to public
  using (
    owner_id = auth.uid()
    or (is_admin() and company_id = my_company_id())
  );

create policy clients_insert on public.clients
  for insert to public
  with check (company_id = my_company_id());

create policy clients_update on public.clients
  for update to public
  using (
    owner_id = auth.uid()
    or (is_admin() and company_id = my_company_id())
  );

create policy clients_delete on public.clients
  for delete to public
  using (
    owner_id = auth.uid()
    or (is_admin() and company_id = my_company_id())
  );