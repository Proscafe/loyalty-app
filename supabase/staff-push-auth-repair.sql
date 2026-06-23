-- Run this once if staff subscriptions return not_authenticated or cannot save.
-- It allows browser push rows for staff/admin/client devices even when a staff page is not using Supabase Auth.

alter table public.push_subscriptions
add column if not exists audience text;

alter table public.push_subscriptions
add column if not exists profile_id uuid null;

alter table public.push_subscriptions
alter column profile_id drop not null;

alter table public.push_subscriptions
add column if not exists role text not null default 'client';

alter table public.push_subscriptions
add column if not exists endpoint text;

alter table public.push_subscriptions
add column if not exists p256dh text;

alter table public.push_subscriptions
add column if not exists auth text;

alter table public.push_subscriptions
add column if not exists user_agent text;

alter table public.push_subscriptions
add column if not exists created_at timestamptz not null default now();

alter table public.push_subscriptions
add column if not exists updated_at timestamptz not null default now();

create unique index if not exists push_subscriptions_endpoint_unique_idx
on public.push_subscriptions(endpoint);

create index if not exists push_subscriptions_role_idx
on public.push_subscriptions(role);

select pg_notify('pgrst', 'reload schema');
