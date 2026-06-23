alter table public.rewards
add column if not exists claim_alert_sent_at timestamptz null;

create index if not exists rewards_claim_alert_sent_at_idx
on public.rewards(claim_alert_sent_at);

create index if not exists rewards_status_claim_alert_idx
on public.rewards(status, claim_alert_sent_at);

select pg_notify('pgrst', 'reload schema');
