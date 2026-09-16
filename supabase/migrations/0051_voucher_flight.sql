-- 0051_voucher_flight.sql
-- Авиаваучер (voucher_type = 'flight'): все данные перелёта в одном JSONB.
-- Структура: { pnr, airline, outbound_label, return_label,
--   outbound[], return[], passengers[], footer_note }
-- см. lib/flight-voucher.ts
alter table public.vouchers add column if not exists flight_data jsonb;
