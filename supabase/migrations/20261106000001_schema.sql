-- CafeRepeat AI — core schema
-- Every business table carries tenant_id. Balances only change through the
-- functions in 20261106000003_loyalty_functions.sql, which write a ledger row
-- for every change.

create extension if not exists pgcrypto;

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('owner', 'manager', 'cashier', 'marketing');
create type public.tenant_status as enum ('trial', 'active', 'past_due', 'suspended', 'cancelled');
create type public.txn_kind as enum (
  'earn_points', 'redeem_points',
  'earn_stamps', 'redeem_stamps',
  'earn_cashback', 'redeem_cashback',
  'signup_bonus', 'referral_bonus', 'birthday_bonus',
  'adjustment', 'expiry', 'refund'
);
create type public.reward_type as enum ('free_item', 'percent_discount', 'fixed_discount');
create type public.reward_cost_type as enum ('points', 'stamps', 'cashback');
create type public.redemption_status as enum ('pending', 'fulfilled', 'cancelled', 'expired');
create type public.discount_type as enum ('percent', 'fixed', 'free_item');
create type public.consent_channel as enum ('whatsapp', 'sms', 'email');
create type public.qr_kind as enum ('branch', 'registration', 'loyalty_card', 'campaign', 'table');
create type public.campaign_type as enum (
  'welcome', 'birthday', 'thank_you', 'reward_earned', 'coupon_expiry',
  'win_back', 'promotion', 'feedback'
);
create type public.campaign_status as enum ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled', 'failed');
create type public.message_status as enum ('queued', 'sent', 'delivered', 'read', 'failed', 'skipped');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled', 'expired');
create type public.payment_status as enum ('created', 'authorized', 'captured', 'failed', 'refunded');
create type public.ticket_status as enum ('open', 'pending', 'resolved', 'closed');

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Platform: plans, tenants, users
-- ---------------------------------------------------------------------------
create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_monthly_inr numeric(10,2),              -- null = custom pricing
  is_public boolean not null default true,
  limits jsonb not null default '{}'::jsonb,    -- e.g. {"branches":1,"customers":1000,"whatsapp_per_month":0}
  features jsonb not null default '[]'::jsonb,  -- e.g. ["stamps","points","whatsapp","ai"]
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$'),
  status public.tenant_status not null default 'trial',
  logo_url text,
  brand_color text not null default '#0E4D3A' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  timezone text not null default 'Asia/Kolkata',
  currency text not null default 'INR',
  contact_phone text,
  contact_email text,
  owner_user_id uuid references auth.users(id) on delete set null,
  trial_ends_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  address text,
  city text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);
create index branches_tenant_idx on public.branches (tenant_id);

-- Profile row for every staff / platform user (customers live in public.customers).
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index user_roles_user_idx on public.user_roles (user_id);

-- Branch assignment for staff. branch_id null = all branches.
create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  branch_id uuid references public.branches(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index staff_members_tenant_idx on public.staff_members (tenant_id);
create index staff_members_user_idx on public.staff_members (user_id);

-- ---------------------------------------------------------------------------
-- QR codes (branch / registration / table / campaign) and scan tracking
-- ---------------------------------------------------------------------------
create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  kind public.qr_kind not null,
  code text not null unique check (code ~ '^[A-Za-z0-9]{6,16}$'),  -- short id used in /q/<code>
  label text not null,
  campaign_id uuid,                                            -- FK added after campaigns table
  scan_count int not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index qr_codes_tenant_idx on public.qr_codes (tenant_id);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  name text check (name is null or length(name) between 1 and 120),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  birthday date,
  referral_code text not null,
  referred_by uuid references public.customers(id) on delete set null,
  registered_branch_id uuid references public.branches(id) on delete set null,
  source_qr_id uuid references public.qr_codes(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'blocked')),
  total_visits int not null default 0,
  total_spent numeric(12,2) not null default 0,
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, phone),
  unique (tenant_id, referral_code),
  unique (tenant_id, auth_user_id)
);
create index customers_tenant_last_visit_idx on public.customers (tenant_id, last_visit_at desc);
create index customers_auth_user_idx on public.customers (auth_user_id);
create index customers_tenant_birthday_idx on public.customers (tenant_id, (extract(month from birthday)), (extract(day from birthday)));

