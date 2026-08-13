-- 0043_profiles_select_company.sql
-- Чтобы «любой может назначить любому», обычный сотрудник должен видеть коллег
-- своей компании (для пикера исполнителя в задачах). Раньше profiles_select
-- показывал только свой профиль (или всё — админу). Расширяем до своей компании.
-- my_company_id() — SECURITY DEFINER, поэтому рекурсии в политике нет.

drop policy if exists profiles_select on public.profiles;

create policy profiles_select on public.profiles
  for select
  using (id = auth.uid() or is_admin() or company_id = my_company_id());