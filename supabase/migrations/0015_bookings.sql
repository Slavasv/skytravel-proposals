0014: day_blocks — несколько типов номеров + активности отеля
-- Дата: июль 2026
-- Зачем: бронирования
--       
-- Статус: накачено на STAGING. На PROD — НЕТ.

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text,

  request_id uuid references public.requests(id) on delete set null,
  proposal_id uuid references public.proposals(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,

  start_date date,
  end_date date,
  destination text,
  status text not null default 'draft',
  notes text,

  company_id uuid references public.companies(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookings_company_idx on public.bookings (company_id);
create index bookings_request_idx on public.bookings (request_id);
create index bookings_client_idx on public.bookings (client_id);




create table public.booking_services (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,

  service_type text,
  partner_id uuid references public.partners(id) on delete set null,
  description text,

  gross numeric,
  net numeric,
  currency text default 'EUR',

  confirmation_no text,
  check_in date,
  check_out date,
  alternatives text,

  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index booking_services_booking_idx on public.booking_services (booking_id);



create or replace function public.next_booking_code(p_company_id uuid)
returns text
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  max_num int;
begin
  select coalesce(max(
    nullif(regexp_replace(booking_code, '^BKG-', ''), '')::int
  ), 0)
  into max_num
  from bookings
  where company_id = p_company_id
    and booking_code ~ '^BKG-\d+$';

  return 'BKG-' || lpad((max_num + 1)::text, 3, '0');
end;
$$;



alter table public.bookings enable row level security;

create policy bookings_select on public.bookings
  for select to public
  using (owner_id = auth.uid() or (is_admin() and company_id = my_company_id()));

create policy bookings_insert on public.bookings
  for insert to public
  with check (company_id = my_company_id());

create policy bookings_update on public.bookings
  for update to public
  using (owner_id = auth.uid() or (is_admin() and company_id = my_company_id()));

create policy bookings_delete on public.bookings
  for delete to public
  using (owner_id = auth.uid() or (is_admin() and company_id = my_company_id()));

alter table public.booking_services enable row level security;

create policy booking_services_all on public.booking_services
  for all to public
  using (
    exists (
      select 1 from bookings b
      where b.id = booking_services.booking_id
        and (b.owner_id = auth.uid() or (is_admin() and b.company_id = my_company_id()))
    )
  )
  with check (
    exists (
      select 1 from bookings b
      where b.id = booking_services.booking_id
        and b.company_id = my_company_id()
    )
  );


  