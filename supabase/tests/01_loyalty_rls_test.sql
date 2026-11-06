-- CafeRepeat AI — database tests (tenant isolation, ledger, duplicates, redemption)
-- Run on a fresh DB after migrations + seed:  psql -v ON_ERROR_STOP=1 -f tests/01_loyalty_rls_test.sql
-- Each failed check raises an exception and stops the run.

\set QUIET on
create schema if not exists tests;
grant usage on schema tests to authenticated, anon, service_role;

create or replace function tests.login(p_uid uuid, p_phone text default null, p_email text default null)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), false);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'phone', p_phone, 'email', p_email)::text, false);
end $$;

create or replace function tests.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'ok - %', label;
end $$;

-- Runs sql and requires it to fail with the given hint (business code) or SQLSTATE.
create or replace function tests.fails(sql text, expected text, label text) returns void language plpgsql as $$
declare h text; st text;
begin
  begin
    execute sql;
  exception when others then
    get stacked diagnostics h = pg_exception_hint, st = returned_sqlstate;
    if coalesce(h, '') = expected or st = expected then raise notice 'ok - %', label; return; end if;
    raise exception 'FAIL: % (got hint=% sqlstate=% msg=%)', label, h, st, sqlerrm;
  end;
  raise exception 'FAIL: % (no error raised)', label;
end $$;
grant execute on all functions in schema tests to authenticated, anon, service_role;

-- Users -----------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@test.in'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@test.in'),
  ('00000000-0000-0000-0000-0000000000c1', 'cashier@test.in');
insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-0000000000d1', '919811111111'),
  ('00000000-0000-0000-0000-0000000000d2', '919822222222'),
  ('00000000-0000-0000-0000-0000000000d3', '919833333333');

create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated, anon;

-- 1. Onboarding ---------------------------------------------------------------
set role authenticated;
select tests.login('00000000-0000-0000-0000-00000000000a', null, 'owner-a@test.in');
insert into ctx select 'ta', (create_tenant('Cafe A', 'cafe-a', 'MG Road', 'Bengaluru', 'Asha'))->>'tenant_id';
insert into ctx select 'ba', id::text from branches where tenant_id = (select v::uuid from ctx where k = 'ta');
insert into branches (tenant_id, name) select v::uuid, 'Whitefield' from ctx where k = 'ta';
insert into ctx select 'ba2', id::text from branches where name = 'Whitefield';
select tests.ok((select count(*) from rewards) = 3, 'owner sees 3 default rewards of own cafe');
select tests.ok((select count(*) from qr_codes) = 1, 'registration QR created on signup');
select tests.fails($$select create_tenant('X', 'cafe-a', 'B')$$, 'slug_taken', 'slug must be unique');
select tests.fails($$select create_tenant('X', 'Bad Slug!', 'B')$$, 'bad_slug', 'slug format enforced');

select tests.login('00000000-0000-0000-0000-00000000000b', null, 'owner-b@test.in');
insert into ctx select 'tb', (create_tenant('Cafe B', 'cafe-b', 'Park St', 'Kolkata', 'Bimal'))->>'tenant_id';

-- 2. Tenant isolation ---------------------------------------------------------
select tests.ok((select count(*) from tenants) = 1, 'owner B sees only own tenant');
select tests.ok((select count(*) from branches where tenant_id = (select v::uuid from ctx where k = 'ta')) = 0, 'owner B cannot see cafe A branches');
select tests.ok((select count(*) from customers) = 0, 'owner B cannot see demo or cafe A customers');
update branches set name = 'hacked' where tenant_id = (select v::uuid from ctx where k = 'ta');
reset role;
select tests.ok((select count(*) from branches where name = 'hacked') = 0, 'owner B cannot update cafe A branches');
set role authenticated;
select tests.fails($$insert into rewards (tenant_id, name, cost_type, cost_value) select v::uuid, 'Free all', 'points', 1 from ctx where k = 'ta'$$,
                   '42501', 'owner B cannot add rewards to cafe A');
select tests.fails($$insert into loyalty_transactions (tenant_id, customer_id, wallet_id, kind, points_delta, points_after, stamps_after, cashback_after, idempotency_key)
                     select tenant_id, customer_id, id, 'adjustment', 1000, 1000, 0, 0, 'x' from loyalty_wallets limit 1$$,
                   '42501', 'staff cannot write the ledger directly');
