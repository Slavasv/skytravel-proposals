create table public.transaction_allocations (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  invoice_id uuid references public.supplier_invoices(id) on delete set null,
  amount numeric not null default 0,
  created_at timestamptz not null default now()
);
create index transaction_allocations_tx_idx on public.transaction_allocations (transaction_id);
create index transaction_allocations_booking_idx on public.transaction_allocations (booking_id);
create index transaction_allocations_invoice_idx on public.transaction_allocations (invoice_id);

alter table public.transactions alter column booking_id drop not null;

insert into public.transaction_allocations (transaction_id, booking_id, invoice_id, amount)
select id, booking_id, invoice_id, amount from public.transactions;

alter table public.transaction_allocations enable row level security;

create policy transaction_allocations_all on public.transaction_allocations
  for all
  using (exists (select 1 from transactions t where t.id = transaction_allocations.transaction_id and t.company_id = my_company_id() and (is_admin() or is_accountant())))
  with check (exists (select 1 from transactions t where t.id = transaction_allocations.transaction_id and t.company_id = my_company_id() and (is_admin() or is_accountant())));