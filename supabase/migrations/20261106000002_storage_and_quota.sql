-- ═══════════════════════════════════════════════════════════════════════
-- Phase 3: private storage buckets + atomic generation quota
-- ═══════════════════════════════════════════════════════════════════════

-- ── Storage ────────────────────────────────────────────────────────────
-- user-uploads: photos users upload (style photos, later wardrobe items).
-- outfit-images: AI inspiration images, written by the server only.
-- Objects live under "<user_id>/..." so policies can scope by folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('user-uploads', 'user-uploads', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('outfit-images', 'outfit-images', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "own uploads readable" on storage.objects for select to authenticated
  using (bucket_id in ('user-uploads', 'outfit-images') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own uploads insertable" on storage.objects for insert to authenticated
  with check (bucket_id = 'user-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own uploads deletable" on storage.objects for delete to authenticated
  using (bucket_id = 'user-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ── Usage: allow a short-lived "pending" reservation ───────────────────
alter table public.ai_usage drop constraint ai_usage_status_check;
alter table public.ai_usage add constraint ai_usage_status_check
  check (status in ('pending', 'success', 'error', 'rate_limited', 'invalid_response'));

-- A pending reservation counts against the quota for 5 minutes (crash safety).
create or replace function public.generation_quota(p_user uuid)
returns table (
  plan_slug text, plan_name text, period text, lim integer, used integer,
  period_start timestamptz, resets_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_sub record;
  v_plan record;
  v_start timestamptz;
  v_reset timestamptz;
  v_limit integer;
  v_months integer;
  v_used integer;
begin
  select s.started_at, s.expires_at, p.slug, p.name, p.period, p.generation_limit
    into v_sub
    from public.subscriptions s join public.plans p on p.id = s.plan_id
   where s.user_id = p_user and s.status = 'active' and s.expires_at > now() and s.started_at is not null
   order by s.expires_at desc limit 1;

  if found then
    v_months := (extract(year from age(now(), v_sub.started_at)) * 12 + extract(month from age(now(), v_sub.started_at)))::int;
    v_start := v_sub.started_at + make_interval(months => v_months);
    v_reset := least(v_sub.started_at + make_interval(months => v_months + 1), v_sub.expires_at);
    plan_slug := v_sub.slug; plan_name := v_sub.name; period := v_sub.period; v_limit := v_sub.generation_limit;
  else
    select p.slug, p.name, p.period, p.generation_limit into v_plan from public.plans p where p.slug = 'free';
    -- Admin-configurable free limit overrides the plan default.
    select coalesce((select (value #>> '{}')::int from public.app_settings where key = 'free_daily_generation_limit'),
                    v_plan.generation_limit, 3)
      into v_limit;
    v_start := (date_trunc('day', now() at time zone 'Asia/Kolkata')) at time zone 'Asia/Kolkata';
    v_reset := v_start + interval '1 day';
    plan_slug := coalesce(v_plan.slug, 'free'); plan_name := coalesce(v_plan.name, 'Free'); period := 'day';
  end if;

  select count(*)::int into v_used
    from public.ai_usage u
   where u.user_id = p_user
     and u.feature = 'outfit_generation'
     and u.created_at >= v_start
     and (u.status = 'success' or (u.status = 'pending' and u.created_at > now() - interval '5 minutes'));

  lim := v_limit; used := v_used; period_start := v_start; resets_at := v_reset;
  return next;
end $$;

-- Signed-in users can read their own quota (for display).
create or replace function public.my_generation_quota()
returns table (plan_slug text, plan_name text, period text, lim integer, used integer, period_start timestamptz, resets_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from public.generation_quota((select auth.uid()));
$$;

-- Atomically reserve one generation. Returns the usage row id, or null if
-- the quota is exhausted. Serialised per user with an advisory lock so two
-- concurrent requests can't both take the last credit.
create or replace function public.reserve_generation(p_user uuid, p_provider text)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  q record;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 42));
  select * into q from public.generation_quota(p_user);
  if q.used >= q.lim then
    return null;
  end if;
  insert into public.ai_usage (user_id, provider, feature, status)
  values (p_user, p_provider, 'outfit_generation', 'pending')
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.generation_quota(uuid) from public, anon, authenticated;
revoke all on function public.reserve_generation(uuid, text) from public, anon, authenticated;
grant execute on function public.generation_quota(uuid) to service_role;
grant execute on function public.reserve_generation(uuid, text) to service_role;
revoke all on function public.my_generation_quota() from public, anon;
grant execute on function public.my_generation_quota() to authenticated;

-- Server-side generation needs to mark its own reservation done.
grant update (status, error_code, estimated_cost, provider) on public.ai_usage to service_role;
