-- 0031_ui_language.sql
-- Язык интерфейса админки — ПЕРСОНАЛЬНАЯ настройка каждого сотрудника.
-- Не путать с RU/EN-полями контента в предложениях (те — для клиента).
-- Значение меняется через server action под service-role (только своё поле,
-- только свой id), поэтому отдельная RLS-политика на update не нужна.

alter table public.profiles
  add column if not exists ui_language text not null default 'en';

alter table public.profiles
  drop constraint if exists profiles_ui_language_check;

alter table public.profiles
  add constraint profiles_ui_language_check check (ui_language in ('en', 'ru'));
