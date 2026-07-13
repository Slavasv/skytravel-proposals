-- ============================================================
-- 0005: Привязка ваучера к клиенту CRM
-- Дата: июль 2026
-- Зачем: ваучер должен знать своего клиента — тогда можно
--        подтягивать travellers в гостей и видеть все ваучеры клиента.
--- Статус: накачено на PROD + STAGING
-- ============================================================

alter table public.vouchers
  add column client_id uuid references public.clients(id) on delete set null;

create index vouchers_client_idx on public.vouchers (client_id);