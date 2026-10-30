-- ============================================================================
-- 0061 — Авиаперелёт в предложении.
-- Перелёт свой у каждого варианта маршрута; клиент не выбирает (только показываем).
-- Список перелётных плеч внутри варианта. Цена — отдельной строкой, в итог не входит.
-- ============================================================================

create table if not exists public.flight_segments (
  id            uuid primary key default gen_random_uuid(),
  variant_id    uuid not null references public.proposal_variants(id) on delete cascade,
  sort_order    int not null default 0,
  kind          text not null default 'outbound' check (kind in ('outbound','return','internal')),
  flight_date   text,                 -- текстом (гибко: «30 сен», даты-диапазоны)
  from_place    text,
  to_place      text,
  airline       text,
  flight_no     text,
  depart_time   text,
  arrive_time   text,
  stops         text,                 -- «прямой» / «1 пересадка, Стамбул»
  travel_class  text default 'economy' check (travel_class in ('economy','premium','business','first','charter')),
  price         numeric,
  price_currency text default 'EUR',
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists flight_segments_variant_idx on public.flight_segments (variant_id, sort_order);

alter table public.flight_segments enable row level security;

-- Доступ как у proposal_variants: публичное чтение (anon) + владелец/админ бренда через предложение.
drop policy if exists flight_segments_select on public.flight_segments;
create policy flight_segments_select on public.flight_segments
  for select
  using (exists (
    select 1 from public.proposal_variants v
    join public.proposals p on p.id = v.proposal_id
    where v.id = flight_segments.variant_id
      and (auth.uid() is null or p.owner_id = auth.uid() or (is_admin() and p.company_id = any(my_company_ids())))
  ));

drop policy if exists flight_segments_write on public.flight_segments;
create policy flight_segments_write on public.flight_segments
  for all
  using (exists (
    select 1 from public.proposal_variants v
    join public.proposals p on p.id = v.proposal_id
    where v.id = flight_segments.variant_id
      and (p.owner_id = auth.uid() or (is_admin() and p.company_id = any(my_company_ids())))
  ))
  with check (exists (
    select 1 from public.proposal_variants v
    join public.proposals p on p.id = v.proposal_id
    where v.id = flight_segments.variant_id
      and (p.owner_id = auth.uid() or (is_admin() and p.company_id = any(my_company_ids())))
  ));
