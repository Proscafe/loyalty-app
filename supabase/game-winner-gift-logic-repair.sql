-- Fix game prediction gift records so Free Dessert gifts are normal gifts, not birthday gifts.
-- Also keeps duplicate blocking scoped to the same match only.

alter table public.rewards add column if not exists source text null;
alter table public.rewards add column if not exists source_match_id uuid null;
alter table public.rewards add column if not exists source_label text null;
alter table public.rewards add column if not exists reward_note text null;
alter table public.rewards add column if not exists reward_name text null;
alter table public.rewards add column if not exists title text null;
alter table public.rewards add column if not exists description text null;
alter table public.rewards add column if not exists gift_type text null;
alter table public.rewards add column if not exists reward_icon text null;
alter table public.rewards add column if not exists reward_status text null;
alter table public.rewards add column if not exists earned_at timestamptz null;
alter table public.rewards add column if not exists expires_at timestamptz null;
alter table public.rewards add column if not exists is_birthday boolean not null default false;
alter table public.rewards add column if not exists birthday_reward boolean not null default false;

create table if not exists public.prediction_match_gifts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null,
  client_id uuid not null,
  reward_id uuid null references public.rewards(id) on delete set null,
  gift_type text not null default 'Free Dessert',
  created_at timestamptz not null default now()
);

alter table public.prediction_match_gifts add column if not exists match_id uuid;
alter table public.prediction_match_gifts add column if not exists client_id uuid;
alter table public.prediction_match_gifts add column if not exists reward_id uuid null references public.rewards(id) on delete set null;
alter table public.prediction_match_gifts add column if not exists gift_type text not null default 'Free Dessert';
alter table public.prediction_match_gifts add column if not exists created_at timestamptz not null default now();

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
drop index if exists public.prediction_match_gifts_unique_idx;

create unique index if not exists prediction_match_gifts_match_client_type_unique_idx
on public.prediction_match_gifts(match_id, client_id, gift_type);

create index if not exists rewards_client_created_idx on public.rewards(client_id, created_at desc);
create index if not exists rewards_source_match_idx on public.rewards(source_match_id);

-- Normalize old game prediction Free Dessert rewards so client UI shows a gift icon, not birthday/cake.
update public.rewards
set gift_type = coalesce(nullif(gift_type, ''), 'gift'),
    reward_icon = 'gift',
    is_birthday = false,
    birthday_reward = false,
    reward_status = coalesce(reward_status, status, 'available'),
    reward_name = coalesce(reward_name, reward_type, title, 'Free Dessert'),
    title = coalesce(title, reward_name, reward_type, 'Free Dessert'),
    description = coalesce(description, reward_note, 'Winner in Football Prediction')
where source = 'game_prediction'
   or source_match_id is not null;

select pg_notify('pgrst', 'reload schema');
