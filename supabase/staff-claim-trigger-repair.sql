alter table public.rewards
add column if not exists claim_alert_sent_at timestamptz null;

alter table public.admin_notifications
add column if not exists sent_count integer not null default 0;

create index if not exists rewards_claim_alert_sent_at_idx
on public.rewards(claim_alert_sent_at);

create index if not exists push_subscriptions_audience_idx
on public.push_subscriptions(audience);

create index if not exists push_subscriptions_role_idx
on public.push_subscriptions(role);

select pg_notify('pgrst', 'reload schema');
