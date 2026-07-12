-- ============================================================
-- 0002: Per-voucher toggle for the brand welcome message
-- Дата: июль 2026
-- Зачем: приветственный текст бренда (greeting_message) нужен
--        не для всех ваучеров — для деловых поездок он не к месту.
--        Флаг per-voucher, не per-brand.
-- Статус: накачено на PROD + STAGING
-- ============================================================

alter table public.vouchers
  add column show_greeting boolean not null default false;