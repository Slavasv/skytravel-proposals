-- ============================================================================
-- 0056 — Персональные токены Microsoft (Вариант А: «от имени назначившего»).
-- ----------------------------------------------------------------------------
-- До этого интеграция Microsoft была ОДНА на компанию (microsoft_integration),
-- поэтому и таски в Planner, и письма уходили от одного аккаунта.
-- Здесь заводим токен НА ПОЛЬЗОВАТЕЛЯ: каждый сотрудник подключает свой рабочий
-- Microsoft, и когда он назначает задачу — она создаётся в Planner и письмо
-- отправляется ЕГО токеном (createdBy = он, письмо из его ящика).
-- Если у назначившего личного токена нет — падаем на общий аккаунт компании.
--
-- refresh_token — секрет. Доступ к таблице ТОЛЬКО через service-role
-- (createSupabaseAdmin), который обходит RLS. Для обычных ролей RLS включён и
-- политик НЕТ — значит строки им не видны (и токен не утечёт через public-ключ).
-- ============================================================================

create table if not exists public.microsoft_user_tokens (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  refresh_token text not null,
  account_email text,
  account_name  text,
  tenant_id     text,
  connected_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.microsoft_user_tokens enable row level security;

-- Явных policy не создаём: при включённом RLS без policy обычные (anon/authenticated)
-- роли не получают ни одной строки. Всё чтение/запись — через service-role в коде.
