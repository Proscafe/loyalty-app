-- Staff/Admin/Client browser push subscription repair.
-- Run this in Supabase SQL Editor before checking push_subscriptions.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid null,
  role text not null default 'client',
  audience text not null default 'Client',
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions
add column if not exists profile_id uuid null;

alter table public.push_subscriptions
alter column profile_id drop not null;

alter table public.push_subscriptions
add column if not exists role text not null default 'client';

alter table public.push_subscriptions
add column if not exists audience text not null default 'Client';

alter table public.push_subscriptions
add column if not exists endpoint text;

alter table public.push_subscriptions
add column if not exists p256dh text;

alter table public.push_subscriptions
add column if not exists auth text;

alter table public.push_subscriptions
add column if not exists user_agent text null;

alter table public.push_subscriptions
add column if not exists created_at timestamptz not null default now();

alter table public.push_subscriptions
add column if not exists updated_at timestamptz not null default now();

update public.push_subscriptions
set audience = case
  when role = 'master_admin' then 'Admin'
  when role = 'staff' then 'Staff'
  else 'Client'
end
where audience is null or audience = '';

create unique index if not exists push_subscriptions_endpoint_unique_idx
on public.push_subscriptions(endpoint);

create index if not exists push_subscriptions_role_idx
on public.push_subscriptions(role);

create index if not exists push_subscriptions_audience_idx
on public.push_subscriptions(audience);

alter table public.push_subscriptions enable row level security;

select pg_notify('pgrst', 'reload schema');

-- Use this AFTER running the repair above:
-- select id, audience, role, endpoint, created_at
-- from public.push_subscriptions
-- order by created_at desc;
