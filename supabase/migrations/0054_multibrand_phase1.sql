-- 0054: Мультибренд, этап 1 (невидимый фундамент).
-- Один владелец может состоять в нескольких брендах. Меняем скалярный my_company_id()
-- на набор my_company_ids() и переписываем RLS на company_id = ANY(my_company_ids()).
-- ОБРАТНО СОВМЕСТИМО: если у пользователя нет членств, my_company_ids() падает на
-- profiles.company_id — поэтому одно-брендовый кабинет ведёт себя ровно как раньше.
-- Применять на Supabase вручную (dev+prod = одна БД). Партнёров не трогаем (у них RLS не включён).

-- ============ Членства пользователь ↔ бренды ============
create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, company_id)
);
create index if not exists company_members_user_idx on public.company_members (user_id);
create index if not exists company_members_company_idx on public.company_members (company_id);

-- Бэкофилл из текущего profiles.company_id (идемпотентно).
insert into public.company_members (user_id, company_id)
select id, company_id from public.profiles
where company_id is not null
on conflict (user_id, company_id) do nothing;

-- ============ Набор доступных брендов (с фолбэком) ============
create or replace function public.my_company_ids() returns uuid[]
  language sql stable security definer set search_path to 'public'
  as $$
    select case
      when exists (select 1 from company_members where user_id = auth.uid())
        then array(select company_id from company_members where user_id = auth.uid())
      else array(select company_id from profiles where id = auth.uid() and company_id is not null)
    end;
  $$;

-- ============ RLS на company_members ============
alter table public.company_members enable row level security;
drop policy if exists company_members_select on public.company_members;
create policy company_members_select on public.company_members
  for select to public
  using (user_id = auth.uid() or is_admin());
-- insert/update/delete членств — через service-role (владелец добавляет бренд/доступ в приложении).

-- ============ CLIENTS ============
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select to public
  using (owner_id = auth.uid() or (is_admin() and company_id = any(my_company_ids())));
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients for insert to public
  with check (company_id = any(my_company_ids()));
drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update to public
  using (owner_id = auth.uid() or (is_admin() and company_id = any(my_company_ids())));
drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete to public
  using (owner_id = auth.uid() or (is_admin() and company_id = any(my_company_ids())));

-- ============ REQUESTS ============
drop policy if exists requests_select on public.requests;
create policy requests_select on public.requests for select to public
  using (owner_id = auth.uid() or (is_admin() and company_id = any(my_company_ids())));
drop policy if exists requests_insert on public.requests;
create policy requests_insert on public.requests for insert to public
  with check (company_id = any(my_company_ids()));
drop policy if exists requests_update on public.requests;
create policy requests_update on public.requests for update to public
  using (owner_id = auth.uid() or (is_admin() and company_id = any(my_company_ids())));
drop policy if exists requests_delete on public.requests;
create policy requests_delete on public.requests for delete to public
  using (owner_id = auth.uid() or (is_admin() and company_id = any(my_company_ids())));

-- ============ BOOKINGS (+ booking_services) ============
drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings for select to public
  using (owner_id = auth.uid() or (is_admin() and company_id = any(my_company_ids())));
drop policy if exists bookings_insert on public.bookings;
create policy bookings_insert on public.bookings for insert to public
  with check (company_id = any(my_company_ids()));
drop policy if exists bookings_update on public.bookings;
create policy bookings_update on public.bookings for update to public
  using (owner_id = auth.uid() or (is_admin() and company_id = any(my_company_ids())));
drop policy if exists bookings_delete on public.bookings;
create policy bookings_delete on public.bookings for delete to public
  using (owner_id = auth.uid() or (is_admin() and company_id = any(my_company_ids())));

drop policy if exists booking_services_all on public.booking_services;
create policy booking_services_all on public.booking_services for all to public
  using (exists (select 1 from bookings b where b.id = booking_services.booking_id
    and (b.owner_id = auth.uid() or (is_admin() and b.company_id = any(my_company_ids())))))
  with check (exists (select 1 from bookings b where b.id = booking_services.booking_id
    and b.company_id = any(my_company_ids())));

-- ============ ADMIN OFFERS (+ дети) ============
drop policy if exists admin_offers_select on public.admin_offers;
create policy admin_offers_select on public.admin_offers for select to public
  using (owner_id = auth.uid() or (is_admin() and company_id = any(my_company_ids())));
drop policy if exists admin_offers_insert on public.admin_offers;
create policy admin_offers_insert on public.admin_offers for insert to public
  with check (company_id = any(my_company_ids()));
drop policy if exists admin_offers_update on public.admin_offers;
create policy admin_offers_update on public.admin_offers for update to public
  using (owner_id = auth.uid() or (is_admin() and company_id = any(my_company_ids())));
drop policy if exists admin_offers_delete on public.admin_offers;
create policy admin_offers_delete on public.admin_offers for delete to public
  using (owner_id = auth.uid() or (is_admin() and company_id = any(my_company_ids())));

drop policy if exists offer_rooms_all on public.offer_rooms;
create policy offer_rooms_all on public.offer_rooms for all to public
  using (exists (select 1 from admin_offers o where o.id = offer_rooms.offer_id
    and (o.owner_id = auth.uid() or (is_admin() and o.company_id = any(my_company_ids())))))
  with check (exists (select 1 from admin_offers o where o.id = offer_rooms.offer_id
    and o.company_id = any(my_company_ids())));

