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