-- Append-only consent log; the latest row per (customer, channel) is the current state.
create table public.customer_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  channel public.consent_channel not null,
  granted boolean not null,
  source text not null,                 -- 'registration', 'profile', 'whatsapp_stop', 'staff'
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_consents_lookup_idx on public.customer_consents (customer_id, channel, created_at desc);

create table public.qr_scans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  qr_code_id uuid not null references public.qr_codes(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index qr_scans_qr_idx on public.qr_scans (qr_code_id, created_at desc);
create index qr_scans_tenant_idx on public.qr_scans (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Loyalty configuration
-- ---------------------------------------------------------------------------
create table public.loyalty_programs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null default 'Rewards',
  is_active boolean not null default true,
  points_enabled boolean not null default true,
  stamps_enabled boolean not null default true,
  cashback_enabled boolean not null default false,
  signup_bonus_points int not null default 0 check (signup_bonus_points >= 0),
  referral_referrer_points int not null default 0 check (referral_referrer_points >= 0),
  referral_referee_points int not null default 0 check (referral_referee_points >= 0),
  birthday_points int not null default 0 check (birthday_points >= 0),
  points_expiry_days int check (points_expiry_days is null or points_expiry_days > 0),  -- expire after N days without a visit
  redemption_valid_minutes int not null default 30 check (redemption_valid_minutes between 5 and 10080),
  max_redemptions_per_day int not null default 3 check (max_redemptions_per_day > 0),
  duplicate_window_seconds int not null default 120 check (duplicate_window_seconds >= 0),
  tiers jsonb not null default '[
    {"key":"silver","name":"Silver","min_points":0,"multiplier":1},
    {"key":"gold","name":"Gold","min_points":500,"multiplier":1.25},
    {"key":"platinum","name":"Platinum","min_points":1500,"multiplier":1.5}
  ]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index loyalty_programs_one_active on public.loyalty_programs (tenant_id) where is_active;

-- One default rule set per program (branch_id null) plus optional branch overrides.
create table public.loyalty_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  program_id uuid not null references public.loyalty_programs(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  points_per_100 numeric(8,2) not null default 10 check (points_per_100 >= 0),
  max_points_per_txn int check (max_points_per_txn is null or max_points_per_txn > 0),
  stamps_per_visit int not null default 1 check (stamps_per_visit >= 0),
  stamp_item_keyword text,              -- e.g. 'coffee': 1 stamp per qualifying item instead of per visit
  cashback_percent numeric(5,2) not null default 0 check (cashback_percent between 0 and 100),
  max_cashback_per_txn numeric(10,2) check (max_cashback_per_txn is null or max_cashback_per_txn >= 0),
  min_purchase_amount numeric(10,2) not null default 0 check (min_purchase_amount >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index loyalty_rules_one_default on public.loyalty_rules (program_id) where branch_id is null and is_active;
create unique index loyalty_rules_one_per_branch on public.loyalty_rules (program_id, branch_id) where branch_id is not null and is_active;
create index loyalty_rules_tenant_idx on public.loyalty_rules (tenant_id);

create table public.loyalty_wallets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  points_balance int not null default 0 check (points_balance >= 0),
  stamps_balance int not null default 0 check (stamps_balance >= 0),
  cashback_balance numeric(12,2) not null default 0 check (cashback_balance >= 0),
  lifetime_points int not null default 0 check (lifetime_points >= 0),
  tier text not null default 'silver',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index loyalty_wallets_tenant_idx on public.loyalty_wallets (tenant_id);

-- ---------------------------------------------------------------------------
-- Rewards & coupons
-- ---------------------------------------------------------------------------
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,   -- null = all branches
  name text not null check (length(name) between 2 and 120),
  description text,
  reward_type public.reward_type not null default 'free_item',
  cost_type public.reward_cost_type not null default 'points',
  cost_value numeric(10,2) not null check (cost_value > 0),
  discount_value numeric(10,2) check (discount_value is null or discount_value > 0),
  min_purchase_amount numeric(10,2) not null default 0,
  max_per_customer int check (max_per_customer is null or max_per_customer > 0),
  stock int check (stock is null or stock >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reward_type = 'free_item' or discount_value is not null),
  check (reward_type <> 'percent_discount' or discount_value <= 100)
);
create index rewards_tenant_idx on public.rewards (tenant_id, is_active);

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9]{8}$'),
  status public.redemption_status not null default 'pending',
  cost_type public.reward_cost_type not null,
  cost_value numeric(10,2) not null,
  expires_at timestamptz not null,
  fulfilled_at timestamptz,
  fulfilled_by uuid references public.users(id) on delete set null,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);
