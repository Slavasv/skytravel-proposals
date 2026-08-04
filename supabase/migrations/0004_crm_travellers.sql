-- ============================================================
-- 0004: CRM — Travellers
-- Дата: июль 2026
-- Зачем: путешественник ≠ клиент. Клиент платит, travellers едут.
--        Структура снята с SharePoint Насти (Lists/Traveller Profiles).
--        Соответствует guests в ваучере — будут подтягиваться автоматически.
-- Статус: накачено на PROD + STAGING
-- ============================================================

create table public.travellers (
  id uuid primary key default gen_random_uuid(),

  -- Привязка к клиенту (кто платит)
  client_id uuid not null references public.clients(id) on delete cascade,

  -- Кто едет
  name text not null default '',
  title text,                        -- Mr / Mrs / Miss / Mstr / Chd / Inf
  relation text,                     -- Primary Client / Spouse / Child / Travel Companion
  traveller_code text,               -- TRVLR-001 (авто, можно вручную)

  date_of_birth text,                -- ДД/ММ/ГГГГ (текстом, как везде в проекте)
  nationality text,

  special_requirements text,
  travel_preferences text,
  notes text,

  sort_order int not null default 0,

  -- Наследуется от клиента (для RLS и удобства)
  company_id uuid references public.companies(id) on delete cascade,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index travellers_client_idx on public.travellers (client_id);
create index travellers_company_idx on public.travellers (company_id);


-- ---------- Автонумерация TRVLR-001, TRVLR-002... ----------

create or replace function public.next_traveller_code(p_company_id uuid)
returns text
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  max_num int;
begin
  select coalesce(max(
    nullif(regexp_replace(traveller_code, '^TRVLR-', ''), '')::int
  ), 0)
  into max_num
  from travellers
  where company_id = p_company_id
    and traveller_code ~ '^TRVLR-\d+$';

  return 'TRVLR-' || lpad((max_num + 1)::text, 3, '0');
end;
$$;


-- ---------- RLS: доступ наследуется от клиента ----------
-- Видишь клиента → видишь его travellers.

alter table public.travellers enable row level security;

create policy travellers_select on public.travellers
  for select to public
  using (
    exists (
      select 1 from clients c
      where c.id = travellers.client_id
        and (c.owner_id = auth.uid() or (is_admin() and c.company_id = my_company_id()))
    )
  );

create policy travellers_insert on public.travellers
  for insert to public
  with check (
    exists (
      select 1 from clients c
      where c.id = travellers.client_id
        and c.company_id = my_company_id()
    )
  );

create policy travellers_update on public.travellers
  for update to public
  using (
    exists (
      select 1 from clients c
      where c.id = travellers.client_id
        and (c.owner_id = auth.uid() or (is_admin() and c.company_id = my_company_id()))
    )
  );

create policy travellers_delete on public.travellers
  for delete to public
  using (
    exists (
      select 1 from clients c
      where c.id = travellers.client_id
        and (c.owner_id = auth.uid() or (is_admin() and c.company_id = my_company_id()))
    )
  );