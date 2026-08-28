-- 0050_task_priority_and_types.sql
-- Приоритеты приводим к 4 планеровским (urgent/important/medium/low).
-- Типы: «библиотеку» разбиваем на hotel/transfer/activity/city.

do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.tasks'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%priority%';
  if c is not null then execute format('alter table public.tasks drop constraint %I', c); end if;
end $$;

update public.tasks set priority = 'important' where priority = 'high';
update public.tasks set priority = 'medium'    where priority = 'normal';

alter table public.tasks alter column priority set default 'medium';
alter table public.tasks add constraint tasks_priority_check
  check (priority in ('urgent', 'important', 'medium', 'low'));

do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.tasks'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%entity_type%';
  if c is not null then execute format('alter table public.tasks drop constraint %I', c); end if;
end $$;

update public.tasks set entity_type = 'general' where entity_type = 'library';
alter table public.tasks add constraint tasks_entity_type_check
  check (entity_type in ('general', 'request', 'proposal', 'booking', 'voucher', 'hotel', 'transfer', 'activity', 'city'));