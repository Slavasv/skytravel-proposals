-- 0044_push_subscriptions.sql
-- Web Push подписки браузеров сотрудников. Одна строка на браузер/устройство.
-- Сам сотрудник управляет своими подписками (RLS); сервер рассылает пуши через
-- service-role клиент (обходит RLS, чтобы достать чужие подписки при отправке).

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_own on public.push_subscriptions
  for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());