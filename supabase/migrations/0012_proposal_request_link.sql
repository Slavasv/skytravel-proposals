-- ============================================================
-- 0012: Связь предложения/дестинейшена с запросом
-- Дата: июль 2026
-- Зачем: из запроса создаются дестинейшены (kind='destination')
--        и предложения (kind='individual'). request_id связывает
--        их с исходным запросом — для истории и аналитики.
-- Статус: накачено на STAGING. На PROD — НЕТ.
-- ============================================================

alter table public.proposals
  add column request_id uuid references public.requests(id) on delete set null;

create index proposals_request_idx on public.proposals (request_id);