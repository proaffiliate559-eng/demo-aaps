-- StyleMood AI — complete database setup (all migrations, in order).
-- Paste this whole file into Supabase → SQL Editor → New query → Run. Run it ONCE on a new project.

-- ════════ 20261106000001_initial_schema.sql ════════
-- ═══════════════════════════════════════════════════════════════════════
-- StyleMood AI — initial schema
-- All user data is protected by Row Level Security: users can only see
-- and change their own rows. Privileged writes (usage, subscriptions,
-- roles, settings) are done by the server with the service role.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Helpers ────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── Roles (admins live here, never in profiles) ───────────────────────
create type public.app_role as enum ('admin');

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles r where r.user_id = uid and r.role = 'admin');
$$;

-- ── Profiles ───────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 50),
  email text,
  gender_preference text check (gender_preference in ('menswear', 'womenswear', 'gender_neutral', 'prefer_not_to_say')),
  age_group text check (age_group in ('under_18', '18_24', '25_34', '35_44', '45_54', '55_plus')),
  country text not null default 'India' check (char_length(country) <= 56),
  language text not null default 'en' check (language in ('en', 'hi')),
  preferred_styles jsonb not null default '[]'::jsonb check (jsonb_typeof(preferred_styles) = 'array'),
  favourite_colours jsonb not null default '[]'::jsonb check (jsonb_typeof(favourite_colours) = 'array'),
  budget_min integer check (budget_min >= 0),
  budget_max integer check (budget_max is null or budget_max >= coalesce(budget_min, 0)),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── User preferences ───────────────────────────────────────────────────
create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  preferred_occasions jsonb not null default '[]'::jsonb check (jsonb_typeof(preferred_occasions) = 'array'),
  preferred_fit text check (preferred_fit in ('slim', 'regular', 'relaxed', 'oversized')),
  preferred_sizes jsonb not null default '{}'::jsonb check (jsonb_typeof(preferred_sizes) = 'object'),
  height_range text check (height_range in ('under_150', '150_160', '160_170', '170_180', '180_190', 'over_190')),
  modesty_preference text check (modesty_preference in ('no_preference', 'standard', 'more_coverage', 'full_coverage')),
  weather_preference text check (weather_preference in ('hot', 'cold', 'rainy', 'pleasant')),
  additional_preferences text check (char_length(additional_preferences) <= 500),
  updated_at timestamptz not null default now()
);
create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- ── Plans & subscriptions ──────────────────────────────────────────────
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  price integer not null check (price >= 0),          -- whole rupees
  period text not null check (period in ('day', 'month')),
  generation_limit integer not null check (generation_limit >= 0),
  saved_limit integer,                                  -- null = unlimited
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status text not null check (status in ('pending', 'active', 'cancelled', 'expired', 'failed')),
  started_at timestamptz,
  expires_at timestamptz,
  payment_reference text unique,
  created_at timestamptz not null default now()
);
create index subscriptions_user_status_idx on public.subscriptions (user_id, status);

-- ── Outfits ────────────────────────────────────────────────────────────
create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null,                             -- groups the 3 looks of one request
  tier text not null check (tier in ('safe', 'trendy', 'bold')),
  name text not null check (char_length(name) <= 120),
  mood text not null,
  occasion text not null,
  style text not null,
  weather text,
  description text,
  outfit_data jsonb not null,
  generated_image_path text,
  estimated_budget integer check (estimated_budget >= 0),
  provider text not null,
  is_mock boolean not null default false,               -- true = dev mock output, never real AI
  created_at timestamptz not null default now()
);
create index outfits_user_created_idx on public.outfits (user_id, created_at desc);
create index outfits_request_idx on public.outfits (request_id);

create table public.saved_outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, outfit_id)
);
create index saved_outfits_user_idx on public.saved_outfits (user_id, created_at desc);

create table public.outfit_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  feedback text check (char_length(feedback) <= 1000),
  created_at timestamptz not null default now(),
  unique (user_id, outfit_id)
);

-- ── Wardrobe ───────────────────────────────────────────────────────────
create table public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  category text not null check (category in ('shirts', 't_shirts', 'trousers', 'jeans', 'jackets', 'dresses', 'skirts', 'shoes', 'accessories', 'traditional')),
  colour text check (char_length(colour) <= 30),
  image_path text,
  brand text check (char_length(brand) <= 60),
  season text check (season in ('all', 'summer', 'winter', 'monsoon')),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);
