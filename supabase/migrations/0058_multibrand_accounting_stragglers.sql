-- ============================================================================
-- 0058 — Мультибренд: последние «отставшие» RLS в бухгалтерии.
-- ----------------------------------------------------------------------------
-- Полный аудит показал, что после 0054/0055/0057 на скалярном my_company_id()
-- (= ТОЛЬКО основной бренд) остались ровно ТРИ политики — все в бухгалтерии.
-- Из-за них кабинет бухгалтера не работает под НЕ-основным брендом (Tigu):
--   1) booking_services_select_accountant (0030) — бухгалтер не видит услуги брони;
--   2) payment_accounts_all             (0036) — не видны/не заводятся счета;
--   3) transaction_allocations_all      (0037) — не видны/не пишутся разбивки платежей.
-- Переводим на my_company_ids(). Замена строго РАСШИРЯЮЩАЯ (набор всегда включает
-- основной бренд), поэтому доступ основного бренда не сужается.
--
-- (transactions и supplier_invoices уже переведены в 0054 — здесь их нет.)
-- ============================================================================

-- 1) booking_services: доступ бухгалтера на чтение услуг брони (через бронь)
drop policy if exists booking_services_select_accountant on public.booking_services;
create policy booking_services_select_accountant on public.booking_services
  for select using (
    is_accountant() and exists (
      select 1 from bookings b
      where b.id = booking_services.booking_id
        and b.company_id = any(my_company_ids())
    )
  );

-- 2) payment_accounts: счета кассы/карты/банка (admin/accountant в пределах брендов)
drop policy if exists payment_accounts_all on public.payment_accounts;
create policy payment_accounts_all on public.payment_accounts
  for all
  using (company_id = any(my_company_ids()) and (is_admin() or is_accountant()))
  with check (company_id = any(my_company_ids()) and (is_admin() or is_accountant()));

-- 3) transaction_allocations: разбивка платежа по броням/инвойсам (через платёж)
drop policy if exists transaction_allocations_all on public.transaction_allocations;
create policy transaction_allocations_all on public.transaction_allocations
  for all
  using (exists (
    select 1 from transactions t
    where t.id = transaction_allocations.transaction_id
      and t.company_id = any(my_company_ids())
      and (is_admin() or is_accountant())
  ))
  with check (exists (
    select 1 from transactions t
    where t.id = transaction_allocations.transaction_id
      and t.company_id = any(my_company_ids())
      and (is_admin() or is_accountant())
  ));