select tests.fails($$update public.users set is_platform_admin = true where id = auth.uid()$$, '42501', 'cannot make yourself platform admin');

-- 3. Staff: a cashier limited to one branch -----------------------------------
reset role;
insert into public.users (id, email, full_name) values ('00000000-0000-0000-0000-0000000000c1', 'cashier@test.in', 'Chetan');
set role authenticated;
select tests.login('00000000-0000-0000-0000-00000000000a');
insert into user_roles (tenant_id, user_id, role) select v::uuid, '00000000-0000-0000-0000-0000000000c1', 'cashier' from ctx where k = 'ta';
insert into staff_members (tenant_id, user_id, branch_id, full_name)
  select (select v::uuid from ctx where k = 'ta'), '00000000-0000-0000-0000-0000000000c1', (select v::uuid from ctx where k = 'ba'), 'Chetan';
select tests.fails($$delete from user_roles where user_id = auth.uid()$$, 'P0001', 'last owner cannot be removed');

-- Owner A configures cashback + a coffee stamp keyword
update loyalty_programs set cashback_enabled = true;
update loyalty_rules set cashback_percent = 5, max_cashback_per_txn = 30, stamp_item_keyword = 'coffee', min_purchase_amount = 100;

-- 4. Customer self-registration with phone OTP ---------------------------------
reset role; set role authenticated;
select tests.login('00000000-0000-0000-0000-0000000000d1', '919811111111');
select tests.ok((get_public_tenant('cafe-a'))->>'name' = 'Cafe A', 'portal can load public cafe info');
select tests.ok(get_my_card('cafe-a') is null, 'not registered yet → no card');
select tests.fails($$select register_customer('cafe-a', 'A')$$, 'name_required', 'name is validated');
insert into ctx select 'c1', (register_customer('cafe-a', 'Riya', 'riya@x.in', '1995-11-06', null, true))->>'customer_id';
select tests.ok((get_my_card('cafe-a'))->'wallet'->>'points' = '50', 'signup bonus 50 points');
select tests.ok((get_my_card('cafe-a'))->'consents'->>'whatsapp' = 'true', 'WhatsApp consent recorded');
select tests.ok((select count(*) from customers) = 1, 'customer sees only own customer row');
select tests.ok((select count(*) from loyalty_wallets) = 1, 'customer sees only own wallet');
select tests.ok((select count(*) from rewards) = 3, 'customer sees cafe A active rewards');
insert into ctx select 'ref1', referral_code from customers where id = (select v::uuid from ctx where k = 'c1');

-- Second customer joins with Riya's referral code
select tests.login('00000000-0000-0000-0000-0000000000d2', '919822222222');
insert into ctx select 'c2', (register_customer('cafe-a', 'Kunal', null, null, (select v from ctx where k = 'ref1'), false))->>'customer_id';
select tests.ok((get_my_card('cafe-a'))->'wallet'->>'points' = '100', 'referee gets 50 signup + 50 referral');
select tests.ok((select count(*) from customers where id = (select v::uuid from ctx where k = 'c1')) = 0, 'customer cannot read another customer');
select tests.ok((select count(*) from loyalty_transactions where customer_id = (select v::uuid from ctx where k = 'c1')) = 0, 'customer cannot read another ledger');

-- 5. Purchases at the counter ------------------------------------------------
select tests.login('00000000-0000-0000-0000-0000000000c1', null, 'cashier@test.in');
select tests.ok((select count(*) from customers) = 2, 'cashier sees cafe A customers only');
select tests.fails(format($$select record_purchase(%L, %L, %L, 500, 'key-branch-2')$$,
  (select v from ctx where k = 'ta'), (select v from ctx where k = 'ba2'), (select v from ctx where k = 'c2')),
  'forbidden', 'cashier cannot record purchases in another branch');

insert into ctx select 'p1', (record_purchase(
  (select v::uuid from ctx where k = 'ta'), (select v::uuid from ctx where k = 'ba'), (select v::uuid from ctx where k = 'c2'),
  450, 'checkout-0001',
  '[{"name":"Cappuccino","category":"coffee","qty":2,"price":160},{"name":"Brownie","category":"dessert","qty":1,"price":130}]',
  'BILL-1001'))::text;
