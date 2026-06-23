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

alter table public.push_subscriptions add column if not exists profile_id uuid null;
alter table public.push_subscriptions alter column profile_id drop not null;
alter table public.push_subscriptions add column if not exists role text not null default 'client';
alter table public.push_subscriptions add column if not exists audience text not null default 'Client';
alter table public.push_subscriptions add column if not exists endpoint text;
alter table public.push_subscriptions add column if not exists p256dh text;
alter table public.push_subscriptions add column if not exists auth text;
alter table public.push_subscriptions add column if not exists user_agent text null;
alter table public.push_subscriptions add column if not exists created_at timestamptz not null default now();
alter table public.push_subscriptions add column if not exists updated_at timestamptz not null default now();

-- Allow the same browser/device endpoint to be saved for more than one audience.
-- This prevents the admin page from overwriting a staff phone subscription.
drop index if exists public.push_subscriptions_endpoint_unique_idx;
drop index if exists public.push_subscriptions_endpoint_idx;

-- Drop older unique constraints on endpoint if they exist.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.push_subscriptions'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%(endpoint)%'
      and pg_get_constraintdef(oid) not ilike '%audience%'
  loop
    execute format('alter table public.push_subscriptions drop constraint if exists %I', constraint_name);
  end loop;
end $$;

-- Keep old rows consistent, but don't destroy rows already marked for a specific audience.
update public.push_subscriptions
set audience = case
  when role = 'master_admin' then 'Admin'
  when role = 'staff' then 'Staff'
  else 'Client'
end,
updated_at = now()
where audience is null or audience = '' or lower(audience) not in ('client','staff','admin');

create unique index if not exists push_subscriptions_endpoint_audience_unique_idx
on public.push_subscriptions(endpoint, audience);

create index if not exists push_subscriptions_role_idx on public.push_subscriptions(role);
create index if not exists push_subscriptions_audience_idx on public.push_subscriptions(audience);

-- Helpful check after running this file:
-- select id, audience, role, endpoint, user_agent, created_at from public.push_subscriptions order by created_at desc;

select pg_notify('pgrst', 'reload schema');