create index wardrobe_items_user_idx on public.wardrobe_items (user_id, category);

-- ── AI usage (written by the server only) ──────────────────────────────
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  provider text not null,
  feature text not null check (feature in ('outfit_generation', 'image_generation', 'chat', 'image_analysis')),
  status text not null check (status in ('success', 'error', 'rate_limited', 'invalid_response')),
  error_code text,
  estimated_cost numeric(10, 4) not null default 0,
  created_at timestamptz not null default now()
);
create index ai_usage_user_feature_idx on public.ai_usage (user_id, feature, created_at desc);
create index ai_usage_created_idx on public.ai_usage (created_at desc);

-- ── Stylist chat ───────────────────────────────────────────────────────
create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) <= 120),
  created_at timestamptz not null default now()
);
create index chat_conversations_user_idx on public.chat_conversations (user_id, created_at desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 8000),
  created_at timestamptz not null default now()
);
create index chat_messages_conversation_idx on public.chat_messages (conversation_id, created_at);

-- ── Moderation & app settings (admin) ──────────────────────────────────
create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null,
  outfit_id uuid references public.outfits (id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════
-- New-user bootstrap
-- ═══════════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', '')), '');
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, left(name, 50));
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in sync when the auth email changes.
create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- ═══════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════════════
alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.outfits enable row level security;
alter table public.saved_outfits enable row level security;
alter table public.outfit_feedback enable row level security;
alter table public.wardrobe_items enable row level security;
alter table public.ai_usage enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.content_reports enable row level security;
alter table public.app_settings enable row level security;

-- Roles: users may see their own roles; nobody but the service role writes.
create policy "own roles readable" on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));

-- Profiles: read/update own row only. Email and onboarding timestamps are
-- further restricted with column privileges below.
create policy "own profile readable" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "own profile updatable" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "own preferences readable" on public.user_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own preferences updatable" on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Plans are public reference data.
create policy "active plans readable" on public.plans for select to anon, authenticated
  using (is_active);

create policy "own subscriptions readable" on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

-- Outfits: users read/delete their own. Inserts happen server-side after
-- AI validation and usage checks (service role), so no insert policy.
create policy "own outfits readable" on public.outfits for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own outfits deletable" on public.outfits for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "own saved readable" on public.saved_outfits for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own saved insertable" on public.saved_outfits for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.outfits o where o.id = outfit_id and o.user_id = (select auth.uid()))
  );
create policy "own saved deletable" on public.saved_outfits for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "own feedback readable" on public.outfit_feedback for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own feedback insertable" on public.outfit_feedback for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.outfits o where o.id = outfit_id and o.user_id = (select auth.uid()))
  );
create policy "own feedback updatable" on public.outfit_feedback for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own wardrobe readable" on public.wardrobe_items for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own wardrobe insertable" on public.wardrobe_items for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own wardrobe updatable" on public.wardrobe_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own wardrobe deletable" on public.wardrobe_items for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "own usage readable" on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

create policy "own conversations readable" on public.chat_conversations for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own conversations insertable" on public.chat_conversations for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own conversations updatable" on public.chat_conversations for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own conversations deletable" on public.chat_conversations for delete to authenticated
  using (user_id = (select auth.uid()));

-- Messages: readable through conversation ownership. Written server-side.
create policy "own messages readable" on public.chat_messages for select to authenticated
  using (exists (
    select 1 from public.chat_conversations c
    where c.id = conversation_id and c.user_id = (select auth.uid())
  ));

create policy "own reports insertable" on public.content_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

create policy "settings readable" on public.app_settings for select to authenticated using (true);

-- ── Column-level privileges ────────────────────────────────────────────
-- Users may edit their profile fields but not email/id/timestamps directly.
revoke update on public.profiles from authenticated, anon;
grant update (display_name, gender_preference, age_group, country, language, preferred_styles,
              favourite_colours, budget_min, budget_max, onboarding_completed_at)
  on public.profiles to authenticated;

revoke update on public.user_preferences from authenticated, anon;
grant update (preferred_occasions, preferred_fit, preferred_sizes, height_range, modesty_preference,
              weather_preference, additional_preferences)
  on public.user_preferences to authenticated;

-- Anonymous users get nothing except active plans.
revoke all on all tables in schema public from anon;
grant select on public.plans to anon;