select tests.ok(((select v from ctx where k = 'p1')::jsonb->>'points_earned')::int = 45, '₹450 → 45 points (10 per ₹100)');
select tests.ok(((select v from ctx where k = 'p1')::jsonb->>'stamps_earned')::int = 2, '2 coffees → 2 stamps (keyword rule)');
select tests.ok(((select v from ctx where k = 'p1')::jsonb->>'cashback_earned')::numeric = 22.50, '5% cashback = ₹22.50');

-- same checkout retried (network retry) → no double award
select tests.ok((record_purchase((select v::uuid from ctx where k = 'ta'), (select v::uuid from ctx where k = 'ba'),
  (select v::uuid from ctx where k = 'c2'), 450, 'checkout-0001'))->>'duplicate' = 'true', 'retry with same key returns duplicate');
select tests.fails(format($$select record_purchase(%L, %L, %L, 300, 'checkout-0002', '[]', 'BILL-1001')$$,
  (select v from ctx where k = 'ta'), (select v from ctx where k = 'ba'), (select v from ctx where k = 'c2')),
  'duplicate_bill', 'same POS bill number rejected');
select tests.fails(format($$select record_purchase(%L, %L, %L, 450, 'checkout-0003')$$,
  (select v from ctx where k = 'ta'), (select v from ctx where k = 'ba'), (select v from ctx where k = 'c2')),
  'possible_duplicate', 'same amount for same customer within 2 min rejected');

-- below minimum purchase → visit counted, nothing earned
select tests.ok((record_purchase((select v::uuid from ctx where k = 'ta'), (select v::uuid from ctx where k = 'ba'),
  (select v::uuid from ctx where k = 'c1'), 80, 'checkout-0005'))->>'points_earned' = '0', 'below min purchase earns nothing');

-- referral completes on referee's first purchase
reset role; set role authenticated;
select tests.login('00000000-0000-0000-0000-0000000000d1', '919811111111');
select tests.ok((get_my_card('cafe-a'))->'wallet'->>'points' = '150', 'referrer got 100 after friend''s first bill (50 + 100)');

-- 6. Ledger integrity: balances = sum of ledger -------------------------------
reset role;
select tests.ok(not exists (
  select 1 from loyalty_wallets w
  where w.points_balance <> coalesce((select sum(points_delta) from loyalty_transactions t where t.wallet_id = w.id), 0)
     or w.stamps_balance <> coalesce((select sum(stamps_delta) from loyalty_transactions t where t.wallet_id = w.id), 0)
     or w.cashback_balance <> coalesce((select sum(cashback_delta) from loyalty_transactions t where t.wallet_id = w.id), 0)),
  'every wallet balance equals the sum of its ledger');

-- 7. Redemption ----------------------------------------------------------------
set role authenticated;
select tests.login('00000000-0000-0000-0000-0000000000d2', '919822222222');
insert into ctx select 'rw_dessert', id::text from rewards where name = 'Free dessert';
insert into ctx select 'rw_coffee', id::text from rewards where name = 'Free coffee';
select tests.fails(format($$select request_redemption(%L)$$, (select v from ctx where k = 'rw_dessert')),
  'insufficient_points', 'cannot redeem 300 pts with 145');
select tests.fails(format($$select request_redemption(%L)$$, (select v from ctx where k = 'rw_coffee')),
  'insufficient_stamps', 'cannot redeem 5 stamps with 2');

reset role;
-- give Kunal enough points through an owner adjustment (ledger + audit)
set role authenticated;
select tests.login('00000000-0000-0000-0000-00000000000a');
select adjust_balance((select v::uuid from ctx where k = 'ta'), (select v::uuid from ctx where k = 'c2'), 200, 0, 0, 'Festival goodwill', 'adj-1');
select tests.fails(format($$select adjust_balance(%L, %L, -9999, 0, 0, 'Oops', 'adj-2')$$,
  (select v from ctx where k = 'ta'), (select v from ctx where k = 'c2')), 'insufficient_points', 'balance can never go negative');

select tests.login('00000000-0000-0000-0000-0000000000d2', '919822222222');
insert into ctx select 'red1', (request_redemption((select v::uuid from ctx where k = 'rw_dessert')))::text;
select tests.ok((get_my_card('cafe-a'))->'wallet'->>'points' = '45', 'points held on redemption (345 − 300)');
select tests.ok(jsonb_array_length((get_my_card('cafe-a'))->'pending_redemptions') = 1, 'pending code shown on card');

