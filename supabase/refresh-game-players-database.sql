create or replace function public.refresh_game_players_database()
returns void
language plpgsql
as $$
begin
  truncate table public.game_players_database;

  insert into public.game_players_database (
    client_id,
    full_name,
    phone,
    email,
    games_played,
    predictions_count,
    gifts_sent,
    gifts_claimed,
    last_game_name,
    first_played_at,
    last_played_at,
    returning_player,
    source,
    source_ids,
    updated_at
  )
  select
    pe.client_id,
    coalesce(nullif(p.full_name, ''), 'Unknown player') as full_name,
    p.phone,
    p.email,
    count(distinct pe.match_id)::int as games_played,
    count(pe.id)::int as predictions_count,
    count(distinct pmg.id)::int as gifts_sent,
    count(distinct case
      when r.status in ('redeemed', 'claimed', 'used')
        or r.reward_status in ('redeemed', 'claimed', 'used')
      then r.id
    end)::int as gifts_claimed,
    (
      array_agg(coalesce(pm.match_label, concat(pm.home_team, ' vs ', pm.away_team)) order by pe.created_at desc)
    )[1] as last_game_name,
    min(pe.created_at) as first_played_at,
    max(pe.created_at) as last_played_at,
    (count(distinct pe.match_id) > 1) as returning_player,
    'prediction_entries' as source,
    jsonb_build_object(
      'prediction_entry_ids', jsonb_agg(distinct pe.id),
      'match_ids', jsonb_agg(distinct pe.match_id)
    ) as source_ids,
    now() as updated_at
  from public.prediction_entries pe
  left join public.profiles p on p.id = pe.client_id
  left join public.prediction_matches pm on pm.id = pe.match_id
  left join public.prediction_match_gifts pmg on pmg.client_id = pe.client_id
  left join public.rewards r on r.id = pmg.reward_id
  where pe.client_id is not null
  group by pe.client_id, p.full_name, p.phone, p.email;
end;
$$;

select public.refresh_game_players_database();

select
  full_name,
  phone,
  games_played,
  predictions_count,
  gifts_sent,
  gifts_claimed,
  last_game_name,
  first_played_at,
  last_played_at,
  returning_player
from public.game_players_database
order by games_played desc, last_played_at desc nulls last;
