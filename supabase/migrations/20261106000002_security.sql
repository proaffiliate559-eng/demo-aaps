-- CafeRepeat AI — roles, permissions, tenant isolation (Row Level Security)
--
-- Model
--   * Staff (owner/manager/cashier/marketing) belong to a tenant through user_roles.
--   * Customers sign in with phone OTP; public.customers.auth_user_id links them.
--   * Platform admins have users.is_platform_admin = true.
--   * Balances, ledger, purchases, visits and redemptions are never written
--     directly by clients: only by SECURITY DEFINER functions (next migration).

-- ---------------------------------------------------------------------------
-- Helper functions (schema "private" is not exposed through the API)
-- ---------------------------------------------------------------------------
create or replace function private.role_perms(r public.app_role)
returns text[] language sql immutable as $$
  select case r
    when 'owner' then array[
      'view_dashboard','view_customers','manage_customers','register_customers','record_purchases',
      'redeem_rewards','create_campaigns','manage_loyalty','manage_qr','manage_branches',
      'manage_staff','manage_billing','manage_settings']
    when 'manager' then array[
      'view_dashboard','view_customers','manage_customers','register_customers','record_purchases',
      'redeem_rewards','create_campaigns','manage_loyalty','manage_qr','manage_branches','manage_settings']
    when 'cashier' then array['view_customers','register_customers','record_purchases','redeem_rewards']
    when 'marketing' then array['view_dashboard','view_customers','create_campaigns']
  end
$$;

create or replace function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select u.is_platform_admin from public.users u where u.id = auth.uid()), false)
$$;

create or replace function private.my_role(t uuid)
returns public.app_role language sql stable security definer set search_path = '' as $$
  select ur.role from public.user_roles ur
  join public.tenants tn on tn.id = ur.tenant_id
  where ur.tenant_id = t and ur.user_id = auth.uid() and tn.status <> 'suspended'
$$;

