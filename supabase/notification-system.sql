-- Run this in Supabase SQL editor before testing push notifications.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'client',
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_profile_id_idx
  on public.push_subscriptions(profile_id);

create index if not exists push_subscriptions_role_idx
  on public.push_subscriptions(role);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  notification_type text not null default 'Announcements',
  audience text not null,
  status text not null default 'Draft',
  send_mode text not null default 'now',
  scheduled_at timestamptz,
  sent_at timestamptz,
  sent_by uuid references public.profiles(id) on delete set null,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_notifications_created_at_idx
  on public.admin_notifications(created_at desc);

create index if not exists admin_notifications_status_idx
  on public.admin_notifications(status);

alter table public.push_subscriptions enable row level security;
alter table public.admin_notifications enable row level security;

-- Users can insert/update their own device subscription.
drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions"
  on public.push_subscriptions
  for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- Master admins can read notification history from the admin UI.
drop policy if exists "Master admins read notifications" on public.admin_notifications;
create policy "Master admins read notifications"
  on public.admin_notifications
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'master_admin'
    )
  );
