-- 0045_tasks_update_assignee_creator_only.sql
-- Ужесточаем права на задачу: менять/закрывать может ТОЛЬКО исполнитель или автор.
-- Раньше мог ещё и админ/владелец — убираем is_admin() из политики.

drop policy if exists tasks_update on public.tasks;

create policy tasks_update on public.tasks
  for update
  using (
    company_id = my_company_id()
    and (creator_id = auth.uid() or assignee_id = auth.uid())
  )
  with check (company_id = my_company_id());