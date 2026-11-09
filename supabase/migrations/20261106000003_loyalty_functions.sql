-- CafeRepeat AI — loyalty engine
-- All balance changes go through private.apply_txn, which:
--   * locks the wallet row (serialises concurrent changes for one customer)
--   * ignores a repeated idempotency key (duplicate event protection)
--   * refuses to take a balance below zero
--   * writes the ledger row with the balances after the change

-- ---------------------------------------------------------------------------
-- Small helpers
-- ---------------------------------------------------------------------------
-- Random code from a 32-letter alphabet (no 0/O/1/I). Uses pg_catalog.gen_random_uuid()
-- (cryptographically random, core since PG13), skipping the fixed version/variant bytes.
create or replace function private.gen_code(len int)
returns text language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  u bytea;
  out text := '';
  idx int;
begin
  while length(out) < len loop
    u := decode(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 'hex');
    foreach idx in array array[0,1,2,3,4,5,7,9,10,11,12,13,14,15] loop
      exit when length(out) >= len;
      out := out || substr(alphabet, (get_byte(u, idx) % 32) + 1, 1);
    end loop;
  end loop;
  return out;
end $$;

create or replace function private.fail(code text, msg text default null)
returns void language plpgsql as $$
begin
  raise exception '%', coalesce(msg, code) using errcode = 'P0001', hint = code;
end $$;

create or replace function private.active_program(t uuid)
returns public.loyalty_programs language sql stable security definer set search_path = '' as $$
  select * from public.loyalty_programs where tenant_id = t and is_active limit 1
$$;

create or replace function private.rules_for(prog uuid, b uuid)
returns public.loyalty_rules language sql stable security definer set search_path = '' as $$
  select * from public.loyalty_rules
  where program_id = prog and is_active and (branch_id = b or branch_id is null)
  order by (branch_id is null) asc   -- branch override first
  limit 1
$$;

-- Tier from lifetime points: returns {"key","name","min_points","multiplier"}
create or replace function private.tier_for(tiers jsonb, lifetime int)
returns jsonb language sql immutable as $$
  select coalesce(
    (select t from jsonb_array_elements(tiers) t
     where (t->>'min_points')::int <= lifetime
     order by (t->>'min_points')::int desc limit 1),
    '{"key":"silver","name":"Silver","min_points":0,"multiplier":1}'::jsonb)
$$;

create or replace function private.wallet_json(w public.loyalty_wallets)
returns jsonb language sql immutable as $$
  select jsonb_build_object('points', w.points_balance, 'stamps', w.stamps_balance,
    'cashback', w.cashback_balance, 'lifetime_points', w.lifetime_points, 'tier', w.tier)
$$;

