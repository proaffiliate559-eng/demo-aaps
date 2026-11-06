-- CafeRepeat AI — seed data
-- 1) Subscription plans (real configuration; Super Admin can edit later).
-- 2) DEMO MODE ONLY: a sample cafe "demo-cafe" with sample customers and
--    purchases, so the dashboard and portal have something to show.
--    Do not run part 2 on a production database.

insert into public.subscription_plans (code, name, price_monthly_inr, limits, features, sort_order) values
  ('starter', 'Starter', 499, '{"branches":1,"customers":1000,"staff":3,"whatsapp_per_month":0}', '["qr_loyalty","stamps","basic_crm"]', 1),
  ('growth', 'Growth', 999, '{"branches":2,"customers":5000,"staff":8,"whatsapp_per_month":2000}', '["qr_loyalty","stamps","points","coupons","whatsapp","campaigns"]', 2),
  ('pro', 'Pro', 1999, '{"branches":3,"customers":20000,"staff":20,"whatsapp_per_month":10000}', '["qr_loyalty","stamps","points","coupons","whatsapp","campaigns","ai","advanced_analytics","segments","automations"]', 3),
  ('enterprise', 'Enterprise', null, '{"branches":null,"customers":null,"staff":null,"whatsapp_per_month":null}', '["everything","multi_branch","advanced_permissions","custom_integrations"]', 4)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- DEMO MODE
-- ---------------------------------------------------------------------------
do $$
declare
  t uuid; b1 uuid; b2 uuid; prog uuid;
  c public.customers;
  w uuid;
  pu uuid;
  names text[] := array['Aarav Shah','Priya Nair','Rohan Gupta','Sneha Iyer','Kabir Malhotra','Ananya Rao',
                        'Vikram Singh','Meera Joshi','Arjun Reddy','Isha Kapoor','Dev Patel','Nisha Verma'];
  i int; k int; amt numeric; days int;
begin
  if exists (select 1 from public.tenants where slug = 'demo-cafe') then return; end if;

  insert into public.tenants (name, slug, status, brand_color, trial_ends_at, settings)
  values ('Brew & Bake (Demo)', 'demo-cafe', 'active', '#0E4D3A', now() + interval '365 days', '{"demo":true}')
  returning id into t;
  insert into public.branches (tenant_id, name, city) values (t, 'Indiranagar', 'Bengaluru') returning id into b1;
  insert into public.branches (tenant_id, name, city) values (t, 'Koramangala', 'Bengaluru') returning id into b2;

  insert into public.loyalty_programs (tenant_id, name, cashback_enabled, signup_bonus_points, referral_referrer_points,
                                       referral_referee_points, birthday_points, points_expiry_days)
  values (t, 'Brew Rewards', true, 50, 100, 50, 100, 180) returning id into prog;
  insert into public.loyalty_rules (tenant_id, program_id, points_per_100, stamps_per_visit, stamp_item_keyword,
                                    cashback_percent, max_cashback_per_txn, min_purchase_amount)
  values (t, prog, 10, 1, 'coffee', 2, 50, 100);

  insert into public.rewards (tenant_id, name, description, reward_type, cost_type, cost_value, discount_value, min_purchase_amount, sort_order) values
    (t, 'Free coffee', 'Buy 5 coffees, get 1 free', 'free_item', 'stamps', 5, null, 0, 1),
    (t, 'Free brownie', 'Any one brownie', 'free_item', 'points', 200, null, 0, 2),
    (t, '₹100 off', 'On bills of ₹500 or more', 'fixed_discount', 'points', 500, 100, 500, 3),
    (t, '15% off your bill', 'Max one per visit', 'percent_discount', 'points', 900, 15, 300, 4),
    (t, '₹50 cashback treat', 'Use cashback for a cookie box', 'free_item', 'cashback', 50, null, 0, 5);

  insert into public.qr_codes (tenant_id, branch_id, kind, code, label) values
    (t, b1, 'registration', 'DEMOIND1', 'Indiranagar · Counter'),
    (t, b1, 'table', 'DEMOIND2', 'Indiranagar · Table 4'),
    (t, b2, 'registration', 'DEMOKOR1', 'Koramangala · Counter');

  for i in 1 .. array_length(names, 1) loop
    c := private.create_customer(t, '+9198' || lpad((10000000 + i * 7919)::text, 8, '0'), names[i], null,
                                 make_date(1990 + i, 1 + (i % 12), 1 + (i * 3 % 27)), null,
                                 case when i % 2 = 0 then b1 else b2 end, null, null);
    insert into public.customer_consents (tenant_id, customer_id, channel, granted, source)
    values (t, c.id, 'whatsapp', i % 3 <> 0, 'staff');
    select id into w from public.loyalty_wallets where customer_id = c.id;
    -- a few visits spread over the last 90 days; some customers go inactive
    for k in 1 .. (i % 6) + 1 loop
      days := (k * 11 + i * 5) % (case when i % 4 = 0 then 90 else 35 end) + (case when i % 4 = 0 then 40 else 0 end);
      amt := 180 + ((i * 37 + k * 53) % 9) * 60;
      insert into public.purchases (tenant_id, branch_id, customer_id, amount, items, idempotency_key, created_at)
      values (t, case when k % 2 = 0 then b1 else b2 end, c.id, amt,
              jsonb_build_array(jsonb_build_object('name', 'Cappuccino', 'category', 'coffee', 'qty', 1 + (k % 2), 'price', 160)),
              'seed:' || c.id || ':' || k, now() - make_interval(days => days))
      returning id into pu;
      insert into public.visits (tenant_id, branch_id, customer_id, purchase_id, created_at)
      values (t, case when k % 2 = 0 then b1 else b2 end, c.id, pu, now() - make_interval(days => days));
      perform private.apply_txn(w, 'earn_points', floor(amt / 10)::int, 0, 0, 'purchase:' || pu || ':points', b1, pu, null, null, true);
      perform private.apply_txn(w, 'earn_stamps', 0, 1 + (k % 2), 0, 'purchase:' || pu || ':stamps', b1, pu, null, null);
      update public.customers set total_visits = total_visits + 1, total_spent = total_spent + amt,
             first_visit_at = least(coalesce(first_visit_at, now()), now() - make_interval(days => days)),
             last_visit_at = greatest(coalesce(last_visit_at, '-infinity'), now() - make_interval(days => days))
       where id = c.id;
    end loop;
  end loop;
end $$;

-- Make an existing Supabase Auth user the owner of the demo cafe:
--   select private.grant_demo_owner('you@example.com');
create or replace function private.grant_demo_owner(p_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid; t uuid;
begin
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then return 'No auth user with that email. Sign up in the app first.'; end if;
  select id into t from public.tenants where slug = 'demo-cafe';
  insert into public.users (id, email, full_name) values (uid, p_email, 'Demo Owner') on conflict (id) do nothing;
  insert into public.user_roles (tenant_id, user_id, role) values (t, uid, 'owner') on conflict (tenant_id, user_id) do update set role = 'owner';
  insert into public.staff_members (tenant_id, user_id, full_name, email) values (t, uid, 'Demo Owner', p_email);
  return 'OK: ' || p_email || ' now owns demo-cafe';
end $$;
revoke execute on function private.grant_demo_owner(text) from public, anon, authenticated;
