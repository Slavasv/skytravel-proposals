-- ============================================================================
-- 0059 — Вложения (файлы/документы): клиенты, реквесты, брони, задачи.
-- Файл хранится ОДИН раз (files), появляется в сущностях ССЫЛКАМИ (file_links).
-- Приватный бакет attachments; доступ/просмотр — по подписанным ссылкам.
-- ============================================================================

-- ---- 1) Файлы (сам объект + метаданные) ----
create table if not exists public.files (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  file_name    text not null,                 -- исходное имя
  storage_path text not null,                 -- путь в бакете attachments
  mime_type    text,
  size_bytes   bigint,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists files_company_idx on public.files (company_id);

-- ---- 2) Появления файла в сущностях ----
create table if not exists public.file_links (
  id          uuid primary key default gen_random_uuid(),
  file_id     uuid not null references public.files(id) on delete cascade,
  entity_type text not null check (entity_type in ('client','request','booking','task')),
  entity_id   uuid not null,
  created_at  timestamptz not null default now(),
  unique (file_id, entity_type, entity_id)
);
create index if not exists file_links_file_idx   on public.file_links (file_id);
create index if not exists file_links_entity_idx on public.file_links (entity_type, entity_id);

-- ---- 3) RLS ----
alter table public.files enable row level security;
alter table public.file_links enable row level security;

-- files: видят/создают в пределах своих брендов; удаляет загрузивший или админ/владелец.
drop policy if exists files_select on public.files;
create policy files_select on public.files
  for select to public
  using (company_id = any(my_company_ids()));

drop policy if exists files_insert on public.files;
create policy files_insert on public.files
  for insert to public
  with check (company_id = any(my_company_ids()));

drop policy if exists files_update on public.files;
create policy files_update on public.files
  for update to public
  using (company_id = any(my_company_ids()) and (uploaded_by = auth.uid() or is_admin() or is_owner()))
  with check (company_id = any(my_company_ids()));

drop policy if exists files_delete on public.files;
create policy files_delete on public.files
  for delete to public
  using (company_id = any(my_company_ids()) and (uploaded_by = auth.uid() or is_admin() or is_owner()));

-- file_links: доступ по родительскому файлу (его бренд).
drop policy if exists file_links_all on public.file_links;
create policy file_links_all on public.file_links
  for all to public
  using (exists (select 1 from public.files f where f.id = file_links.file_id and f.company_id = any(my_company_ids())))
  with check (exists (select 1 from public.files f where f.id = file_links.file_id and f.company_id = any(my_company_ids())));

-- ---- 4) Приватный бакет attachments ----
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Доступ к объектам бакета — только залогиненным (приложение админское, все authenticated).
-- Изоляция по брендам обеспечивается таблицей files; имена объектов не угадываемы (uuid).
drop policy if exists attachments_select on storage.objects;
create policy attachments_select on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments');

drop policy if exists attachments_insert on storage.objects;
create policy attachments_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments');

drop policy if exists attachments_update on storage.objects;
create policy attachments_update on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments');

drop policy if exists attachments_delete on storage.objects;
create policy attachments_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments');
