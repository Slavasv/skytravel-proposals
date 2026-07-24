-- ============================================================
-- 0018: Связь ваучера с бронью + тип ваучера
-- Дата: июль 2026
-- Зачем: ваучеры создаются из брони. На одну бронь их может быть
--        несколько по типам: проживание (отели), перелёты (авиа).
--        voucher_type определяет, какие услуги брони переносятся
--        и какой шаблон используется.
--        Сейчас реализован accommodation; flight — следующим этапом.
-- Статус: накачено на STAGING. На PROD — НЕТ.
-- ============================================================

alter table public.vouchers
  add column booking_id uuid references public.bookings(id) on delete set null,
  add column voucher_type text not null default 'accommodation';

create index vouchers_booking_idx on public.vouchers (booking_id);