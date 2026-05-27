-- ============================================================================
-- Loyalty Program App — Supabase schema
-- Run this entire file in Supabase Dashboard → SQL Editor → New query.
-- ============================================================================

-- Extensions ------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- Enums (we use text + CHECK constraints per the spec, but keep this here
-- as a convenient single place to update allowed values) ----------------------

-- ===========================================================================
-- 1. profiles
-- ===========================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text,
  phone       text,
  id_number   text,
  role        text not null default 'client'
              check (role in ('master_admin', 'staff', 'client')),
  client_code text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_client_code_idx on public.profiles (client_code);
create index if not exists profiles_phone_idx on public.profiles (phone);
create index if not exists profiles_full_name_idx on public.profiles (lower(full_name));

-- ===========================================================================
-- 2. loyalty_categories
-- ===========================================================================
create table if not exists public.loyalty_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Seed default categories
insert into public.loyalty_categories (name, description, sort_order) values
  ('Sandwiches',  'Sandwich loyalty line', 1),
  ('Main Course', 'Main course loyalty line', 2),
  ('Desserts',    'Dessert loyalty line', 3),
  ('Coffee',      'Coffee loyalty line', 4),
  ('Desserts 2',  'Second dessert loyalty line', 5)
on conflict (name) do nothing;

-- ===========================================================================
-- 3. client_stamps  (one row per client per category)
-- ===========================================================================
create table if not exists public.client_stamps (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles(id) on delete cascade,
  category_id  uuid not null references public.loyalty_categories(id) on delete cascade,
  stamp_count  integer not null default 0 check (stamp_count between 0 and 5),
  updated_at   timestamptz not null default now(),
  unique (client_id, category_id)
);

create index if not exists client_stamps_client_idx on public.client_stamps (client_id);

-- ===========================================================================
-- 4. rewards
-- ===========================================================================
create table if not exists public.rewards (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles(id) on delete cascade,
  category_id  uuid not null references public.loyalty_categories(id) on delete cascade,
  reward_type  text not null,
  status       text not null default 'available'
               check (status in ('available', 'redeemed', 'expired')),
  earned_at    timestamptz not null default now(),
  redeemed_at  timestamptz,
  redeemed_by  uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

create index if not exists rewards_client_idx on public.rewards (client_id);
create index if not exists rewards_status_idx on public.rewards (status);

-- ===========================================================================
-- 5. stamp_transactions
-- ===========================================================================
create table if not exists public.stamp_transactions (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.profiles(id) on delete cascade,
  category_id         uuid references public.loyalty_categories(id) on delete set null,
  staff_id            uuid references public.profiles(id) on delete set null,
  action_type         text not null
                      check (action_type in
                        ('add_stamp', 'reward_earned', 'reward_redeemed', 'manual_adjustment')),
  stamp_count_before  integer,
  stamp_count_after   integer,
  reward_id           uuid references public.rewards(id) on delete set null,
  notes               text,
  created_at          timestamptz not null default now()
);

create index if not exists stamp_tx_client_idx on public.stamp_transactions (client_id);
create index if not exists stamp_tx_created_idx on public.stamp_transactions (created_at desc);

-- ===========================================================================
-- Helper: generate a unique short client_code (e.g. "CLT-7F3K9A")
-- ===========================================================================
create or replace function public.generate_client_code()
returns text
language plpgsql
as $$
declare
  candidate text;
  exists_count int;
begin
  loop
    -- 6 uppercase alphanumeric chars
    candidate := 'CLT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    select count(*) into exists_count from public.profiles where client_code = candidate;
    exit when exists_count = 0;
  end loop;
  return candidate;
end;
$$;

-- ===========================================================================
-- Trigger: when a new auth user is created, create a matching profile row
-- and seed the 5 client_stamps rows.
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_phone     text;
  v_id_number text;
  v_code      text;
begin
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''), '@', 1));
  v_phone     := new.raw_user_meta_data->>'phone';
  v_id_number := new.raw_user_meta_data->>'id_number';
  v_code      := public.generate_client_code();

  insert into public.profiles (id, full_name, email, phone, id_number, role, client_code)
  values (new.id, v_full_name, new.email, v_phone, v_id_number, 'client', v_code);

  -- Seed a stamp row for each active category
  insert into public.client_stamps (client_id, category_id, stamp_count)
  select new.id, c.id, 0
  from public.loyalty_categories c
  where c.is_active = true;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- Utility: keep updated_at fresh
