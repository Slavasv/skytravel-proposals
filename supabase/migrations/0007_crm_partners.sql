-- ============================================================
-- 0007: CRM — Partners / Hotels (справочник)
-- Дата: июль 2026
-- Зачем: единый справочник поставщиков и отелей. Структура снята
--        с SharePoint Насти (Partners Hotels List).
--        Один список, тип услуги (service_type) различает записи:
--        Accomodation (отели), DMC, OTS, Transfer company,
--        Private Guide, Villa Rent Company.
--        Нужен для БРОНИРОВАНИЙ — при добавлении услуги в бронь
--        партнёр/отель выбирается отсюда.
--        Справочник ОБЩИЙ для компании (не мой/чужой): все сотрудники
--        видят все записи своей компании. Бренды изолированы.
-- Статус: накачено на STAGING. На PROD — НЕТ.
-- ============================================================

create table public.partners (
  id uuid primary key default gen_random_uuid(),

  name text not null default '',
  service_type text,              -- Accomodation | DMC | OTS | Transfer company | Private Guide | Villa Rent Company
  destination text,               -- страна/направление (может быть пусто у DMC)
  operator_group text,            -- Hotel Group / Operator: IHG, Six Senses, Mandarin Oriental...
  useful_links text,
  comments text,

  company_id uuid references public.companies(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index partners_company_idx on public.partners (company_id);
create index partners_name_idx on public.partners (lower(name));
create index partners_type_idx on public.partners (service_type);


-- ---------- RLS: справочник общий для компании ----------
-- Любой сотрудник видит все записи своей компании (нужны всем для
-- бронирований), но бренды изолированы через my_company_id().

alter table public.partners enable row level security;

create policy partners_select on public.partners
  for select to public
  using (company_id = my_company_id());

create policy partners_insert on public.partners
  for insert to public
  with check (company_id = my_company_id());

create policy partners_update on public.partners
  for update to public
  using (company_id = my_company_id());

create policy partners_delete on public.partners
  for delete to public
  using (company_id = my_company_id());