-- One-time repair: process any loyalty card stuck at 5/5 or higher.
-- It creates one available reward for the stuck full card, logs reward_earned,
-- then resets the stamp count to 0.

with stuck_cards as (
  select
    cs.client_id,
    cs.category_id,
    cs.stamp_count,
    coalesce(c.name, c.title, 'Reward') as category_name
  from public.client_stamps cs
  left join public.loyalty_categories c on c.id = cs.category_id
  where cs.stamp_count >= 5
), inserted_rewards as (
  insert into public.rewards (
    client_id,
    category_id,
    reward_type,
    status,
    earned_at,
    expires_at,
    source,
    source_label,
    created_at
  )
  select
    client_id,
    category_id,
    'Free ' || category_name,
    'available',
    now(),
    now() + interval '30 days',
    'loyalty_card',
    category_name,
    now()
  from stuck_cards
  returning id, client_id, category_id
), reward_logs as (
  insert into public.stamp_transactions (
    client_id,
    category_id,
    action_type,
    stamp_count,
    stamp_count_before,
    stamp_count_after,
    reward_id,
    created_at
  )
  select
    r.client_id,
    r.category_id,
    'reward_earned',
    5,
    5,
    0,
    r.id,
    now()
  from inserted_rewards r
  returning id
)
update public.client_stamps cs
set stamp_count = 0,
    updated_at = now()
from stuck_cards sc
where cs.client_id = sc.client_id
  and cs.category_id = sc.category_id;

select pg_notify('pgrst', 'reload schema');
