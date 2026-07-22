-- ============================================================
-- 0008: CRM — Requests (запросы / воронка)
-- Дата: июль 2026
-- Зачем: заявки клиентов со статусами (воронка продаж).
--        Связь: клиент → запрос → (при Confirmed) → бронирование.
--        Менеджер = owner_id. closed_at ставится при Confirmed/Cancelled,
--        отсюда считается время закрытия сделки.
-- Статус: накачено на STAGING. и на PROD
-- ============================================================

sql
create table public.requests (
  id uuid primary key default gen_random_uuid(),

  request_code text,                       -- REQ-001 (авто, можно вручную)

  -- Связи
  client_id uuid references public.clients(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,   -- менеджер (кто ведёт)

  -- Содержание
  destination text,                        -- направление
  details text,                            -- "что хочет" — свободный текст

  -- Воронка
  status text not null default 'new',      -- см. значения ниже
  priority text,                           -- Low / Medium / High (опц.)

  -- Даты
  closed_at timestamptz,                   -- когда статус стал Confirmed/Cancelled

  company_id uuid references public.companies(id) on delete cascade,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index requests_company_idx on public.requests (company_id);
create index requests_owner_idx on public.requests (owner_id);
create index requests_client_idx on public.requests (client_id);
create index requests_status_idx on public.requests (status);



create or replace function public.next_request_code(p_company_id uuid)
returns text
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  max_num int;
begin
  select coalesce(max(
    nullif(regexp_replace(request_code, '^REQ-', ''), '')::int
  ), 0)
  into max_num
  from requests
  where company_id = p_company_id
    and request_code ~ '^REQ-\d+$';

  return 'REQ-' || lpad((max_num + 1)::text, 3, '0');
end;
$$;




alter table public.requests enable row level security;

create policy requests_select on public.requests
  for select to public
  using (
    owner_id = auth.uid()
    or (is_admin() and company_id = my_company_id())
  );

create policy requests_insert on public.requests
  for insert to public
  with check (company_id = my_company_id());

create policy requests_update on public.requests
  for update to public
  using (
    owner_id = auth.uid()
    or (is_admin() and company_id = my_company_id())
  );

create policy requests_delete on public.requests
  for delete to public
  using (
    owner_id = auth.uid()
    or (is_admin() and company_id = my_company_id())
  );