-- The single writer of balances. Returns the ledger row id, or null when the
-- idempotency key was already used (nothing changes in that case).
create or replace function private.apply_txn(
  p_wallet_id uuid, p_kind public.txn_kind,
  p_points int, p_stamps int, p_cashback numeric,
  p_key text, p_branch uuid default null,
  p_purchase uuid default null, p_redemption uuid default null,
  p_note text default null, p_counts_lifetime boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  w public.loyalty_wallets;
  prog public.loyalty_programs;
  new_id uuid;
begin
  if coalesce(p_points, 0) = 0 and coalesce(p_stamps, 0) = 0 and coalesce(p_cashback, 0) = 0 then
    return null;
  end if;

  select * into w from public.loyalty_wallets where id = p_wallet_id for update;
  if not found then perform private.fail('wallet_not_found'); end if;

  if exists (select 1 from public.loyalty_transactions where tenant_id = w.tenant_id and idempotency_key = p_key) then
    return null;
  end if;

  if w.points_balance + coalesce(p_points, 0) < 0 then perform private.fail('insufficient_points', 'Not enough points'); end if;
  if w.stamps_balance + coalesce(p_stamps, 0) < 0 then perform private.fail('insufficient_stamps', 'Not enough stamps'); end if;
  if w.cashback_balance + coalesce(p_cashback, 0) < 0 then perform private.fail('insufficient_cashback', 'Not enough cashback'); end if;

  w.points_balance := w.points_balance + coalesce(p_points, 0);
  w.stamps_balance := w.stamps_balance + coalesce(p_stamps, 0);
  w.cashback_balance := w.cashback_balance + coalesce(p_cashback, 0);
  if p_counts_lifetime and coalesce(p_points, 0) > 0 then
    w.lifetime_points := w.lifetime_points + p_points;
  end if;
  prog := private.active_program(w.tenant_id);
  if prog.id is not null then
    w.tier := private.tier_for(prog.tiers, w.lifetime_points) ->> 'key';
  end if;

  update public.loyalty_wallets
     set points_balance = w.points_balance, stamps_balance = w.stamps_balance,
         cashback_balance = w.cashback_balance, lifetime_points = w.lifetime_points, tier = w.tier
   where id = w.id;

  insert into public.loyalty_transactions (
    tenant_id, branch_id, customer_id, wallet_id, kind,
    points_delta, stamps_delta, cashback_delta,
    points_after, stamps_after, cashback_after,
    purchase_id, redemption_id, idempotency_key, note, created_by)
  values (
    w.tenant_id, p_branch, w.customer_id, w.id, p_kind,
    coalesce(p_points, 0), coalesce(p_stamps, 0), coalesce(p_cashback, 0),
    w.points_balance, w.stamps_balance, w.cashback_balance,
    p_purchase, p_redemption, p_key, p_note, auth.uid())
  returning id into new_id;
  return new_id;
end $$;

-- Creates customer + wallet + signup bonus + optional referral. Used by both
-- self-registration and staff registration.
create or replace function private.create_customer(
  t uuid, p_phone text, p_name text, p_email text, p_birthday date,
  p_auth_user uuid, p_branch uuid, p_qr uuid, p_referral_code text
) returns public.customers language plpgsql security definer set search_path = '' as $$
declare
  c public.customers;
  w public.loyalty_wallets;
  prog public.loyalty_programs := private.active_program(t);
  ref public.customers;
  ref_id uuid;
  v_code text;
begin
  loop
    v_code := private.gen_code(6);
    exit when not exists (select 1 from public.customers where tenant_id = t and referral_code = v_code);
  end loop;

  insert into public.customers (tenant_id, auth_user_id, phone, name, email, birthday, referral_code,
                                registered_branch_id, source_qr_id)
  values (t, p_auth_user, p_phone, nullif(trim(p_name), ''), nullif(trim(lower(p_email)), ''), p_birthday, v_code, p_branch, p_qr)
  returning * into c;

  insert into public.loyalty_wallets (tenant_id, customer_id) values (t, c.id) returning * into w;

  if prog.id is not null and prog.signup_bonus_points > 0 then
    perform private.apply_txn(w.id, 'signup_bonus', prog.signup_bonus_points, 0, 0,
      'signup:' || c.id, p_branch, null, null, 'Welcome bonus', true);
  end if;

  if nullif(trim(p_referral_code), '') is not null then
    select * into ref from public.customers
     where tenant_id = t and referral_code = upper(trim(p_referral_code)) and id <> c.id and status = 'active';
    if ref.id is not null then
      update public.customers set referred_by = ref.id where id = c.id;
      insert into public.referrals (tenant_id, referrer_id, referee_id) values (t, ref.id, c.id) returning id into ref_id;
      if prog.id is not null and prog.referral_referee_points > 0 then
        perform private.apply_txn(w.id, 'referral_bonus', prog.referral_referee_points, 0, 0,
          'referral:' || ref_id || ':referee', p_branch, null, null, 'Joined with a referral code', true);
      end if;
    end if;
  end if;

  select * into c from public.customers where id = c.id;
  return c;
end $$;

-- ---------------------------------------------------------------------------
-- Public (anonymous) entry points for the customer portal
-- ---------------------------------------------------------------------------
create or replace function public.get_public_tenant(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  tn public.tenants;
  prog public.loyalty_programs;
  r public.loyalty_rules;
begin
  select * into tn from public.tenants where slug = lower(p_slug) and status in ('trial', 'active', 'past_due');
  if not found then return null; end if;
  prog := private.active_program(tn.id);
  if prog.id is not null then r := private.rules_for(prog.id, null); end if;
  return jsonb_build_object(
    'id', tn.id, 'name', tn.name, 'slug', tn.slug, 'logo_url', tn.logo_url, 'brand_color', tn.brand_color,
    'program', case when prog.id is null then null else jsonb_build_object(
      'name', prog.name,
      'points_enabled', prog.points_enabled, 'stamps_enabled', prog.stamps_enabled, 'cashback_enabled', prog.cashback_enabled,
      'points_per_100', r.points_per_100, 'cashback_percent', r.cashback_percent,
      'stamp_item_keyword', r.stamp_item_keyword, 'min_purchase_amount', r.min_purchase_amount,
      'signup_bonus_points', prog.signup_bonus_points, 'birthday_points', prog.birthday_points,
      'referral_referee_points', prog.referral_referee_points, 'tiers', prog.tiers,
      'stamp_goal', (select min(cost_value)::int from public.rewards
                     where tenant_id = tn.id and is_active and cost_type = 'stamps')) end,
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'city', b.city) order by b.name)
                          from public.branches b where b.tenant_id = tn.id and b.is_active), '[]'::jsonb),
    'rewards', coalesce((select jsonb_agg(jsonb_build_object('id', rw.id, 'name', rw.name, 'cost_type', rw.cost_type,
                                  'cost_value', rw.cost_value, 'reward_type', rw.reward_type) order by rw.sort_order, rw.cost_value)
                          from public.rewards rw where rw.tenant_id = tn.id and rw.is_active
                            and (rw.ends_at is null or rw.ends_at > now())), '[]'::jsonb));
end $$;

