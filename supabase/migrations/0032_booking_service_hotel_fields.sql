-- 0032_booking_service_hotel_fields.sql
-- Поля отеля в услугах брони — чтобы переносить из маршрута предложения
-- (тип номера, питание, число ночей) и потом парсить в ваучер.

alter table public.booking_services
  add column if not exists room_type text,
  add column if not exists meal_plan text,
  add column if not exists nights text;