drop policy if exists offer_room_quotes_all on public.offer_room_quotes;
create policy offer_room_quotes_all on public.offer_room_quotes for all to public
  using (exists (select 1 from offer_rooms r join admin_offers o on o.id = r.offer_id
    where r.id = offer_room_quotes.room_id
      and (o.owner_id = auth.uid() or (is_admin() and o.company_id = any(my_company_ids())))))
  with check (exists (select 1 from offer_rooms r join admin_offers o on o.id = r.offer_id
    where r.id = offer_room_quotes.room_id and o.company_id = any(my_company_ids())));

-- ============ SIMPLE PROPOSALS (+ simple_rooms) ============
drop policy if exists simple_proposals_select on public.simple_proposals;
create policy simple_proposals_select on public.simple_proposals for select to public
  using (owner_id = auth.uid() or (is_admin() and company_id = any(my_company_ids())));
drop policy if exists simple_proposals_insert on public.simple_proposals;
create policy simple_proposals_insert on public.simple_proposals for insert to public
  with check (company_id = any(my_company_ids()));
drop policy if exists simple_proposals_update on public.simple_proposals;
create policy simple_proposals_update on public.simple_proposals for update to public
  using (owner_id = auth.uid() or (is_admin() and company_id = any(my_company_ids())));
drop policy if exists simple_proposals_delete on public.simple_proposals;
create policy simple_proposals_delete on public.simple_proposals for delete to public
  using (owner_id = auth.uid() or (is_admin() and company_id = any(my_company_ids())));

drop policy if exists simple_rooms_all on public.simple_rooms;
create policy simple_rooms_all on public.simple_rooms for all to public
  using (exists (select 1 from simple_proposals s where s.id = simple_rooms.simple_id
    and (s.owner_id = auth.uid() or (is_admin() and s.company_id = any(my_company_ids())))))
  with check (exists (select 1 from simple_proposals s where s.id = simple_rooms.simple_id
    and s.company_id = any(my_company_ids())));

-- ============ PROPOSALS ============
-- select: anon (публичная страница) + владелец + админ бренда; insert: любой залогиненный (как было).
drop policy if exists proposals_select on public.proposals;
create policy proposals_select on public.proposals for select
  using (auth.uid() is null or owner_id = auth.uid() or (is_admin() and company_id = any(my_company_ids())));
drop policy if exists proposals_update on public.proposals;
create policy proposals_update on public.proposals for update
  using (owner_id = auth.uid() or (is_admin() and company_id = any(my_company_ids())));
drop policy if exists proposals_delete on public.proposals;
create policy proposals_delete on public.proposals for delete
  using (owner_id = auth.uid() or (is_admin() and company_id = any(my_company_ids())));

-- ============ ACCOUNTING ============
drop policy if exists supplier_invoices_select on public.supplier_invoices;
create policy supplier_invoices_select on public.supplier_invoices for select
  using (company_id = any(my_company_ids()) and (is_admin() or is_accountant()
    or exists (select 1 from bookings b where b.id = booking_id and b.owner_id = auth.uid())));
drop policy if exists supplier_invoices_insert on public.supplier_invoices;
create policy supplier_invoices_insert on public.supplier_invoices for insert
  with check (company_id = any(my_company_ids()) and (is_admin()
    or exists (select 1 from bookings b where b.id = booking_id and b.owner_id = auth.uid())));
drop policy if exists supplier_invoices_update on public.supplier_invoices;
create policy supplier_invoices_update on public.supplier_invoices for update
  using (company_id = any(my_company_ids()) and (is_admin()
    or exists (select 1 from bookings b where b.id = booking_id and b.owner_id = auth.uid())));
drop policy if exists supplier_invoices_delete on public.supplier_invoices;
create policy supplier_invoices_delete on public.supplier_invoices for delete
  using (company_id = any(my_company_ids()) and (is_admin()
    or exists (select 1 from bookings b where b.id = booking_id and b.owner_id = auth.uid())));

drop policy if exists transactions_all on public.transactions;
create policy transactions_all on public.transactions for all
  using (company_id = any(my_company_ids()) and (is_admin() or is_accountant()))
  with check (company_id = any(my_company_ids()) and (is_admin() or is_accountant()));

-- ============ ACCOUNTANT доп. доступ (0029) ============
drop policy if exists bookings_select_accountant on public.bookings;
create policy bookings_select_accountant on public.bookings for select
  using (is_accountant() and company_id = any(my_company_ids()));
drop policy if exists clients_select_accountant on public.clients;
create policy clients_select_accountant on public.clients for select
  using (is_accountant() and company_id = any(my_company_ids()));
-- partners: RLS не включён, политика инертна — но приведём к общему виду на будущее.
drop policy if exists partners_select_accountant on public.partners;
create policy partners_select_accountant on public.partners for select
  using (is_accountant() and company_id = any(my_company_ids()));

-- ============ PROFILES (select) ============
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or is_admin() or company_id = any(my_company_ids()));

-- ============ COMPANIES (update владельцем любого своего бренда) ============
drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies for update
  using (is_owner() and id = any(my_company_ids()))
  with check (is_owner() and id = any(my_company_ids()));
