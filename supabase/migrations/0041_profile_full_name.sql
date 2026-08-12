-- 0041_profile_full_name.sql
-- Имя сотрудника в дополнение к email. Показываем в списке команды, на статусах,
-- в задачах (исполнитель/автор). Если пусто — везде откатываемся на email.

alter table public.profiles
  add column if not exists full_name text;