-- ===========================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists client_stamps_touch on public.client_stamps;
create trigger client_stamps_touch before update on public.client_stamps
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- Core RPC: add a stamp atomically and earn a reward if the 5th was added
-- ===========================================================================
create or replace function public.add_stamp(
  p_client_id   uuid,
  p_category_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role  text;
  v_before       int;
  v_after        int;
  v_cat_name     text;
  v_reward_id    uuid;
  v_reward       jsonb;
begin
  -- Authorize: caller must be staff or master_admin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is null or v_caller_role not in ('staff','master_admin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  -- Category lookup (for reward label)
  select name into v_cat_name from public.loyalty_categories where id = p_category_id and is_active = true;
  if v_cat_name is null then
    raise exception 'category_not_found';
  end if;

  -- Ensure a stamp row exists, then lock it
  insert into public.client_stamps (client_id, category_id, stamp_count)
  values (p_client_id, p_category_id, 0)
  on conflict (client_id, category_id) do nothing;

  select stamp_count into v_before
    from public.client_stamps
   where client_id = p_client_id and category_id = p_category_id
   for update;

  v_after := v_before + 1;

  if v_after < 5 then
    -- Simple increment
    update public.client_stamps
       set stamp_count = v_after
     where client_id = p_client_id and category_id = p_category_id;

    insert into public.stamp_transactions
      (client_id, category_id, staff_id, action_type, stamp_count_before, stamp_count_after)
      values (p_client_id, p_category_id, auth.uid(), 'add_stamp', v_before, v_after);

    return jsonb_build_object(
      'success', true,
      'new_stamp_count', v_after,
      'reward_earned', false
    );
  else
    -- 5th stamp → reward + reset
    insert into public.stamp_transactions
      (client_id, category_id, staff_id, action_type, stamp_count_before, stamp_count_after)
      values (p_client_id, p_category_id, auth.uid(), 'add_stamp', v_before, 5);

    insert into public.rewards (client_id, category_id, reward_type, status, earned_at)
      values (p_client_id, p_category_id, 'Free ' || v_cat_name || ' Item', 'available', now())
      returning id into v_reward_id;

    insert into public.stamp_transactions
      (client_id, category_id, staff_id, action_type, stamp_count_before, stamp_count_after, reward_id)
      values (p_client_id, p_category_id, auth.uid(), 'reward_earned', 5, 0, v_reward_id);

    update public.client_stamps
       set stamp_count = 0
     where client_id = p_client_id and category_id = p_category_id;

    select jsonb_build_object(
      'id', r.id,
      'reward_type', r.reward_type,
      'category_id', r.category_id,
      'category_name', v_cat_name,
      'status', r.status,
      'earned_at', r.earned_at
    ) into v_reward
    from public.rewards r where r.id = v_reward_id;

    return jsonb_build_object(
      'success', true,
      'new_stamp_count', 0,
      'reward_earned', true,
      'reward', v_reward
    );
  end if;
end;
$$;

-- ===========================================================================
-- Core RPC: redeem an available reward
-- ===========================================================================
create or replace function public.redeem_reward(
  p_reward_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_status      text;
  v_client_id   uuid;
  v_category_id uuid;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is null or v_caller_role not in ('staff','master_admin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select status, client_id, category_id
    into v_status, v_client_id, v_category_id
    from public.rewards
   where id = p_reward_id
   for update;

  if v_status is null then
    raise exception 'reward_not_found';
  end if;
  if v_status <> 'available' then
    raise exception 'reward_not_available';
  end if;

  update public.rewards
     set status      = 'redeemed',
         redeemed_at = now(),
         redeemed_by = auth.uid()
   where id = p_reward_id;

  insert into public.stamp_transactions
    (client_id, category_id, staff_id, action_type, reward_id)
    values (v_client_id, v_category_id, auth.uid(), 'reward_redeemed', p_reward_id);

  return jsonb_build_object('success', true, 'reward_id', p_reward_id);
end;
$$;

-- ===========================================================================
-- Helper RPC: client search (staff/admin only)
-- ===========================================================================
create or replace function public.search_clients(p_query text)
returns setof public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_q text;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is null or v_caller_role not in ('staff','master_admin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  v_q := '%' || lower(coalesce(p_query, '')) || '%';

  return query
    select * from public.profiles
     where role = 'client'
       and (
         lower(full_name) like v_q
         or lower(coalesce(phone,'')) like v_q
         or lower(coalesce(client_code,'')) like v_q
         or lower(coalesce(id_number,'')) like v_q
       )
     order by full_name
     limit 25;
end;
$$;

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.profiles            enable row level security;
alter table public.loyalty_categories  enable row level security;
alter table public.client_stamps       enable row level security;
alter table public.rewards             enable row level security;
alter table public.stamp_transactions  enable row level security;

-- Tiny helper to read the current user's role from JWT-safe context
create or replace function public.current_role_value()
returns text
language sql stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- profiles ------------------------------------------------------------------
drop policy if exists "profiles self read"        on public.profiles;
drop policy if exists "profiles staff read"       on public.profiles;
drop policy if exists "profiles admin all"        on public.profiles;
drop policy if exists "profiles self update"      on public.profiles;

create policy "profiles self read"   on public.profiles for select
  using (id = auth.uid());

create policy "profiles staff read"  on public.profiles for select
  using (public.current_role_value() in ('staff','master_admin'));

create policy "profiles self update" on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
  -- ^ prevents clients from elevating their own role

create policy "profiles admin all"   on public.profiles for all
  using (public.current_role_value() = 'master_admin')
  with check (public.current_role_value() = 'master_admin');

-- loyalty_categories --------------------------------------------------------
drop policy if exists "cats read all"   on public.loyalty_categories;
drop policy if exists "cats admin all"  on public.loyalty_categories;

create policy "cats read all"  on public.loyalty_categories for select using (true);
create policy "cats admin all" on public.loyalty_categories for all
  using (public.current_role_value() = 'master_admin')
  with check (public.current_role_value() = 'master_admin');

-- client_stamps -------------------------------------------------------------
drop policy if exists "stamps self read"  on public.client_stamps;
drop policy if exists "stamps staff read" on public.client_stamps;
drop policy if exists "stamps admin all"  on public.client_stamps;

create policy "stamps self read"  on public.client_stamps for select
  using (client_id = auth.uid());

create policy "stamps staff read" on public.client_stamps for select
  using (public.current_role_value() in ('staff','master_admin'));

create policy "stamps admin all"  on public.client_stamps for all
  using (public.current_role_value() = 'master_admin')
  with check (public.current_role_value() = 'master_admin');
-- (writes happen through SECURITY DEFINER add_stamp(); no direct INSERT/UPDATE policy needed for staff)

-- rewards -------------------------------------------------------------------
drop policy if exists "rewards self read"  on public.rewards;
drop policy if exists "rewards staff read" on public.rewards;
drop policy if exists "rewards admin all"  on public.rewards;

create policy "rewards self read"  on public.rewards for select
  using (client_id = auth.uid());
create policy "rewards staff read" on public.rewards for select
  using (public.current_role_value() in ('staff','master_admin'));
create policy "rewards admin all"  on public.rewards for all
  using (public.current_role_value() = 'master_admin')
  with check (public.current_role_value() = 'master_admin');

-- stamp_transactions --------------------------------------------------------
drop policy if exists "tx self read"  on public.stamp_transactions;
drop policy if exists "tx staff read" on public.stamp_transactions;
drop policy if exists "tx admin all"  on public.stamp_transactions;

create policy "tx self read"  on public.stamp_transactions for select
  using (client_id = auth.uid());
create policy "tx staff read" on public.stamp_transactions for select
  using (public.current_role_value() in ('staff','master_admin'));
create policy "tx admin all"  on public.stamp_transactions for all
  using (public.current_role_value() = 'master_admin')
  with check (public.current_role_value() = 'master_admin');

-- ===========================================================================
-- Convenience: grant authenticated users execute on our RPCs
-- (Function bodies still enforce role checks internally.)
-- ===========================================================================
grant execute on function public.add_stamp(uuid, uuid)      to authenticated;
grant execute on function public.redeem_reward(uuid)        to authenticated;
grant execute on function public.search_clients(text)       to authenticated;