-- Called by /q/<code> before redirecting to the portal. Counts the scan.
create or replace function public.track_qr_scan(p_code text, p_user_agent text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  q public.qr_codes;
  tn public.tenants;
begin
  select * into q from public.qr_codes where code = p_code and is_active;
  if not found then return null; end if;
  select * into tn from public.tenants where id = q.tenant_id and status in ('trial', 'active', 'past_due');
  if not found then return null; end if;
  update public.qr_codes set scan_count = scan_count + 1 where id = q.id;
  insert into public.qr_scans (tenant_id, qr_code_id, customer_id, user_agent)
  values (q.tenant_id, q.id,
          (select c.id from public.customers c where c.tenant_id = q.tenant_id and c.auth_user_id = auth.uid() and auth.uid() is not null),
          left(p_user_agent, 300));
  return jsonb_build_object('tenant_slug', tn.slug, 'branch_id', q.branch_id, 'kind', q.kind, 'qr_id', q.id, 'label', q.label);
end $$;

-- ---------------------------------------------------------------------------
-- Customer (phone-OTP user) functions
-- ---------------------------------------------------------------------------
create or replace function private.my_customer(p_slug text)
returns public.customers language plpgsql stable security definer set search_path = '' as $$
declare c public.customers;
begin
  if auth.uid() is null then perform private.fail('not_signed_in', 'Please sign in'); end if;
  select c2.* into c from public.customers c2 join public.tenants tn on tn.id = c2.tenant_id
   where tn.slug = lower(p_slug) and c2.auth_user_id = auth.uid();
  return c;  -- id is null when not registered here yet
end $$;

create or replace function public.register_customer(
  p_tenant_slug text, p_name text, p_email text default null, p_birthday date default null,
  p_referral_code text default null, p_whatsapp_consent boolean default false,
  p_branch_id uuid default null, p_qr_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  tn public.tenants;
  ph text := private.normalize_phone(auth.jwt() ->> 'phone');
  c public.customers;
  is_new boolean := false;
begin
  if auth.uid() is null then perform private.fail('not_signed_in', 'Please sign in'); end if;
  if ph is null then perform private.fail('phone_required', 'Sign in with your mobile number first'); end if;
  if length(coalesce(trim(p_name), '')) < 2 then perform private.fail('name_required', 'Please enter your name'); end if;
  if p_birthday is not null and (p_birthday > current_date or p_birthday < date '1900-01-01') then
    perform private.fail('bad_birthday', 'Birthday looks wrong');
  end if;

  select * into tn from public.tenants where slug = lower(p_tenant_slug) and status in ('trial', 'active', 'past_due');
  if not found then perform private.fail('business_not_found', 'Business not found'); end if;
  if p_branch_id is not null and not exists (select 1 from public.branches where id = p_branch_id and tenant_id = tn.id) then
    p_branch_id := null;
  end if;
  if p_qr_id is not null and not exists (select 1 from public.qr_codes where id = p_qr_id and tenant_id = tn.id) then
    p_qr_id := null;
  end if;

  select * into c from public.customers where tenant_id = tn.id and phone = ph for update;
  if c.id is null then
    c := private.create_customer(tn.id, ph, p_name, p_email, p_birthday, auth.uid(), p_branch_id, p_qr_id, p_referral_code);
    is_new := true;
  else
    if c.auth_user_id is not null and c.auth_user_id <> auth.uid() then
      perform private.fail('phone_linked', 'This number is already linked to another account');
    end if;
    -- Customer was added at the counter earlier: link the login and fill blanks.
    update public.customers
       set auth_user_id = auth.uid(),
           name = coalesce(name, nullif(trim(p_name), '')),
           email = coalesce(email, nullif(trim(lower(p_email)), '')),
           birthday = coalesce(birthday, p_birthday)
     where id = c.id returning * into c;
  end if;

  insert into public.customer_consents (tenant_id, customer_id, channel, granted, source, evidence)
  values (tn.id, c.id, 'whatsapp', coalesce(p_whatsapp_consent, false), 'registration',
          jsonb_build_object('at', now(), 'text', 'Send me offers and updates on WhatsApp'));

  perform private.audit(tn.id, case when is_new then 'customer.registered' else 'customer.linked' end, 'customer', c.id,
                        jsonb_build_object('via', 'portal', 'qr_id', p_qr_id));
  return jsonb_build_object('customer_id', c.id, 'new', is_new);
end $$;

create or replace function public.update_my_profile(p_tenant_slug text, p_name text, p_email text default null, p_birthday date default null)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.customers := private.my_customer(p_tenant_slug);
begin
  if c.id is null then perform private.fail('not_registered', 'Please join first'); end if;
  if length(coalesce(trim(p_name), '')) < 2 then perform private.fail('name_required', 'Please enter your name'); end if;
  if c.birthday is not null and p_birthday is not null and p_birthday <> c.birthday then
    perform private.fail('birthday_locked', 'Birthday can only be changed by the cafe staff');
  end if;
  update public.customers
     set name = trim(p_name), email = nullif(trim(lower(p_email)), ''), birthday = coalesce(c.birthday, p_birthday)
   where id = c.id;
end $$;

create or replace function public.set_my_consent(p_tenant_slug text, p_channel public.consent_channel, p_granted boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.customers := private.my_customer(p_tenant_slug);
begin
  if c.id is null then perform private.fail('not_registered', 'Please join first'); end if;
  insert into public.customer_consents (tenant_id, customer_id, channel, granted, source, evidence)
  values (c.tenant_id, c.id, p_channel, p_granted, 'profile', jsonb_build_object('at', now()));
end $$;

create or replace function public.submit_feedback(p_tenant_slug text, p_rating int, p_comment text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  c public.customers := private.my_customer(p_tenant_slug);
  v public.visits;
  fid uuid;
begin
  if c.id is null then perform private.fail('not_registered', 'Please join first'); end if;
  if p_rating not between 1 and 5 then perform private.fail('bad_rating', 'Rating must be 1 to 5'); end if;
  if exists (select 1 from public.feedback where customer_id = c.id and created_at > now() - interval '12 hours') then
    perform private.fail('feedback_recent', 'Thanks! You already shared feedback recently');
  end if;
  select * into v from public.visits where customer_id = c.id and created_at > now() - interval '7 days'
   order by created_at desc limit 1;
  insert into public.feedback (tenant_id, branch_id, customer_id, visit_id, rating, comment)
  values (c.tenant_id, v.branch_id, c.id, v.id, p_rating, nullif(trim(left(p_comment, 1000)), ''))
  returning id into fid;
  return fid;
end $$;

-- Everything the loyalty card screen needs, in one call.
create or replace function public.get_my_card(p_tenant_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  c public.customers := private.my_customer(p_tenant_slug);
  w public.loyalty_wallets;
  prog public.loyalty_programs;
  cur jsonb; nxt jsonb;
begin
  if c.id is null then return null; end if;
  select * into w from public.loyalty_wallets where customer_id = c.id;
  prog := private.active_program(c.tenant_id);
  cur := private.tier_for(prog.tiers, w.lifetime_points);
  select t into nxt from jsonb_array_elements(prog.tiers) t
   where (t->>'min_points')::int > w.lifetime_points order by (t->>'min_points')::int limit 1;

  return jsonb_build_object(
    'customer', jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'email', c.email, 'birthday', c.birthday,
                                   'referral_code', c.referral_code, 'total_visits', c.total_visits,
                                   'member_since', c.created_at, 'last_visit_at', c.last_visit_at),
    'wallet', private.wallet_json(w),
    'tier', cur, 'next_tier', nxt,
    'consents', coalesce((select jsonb_object_agg(x.channel, x.granted) from (
        select distinct on (channel) channel, granted from public.customer_consents
        where customer_id = c.id order by channel, created_at desc) x), '{}'::jsonb),
    'pending_redemptions', coalesce((select jsonb_agg(jsonb_build_object('id', rr.id, 'code', rr.code, 'reward', rw.name,
        'expires_at', rr.expires_at) order by rr.created_at desc)
        from public.reward_redemptions rr join public.rewards rw on rw.id = rr.reward_id
        where rr.customer_id = c.id and rr.status = 'pending' and rr.expires_at > now()), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(h order by h.created_at desc) from (
        select lt.id, lt.kind, lt.points_delta, lt.stamps_delta, lt.cashback_delta, lt.note, lt.created_at,
               b.name as branch, p.amount
        from public.loyalty_transactions lt
        left join public.branches b on b.id = lt.branch_id
        left join public.purchases p on p.id = lt.purchase_id
        where lt.customer_id = c.id order by lt.created_at desc limit 50) h), '[]'::jsonb),
    'visits', coalesce((select jsonb_agg(v order by v.created_at desc) from (
        select vi.id, vi.created_at, b.name as branch, p.amount
        from public.visits vi left join public.branches b on b.id = vi.branch_id
        left join public.purchases p on p.id = vi.purchase_id
        where vi.customer_id = c.id order by vi.created_at desc limit 30) v), '[]'::jsonb),
    'referrals', jsonb_build_object(
        'joined', (select count(*) from public.referrals where referrer_id = c.id),
        'completed', (select count(*) from public.referrals where referrer_id = c.id and status = 'completed'),
        'referrer_points', prog.referral_referrer_points, 'referee_points', prog.referral_referee_points)
  );
end $$;

-- Customer asks to redeem: balance is deducted now (held) and a one-time
-- code is issued. Staff confirm it within redemption_valid_minutes, otherwise
-- it expires and the balance is refunded.
create or replace function public.request_redemption(p_reward_id uuid, p_branch_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  rw public.rewards;
  c public.customers;
  w public.loyalty_wallets;
  prog public.loyalty_programs;
  rr public.reward_redemptions;
  cnt int;
  v_code text;
begin
  if auth.uid() is null then perform private.fail('not_signed_in', 'Please sign in'); end if;
  select * into rw from public.rewards where id = p_reward_id for update;
  if not found or not rw.is_active
     or (rw.starts_at is not null and rw.starts_at > now())
     or (rw.ends_at is not null and rw.ends_at <= now()) then
    perform private.fail('reward_unavailable', 'This reward is not available');
  end if;
  select * into c from public.customers where tenant_id = rw.tenant_id and auth_user_id = auth.uid();
  if c.id is null then perform private.fail('not_registered', 'Please join first'); end if;
  if c.status <> 'active' then perform private.fail('customer_blocked', 'Your account is on hold. Please contact the cafe'); end if;
  if p_branch_id is not null and not exists (select 1 from public.branches where id = p_branch_id and tenant_id = rw.tenant_id) then
    p_branch_id := null;
  end if;
  prog := private.active_program(rw.tenant_id);

  -- lock wallet first so counts below are consistent for this customer
  select * into w from public.loyalty_wallets where customer_id = c.id for update;

  -- Return points held by this customer's own expired codes before checking
  -- the balance (the daily job does this for everyone else).
  for rr in select * from public.reward_redemptions
            where customer_id = c.id and status = 'pending' and expires_at <= now() for update loop
    perform private.release_redemption(rr, 'expired', 'Code expired before use');
  end loop;
  select * into w from public.loyalty_wallets where id = w.id;

  if rw.stock is not null and rw.stock <= 0 then perform private.fail('out_of_stock', 'This reward is sold out'); end if;
  if rw.max_per_customer is not null then
    select count(*) into cnt from public.reward_redemptions
     where customer_id = c.id and reward_id = rw.id and status in ('pending', 'fulfilled');
    if cnt >= rw.max_per_customer then perform private.fail('limit_reached', 'You have already used this reward'); end if;
  end if;
  select count(*) into cnt from public.reward_redemptions
   where customer_id = c.id and status in ('pending', 'fulfilled') and created_at > now() - interval '24 hours';
  if cnt >= coalesce(prog.max_redemptions_per_day, 3) then
    perform private.fail('daily_limit', 'Daily redemption limit reached. Try again tomorrow');
  end if;

  loop
    v_code := private.gen_code(8);
    exit when not exists (select 1 from public.reward_redemptions rr2 where rr2.tenant_id = rw.tenant_id and rr2.code = v_code);
  end loop;

  insert into public.reward_redemptions (tenant_id, branch_id, customer_id, reward_id, code, status, cost_type, cost_value, expires_at)
  values (rw.tenant_id, p_branch_id, c.id, rw.id, v_code, 'pending', rw.cost_type, rw.cost_value,
          now() + make_interval(mins => coalesce(prog.redemption_valid_minutes, 30)))
  returning * into rr;

  perform private.apply_txn(w.id,
    case rw.cost_type when 'points' then 'redeem_points' when 'stamps' then 'redeem_stamps' else 'redeem_cashback' end::public.txn_kind,
    case when rw.cost_type = 'points' then -rw.cost_value::int else 0 end,
    case when rw.cost_type = 'stamps' then -rw.cost_value::int else 0 end,
    case when rw.cost_type = 'cashback' then -rw.cost_value else 0 end,
    'redeem:' || rr.id, p_branch_id, null, rr.id, rw.name);

  if rw.stock is not null then update public.rewards set stock = stock - 1 where id = rw.id; end if;

  return jsonb_build_object('redemption_id', rr.id, 'code', rr.code, 'expires_at', rr.expires_at, 'reward', rw.name);
end $$;

-- Puts the balance back for a pending redemption (cancel / expire).
create or replace function private.release_redemption(rr public.reward_redemptions, new_status public.redemption_status, reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare w public.loyalty_wallets;
begin
  update public.reward_redemptions set status = new_status, cancelled_reason = reason where id = rr.id;
  -- same lock order as request_redemption (reward row, then wallet) to avoid deadlocks
  update public.rewards set stock = stock + 1 where id = rr.reward_id and stock is not null;
  select * into w from public.loyalty_wallets where customer_id = rr.customer_id;
  perform private.apply_txn(w.id, 'refund',
    case when rr.cost_type = 'points' then rr.cost_value::int else 0 end,
    case when rr.cost_type = 'stamps' then rr.cost_value::int else 0 end,
    case when rr.cost_type = 'cashback' then rr.cost_value else 0 end,
    'refund:' || rr.id, rr.branch_id, null, rr.id, reason);
end $$;

create or replace function public.cancel_my_redemption(p_redemption_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare rr public.reward_redemptions;
begin
  select * into rr from public.reward_redemptions
   where id = p_redemption_id and customer_id in (select private.my_customer_ids()) for update;
  if not found then perform private.fail('not_found', 'Redemption not found'); end if;
  if rr.status <> 'pending' then perform private.fail('not_pending', 'This code was already used or closed'); end if;
  perform private.release_redemption(rr, 'cancelled', 'Cancelled by customer');
end $$;

-- ---------------------------------------------------------------------------
-- Staff functions
-- ---------------------------------------------------------------------------
create or replace function public.staff_register_customer(
  p_tenant_id uuid, p_branch_id uuid, p_phone text, p_name text default null,
  p_whatsapp_consent boolean default false, p_referral_code text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ph text := private.normalize_phone(p_phone);
  c public.customers;
begin
  if not private.has_perm(p_tenant_id, 'register_customers') or not private.can_use_branch(p_tenant_id, p_branch_id) then
    perform private.fail('forbidden', 'You do not have permission for this');
  end if;
  if ph is null then perform private.fail('bad_phone', 'Enter a valid mobile number'); end if;
  if not exists (select 1 from public.branches where id = p_branch_id and tenant_id = p_tenant_id and is_active) then
    perform private.fail('bad_branch', 'Branch not found');
  end if;
  select * into c from public.customers where tenant_id = p_tenant_id and phone = ph;
  if c.id is not null then
    return jsonb_build_object('customer_id', c.id, 'new', false);
  end if;
  c := private.create_customer(p_tenant_id, ph, p_name, null, null, null, p_branch_id, null, p_referral_code);
  insert into public.customer_consents (tenant_id, customer_id, channel, granted, source, evidence)
  values (p_tenant_id, c.id, 'whatsapp', coalesce(p_whatsapp_consent, false), 'staff',
          jsonb_build_object('recorded_by', auth.uid(), 'at', now()));
  perform private.audit(p_tenant_id, 'customer.registered', 'customer', c.id, jsonb_build_object('via', 'staff', 'branch_id', p_branch_id));
  return jsonb_build_object('customer_id', c.id, 'new', true);
end $$;

-- Record a purchase and award points / stamps / cashback by the active rules.
-- p_idempotency_key: generated by the client per checkout; retries return the
-- first result instead of awarding twice. p_bill_ref: POS bill number,
-- unique per branch.
create or replace function public.record_purchase(
  p_tenant_id uuid, p_branch_id uuid, p_customer_id uuid, p_amount numeric,
  p_idempotency_key text, p_items jsonb default '[]'::jsonb, p_bill_ref text default null,
  p_cashback_to_use numeric default 0
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.customers;
  w public.loyalty_wallets;
  prog public.loyalty_programs;
  r public.loyalty_rules;
  pu public.purchases;
  tier jsonb;
  paid numeric;
  pts int := 0; stamps int := 0; cb numeric := 0;
  first_visit boolean;
  ref public.referrals;
  ref_wallet uuid;
begin
  if not private.has_perm(p_tenant_id, 'record_purchases') or not private.can_use_branch(p_tenant_id, p_branch_id) then
    perform private.fail('forbidden', 'You do not have permission for this');
  end if;
  if p_amount is null or p_amount < 0 or p_amount > 1000000 then perform private.fail('bad_amount', 'Enter a valid bill amount'); end if;
  if length(coalesce(p_idempotency_key, '')) < 8 then perform private.fail('bad_request', 'Missing idempotency key'); end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then perform private.fail('bad_items', 'Items must be a list'); end if;
  p_cashback_to_use := coalesce(p_cashback_to_use, 0);
  if p_cashback_to_use < 0 or p_cashback_to_use > p_amount then perform private.fail('bad_cashback', 'Cashback cannot be more than the bill'); end if;

  if not exists (select 1 from public.branches where id = p_branch_id and tenant_id = p_tenant_id and is_active) then
    perform private.fail('bad_branch', 'Branch not found');
  end if;
  select * into c from public.customers where id = p_customer_id and tenant_id = p_tenant_id for update;
  if c.id is null then perform private.fail('customer_not_found', 'Customer not found'); end if;

  -- Retried request → same answer, nothing awarded twice. Checked after the
  -- customer row lock so two simultaneous retries also see each other.
  select * into pu from public.purchases where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
  if pu.id is not null then
    select * into w from public.loyalty_wallets where customer_id = pu.customer_id;
    return jsonb_build_object('purchase_id', pu.id, 'duplicate', true, 'wallet', private.wallet_json(w),
      'points_earned', coalesce((select sum(points_delta) from public.loyalty_transactions where purchase_id = pu.id and points_delta > 0), 0),
      'stamps_earned', coalesce((select sum(stamps_delta) from public.loyalty_transactions where purchase_id = pu.id and stamps_delta > 0), 0),
      'cashback_earned', coalesce((select sum(cashback_delta) from public.loyalty_transactions where purchase_id = pu.id and cashback_delta > 0), 0));
  end if;

  if c.status <> 'active' then perform private.fail('customer_blocked', 'This customer is blocked'); end if;

  if nullif(trim(p_bill_ref), '') is not null and exists (
      select 1 from public.purchases where tenant_id = p_tenant_id and branch_id = p_branch_id and bill_ref = trim(p_bill_ref)) then
    perform private.fail('duplicate_bill', 'This bill number was already recorded');
  end if;

  prog := private.active_program(p_tenant_id);
  if prog.id is null then perform private.fail('no_program', 'Set up the loyalty program first'); end if;
  r := private.rules_for(prog.id, p_branch_id);

  if prog.duplicate_window_seconds > 0 and exists (
      select 1 from public.purchases
      where customer_id = c.id and branch_id = p_branch_id and amount = p_amount
        and created_at > now() - make_interval(secs => prog.duplicate_window_seconds)) then
    perform private.fail('possible_duplicate', 'Same bill for this customer was just recorded. Wait a moment or add the bill number');
  end if;

  select * into w from public.loyalty_wallets where customer_id = c.id for update;
  first_visit := c.total_visits = 0;

  insert into public.purchases (tenant_id, branch_id, customer_id, amount, items, bill_ref, cashback_used, idempotency_key, recorded_by)
  values (p_tenant_id, p_branch_id, c.id, p_amount, coalesce(p_items, '[]'::jsonb), nullif(trim(p_bill_ref), ''),
          p_cashback_to_use, p_idempotency_key, auth.uid())
  returning * into pu;
  insert into public.visits (tenant_id, branch_id, customer_id, purchase_id, source)
  values (p_tenant_id, p_branch_id, c.id, pu.id, 'purchase');
  update public.customers
     set total_visits = total_visits + 1, total_spent = total_spent + p_amount,
         first_visit_at = coalesce(first_visit_at, now()), last_visit_at = now()
   where id = c.id;

  if p_cashback_to_use > 0 then
    if not prog.cashback_enabled then perform private.fail('cashback_disabled', 'Cashback is not enabled'); end if;
    perform private.apply_txn(w.id, 'redeem_cashback', 0, 0, -p_cashback_to_use,
      'purchase:' || pu.id || ':cashback_used', p_branch_id, pu.id, null, 'Cashback used on bill');
  end if;

  paid := p_amount - p_cashback_to_use;
  if r.id is not null and paid >= r.min_purchase_amount then
    tier := private.tier_for(prog.tiers, w.lifetime_points);
    if prog.points_enabled and r.points_per_100 > 0 then
      pts := floor(paid / 100.0 * r.points_per_100 * coalesce((tier->>'multiplier')::numeric, 1));
      if r.max_points_per_txn is not null then pts := least(pts, r.max_points_per_txn); end if;
    end if;
    if prog.stamps_enabled then
      if nullif(trim(r.stamp_item_keyword), '') is not null then
        select coalesce(sum(greatest(coalesce((i->>'qty')::int, 1), 0)), 0) into stamps
          from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
         where coalesce(i->>'name', '') || ' ' || coalesce(i->>'category', '') ilike '%' || trim(r.stamp_item_keyword) || '%';
        stamps := least(stamps, 20);
      else
        stamps := r.stamps_per_visit;
      end if;
    end if;
    if prog.cashback_enabled and r.cashback_percent > 0 then
      cb := round(paid * r.cashback_percent / 100.0, 2);
      if r.max_cashback_per_txn is not null then cb := least(cb, r.max_cashback_per_txn); end if;
    end if;
  end if;

  perform private.apply_txn(w.id, 'earn_points', pts, 0, 0, 'purchase:' || pu.id || ':points', p_branch_id, pu.id, null, null, true);
  perform private.apply_txn(w.id, 'earn_stamps', 0, stamps, 0, 'purchase:' || pu.id || ':stamps', p_branch_id, pu.id, null, null);
  perform private.apply_txn(w.id, 'earn_cashback', 0, 0, cb, 'purchase:' || pu.id || ':cashback', p_branch_id, pu.id, null, null);

  -- Referral completes on the referee's first purchase.
  if first_visit then
    select * into ref from public.referrals where referee_id = c.id and status = 'pending' for update;
    if ref.id is not null then
      update public.referrals set status = 'completed', completed_at = now() where id = ref.id;
      if prog.referral_referrer_points > 0 then
        select id into ref_wallet from public.loyalty_wallets where customer_id = ref.referrer_id;
        perform private.apply_txn(ref_wallet, 'referral_bonus', prog.referral_referrer_points, 0, 0,
          'referral:' || ref.id || ':referrer', p_branch_id, null, null, 'Your friend made their first visit', true);
      end if;
    end if;
  end if;

  perform private.audit(p_tenant_id, 'purchase.recorded', 'purchase', pu.id,
    jsonb_build_object('customer_id', c.id, 'amount', p_amount, 'branch_id', p_branch_id, 'points', pts, 'stamps', stamps, 'cashback', cb));

  select * into w from public.loyalty_wallets where id = w.id;
  return jsonb_build_object('purchase_id', pu.id, 'duplicate', false, 'points_earned', pts, 'stamps_earned', stamps,
                            'cashback_earned', cb, 'wallet', private.wallet_json(w));
end $$;

-- Staff confirm a redemption code at the counter. Business outcomes are
-- returned (ok=false + reason) rather than raised, so an expiry refund commits.
create or replace function public.confirm_redemption(p_tenant_id uuid, p_branch_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  rr public.reward_redemptions;
  rw public.rewards;
  c public.customers;
begin
  if not private.has_perm(p_tenant_id, 'redeem_rewards') or not private.can_use_branch(p_tenant_id, p_branch_id) then
    perform private.fail('forbidden', 'You do not have permission for this');
  end if;
  select * into rr from public.reward_redemptions
   where tenant_id = p_tenant_id and code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
   for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  select * into rw from public.rewards where id = rr.reward_id;
  select * into c from public.customers where id = rr.customer_id;

  if rr.status = 'fulfilled' then
    return jsonb_build_object('ok', false, 'reason', 'already_used', 'used_at', rr.fulfilled_at, 'reward', rw.name);
  end if;
  if rr.status <> 'pending' then return jsonb_build_object('ok', false, 'reason', rr.status::text, 'reward', rw.name); end if;
  if rr.expires_at <= now() then
    perform private.release_redemption(rr, 'expired', 'Code expired before use');
    return jsonb_build_object('ok', false, 'reason', 'expired', 'reward', rw.name);
  end if;
  if rw.branch_id is not null and rw.branch_id <> p_branch_id then
    return jsonb_build_object('ok', false, 'reason', 'wrong_branch', 'reward', rw.name);
  end if;

  update public.reward_redemptions
     set status = 'fulfilled', fulfilled_at = now(), fulfilled_by = auth.uid(), branch_id = p_branch_id
   where id = rr.id;
  perform private.audit(p_tenant_id, 'redemption.fulfilled', 'reward_redemption', rr.id,
    jsonb_build_object('reward', rw.name, 'customer_id', rr.customer_id, 'branch_id', p_branch_id));
  return jsonb_build_object('ok', true, 'reward', rw.name, 'reward_type', rw.reward_type, 'discount_value', rw.discount_value,
                            'customer', jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone));
end $$;

-- Owner/manager manual adjustment with a reason (recorded in ledger + audit).
create or replace function public.adjust_balance(
  p_tenant_id uuid, p_customer_id uuid, p_points int, p_stamps int, p_cashback numeric, p_reason text, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare w public.loyalty_wallets;
begin
  if not private.has_perm(p_tenant_id, 'manage_customers') then perform private.fail('forbidden', 'You do not have permission for this'); end if;
  if length(coalesce(trim(p_reason), '')) < 3 then perform private.fail('reason_required', 'Add a reason'); end if;
  select * into w from public.loyalty_wallets where customer_id = p_customer_id and tenant_id = p_tenant_id;
  if w.id is null then perform private.fail('customer_not_found', 'Customer not found'); end if;
  perform private.apply_txn(w.id, 'adjustment', coalesce(p_points, 0), coalesce(p_stamps, 0), coalesce(p_cashback, 0),
    'adjust:' || p_idempotency_key, null, null, null, trim(p_reason));
  perform private.audit(p_tenant_id, 'wallet.adjusted', 'customer', p_customer_id,
    jsonb_build_object('points', p_points, 'stamps', p_stamps, 'cashback', p_cashback, 'reason', p_reason));
  select * into w from public.loyalty_wallets where id = w.id;
  return private.wallet_json(w);
end $$;

-- ---------------------------------------------------------------------------
-- Onboarding: a signed-in user creates a business
-- ---------------------------------------------------------------------------
create or replace function public.create_tenant(
  p_name text, p_slug text, p_branch_name text, p_city text default null, p_owner_name text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  tn public.tenants;
  br public.branches;
  prog public.loyalty_programs;
  plan public.subscription_plans;
begin
  if uid is null then perform private.fail('not_signed_in', 'Please sign in'); end if;
  if (select count(*) from public.user_roles where user_id = uid and role = 'owner') >= 5 then
    perform private.fail('too_many_businesses', 'Contact support to add more businesses');
  end if;
  p_slug := lower(trim(p_slug));
  if p_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$' then
    perform private.fail('bad_slug', 'Use 3–48 lowercase letters, numbers or dashes');
  end if;
  if p_slug in ('admin', 'api', 'app', 'dashboard', 'login', 'signup', 'q', 'c', 'www', 'support', 'super-admin') then
    perform private.fail('slug_taken', 'That link is reserved');
  end if;
  if exists (select 1 from public.tenants where slug = p_slug) then perform private.fail('slug_taken', 'That link is taken'); end if;

  insert into public.users (id, full_name, email)
  values (uid, nullif(trim(p_owner_name), ''), auth.jwt() ->> 'email')
  on conflict (id) do update set full_name = coalesce(public.users.full_name, excluded.full_name);

  insert into public.tenants (name, slug, owner_user_id, trial_ends_at, status)
  values (trim(p_name), p_slug, uid, now() + interval '14 days', 'trial') returning * into tn;
  insert into public.user_roles (tenant_id, user_id, role) values (tn.id, uid, 'owner');
  insert into public.branches (tenant_id, name, city) values (tn.id, trim(p_branch_name), nullif(trim(p_city), '')) returning * into br;
  insert into public.staff_members (tenant_id, user_id, branch_id, full_name, email)
  values (tn.id, uid, null, coalesce(nullif(trim(p_owner_name), ''), 'Owner'), auth.jwt() ->> 'email');

  insert into public.loyalty_programs (tenant_id, name, signup_bonus_points, referral_referrer_points, referral_referee_points, birthday_points)
  values (tn.id, trim(p_name) || ' Rewards', 50, 100, 50, 100) returning * into prog;
  insert into public.loyalty_rules (tenant_id, program_id, points_per_100, stamps_per_visit)
  values (tn.id, prog.id, 10, 1);
  insert into public.rewards (tenant_id, name, description, reward_type, cost_type, cost_value, sort_order) values
    (tn.id, 'Free coffee', 'Any regular hot coffee', 'free_item', 'stamps', 5, 1),
    (tn.id, 'Free dessert', 'Any dessert up to ₹150', 'free_item', 'points', 300, 2);
  insert into public.rewards (tenant_id, name, description, reward_type, cost_type, cost_value, discount_value, min_purchase_amount, sort_order)
  values (tn.id, '₹100 off', 'On bills of ₹500 or more', 'fixed_discount', 'points', 500, 100, 500, 3);

  insert into public.qr_codes (tenant_id, branch_id, kind, code, label, created_by)
  values (tn.id, br.id, 'registration', private.gen_code(8), br.name || ' · Join & earn', uid);

  select * into plan from public.subscription_plans where code = 'starter';
  if plan.id is not null then
    insert into public.subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
    values (tn.id, plan.id, 'trialing', now(), tn.trial_ends_at);
  end if;

  perform private.audit(tn.id, 'tenant.created', 'tenant', tn.id, jsonb_build_object('slug', tn.slug));
  return jsonb_build_object('tenant_id', tn.id, 'slug', tn.slug, 'branch_id', br.id);
end $$;

create or replace function public.create_qr_code(p_tenant_id uuid, p_branch_id uuid, p_kind public.qr_kind, p_label text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare q public.qr_codes; v_code text;
begin
  if not private.has_perm(p_tenant_id, 'manage_qr') then perform private.fail('forbidden', 'You do not have permission for this'); end if;
  if p_branch_id is not null and not exists (select 1 from public.branches where id = p_branch_id and tenant_id = p_tenant_id) then
    perform private.fail('bad_branch', 'Branch not found');
  end if;
  if length(coalesce(trim(p_label), '')) < 2 then perform private.fail('label_required', 'Add a label'); end if;
  loop
    v_code := private.gen_code(8);
    exit when not exists (select 1 from public.qr_codes q2 where q2.code = v_code);
  end loop;
  insert into public.qr_codes (tenant_id, branch_id, kind, code, label, created_by)
  values (p_tenant_id, p_branch_id, p_kind, v_code, trim(p_label), auth.uid()) returning * into q;
  perform private.audit(p_tenant_id, 'qr.created', 'qr_code', q.id, jsonb_build_object('kind', p_kind, 'label', p_label));
  return jsonb_build_object('id', q.id, 'code', q.code);
end $$;

-- ---------------------------------------------------------------------------
-- Scheduled jobs (run with pg_cron or a Vercel cron calling with service role)
-- ---------------------------------------------------------------------------
create or replace function public.job_expire_redemptions()
returns int language plpgsql security definer set search_path = '' as $$
declare rr public.reward_redemptions; n int := 0;
begin
  for rr in select * from public.reward_redemptions where status = 'pending' and expires_at <= now() for update skip locked loop
    perform private.release_redemption(rr, 'expired', 'Code expired before use');
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.job_birthday_rewards()
returns int language plpgsql security definer set search_path = '' as $$
declare rec record; n int := 0; today date;
begin
  for rec in
    select c.id as customer_id, c.tenant_id, c.birthday, w.id as wallet_id, p.birthday_points, tn.timezone
    from public.customers c
    join public.tenants tn on tn.id = c.tenant_id and tn.status in ('trial', 'active', 'past_due')
    join public.loyalty_programs p on p.tenant_id = c.tenant_id and p.is_active and p.birthday_points > 0
    join public.loyalty_wallets w on w.customer_id = c.id
    where c.status = 'active' and c.birthday is not null
  loop
    today := (now() at time zone rec.timezone)::date;
    continue when extract(month from rec.birthday) <> extract(month from today)
               or extract(day from rec.birthday) <> extract(day from today);
    if private.apply_txn(rec.wallet_id, 'birthday_bonus', rec.birthday_points, 0, 0,
         'birthday:' || rec.customer_id || ':' || extract(year from today), null, null, null, 'Happy birthday!', true) is not null then
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- Points expire after N days without a visit (loyalty_programs.points_expiry_days).
create or replace function public.job_expire_points()
returns int language plpgsql security definer set search_path = '' as $$
declare rec record; n int := 0;
begin
  for rec in
    select w.id as wallet_id, w.points_balance, c.id as customer_id, coalesce(c.last_visit_at, c.created_at) as since
    from public.loyalty_wallets w
    join public.customers c on c.id = w.customer_id
    join public.loyalty_programs p on p.tenant_id = w.tenant_id and p.is_active and p.points_expiry_days is not null
    where w.points_balance > 0
      and coalesce(c.last_visit_at, c.created_at) < now() - make_interval(days => p.points_expiry_days)
  loop
    if private.apply_txn(rec.wallet_id, 'expiry', -rec.points_balance, 0, 0,
         'expiry:' || rec.customer_id || ':' || to_char(rec.since, 'YYYYMMDDHH24MISS'), null, null, null, 'Points expired after inactivity') is not null then
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
-- Only this app's functions (other functions in the project are left alone).
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array[
      'get_public_tenant','track_qr_scan','register_customer','update_my_profile','set_my_consent',
      'submit_feedback','get_my_card','request_redemption','cancel_my_redemption','staff_register_customer',
      'record_purchase','confirm_redemption','adjust_balance','create_tenant','create_qr_code',
      'job_expire_redemptions','job_birthday_rewards','job_expire_points'])
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.app_tables(), private.role_perms(public.app_role), private.is_platform_admin(), private.my_role(uuid),
  private.is_member(uuid), private.has_perm(uuid, text), private.can_use_branch(uuid, uuid),
  private.my_customer_ids(), private.is_customer_of(uuid)
to anon, authenticated;

grant execute on function public.get_public_tenant(text), public.track_qr_scan(text, text) to anon, authenticated;
grant execute on function
  public.register_customer(text, text, text, date, text, boolean, uuid, uuid),
  public.update_my_profile(text, text, text, date),
  public.set_my_consent(text, public.consent_channel, boolean),
  public.submit_feedback(text, int, text),
  public.get_my_card(text),
  public.request_redemption(uuid, uuid),
  public.cancel_my_redemption(uuid),
  public.staff_register_customer(uuid, uuid, text, text, boolean, text),
  public.record_purchase(uuid, uuid, uuid, numeric, text, jsonb, text, numeric),
  public.confirm_redemption(uuid, uuid, text),
  public.adjust_balance(uuid, uuid, int, int, numeric, text, text),
  public.create_tenant(text, text, text, text, text),
  public.create_qr_code(uuid, uuid, public.qr_kind, text)
to authenticated;
grant execute on function public.job_expire_redemptions(), public.job_birthday_rewards(), public.job_expire_points() to service_role;
grant execute on all functions in schema private to service_role;
