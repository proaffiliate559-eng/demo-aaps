import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { can, type Permission, type Role } from '@/lib/permissions';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  brand_color: string;
  logo_url: string | null;
  trial_ends_at: string | null;
}
export interface Branch {
  id: string;
  name: string;
  city: string | null;
  is_active: boolean;
}
export interface StaffContext {
  userId: string;
  email: string | null;
  tenant: Tenant;
  role: Role;
  branches: Branch[];
  allowedBranchIds: string[] | null; // null = all branches
}

export const getUser = cache(async () => {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export const getMyBusinesses = cache(async () => {
  const user = await getUser();
  if (!user) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from('user_roles')
    .select('role, tenants!inner(id, name, slug, status)')
    .eq('user_id', user.id);
  return (data ?? []).map((r: { role: Role; tenants: unknown }) => ({ role: r.role, tenant: r.tenants as Tenant }));
});

// Loads the tenant by slug for the signed-in staff member. RLS guarantees a
// user only ever sees tenants they belong to.
export const getStaffContext = cache(async (slug: string): Promise<StaffContext> => {
  const user = await getUser();
  if (!user) redirect(`/login?next=/dashboard/${slug}`);
  const supabase = createClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, status, brand_color, logo_url, trial_ends_at')
    .eq('slug', slug)
    .maybeSingle();
  if (!tenant) notFound();

  const [{ data: roleRow }, { data: branches }, { data: staff }] = await Promise.all([
    supabase.from('user_roles').select('role').eq('tenant_id', tenant.id).eq('user_id', user.id).maybeSingle(),
    supabase.from('branches').select('id, name, city, is_active').eq('tenant_id', tenant.id).order('name'),
    supabase.from('staff_members').select('branch_id, is_active').eq('tenant_id', tenant.id).eq('user_id', user.id),
  ]);
  if (!roleRow) notFound();
  const role = roleRow.role as Role;

  let allowed: string[] | null = null;
  if (role === 'cashier' || role === 'marketing') {
    const rows = (staff ?? []).filter((s: { is_active: boolean }) => s.is_active);
    allowed = rows.some((s: { branch_id: string | null }) => s.branch_id === null)
      ? null
      : rows.map((s: { branch_id: string | null }) => s.branch_id as string);
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    tenant: tenant as Tenant,
    role,
    branches: (branches ?? []) as Branch[],
    allowedBranchIds: allowed,
  };
});

export async function requirePerm(slug: string, perm: Permission) {
  const ctx = await getStaffContext(slug);
  if (!can(ctx.role, perm)) redirect(`/dashboard/${slug}?denied=${perm}`);
  return ctx;
}
