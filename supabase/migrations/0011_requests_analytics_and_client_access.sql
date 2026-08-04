alter table public.requests
  add column cancel_reason text,      -- причина отмены (из списка)
  add column cancel_note text,        -- детали отмены свободно
  add column client_notes text,       -- правки/пожелания клиента по ходу
  add column agent_notes text,        -- внутренние заметки агента
  add column trip_rating int,         -- оценка поездки 1-5
  add column trip_feedback text;      -- отзыв после поездки





  drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients
  for select to public
  using (company_id = my_company_id());

drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients
  for update to public
  using (company_id = my_company_id());