create or replace function private.is_member(t uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.my_role(t) is not null
$$;

create or replace function private.has_perm(t uuid, perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(perm = any(private.role_perms(private.my_role(t))), false)
$$;

-- Cashiers may be limited to branches via staff_members; owners/managers see all.
create or replace function private.can_use_branch(t uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when private.my_role(t) in ('owner','manager') then true
    when private.my_role(t) is null then false
    else exists (
      select 1 from public.staff_members s
      where s.tenant_id = t and s.user_id = auth.uid() and s.is_active
        and (s.branch_id is null or s.branch_id = b))
  end
$$;

create or replace function private.my_customer_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select c.id from public.customers c where c.auth_user_id = auth.uid() and auth.uid() is not null
$$;

create or replace function private.is_customer_of(t uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.customers c where c.tenant_id = t and c.auth_user_id = auth.uid() and auth.uid() is not null)
$$;

-- Accepts '9876543210', '919876543210', '+91 98765-43210' → '+919876543210'
create or replace function private.normalize_phone(p text)
returns text language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if length(d) = 10 and d ~ '^[6-9]' then return '+91' || d; end if;
  if length(d) = 12 and d like '91%' then return '+' || d; end if;
  if length(d) between 8 and 15 and coalesce(p, '') like '+%' then return '+' || d; end if;
  return null;
end $$;

create or replace function private.audit(t uuid, act text, ent text, ent_id uuid, d jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, data)
  values (t, auth.uid(), act, ent, ent_id, coalesce(d, '{}'::jsonb))
$$;

-- Block self-promotion to platform admin through the users table.
create or replace function private.guard_users_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_platform_admin is distinct from old.is_platform_admin
     and coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role'
     and not private.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger users_guard before update on public.users for each row execute function private.guard_users_update();

-- An owner cannot be removed or demoted if they are the last owner.
create or replace function private.guard_last_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare t uuid := coalesce(old.tenant_id, new.tenant_id);
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if (select count(*) from public.user_roles where tenant_id = t and role = 'owner') <= 1 then
      raise exception 'a business needs at least one owner' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger user_roles_last_owner before update or delete on public.user_roles
  for each row execute function private.guard_last_owner();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema private to anon, authenticated, service_role;
revoke all on all functions in schema private from public;
grant execute on function
  private.app_tables(), private.role_perms(public.app_role), private.is_platform_admin(), private.my_role(uuid),
  private.is_member(uuid), private.has_perm(uuid, text), private.can_use_branch(uuid, uuid),
  private.my_customer_ids(), private.is_customer_of(uuid)
to anon, authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array private.app_tables() loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant select on public.subscription_plans to anon;

-- Ledger-type tables: no direct writes from clients at all (functions only).
revoke insert, update, delete on
  public.loyalty_wallets, public.loyalty_transactions, public.purchases, public.visits,
  public.reward_redemptions, public.coupon_redemptions, public.referrals, public.customer_consents,
  public.qr_scans, public.feedback, public.audit_logs, public.subscriptions, public.payments,
  public.whatsapp_messages, public.tenants
from authenticated;
grant update (name, logo_url, brand_color, timezone, contact_phone, contact_email, settings) on public.tenants to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array private.app_tables() loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Platform admins can read everything.
do $$
declare t text;
begin
  foreach t in array private.app_tables() loop
    execute format('create policy %I on public.%I for select to authenticated using (private.is_platform_admin())', 'platform_admin_read', t);
  end loop;
end $$;

-- plans
create policy plans_public_read on public.subscription_plans for select to anon, authenticated using (is_public);
create policy plans_admin_write on public.subscription_plans for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

-- tenants
create policy tenants_member_read on public.tenants for select to authenticated using (private.is_member(id));
create policy tenants_settings_update on public.tenants for update to authenticated
  using (private.has_perm(id, 'manage_settings')) with check (private.has_perm(id, 'manage_settings'));

-- branches
create policy branches_member_read on public.branches for select to authenticated using (private.is_member(tenant_id));
create policy branches_manage on public.branches for all to authenticated
  using (private.has_perm(tenant_id, 'manage_branches')) with check (private.has_perm(tenant_id, 'manage_branches'));

-- users (staff profiles)
create policy users_self_read on public.users for select to authenticated using (id = auth.uid());
create policy users_colleague_read on public.users for select to authenticated using (
  exists (select 1 from public.user_roles a join public.user_roles b on a.tenant_id = b.tenant_id
          where a.user_id = auth.uid() and b.user_id = users.id));
create policy users_self_insert on public.users for insert to authenticated with check (id = auth.uid() and not is_platform_admin);
create policy users_self_update on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- user_roles / staff
create policy user_roles_read on public.user_roles for select to authenticated
  using (user_id = auth.uid() or private.is_member(tenant_id));
create policy user_roles_manage on public.user_roles for all to authenticated
  using (private.has_perm(tenant_id, 'manage_staff')) with check (private.has_perm(tenant_id, 'manage_staff'));
create policy staff_read on public.staff_members for select to authenticated using (private.is_member(tenant_id));
create policy staff_manage on public.staff_members for all to authenticated
  using (private.has_perm(tenant_id, 'manage_staff')) with check (private.has_perm(tenant_id, 'manage_staff'));

-- QR codes
create policy qr_read on public.qr_codes for select to authenticated using (private.is_member(tenant_id));
create policy qr_manage on public.qr_codes for all to authenticated
  using (private.has_perm(tenant_id, 'manage_qr')) with check (private.has_perm(tenant_id, 'manage_qr'));
create policy qr_scans_read on public.qr_scans for select to authenticated using (private.has_perm(tenant_id, 'view_dashboard'));

-- customers
create policy customers_staff_read on public.customers for select to authenticated using (private.has_perm(tenant_id, 'view_customers'));
create policy customers_self_read on public.customers for select to authenticated using (auth_user_id = auth.uid());
create policy customers_staff_update on public.customers for update to authenticated
  using (private.has_perm(tenant_id, 'manage_customers')) with check (private.has_perm(tenant_id, 'manage_customers'));
revoke insert, delete on public.customers from authenticated;   -- created via register functions

-- per-customer data: staff of the tenant, or the customer themself
do $$
declare t text;
begin
  foreach t in array array['customer_consents','loyalty_wallets','loyalty_transactions','reward_redemptions',
                           'coupon_redemptions','purchases','visits','feedback'] loop
    execute format('create policy %I on public.%I for select to authenticated using (private.has_perm(tenant_id, %L))', t || '_staff_read', t, 'view_customers');
    execute format('create policy %I on public.%I for select to authenticated using (customer_id in (select private.my_customer_ids()))', t || '_self_read', t);
  end loop;
end $$;
create policy referrals_staff_read on public.referrals for select to authenticated using (private.has_perm(tenant_id, 'view_customers'));
create policy referrals_self_read on public.referrals for select to authenticated
  using (referrer_id in (select private.my_customer_ids()) or referee_id in (select private.my_customer_ids()));

-- loyalty configuration
create policy programs_read on public.loyalty_programs for select to authenticated
  using (private.is_member(tenant_id) or private.is_customer_of(tenant_id));
create policy programs_manage on public.loyalty_programs for all to authenticated
  using (private.has_perm(tenant_id, 'manage_loyalty')) with check (private.has_perm(tenant_id, 'manage_loyalty'));
create policy rules_read on public.loyalty_rules for select to authenticated
  using (private.is_member(tenant_id) or private.is_customer_of(tenant_id));
create policy rules_manage on public.loyalty_rules for all to authenticated
  using (private.has_perm(tenant_id, 'manage_loyalty')) with check (private.has_perm(tenant_id, 'manage_loyalty'));

-- rewards & coupons
create policy rewards_read on public.rewards for select to authenticated
  using (private.is_member(tenant_id) or (is_active and private.is_customer_of(tenant_id)));
create policy rewards_manage on public.rewards for all to authenticated
  using (private.has_perm(tenant_id, 'manage_loyalty')) with check (private.has_perm(tenant_id, 'manage_loyalty'));
create policy coupons_staff_read on public.coupons for select to authenticated using (private.is_member(tenant_id));
create policy coupons_self_read on public.coupons for select to authenticated
  using (is_active and (customer_id in (select private.my_customer_ids())
                        or (customer_id is null and private.is_customer_of(tenant_id))));
create policy coupons_manage on public.coupons for all to authenticated
  using (private.has_perm(tenant_id, 'manage_loyalty') or private.has_perm(tenant_id, 'create_campaigns'))
  with check (private.has_perm(tenant_id, 'manage_loyalty') or private.has_perm(tenant_id, 'create_campaigns'));

-- campaigns, WhatsApp, AI
do $$
declare t text;
begin
  foreach t in array array['campaigns','campaign_recipients','whatsapp_templates','ai_insights'] loop
    execute format('create policy %I on public.%I for select to authenticated using (private.has_perm(tenant_id, %L) or private.has_perm(tenant_id, %L))', t || '_read', t, 'create_campaigns', 'view_dashboard');
    execute format('create policy %I on public.%I for all to authenticated using (private.has_perm(tenant_id, %L)) with check (private.has_perm(tenant_id, %L))', t || '_manage', t, 'create_campaigns', 'create_campaigns');
  end loop;
end $$;
create policy whatsapp_messages_read on public.whatsapp_messages for select to authenticated
  using (private.has_perm(tenant_id, 'create_campaigns') or private.has_perm(tenant_id, 'view_dashboard'));

-- billing, support, audit
create policy subscriptions_read on public.subscriptions for select to authenticated using (private.is_member(tenant_id));
create policy payments_read on public.payments for select to authenticated using (private.has_perm(tenant_id, 'manage_billing'));
create policy tickets_read on public.support_tickets for select to authenticated using (private.is_member(tenant_id));
create policy tickets_create on public.support_tickets for insert to authenticated
  with check (private.is_member(tenant_id) and opened_by = auth.uid());
create policy tickets_admin_update on public.support_tickets for update to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy audit_read on public.audit_logs for select to authenticated using (private.has_perm(tenant_id, 'manage_staff'));