-- ═══════════════════════════════════════════════════════════════════════
-- Reference data
-- ═══════════════════════════════════════════════════════════════════════
insert into public.plans (slug, name, price, period, generation_limit, saved_limit, features, sort_order) values
  ('free', 'Free', 0, 'day', 3, 10,
   '["3 outfit generations per day","Basic recommendations","Save up to 10 looks","AI stylist chat (limited)"]', 0),
  ('basic', 'Basic', 99, 'month', 30, 100,
   '["30 generations per month","Save up to 100 looks","Additional styling suggestions","Digital wardrobe"]', 1),
  ('pro', 'Pro', 199, 'month', 100, null,
   '["100 generations per month","Advanced styling & personalisation","Outfit inspiration images","Priority generation"]', 2),
  ('premium', 'Premium', 299, 'month', 300, null,
   '["300 generations per month","Everything in Pro","Premium styling tools","Early access to virtual try-on"]', 3)
on conflict (slug) do nothing;

insert into public.app_settings (key, value) values
  ('free_daily_generation_limit', '3'),
  ('features', '{"image_generation": false, "stylist_chat": true, "wardrobe": true}')
on conflict (key) do nothing;

-- ════════ 20261106000002_storage_and_quota.sql ════════
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

-- ════════ 20261106000003_wardrobe_chat.sql ════════
-- ═══════════════════════════════════════════════════════════════════════
-- Phase 4: wardrobe & stylist chat refinements
-- ═══════════════════════════════════════════════════════════════════════

-- Wardrobe items get an updated_at for "recently edited" ordering.
alter table public.wardrobe_items add column updated_at timestamptz not null default now();
create trigger wardrobe_items_updated_at before update on public.wardrobe_items
  for each row execute function public.set_updated_at();
create index wardrobe_items_user_created_idx on public.wardrobe_items (user_id, created_at desc);

-- Conversations are ordered by latest activity.
alter table public.chat_conversations add column updated_at timestamptz not null default now();
create index chat_conversations_user_updated_idx on public.chat_conversations (user_id, updated_at desc);

-- Messages are written by the server (after validation, usage limits and the
-- AI call). Users can only read them, and only in their own conversations.
-- Users may not edit conversations except via delete.
drop policy "own conversations updatable" on public.chat_conversations;
drop policy "own conversations insertable" on public.chat_conversations;

-- Users may only set an image path inside their own wardrobe folder.
alter table public.wardrobe_items add constraint wardrobe_image_path_owner
  check (image_path is null or image_path like (user_id::text || '/wardrobe/%'));

-- ════════ 20261106000004_admin_payments.sql ════════
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

-- ════════ 20261106000005_security_hardening.sql ════════
-- ═══════════════════════════════════════════════════════════════════════
-- Phase 6: security hardening (defence in depth on top of RLS)
-- ═══════════════════════════════════════════════════════════════════════

-- 1. is_admin(uid) could be called by anyone for any uid (admin enumeration).
--    Keep it for server use only; signed-in users can only ask about themselves.
revoke all on function public.is_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_admin(uuid) to service_role;

create or replace function public.am_i_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin');
$$;
revoke all on function public.am_i_admin() from public, anon;
grant execute on function public.am_i_admin() to authenticated;

-- 2. Trigger functions are never called directly.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_user_email_change() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- 3. Server-only tables: remove table privileges (RLS already denies access).
revoke all on public.payments, public.webhook_events, public.admin_audit_log from anon;
revoke all on public.webhook_events, public.admin_audit_log from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.payments from authenticated;
grant select on public.payments to authenticated; -- still limited to own rows by RLS

-- Writes that only the server performs (AI output, usage, subscriptions, roles, settings).
revoke insert, update, delete, truncate on public.outfits, public.ai_usage, public.subscriptions,
  public.user_roles, public.app_settings, public.plans, public.chat_messages from authenticated;
grant delete on public.outfits to authenticated; -- users may delete their own outfits (RLS)
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Future tables don't get automatic anon access.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- 4. Upload rate limiting: uploads by this user in the last hour.
create or replace function public.recent_upload_count(p_user uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::int from storage.objects
   where bucket_id = 'user-uploads' and owner = p_user and created_at > now() - interval '1 hour';
$$;
revoke all on function public.recent_upload_count(uuid) from public, anon, authenticated;
grant execute on function public.recent_upload_count(uuid) to service_role;

-- 5. Index used by admin daily activity & usage queries.
create index if not exists ai_usage_feature_status_created_idx on public.ai_usage (feature, status, created_at desc);

