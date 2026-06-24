-- Repair columns used by the stamp completion reward flow.
alter table public.stamp_transactions add column if not exists client_id uuid null;
alter table public.stamp_transactions add column if not exists profile_id uuid null;
alter table public.stamp_transactions add column if not exists category_id uuid null;
alter table public.stamp_transactions add column if not exists category text null;
alter table public.stamp_transactions add column if not exists action text null;
alter table public.stamp_transactions add column if not exists action_type text null;
alter table public.stamp_transactions add column if not exists amount integer not null default 1;
alter table public.stamp_transactions add column if not exists stamp_count integer null;
alter table public.stamp_transactions add column if not exists stamp_count_before integer null;
alter table public.stamp_transactions add column if not exists stamp_count_after integer null;
alter table public.stamp_transactions add column if not exists reward_id uuid null;
alter table public.stamp_transactions add column if not exists staff_id uuid null;
alter table public.stamp_transactions add column if not exists note text null;
alter table public.stamp_transactions add column if not exists created_at timestamptz not null default now();

alter table public.rewards add column if not exists client_id uuid null;
alter table public.rewards add column if not exists profile_id uuid null;
alter table public.rewards add column if not exists category_id uuid null;
alter table public.rewards add column if not exists title text null;
alter table public.rewards add column if not exists reward_name text null;
alter table public.rewards add column if not exists reward_type text null;
alter table public.rewards add column if not exists reward_label text null;
alter table public.rewards add column if not exists gift_type text null;
alter table public.rewards add column if not exists description text null;
alter table public.rewards add column if not exists status text not null default 'available';
alter table public.rewards add column if not exists reward_status text null;
alter table public.rewards add column if not exists earned_at timestamptz null;
alter table public.rewards add column if not exists created_at timestamptz not null default now();
alter table public.rewards add column if not exists expires_at timestamptz null;
alter table public.rewards add column if not exists expiry_date timestamptz null;
alter table public.rewards add column if not exists valid_until timestamptz null;
alter table public.rewards add column if not exists source text null;
alter table public.rewards add column if not exists source_label text null;

update public.rewards
set reward_status = status
where reward_status is null and status is not null;

select pg_notify('pgrst', 'reload schema');
