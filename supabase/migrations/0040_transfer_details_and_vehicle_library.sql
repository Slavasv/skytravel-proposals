-- 0040_transfer_details_and_vehicle_library.sql
-- Бронирование трансфера:
--   1) transfer_details (jsonb) на booking_services — специфика трансфера
--      (тип One Way/Round Trip/Hourly, плечи, часы аренды, pickup/dropoff, комментарий).
--      Шапка (partner, confirmation_no, gross/net/currency) остаётся в колонках booking_services,
--      комиссия считается как gross - net.
--   2) Транспорт как справочник библиотеки: новый тип content_blocks = 'vehicle'
--      (выбор из списка / создать новый, по аналогии с отелями). Название транспорта
--      хранится в title_ru/title_en, как у отелей.

alter table public.booking_services
  add column if not exists transfer_details jsonb;

alter table public.content_blocks
  drop constraint if exists content_blocks_type_check;

alter table public.content_blocks
  add constraint content_blocks_type_check
  check (type = any (array['hotel'::text, 'activity'::text, 'transfer'::text, 'city'::text, 'vehicle'::text]));