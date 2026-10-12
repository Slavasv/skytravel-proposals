-- ============================================================================
-- 0060 — Разбивка оплаты между клиентами (split bill).
-- План долей на брони. Факт оплат берём из transactions + transaction_allocations
-- (ничего в деньгах не меняем). Витрина доля/оплачено/остаток — в приложении.
-- ============================================================================

create table if not exists public.booking_payers (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null references public.bookings(id) on delete cascade,
  client_id      uuid references public.clients(id) on delete set null,
  share_amount   numeric,                 -- доля этого плательщика (в его валюте)
  share_currency text not null default 'EUR',
  account_id     uuid references public.payment_accounts(id) on delete set null,  -- ожидаемый счёт (опц.)
  note           text,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists booking_payers_booking_idx on public.booking_payers (booking_id);

alter table public.booking_payers enable row level security;

-- доступ как к самой брони (владелец брони или админ своего бренда)
drop policy if exists booking_payers_all on public.booking_payers;
create policy booking_payers_all on public.booking_payers
  for all to public
  using (exists (
    select 1 from bookings b
    where b.id = booking_payers.booking_id
      and (b.owner_id = auth.uid() or (is_admin() and b.company_id = any(my_company_ids())))
  ))
  with check (exists (
    select 1 from bookings b
    where b.id = booking_payers.booking_id
      and b.company_id = any(my_company_ids())
  ));