create index reward_redemptions_customer_idx on public.reward_redemptions (customer_id, created_at desc);
create index reward_redemptions_pending_idx on public.reward_redemptions (expires_at) where status = 'pending';

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,  -- personal coupon when set
  campaign_id uuid,
  code text not null check (code ~ '^[A-Z0-9-]{4,24}$'),
  name text not null,
  discount_type public.discount_type not null,
  discount_value numeric(10,2) not null check (discount_value >= 0),
  min_purchase_amount numeric(10,2) not null default 0,
  max_discount_amount numeric(10,2),
  usage_limit int check (usage_limit is null or usage_limit > 0),
  per_customer_limit int not null default 1 check (per_customer_limit > 0),
  used_count int not null default 0,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);
create index coupons_customer_idx on public.coupons (customer_id) where customer_id is not null;

-- ---------------------------------------------------------------------------
-- Purchases, visits, ledger
-- ---------------------------------------------------------------------------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  items jsonb not null default '[]'::jsonb,       -- [{name, qty, price, category}]
  bill_ref text,                                  -- POS bill number; unique per branch
  coupon_id uuid references public.coupons(id) on delete set null,
  discount_amount numeric(12,2) not null default 0,
  cashback_used numeric(12,2) not null default 0,
  idempotency_key text not null,
  recorded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);
