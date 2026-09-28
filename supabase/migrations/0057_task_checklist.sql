-- ============================================================================
-- 0057 — Подзадачи-чеклист внутри задачи (как в Planner) + добор RLS задач.
-- ============================================================================

-- ---- 1) tasks: ещё один «отставший» от 0054 — политики были на скалярном
--         my_company_id() (только основной бренд). Переводим на my_company_ids(),
--         иначе задачи под НЕ-основным брендом (Tigu) не видны/не создаются.
--         Замена строго расширяющая (набор всегда включает основной бренд).
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to public
  using (company_id = any(my_company_ids()));

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to public
  with check (company_id = any(my_company_ids()));

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to public
  using (
    company_id = any(my_company_ids())
    and (creator_id = auth.uid() or assignee_id = auth.uid())
  )
  with check (company_id = any(my_company_ids()));

-- ---- 2) Пункты чеклиста задачи (подзадачи «как в Planner»: текст + галочка) ----
create table if not exists public.task_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  title       text not null,
  done        boolean not null default false,
  sort_order  integer not null default 0,
  ms_item_id  text,                 -- ключ пункта в Planner (для двусторонней синхры)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists task_checklist_task_idx on public.task_checklist_items (task_id, sort_order);

alter table public.task_checklist_items enable row level security;

-- Доступ по родительской задаче (видно/меняется тем, кто видит задачу в своём бренде).
drop policy if exists task_checklist_all on public.task_checklist_items;
create policy task_checklist_all on public.task_checklist_items
  for all to public
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_checklist_items.task_id
        and t.company_id = any(my_company_ids())
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_checklist_items.task_id
        and t.company_id = any(my_company_ids())
    )
  );
