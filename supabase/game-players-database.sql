-- PRO's Cafe - Games Players Database
-- Run this in Supabase SQL Editor.
-- It creates a reusable database table with all users who played in the Games tab.

create extension if not exists pgcrypto;

create table if not exists public.game_players_database (
  id uuid primary key default gen_random_uuid(),
  client_id uuid null,
  full_name text null,
  phone text null,
  email text null,
  games_played integer not null default 0,
  predictions_count integer not null default 0,
  gifts_sent integer not null default 0,
  gifts_claimed integer not null default 0,
  last_game_name text null,
  first_played_at timestamptz null,
  last_played_at timestamptz null,
  returning_player boolean not null default false,
  source text not null default 'games',
  source_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists game_players_database_client_id_idx on public.game_players_database(client_id);
create index if not exists game_players_database_phone_idx on public.game_players_database(phone);
create index if not exists game_players_database_last_played_idx on public.game_players_database(last_played_at desc);

-- Rebuilds the games players database from the current game_predictions table.
-- Expected source: public.game_predictions with client_id, full_name/player_name/name, phone, created_at, game_link_id/match_id.
create or replace function public.refresh_game_players_database()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.game_predictions') is null then
    raise exception 'Missing table public.game_predictions. Upload your GamesPage or tell me the exact game predictions table name.';
  end if;

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
    source_ids,
    updated_at
  )
  with prediction_rows as (
    select
      gp.*,
      coalesce(
        gp.client_id,
        gp.user_id,
        gp.profile_id
      )::uuid as resolved_client_id,
      coalesce(
        nullif(gp.full_name, ''),
        nullif(gp.player_name, ''),
        nullif(gp.client_name, ''),
        nullif(gp.name, '')
      ) as resolved_name,
      coalesce(
        nullif(gp.phone, ''),
        nullif(gp.client_phone, ''),
        nullif(gp.mobile, '')
      ) as resolved_phone,
      coalesce(gp.created_at, gp.submitted_at, gp.updated_at, now()) as resolved_played_at,
      coalesce(gp.game_link_id, gp.match_id, gp.game_id)::text as resolved_game_id
    from public.game_predictions gp
  ),
  grouped as (
    select
      resolved_client_id as client_id,
      max(resolved_name) filter (where resolved_name is not null) as full_name,
      max(resolved_phone) filter (where resolved_phone is not null) as phone,
      count(distinct resolved_game_id) filter (where resolved_game_id is not null) as games_played,
      count(*) as predictions_count,
      min(resolved_played_at) as first_played_at,
      max(resolved_played_at) as last_played_at,
      jsonb_agg(distinct resolved_game_id) filter (where resolved_game_id is not null) as source_ids
    from prediction_rows
    where resolved_client_id is not null
       or resolved_phone is not null
       or resolved_name is not null
    group by resolved_client_id, coalesce(resolved_phone, resolved_name)
  ),
  gift_rows as (
    select
      coalesce(r.client_id, pmg.client_id)::uuid as client_id,
      count(*) filter (where r.id is not null or pmg.id is not null) as gifts_sent,
      count(*) filter (
        where lower(coalesce(r.status, r.reward_status, '')) in ('claimed', 'redeemed', 'used')
           or r.redeemed_at is not null
      ) as gifts_claimed
    from public.rewards r
    full join public.prediction_match_gifts pmg
      on pmg.reward_id = r.id
    where coalesce(r.source, '') = 'game_prediction'
       or r.source_match_id is not null
       or pmg.id is not null
    group by coalesce(r.client_id, pmg.client_id)
  )
  select
    g.client_id,
    coalesce(nullif(p.full_name, ''), nullif(p.name, ''), g.full_name) as full_name,
    coalesce(nullif(p.phone, ''), nullif(p.mobile, ''), g.phone) as phone,
    p.email,
    greatest(g.games_played, case when g.predictions_count > 0 then 1 else 0 end)::integer as games_played,
    g.predictions_count::integer,
    coalesce(gr.gifts_sent, 0)::integer,
    coalesce(gr.gifts_claimed, 0)::integer,
    null::text as last_game_name,
    g.first_played_at,
    g.last_played_at,
    (g.predictions_count > 1 or g.games_played > 1) as returning_player,
    coalesce(g.source_ids, '[]'::jsonb),
    now()
  from grouped g
  left join public.profiles p on p.id = g.client_id
  left join gift_rows gr on gr.client_id = g.client_id;

  select pg_notify('pgrst', 'reload schema');
end;
$$;


-- After this script finishes successfully, run this separately:
-- select public.refresh_game_players_database();
