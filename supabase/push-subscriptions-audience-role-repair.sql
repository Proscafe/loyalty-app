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
alter table public.push_subscriptions add column if not exists role text not null default 'client';
alter table public.push_subscriptions add column if not exists audience text not null default 'Client';
alter table public.push_subscriptions add column if not exists endpoint text;
alter table public.push_subscriptions add column if not exists p256dh text;
alter table public.push_subscriptions add column if not exists auth text;
alter table public.push_subscriptions add column if not exists user_agent text null;
alter table public.push_subscriptions add column if not exists created_at timestamptz not null default now();
alter table public.push_subscriptions add column if not exists updated_at timestamptz not null default now();

update public.push_subscriptions
set audience = case
  when lower(coalesce(role, '')) = 'master_admin' then 'Admin'
  when lower(coalesce(role, '')) = 'staff' then 'Staff'
  else 'Client'
end
where audience is null or trim(audience) = '';

update public.push_subscriptions
set role = case
  when lower(coalesce(audience, '')) = 'admin' then 'master_admin'
  when lower(coalesce(audience, '')) = 'staff' then 'staff'
  else 'client'
end
where role is null or trim(role) = '';

create unique index if not exists push_subscriptions_endpoint_unique_idx on public.push_subscriptions(endpoint);
create index if not exists push_subscriptions_role_idx on public.push_subscriptions(role);
create index if not exists push_subscriptions_audience_idx on public.push_subscriptions(audience);

select pg_notify('pgrst', 'reload schema');
