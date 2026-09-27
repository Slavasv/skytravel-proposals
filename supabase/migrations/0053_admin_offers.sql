-- 0053: Админ-офферы (сравнение цен) + Симпл-пропозалы (клиентский текст)
-- Дата: сентябрь 2026
-- Зачем:
--   admin_offers  — ОДИН отель на оффер, общая шапка (даты/размещение/питание),
--   offer_rooms   — несколько номеров внутри оффера (тип, ссылка, цена клиенту),
--   offer_room_quotes — котировки на номер: нетто (партнёр, можно несколько) / booking / отель,
--                       отметка «актуальная», комиссия %.
--   simple_proposals / simple_rooms — снимок для клиента (только цена клиенту), генерится из оффера.
-- Статус: применить на Supabase вручную (dev+prod = одна БД).

-- ============ АДМИН ОФФЕР ============
create table public.admin_offers (
  id uuid primary key default gen_random_uuid(),

  request_id uuid references public.requests(id) on delete set null,
  client_id  uuid references public.clients(id)  on delete set null,

  title       text,                 -- для списка: клиент/поездка
  hotel_name  text,
  date_from   date,
  date_to     date,
  occupancy   text,                 -- свободный текст: «2 взрослых + 5 детей (14,11,…)»
  meal        text,                 -- свободный текст: «завтраки» / «без питания»
  status      text not null default 'draft',   -- draft | sent
  notes       text,

  company_id uuid references public.companies(id) on delete cascade,
  owner_id   uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index admin_offers_company_idx on public.admin_offers (company_id);
create index admin_offers_request_idx on public.admin_offers (request_id);
create index admin_offers_client_idx  on public.admin_offers (client_id);

create table public.offer_rooms (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.admin_offers(id) on delete cascade,

  sort_order int not null default 0,
  room_type  text,
  room_link  text,
  room_note  text,                  -- напр. «2 номера Outer-connecting…»
  sale_price numeric,               -- цена клиенту (вводится вручную)
  sale_currency text default 'EUR',
  extra_label text,                 -- напр. «Дополнительный номер»
  extra_price numeric,
  is_recommended boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index offer_rooms_offer_idx on public.offer_rooms (offer_id);

create table public.offer_room_quotes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.offer_rooms(id) on delete cascade,

  source text not null default 'netto',  -- netto | booking | hotel
  partner_id uuid references public.partners(id) on delete set null,  -- только для netto
  amount numeric,
  currency text default 'EUR',
  commission_pct numeric,
  is_chosen boolean not null default false,
  note text,
  sort_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index offer_room_quotes_room_idx on public.offer_room_quotes (room_id);

-- ============ СИМПЛ ПРОПОЗАЛ (клиент) ============
create table public.simple_proposals (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  source_offer_id uuid references public.admin_offers(id) on delete set null,

  request_id uuid references public.requests(id) on delete set null,
  client_id  uuid references public.clients(id)  on delete set null,

  title      text,
  hotel_name text,
  date_from  date,
  date_to    date,
  occupancy  text,
  meal       text,
  status     text not null default 'draft',

  company_id uuid references public.companies(id) on delete cascade,
  owner_id   uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index simple_proposals_company_idx on public.simple_proposals (company_id);

create table public.simple_rooms (
  id uuid primary key default gen_random_uuid(),
  simple_id uuid not null references public.simple_proposals(id) on delete cascade,

  sort_order int not null default 0,
  room_type text,
  room_link text,
  room_note text,
  price numeric,                    -- только цена клиенту
  currency text default 'EUR',
  extra_label text,
  extra_price numeric,
  is_recommended boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index simple_rooms_simple_idx on public.simple_rooms (simple_id);

-- ============ RLS ============
alter table public.admin_offers enable row level security;
create policy admin_offers_select on public.admin_offers for select to public
  using (owner_id = auth.uid() or (is_admin() and company_id = my_company_id()));
create policy admin_offers_insert on public.admin_offers for insert to public
  with check (company_id = my_company_id());
create policy admin_offers_update on public.admin_offers for update to public
  using (owner_id = auth.uid() or (is_admin() and company_id = my_company_id()));
create policy admin_offers_delete on public.admin_offers for delete to public
  using (owner_id = auth.uid() or (is_admin() and company_id = my_company_id()));

alter table public.offer_rooms enable row level security;
create policy offer_rooms_all on public.offer_rooms for all to public
  using (exists (select 1 from admin_offers o where o.id = offer_rooms.offer_id
    and (o.owner_id = auth.uid() or (is_admin() and o.company_id = my_company_id()))))
  with check (exists (select 1 from admin_offers o where o.id = offer_rooms.offer_id
    and o.company_id = my_company_id()));

alter table public.offer_room_quotes enable row level security;
create policy offer_room_quotes_all on public.offer_room_quotes for all to public
  using (exists (select 1 from offer_rooms r join admin_offers o on o.id = r.offer_id
    where r.id = offer_room_quotes.room_id
      and (o.owner_id = auth.uid() or (is_admin() and o.company_id = my_company_id()))))
  with check (exists (select 1 from offer_rooms r join admin_offers o on o.id = r.offer_id
    where r.id = offer_room_quotes.room_id and o.company_id = my_company_id()));

alter table public.simple_proposals enable row level security;
create policy simple_proposals_select on public.simple_proposals for select to public
  using (owner_id = auth.uid() or (is_admin() and company_id = my_company_id()));
create policy simple_proposals_insert on public.simple_proposals for insert to public
  with check (company_id = my_company_id());
create policy simple_proposals_update on public.simple_proposals for update to public
  using (owner_id = auth.uid() or (is_admin() and company_id = my_company_id()));
create policy simple_proposals_delete on public.simple_proposals for delete to public
  using (owner_id = auth.uid() or (is_admin() and company_id = my_company_id()));

alter table public.simple_rooms enable row level security;
create policy simple_rooms_all on public.simple_rooms for all to public
  using (exists (select 1 from simple_proposals s where s.id = simple_rooms.simple_id
    and (s.owner_id = auth.uid() or (is_admin() and s.company_id = my_company_id()))))
  with check (exists (select 1 from simple_proposals s where s.id = simple_rooms.simple_id
    and s.company_id = my_company_id()));

-- Публичное чтение симпла по slug (клиент открывает ссылку без логина) — по желанию.
-- Пока НЕ включаем: главный выход — копируемый текст, публичную ссылку добавим позже при надобности.
