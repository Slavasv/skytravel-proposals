-- 0030_accountant_services.sql
-- Бухгалтеру нужен доступ на ЧТЕНИЕ услуг броней (booking_services.gross),
-- чтобы посчитать «кто должен нам» = продажа клиенту минус его оплаты.
-- Только чтение, только свой бренд (через бронь). Существующие политики не трогаем.

create policy booking_services_select_accountant on public.booking_services
  for select using (
    is_accountant() and exists (
      select 1 from bookings b
      where b.id = booking_services.booking_id
        and b.company_id = my_company_id()
    )
  );