select tests.login('00000000-0000-0000-0000-0000000000c1');
select tests.ok((confirm_redemption((select v::uuid from ctx where k = 'ta'), (select v::uuid from ctx where k = 'ba'),
  (select v::jsonb->>'code' from ctx where k = 'red1')))->>'ok' = 'true', 'cashier confirms the code');
select tests.ok((confirm_redemption((select v::uuid from ctx where k = 'ta'), (select v::uuid from ctx where k = 'ba'),
  (select v::jsonb->>'code' from ctx where k = 'red1')))->>'reason' = 'already_used', 'same code cannot be used twice');

select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.fails(format($$select confirm_redemption(%L, %L, 'ABCDEFGH')$$, (select v from ctx where k = 'ta'), (select v from ctx where k = 'ba')),
  'forbidden', 'other cafe''s owner cannot confirm cafe A codes');

-- expiry refunds the hold
reset role;
update loyalty_wallets set points_balance = points_balance + 300 where customer_id = (select v::uuid from ctx where k = 'c2');
insert into loyalty_transactions (tenant_id, customer_id, wallet_id, kind, points_delta, points_after, stamps_after, cashback_after, idempotency_key, note)
  select tenant_id, customer_id, id, 'adjustment', 300, points_balance, stamps_balance, cashback_balance, 'test-topup', 'test top-up'
  from loyalty_wallets where customer_id = (select v::uuid from ctx where k = 'c2');
set role authenticated;
select tests.login('00000000-0000-0000-0000-0000000000d2', '919822222222');
insert into ctx select 'red2', (request_redemption((select v::uuid from ctx where k = 'rw_dessert')))::text;
reset role;
update reward_redemptions set expires_at = now() - interval '1 minute' where code = (select v::jsonb->>'code' from ctx where k = 'red2');
set role service_role;
select tests.ok(job_expire_redemptions() = 1, 'expiry job closes 1 code');
reset role;
select tests.ok((select points_balance from loyalty_wallets where customer_id = (select v::uuid from ctx where k = 'c2')) = 345, 'expired code refunded (345)');
set role service_role;
select tests.ok(job_expire_redemptions() = 0, 'expiry job is idempotent');

-- 8. Birthday job: once per year even if run twice ----------------------------
reset role;
update customers set birthday = (now() at time zone 'Asia/Kolkata')::date - interval '30 years' where id = (select v::uuid from ctx where k = 'c1');
set role service_role;
select tests.ok(job_birthday_rewards() >= 1, 'birthday points granted');
select tests.ok(job_birthday_rewards() = 0, 'birthday points not granted twice');

-- 9. Tier upgrade multiplies points --------------------------------------------
reset role;
update loyalty_wallets set lifetime_points = 600 where customer_id = (select v::uuid from ctx where k = 'c1');
set role authenticated;
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.ok((record_purchase((select v::uuid from ctx where k = 'ta'), (select v::uuid from ctx where k = 'ba'),
  (select v::uuid from ctx where k = 'c1'), 1000, 'checkout-gold-1'))->>'points_earned' = '125', 'Gold tier gets 1.25x (100 → 125)');

-- 10. Anonymous visitor -------------------------------------------------------
reset role; set role anon;
select tests.login(null);
select tests.ok((track_qr_scan('DEMOIND1', 'test-agent'))->>'tenant_slug' = 'demo-cafe', 'anon QR scan resolves cafe');
select tests.fails($$select count(*) from customers$$, '42501', 'anon cannot read customers');
select tests.fails($$select record_purchase(null, null, null, 1, 'xxxxxxxxx')$$, '42501', 'anon cannot call staff functions');
reset role;
select tests.ok((select scan_count from qr_codes where code = 'DEMOIND1') = 1, 'QR scan counted');

-- 11. Audit trail -------------------------------------------------------------
select tests.ok((select count(*) from audit_logs where action = 'purchase.recorded') >= 3, 'purchases are audited');
select tests.ok((select count(*) from audit_logs where action = 'wallet.adjusted') = 1, 'manual adjustment audited');

\echo ALL DATABASE TESTS PASSED
