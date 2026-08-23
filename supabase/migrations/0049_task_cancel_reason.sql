-- 0049_task_cancel_reason.sql
-- Причина отмены задачи (заполняется при переводе в статус 'cancelled').
alter table public.tasks add column if not exists cancel_reason text;