create unique index purchases_bill_ref_unique on public.purchases (tenant_id, branch_id, bill_ref) where bill_ref is not null;
create index purchases_customer_idx on public.purchases (customer_id, created_at desc);
create index purchases_tenant_created_idx on public.purchases (tenant_id, created_at desc);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  purchase_id uuid references public.purchases(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  discount_amount numeric(12,2) not null default 0,
  redeemed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coupon_id, purchase_id)
);
create index coupon_redemptions_coupon_customer_idx on public.coupon_redemptions (coupon_id, customer_id);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete cascade,
  purchase_id uuid unique references public.purchases(id) on delete set null,
  source text not null default 'purchase' check (source in ('purchase', 'checkin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index visits_tenant_created_idx on public.visits (tenant_id, created_at desc);
create index visits_customer_idx on public.visits (customer_id, created_at desc);

create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete cascade,
  wallet_id uuid not null references public.loyalty_wallets(id) on delete cascade,
  kind public.txn_kind not null,
  points_delta int not null default 0,
  stamps_delta int not null default 0,
  cashback_delta numeric(12,2) not null default 0,
  points_after int not null,
  stamps_after int not null,
  cashback_after numeric(12,2) not null,
  purchase_id uuid references public.purchases(id) on delete set null,
  redemption_id uuid references public.reward_redemptions(id) on delete set null,
  idempotency_key text not null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key),
  check (points_delta <> 0 or stamps_delta <> 0 or cashback_delta <> 0)
);
create index loyalty_transactions_customer_idx on public.loyalty_transactions (customer_id, created_at desc);
create index loyalty_transactions_tenant_idx on public.loyalty_transactions (tenant_id, created_at desc);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  referrer_id uuid not null references public.customers(id) on delete cascade,
  referee_id uuid not null unique references public.customers(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'completed', 'rejected')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (referrer_id <> referee_id)
);
create index referrals_referrer_idx on public.referrals (referrer_id);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  comment text check (comment is null or length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, visit_id)
);
create index feedback_tenant_idx on public.feedback (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Campaigns & WhatsApp (used from Milestone 3/4; created now so the schema is complete)
-- ---------------------------------------------------------------------------
create table public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (name ~ '^[a-z0-9_]{1,512}$'),
  language text not null default 'en',
  category text not null default 'MARKETING' check (category in ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
  body text not null,
  variables jsonb not null default '[]'::jsonb,
  meta_template_id text,
  meta_status text not null default 'draft' check (meta_status in ('draft', 'pending', 'approved', 'rejected', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name, language)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  name text not null,
  type public.campaign_type not null,
  status public.campaign_status not null default 'draft',
  segment jsonb not null default '{}'::jsonb,       -- e.g. {"segment":"inactive","days":30}
  reward_id uuid references public.rewards(id) on delete set null,
  coupon_id uuid references public.coupons(id) on delete set null,
  template_id uuid references public.whatsapp_templates(id) on delete set null,
  message text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  ai_generated boolean not null default false,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_tenant_idx on public.campaigns (tenant_id, created_at desc);

alter table public.qr_codes add constraint qr_codes_campaign_fk foreign key (campaign_id) references public.campaigns(id) on delete set null;
alter table public.coupons add constraint coupons_campaign_fk foreign key (campaign_id) references public.campaigns(id) on delete set null;

create table public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  status public.message_status not null default 'queued',
  skip_reason text,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, customer_id)
);

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  template_id uuid references public.whatsapp_templates(id) on delete set null,
  to_phone text not null,
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  status public.message_status not null default 'queued',
  meta_message_id text unique,
  payload jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index whatsapp_messages_tenant_idx on public.whatsapp_messages (tenant_id, created_at desc);

create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null,                        -- 'weekly_summary', 'offer_suggestion', 'segment_suggestion'
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'approved', 'dismissed')),
  reviewed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Billing & platform ops (Milestone 5)
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  status public.subscription_status not null default 'trialing',
  current_period_start timestamptz,
  current_period_end timestamptz,
  razorpay_subscription_id text unique,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_tenant_idx on public.subscriptions (tenant_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  amount_inr numeric(12,2) not null,
  status public.payment_status not null default 'created',
  razorpay_order_id text,
  razorpay_payment_id text unique,
  raw_event jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  opened_by uuid references public.users(id) on delete set null,
  subject text not null,
  body text not null,
  status public.ticket_status not null default 'open',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index audit_logs_tenant_idx on public.audit_logs (tenant_id, created_at desc);

-- The tables this app owns. Loops below touch only these, never other
-- tables that may already exist in the project's public schema.
create or replace function private.app_tables()
returns text[] language sql immutable as $$
  select array['subscription_plans', 'tenants', 'branches', 'users', 'user_roles', 'staff_members', 'qr_codes', 'customers', 'customer_consents', 'qr_scans', 'loyalty_programs', 'loyalty_rules', 'loyalty_wallets', 'rewards', 'reward_redemptions', 'coupons', 'purchases', 'coupon_redemptions', 'visits', 'loyalty_transactions', 'referrals', 'feedback', 'whatsapp_templates', 'campaigns', 'campaign_recipients', 'whatsapp_messages', 'ai_insights', 'subscriptions', 'payments', 'support_tickets', 'audit_logs']
$$;

-- ---------------------------------------------------------------------------
-- updated_at triggers on every app table
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array private.app_tables()
  loop
    execute format('create trigger %I before update on public.%I for each row execute function private.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;
