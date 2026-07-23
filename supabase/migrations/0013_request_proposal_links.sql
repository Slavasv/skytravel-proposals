-- ============================================================
-- 0013: Связи запрос ↔ предложения/дестинейшены (many-to-many)
-- Дата: июль 2026
-- Зачем: дестинейшн переиспользуемый — один и тот же может быть
--        прикреплён к разным запросам. proposals.request_id (0012)
--        показывает, ИЗ КАКОГО запроса создан, а эта таблица —
--        какие прикреплены к запросу (включая созданные ранее).
-- Статус: накачено на STAGING. На PROD — НЕТ.
-- ============================================================

create table public.request_proposal_links (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (request_id, proposal_id)
);

create index rpl_request_idx on public.request_proposal_links (request_id);
create index rpl_proposal_idx on public.request_proposal_links (proposal_id);





alter table public.request_proposal_links enable row level security;

create policy rpl_all on public.request_proposal_links
  for all to public
  using (
    exists (
      select 1 from requests r
      where r.id = request_proposal_links.request_id
        and (r.owner_id = auth.uid() or (is_admin() and r.company_id = my_company_id()))
    )
  )
  with check (
    exists (
      select 1 from requests r
      where r.id = request_proposal_links.request_id
        and r.company_id = my_company_id()
    )
  );