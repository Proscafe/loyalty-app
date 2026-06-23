-- Ensure game/free-dessert rewards are not treated as birthday rewards.
-- Keeps true birthday rewards intact when their id starts with birthday- or description mentions birthday.
alter table public.rewards
add column if not exists is_birthday_reward boolean not null default false;

update public.rewards
set is_birthday_reward = false
where reward_type = 'Free Dessert'
  and coalesce(is_birthday_reward, false) = true
  and coalesce(description, '') not ilike '%birthday%'
  and id::text not ilike 'birthday-%';

select pg_notify('pgrst', 'reload schema');
