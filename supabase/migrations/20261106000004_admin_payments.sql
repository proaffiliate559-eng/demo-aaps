-- ═══════════════════════════════════════════════════════════════════════
-- Phase 5: payments, subscriptions fulfilment, admin analytics & audit log
-- ═══════════════════════════════════════════════════════════════════════

-- ── Payments (one row per Razorpay order) ──────────────────────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  plan_id uuid not null references public.plans (id),
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR',
  status text not null default 'created' check (status in ('created', 'paid', 'failed', 'cancelled')),
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_user_idx on public.payments (user_id, created_at desc);
create index payments_status_idx on public.payments (status, created_at desc);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;
create policy "own payments readable" on public.payments for select to authenticated
  using (user_id = (select auth.uid()));

-- ── Webhook idempotency ────────────────────────────────────────────────
create table public.webhook_events (
  id text primary key,                 -- x-razorpay-event-id
  event text not null,
  received_at timestamptz not null default now()
);
alter table public.webhook_events enable row level security; -- no policies: service role only

-- ── Admin audit log ────────────────────────────────────────────────────
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_user_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
alter table public.admin_audit_log enable row level security; -- service role only

-- One active subscription per user.
create unique index subscriptions_one_active_per_user on public.subscriptions (user_id) where status = 'active';

-- ── Fulfilment: atomic & idempotent ────────────────────────────────────
-- Marks the order paid and grants/extends a 1-month pass. Calling it twice
-- (checkout callback + webhook) is safe: only the first call changes anything.
create or replace function public.fulfil_payment(p_order_id text, p_payment_id text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_pay public.payments%rowtype;
  v_sub public.subscriptions%rowtype;
  v_start timestamptz;
begin
  select * into v_pay from public.payments where razorpay_order_id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_order');
  end if;
  if v_pay.status = 'paid' then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  if v_pay.user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'user_deleted');
  end if;

  update public.payments
     set status = 'paid', razorpay_payment_id = p_payment_id, failure_reason = null
   where id = v_pay.id;

  select * into v_sub from public.subscriptions
   where user_id = v_pay.user_id and status = 'active' for update;

  if found and v_sub.plan_id = v_pay.plan_id and v_sub.expires_at > now() then
    -- Same plan: extend from the current expiry.
    update public.subscriptions set expires_at = v_sub.expires_at + interval '1 month' where id = v_sub.id;
  else
    if found then
      update public.subscriptions set status = 'cancelled' where id = v_sub.id;
    end if;
    v_start := now();
    insert into public.subscriptions (user_id, plan_id, status, started_at, expires_at, payment_reference)
    values (v_pay.user_id, v_pay.plan_id, 'active', v_start, v_start + interval '1 month', p_payment_id);
  end if;

  return jsonb_build_object('ok', true, 'already', false);
end $$;

-- Expire passes whose period has ended (also run from the admin dashboard).
create or replace function public.expire_subscriptions()
returns integer language sql volatile security definer set search_path = '' as $$
  with e as (
    update public.subscriptions set status = 'expired'
     where status = 'active' and expires_at <= now() returning 1
  ) select count(*)::int from e;
$$;

