-- 0042_tasks.sql
-- Задачи команды. Единый источник правды (нативные задачи, не Microsoft).
-- Заводятся с любой страницы (тип/привязка подтягиваются из контекста) или глобально.
-- Видны всем сотрудникам компании; создавать/назначать может любой;
-- редактировать/закрывать — автор, исполнитель или админ/владелец;
-- физического удаления нет — только статус 'cancelled' (история цела).
-- Поля ms_* / external_source — задел под будущий односторонний пуш в Microsoft.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,

  title text not null,
  description text,

  status text not null default 'open'
    check (status in ('open', 'in_progress', 'done', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high')),

  assignee_id uuid references public.profiles(id) on delete set null,  -- кому (может быть пусто = общий пул)
  creator_id  uuid references public.profiles(id) on delete set null,  -- кто завёл

  due_at timestamptz,  -- срок (дата + время; время опционально)

  -- денормализация под быстрый фильтр (как в остальных списках)
  client_id  uuid references public.clients(id)  on delete set null,
  partner_id uuid references public.partners(id) on delete set null,

  -- привязка + «где именно»
  entity_type text not null default 'general'
    check (entity_type in ('general', 'request', 'proposal', 'booking', 'voucher', 'library')),
  entity_id uuid,               -- конкретная запись (полиморфно, без FK); null для 'general' или «тип без записи»
  context_label text,           -- «Заявка #318 · День 3 · Отель Burj Al Arab»
  context_url text,             -- глубокая ссылка назад (с якорем на блок)
  context jsonb,                -- задел: block_id / field / прочее

  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,

  -- задел под синхронизацию с Microsoft (пока не используется)
  ms_task_id text,
  ms_synced_at timestamptz,
  external_source text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_company_idx  on public.tasks (company_id);
create index tasks_assignee_idx on public.tasks (assignee_id);
create index tasks_creator_idx  on public.tasks (creator_id);
create index tasks_status_idx   on public.tasks (status);
create index tasks_due_idx      on public.tasks (due_at);
create index tasks_client_idx   on public.tasks (client_id);
create index tasks_partner_idx  on public.tasks (partner_id);
create index tasks_entity_idx   on public.tasks (entity_type, entity_id);

alter table public.tasks enable row level security;

-- видят все сотрудники своей компании
create policy tasks_select on public.tasks
  for select
  using (company_id = my_company_id());

-- создавать может любой сотрудник компании
create policy tasks_insert on public.tasks
  for insert
  with check (company_id = my_company_id());

-- редактировать/закрывать: автор, исполнитель или админ/владелец
create policy tasks_update on public.tasks
  for update
  using (
    company_id = my_company_id()
    and (creator_id = auth.uid() or assignee_id = auth.uid() or is_admin())
  )
  with check (company_id = my_company_id());

-- delete-политики нет специально: удаляем не физически, а статусом 'cancelled'.