-- 0048_proposal_layout.sql
-- Колонка layout у предложения (Full / Hotel). В коде/UI была, в БД отсутствовала.
alter table public.proposals add column if not exists layout text default 'full';