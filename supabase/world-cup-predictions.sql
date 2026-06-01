-- World Cup predictions system
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.prediction_matches (
  id uuid primary key default gen_random_uuid(),
  home_team text not null,
  away_team text not null,
  match_label text,
  kickoff_at timestamptz not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  secret_code text not null unique,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prediction_entries (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.prediction_matches(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  home_score integer not null check (home_score >= 0 and home_score <= 99),
  away_score integer not null check (away_score >= 0 and away_score <= 99),
  created_at timestamptz not null default now(),
  unique (match_id, client_id)
);

create index if not exists prediction_matches_secret_code_idx
on public.prediction_matches (secret_code);

create index if not exists prediction_matches_kickoff_at_idx
on public.prediction_matches (kickoff_at desc);

create index if not exists prediction_entries_match_id_idx
on public.prediction_entries (match_id);

create index if not exists prediction_entries_client_id_idx
on public.prediction_entries (client_id);
