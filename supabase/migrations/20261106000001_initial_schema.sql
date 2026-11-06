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
