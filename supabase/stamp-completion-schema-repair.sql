alter table public.rewards
add column if not exists source text null;

alter table public.rewards
add column if not exists source_label text null;

alter table public.stamp_transactions
add column if not exists stamp_count_before integer null;

alter table public.stamp_transactions
add column if not exists stamp_count_after integer null;

alter table public.stamp_transactions
add column if not exists reward_id uuid null;

select pg_notify('pgrst', 'reload schema');