-- ── Admin analytics (service role only) ───────────────────────────────
create or replace function public.admin_overview()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total_users',        (select count(*) from auth.users),
    'new_users_7d',       (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'active_users_7d',    (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'onboarded_users',    (select count(*) from public.profiles where onboarding_completed_at is not null),
    'generations_total',  (select count(*) from public.ai_usage where feature = 'outfit_generation' and status = 'success'),
    'generations_7d',     (select count(*) from public.ai_usage where feature = 'outfit_generation' and status = 'success' and created_at > now() - interval '7 days'),
    'ai_calls_7d',        (select count(*) from public.ai_usage where status <> 'pending' and created_at > now() - interval '7 days'),
    'ai_errors_7d',       (select count(*) from public.ai_usage where status in ('error', 'rate_limited', 'invalid_response') and created_at > now() - interval '7 days'),
    'chat_messages_7d',   (select count(*) from public.ai_usage where feature = 'chat' and status = 'success' and created_at > now() - interval '7 days'),
    'revenue_paise_total',(select coalesce(sum(amount_paise), 0) from public.payments where status = 'paid'),
    'revenue_paise_30d',  (select coalesce(sum(amount_paise), 0) from public.payments where status = 'paid' and updated_at > now() - interval '30 days'),
    'active_subscriptions',(select count(*) from public.subscriptions where status = 'active' and expires_at > now()),
    'open_reports',       (select count(*) from public.content_reports where status = 'open'),
    'saved_looks',        (select count(*) from public.saved_outfits),
    'wardrobe_items',     (select count(*) from public.wardrobe_items)
  );
$$;

-- Daily series for the last p_days days (IST calendar days).
create or replace function public.admin_daily_activity(p_days integer default 14)
returns table (day date, signups bigint, generations bigint, ai_errors bigint)
language sql stable security definer set search_path = '' as $$
  with days as (
    select generate_series(
      (now() at time zone 'Asia/Kolkata')::date - (least(greatest(p_days, 1), 90) - 1),
      (now() at time zone 'Asia/Kolkata')::date, interval '1 day')::date as day
  )
  select d.day,
    (select count(*) from auth.users u where (u.created_at at time zone 'Asia/Kolkata')::date = d.day),
    (select count(*) from public.ai_usage a where a.feature = 'outfit_generation' and a.status = 'success'
        and (a.created_at at time zone 'Asia/Kolkata')::date = d.day),
    (select count(*) from public.ai_usage a where a.status in ('error', 'rate_limited', 'invalid_response')
        and (a.created_at at time zone 'Asia/Kolkata')::date = d.day)
  from days d order by d.day;
$$;

-- Popularity of moods / occasions / styles, counted per generation request.
create or replace function public.admin_outfit_breakdown(p_days integer default 30)
returns table (dimension text, value text, requests bigint)
language sql stable security definer set search_path = '' as $$
  with req as (
    select distinct on (request_id) request_id, mood, occasion, style
      from public.outfits
     where created_at > now() - make_interval(days => least(greatest(p_days, 1), 365))
  )
  select 'mood', mood, count(*) from req group by mood
  union all select 'occasion', occasion, count(*) from req group by occasion
  union all select 'style', style, count(*) from req group by style
  order by 1, 3 desc;
$$;

-- AI usage grouped by feature/provider/status for the last p_days.
create or replace function public.admin_ai_usage(p_days integer default 7)
returns table (feature text, provider text, status text, error_code text, calls bigint)
language sql stable security definer set search_path = '' as $$
  select feature, provider, status, error_code, count(*)
    from public.ai_usage
   where created_at > now() - make_interval(days => least(greatest(p_days, 1), 365)) and status <> 'pending'
   group by 1, 2, 3, 4 order by 5 desc;
$$;

-- User list for admins (joins auth metadata + plan + usage).
create or replace function public.admin_list_users(p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, email text, display_name text, created_at timestamptz, last_sign_in_at timestamptz,
  banned_until timestamptz, onboarded boolean, plan_slug text, generations bigint, is_admin boolean, total_count bigint
)
language sql stable security definer set search_path = '' as $$
  with base as (
    select u.id, u.email::text, p.display_name, u.created_at, u.last_sign_in_at, u.banned_until,
           p.onboarding_completed_at is not null as onboarded
      from auth.users u left join public.profiles p on p.id = u.id
     where p_search is null or p_search = ''
        or u.email ilike '%' || replace(replace(replace(p_search, '\', '\\'), '%', '\%'), '_', '\_') || '%'
        or p.display_name ilike '%' || replace(replace(replace(p_search, '\', '\\'), '%', '\%'), '_', '\_') || '%'
  )
  select b.*,
    coalesce((select pl.slug from public.subscriptions s join public.plans pl on pl.id = s.plan_id
               where s.user_id = b.id and s.status = 'active' and s.expires_at > now() limit 1), 'free'),
    (select count(*) from public.ai_usage a where a.user_id = b.id and a.feature = 'outfit_generation' and a.status = 'success'),
    exists (select 1 from public.user_roles r where r.user_id = b.id and r.role = 'admin'),
    count(*) over ()
  from base b
  order by b.created_at desc
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.fulfil_payment(text, text)', 'public.expire_subscriptions()', 'public.admin_overview()',
    'public.admin_daily_activity(integer)', 'public.admin_outfit_breakdown(integer)',
    'public.admin_ai_usage(integer)', 'public.admin_list_users(text, integer, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- Users may report their own outfits for review (content_reports insert policy
-- already restricts reporter_id); also require they own the outfit.
drop policy "own reports insertable" on public.content_reports;
create policy "own reports insertable" on public.content_reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and (outfit_id is null or exists (select 1 from public.outfits o where o.id = outfit_id and o.user_id = (select auth.uid())))
  );
