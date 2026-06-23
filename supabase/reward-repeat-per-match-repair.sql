-- Allow the same client to receive the same reward again from different matches.
-- Duplicate blocking should happen only for the same client + same match + same gift.

alter table public.rewards
add column if not exists source text null;

alter table public.rewards
add column if not exists source_match_id uuid null;

alter table public.rewards
add column if not exists source_label text null;

alter table public.rewards
add column if not exists reward_note text null;

create table if not exists public.prediction_match_gifts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null,
  client_id uuid not null,
  reward_id uuid null references public.rewards(id) on delete set null,
  gift_type text not null default 'Free Dessert',
  created_at timestamptz not null default now()
);

alter table public.prediction_match_gifts
add column if not exists match_id uuid;

alter table public.prediction_match_gifts
add column if not exists client_id uuid;

alter table public.prediction_match_gifts
add column if not exists reward_id uuid null references public.rewards(id) on delete set null;

alter table public.prediction_match_gifts
add column if not exists gift_type text not null default 'Free Dessert';

alter table public.prediction_match_gifts
add column if not exists created_at timestamptz not null default now();

-- Remove old unique constraints/indexes that incorrectly allow only one Free Dessert per client forever.
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.rewards'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%client_id%'
      and pg_get_constraintdef(oid) ilike '%reward_type%'
  loop
    execute format('alter table public.rewards drop constraint %I', r.conname);
  end loop;
end $$;

drop index if exists public.rewards_client_id_reward_type_key;
drop index if exists public.rewards_client_reward_type_key;
drop index if exists public.rewards_unique_client_reward_type;
drop index if exists public.rewards_client_id_reward_type_idx;

-- Only one gift of the same type per client per match.
drop index if exists public.prediction_match_gifts_unique_idx;
create unique index if not exists prediction_match_gifts_match_client_type_unique_idx
on public.prediction_match_gifts(match_id, client_id, gift_type);

create index if not exists rewards_client_created_idx
on public.rewards(client_id, created_at desc);

create index if not exists rewards_source_match_idx
on public.rewards(source_match_id);

select pg_notify('pgrst', 'reload schema');
