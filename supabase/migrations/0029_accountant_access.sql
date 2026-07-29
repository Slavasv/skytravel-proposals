-- 0029_accountant_access.sql
-- Роль accountant должна видеть КОНТЕКСТ кабинета (брони, клиентов, поставщиков),
-- чтобы отображать инвойсы/платежи и выбирать бронь при добавлении платежа.
-- Добавляем отдельные permissive SELECT-политики — существующие не трогаем (в Postgres
-- несколько permissive-политик объединяются по ИЛИ). Только чтение и только свой бренд.

create policy bookings_select_accountant on public.bookings
  for select using (is_accountant() and company_id = my_company_id());

create policy clients_select_accountant on public.clients
  for select using (is_accountant() and company_id = my_company_id());

create policy partners_select_accountant on public.partners
  for select using (is_accountant() and company_id = my_company_id());