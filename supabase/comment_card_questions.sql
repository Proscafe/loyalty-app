-- PRO'S Loyalty App
-- Comment Card Question Manager
-- Run once in Supabase SQL Editor.

create table if not exists public.comment_card_questions (
  id uuid primary key default gen_random_uuid(),
  question_key text not null unique,
  question_text text not null,
  question_type text not null check (
    question_type in ('rating', 'select', 'textarea')
  ),
  is_active boolean not null default true,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.comment_card_questions enable row level security;

drop policy if exists "Public can read active comment card questions"
on public.comment_card_questions;

drop policy if exists "Master admins manage comment card questions"
on public.comment_card_questions;

create policy "Public can read active comment card questions"
on public.comment_card_questions
for select
to anon, authenticated
using (is_active = true);

create policy "Master admins manage comment card questions"
on public.comment_card_questions
for all
to authenticated
using (public.is_master_admin())
with check (public.is_master_admin());

create or replace function public.set_comment_card_question_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists comment_card_questions_set_updated_at
on public.comment_card_questions;

create trigger comment_card_questions_set_updated_at
before update on public.comment_card_questions
for each row
execute function public.set_comment_card_question_updated_at();

insert into public.comment_card_questions
  (question_key, question_text, question_type, is_active, is_required, sort_order, options)
values
  ('experience_rating', 'How would you rate your overall experience?', 'rating', true, true, 10, '[]'::jsonb),
  ('food_rating', 'How would you rate the food?', 'rating', true, true, 20, '[]'::jsonb),
  ('service_rating', 'How would you rate the service?', 'rating', true, true, 30, '[]'::jsonb),
  ('cleanliness_rating', 'How would you rate the cleanliness?', 'rating', true, true, 40, '[]'::jsonb),
  ('visit_again_rating', 'How likely are you to visit us again?', 'rating', true, true, 50, '[]'::jsonb),
  (
    'heard_about_us',
    'How did you hear about us?',
    'select',
    true,
    false,
    60,
    '["Instagram","Facebook","TikTok","Google","Friend / Family","Walk-in","Other"]'::jsonb
  ),
  ('comments', 'Anything else you would like to tell us?', 'textarea', true, false, 70, '[]'::jsonb)
on conflict (question_key) do nothing;

grant select on public.comment_card_questions to anon, authenticated;
