-- ============================================================================
-- 0055 — Мультибренд, фаза 1: добор «отставших» таблиц.
-- ----------------------------------------------------------------------------
-- В 0054 RLS перевели на my_company_ids() (набор брендов владельца), но часть
-- дочерних таблиц туда не попала и осталась на скалярном my_company_id()
-- (= ТОЛЬКО основной бренд). Из-за этого запись/чтение под НЕ-основным брендом
-- (напр. Tigu, когда основной у профиля — Sky) отклоняется RLS.
-- Симптом: у Ская работает, у Тигу — нет (направления в реквесте, варианты и т.п.).
--
-- Здесь переводим оставшиеся политики на my_company_ids(). Замена строго
-- РАСШИРЯЮЩАЯ: my_company_ids() всегда включает основной company_id (фолбэк),
-- поэтому доступ основного бренда не сужается — только добавляются бренды-членства.
-- Тела политик 1-в-1 повторяют оригиналы (0004 / 0013 / 0022), меняется лишь
-- `= my_company_id()` → `= any(my_company_ids())`.
-- ============================================================================

-- ============ TRAVELLERS (родитель — clients) — было в 0004 ============
drop policy if exists travellers_select on public.travellers;
create policy travellers_select on public.travellers
  for select to public
  using (
    exists (
      select 1 from clients c
      where c.id = travellers.client_id
        and (c.owner_id = auth.uid() or (is_admin() and c.company_id = any(my_company_ids())))
    )
  );

drop policy if exists travellers_insert on public.travellers;
create policy travellers_insert on public.travellers
  for insert to public
  with check (
    exists (
      select 1 from clients c
      where c.id = travellers.client_id
        and c.company_id = any(my_company_ids())
    )
  );

drop policy if exists travellers_update on public.travellers;
create policy travellers_update on public.travellers
  for update to public
  using (
    exists (
      select 1 from clients c
      where c.id = travellers.client_id
        and (c.owner_id = auth.uid() or (is_admin() and c.company_id = any(my_company_ids())))
    )
  );

drop policy if exists travellers_delete on public.travellers;
create policy travellers_delete on public.travellers
  for delete to public
  using (
    exists (
      select 1 from clients c
      where c.id = travellers.client_id
        and (c.owner_id = auth.uid() or (is_admin() and c.company_id = any(my_company_ids())))
    )
  );

-- ============ REQUEST ↔ PROPOSAL LINKS (родитель — requests) — было в 0013 ==
drop policy if exists rpl_all on public.request_proposal_links;
create policy rpl_all on public.request_proposal_links
  for all to public
  using (
    exists (
      select 1 from requests r
      where r.id = request_proposal_links.request_id
        and (r.owner_id = auth.uid() or (is_admin() and r.company_id = any(my_company_ids())))
    )
  )
  with check (
    exists (
      select 1 from requests r
      where r.id = request_proposal_links.request_id
        and r.company_id = any(my_company_ids())
    )
  );

-- ============ PROPOSAL VARIANTS (родитель — proposals) — было в 0022 ========
-- ВНИМАНИЕ: в select сохраняем ветку `auth.uid() is null` — она нужна публичной
-- (анонимной) странице предложения, чтобы читать варианты.
drop policy if exists proposal_variants_select on public.proposal_variants;
create policy proposal_variants_select on public.proposal_variants
for select using (
  exists (select 1 from public.proposals p where p.id = proposal_id
    and (auth.uid() is null or p.owner_id = auth.uid() or (is_admin() and p.company_id = any(my_company_ids())))));

drop policy if exists proposal_variants_insert on public.proposal_variants;
create policy proposal_variants_insert on public.proposal_variants
for insert with check (
  exists (select 1 from public.proposals p where p.id = proposal_id
    and (p.owner_id = auth.uid() or (is_admin() and p.company_id = any(my_company_ids())))));

drop policy if exists proposal_variants_update on public.proposal_variants;
create policy proposal_variants_update on public.proposal_variants
for update using (
  exists (select 1 from public.proposals p where p.id = proposal_id
    and (p.owner_id = auth.uid() or (is_admin() and p.company_id = any(my_company_ids())))));

drop policy if exists proposal_variants_delete on public.proposal_variants;
create policy proposal_variants_delete on public.proposal_variants
for delete using (
  exists (select 1 from public.proposals p where p.id = proposal_id
    and (p.owner_id = auth.uid() or (is_admin() and p.company_id = any(my_company_ids())))));

-- ============ REQUEST_DESTINATIONS (родитель — requests) ====================
-- Таблицу создавали вручную в Supabase (в миграциях её CREATE нет), поэтому имя
-- старой политики точно не известно. Снимаем вероятные имена и ставим каноничную
-- политику по образцу дочерних таблиц из 0054 (booking_services_all / rpl_all).
alter table public.request_destinations enable row level security;

drop policy if exists request_destinations_all on public.request_destinations;
drop policy if exists request_destinations_select on public.request_destinations;
drop policy if exists request_destinations_insert on public.request_destinations;
drop policy if exists request_destinations_update on public.request_destinations;
drop policy if exists request_destinations_delete on public.request_destinations;
drop policy if exists request_destinations_rw on public.request_destinations;

create policy request_destinations_all on public.request_destinations
  for all to public
  using (
    exists (
      select 1 from requests r
      where r.id = request_destinations.request_id
        and (r.owner_id = auth.uid() or (is_admin() and r.company_id = any(my_company_ids())))
    )
  )
  with check (
    exists (
      select 1 from requests r
      where r.id = request_destinations.request_id
        and r.company_id = any(my_company_ids())
    )
  );
