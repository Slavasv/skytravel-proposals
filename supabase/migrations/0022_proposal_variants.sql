-- ============================================================
-- 0022: Варианты маршрута
-- Дата: июль 2026
-- Зачем: одно предложение может содержать несколько полных
--        сценариев маршрута («Классический» / «Арт & Вино» /
--        «Эксклюзивный»). Клиент выбирает один.
--
--   Новый уровень: proposals → proposal_variants → days.
--   ОБЩЕЕ у предложения: клиент, гости, даты, страна, обложка,
--     интро, валюта.
--   СВОЁ у варианта: название, подзаголовок, дни, стоимость,
--     итог, условия (оплата/отмена/включено/не включено),
--     галерея «Впечатления», авиаперелёт (позже).
--
--   Переезд существующих: каждому предложению создан один
--   вариант «Маршрут 1», cost/terms поля перенесены в него,
--   дни перепривязаны к варианту (days.variant_id).
--   Старые cost/terms поля в proposals пока остаются (не трогаем).
-- Статус: накачено на STAGING. На PROD — НЕТ.
-- ============================================================

create table public.proposal_variants (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  sort_order integer not null default 0,
  name_ru text,
  name_en text,
  subtitle_ru text,
  subtitle_en text,
  is_selected boolean not null default false,
  total_price numeric,
  payment_terms_ru text,
  payment_terms_en text,
  cancellation_policy_ru text,
  cancellation_policy_en text,
  cost_includes_ru text,
  cost_includes_en text,
  cost_excludes_ru text,
  cost_excludes_en text,
  cost_notes_ru text,
  cost_notes_en text,
  gallery jsonb default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index proposal_variants_proposal_idx on public.proposal_variants (proposal_id, sort_order);

alter table public.days add column variant_id uuid references public.proposal_variants(id) on delete cascade;
create index days_variant_idx on public.days (variant_id);

-- переезд существующих предложений
insert into public.proposal_variants (
  proposal_id, sort_order, name_ru, name_en, is_selected, total_price,
  payment_terms_ru, payment_terms_en, cancellation_policy_ru, cancellation_policy_en,
  cost_includes_ru, cost_includes_en, cost_excludes_ru, cost_excludes_en,
  cost_notes_ru, cost_notes_en
)
select
  p.id, 0, 'Маршрут 1', 'Route 1', true, p.total_price,
  p.payment_terms_ru, p.payment_terms_en, p.cancellation_policy_ru, p.cancellation_policy_en,
  p.cost_includes_ru, p.cost_includes_en, p.cost_excludes_ru, p.cost_excludes_en,
  p.cost_notes_ru, p.cost_notes_en
from public.proposals p
where (p.kind = 'individual' or p.kind is null)
  and not exists (select 1 from public.proposal_variants v where v.proposal_id = p.id);

update public.days d
set variant_id = v.id
from public.proposal_variants v
where v.proposal_id = d.proposal_id
  and d.variant_id is null;

-- RLS: доступ через родительское предложение
alter table public.proposal_variants enable row level security;

create policy proposal_variants_select on public.proposal_variants
for select using (
  exists (select 1 from public.proposals p where p.id = proposal_id
    and (auth.uid() is null or p.owner_id = auth.uid() or (is_admin() and p.company_id = my_company_id()))));

create policy proposal_variants_insert on public.proposal_variants
for insert with check (
  exists (select 1 from public.proposals p where p.id = proposal_id
    and (p.owner_id = auth.uid() or (is_admin() and p.company_id = my_company_id()))));

create policy proposal_variants_update on public.proposal_variants
for update using (
  exists (select 1 from public.proposals p where p.id = proposal_id
    and (p.owner_id = auth.uid() or (is_admin() and p.company_id = my_company_id()))));

create policy proposal_variants_delete on public.proposal_variants
for delete using (
  exists (select 1 from public.proposals p where p.id = proposal_id
    and (p.owner_id = auth.uid() or (is_admin() and p.company_id = my_company_id()))));