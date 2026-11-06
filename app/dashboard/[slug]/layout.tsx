import { getStaffContext } from '@/lib/staff';
import Nav from '@/components/dashboard/Nav';

export default async function TenantLayout({ children, params }: { children: React.ReactNode; params: { slug: string } }) {
  const ctx = await getStaffContext(params.slug);
  const trialDays = ctx.tenant.status === 'trial' && ctx.tenant.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(ctx.tenant.trial_ends_at).getTime() - Date.now()) / 86_400_000))
    : null;
  return (
    <div className="min-h-screen md:flex">
      <Nav slug={ctx.tenant.slug} name={ctx.tenant.name} role={ctx.role} email={ctx.email} />
      <main className="min-w-0 flex-1 p-5 md:p-8">
        {trialDays !== null && (
          <p className="no-print mb-4 rounded-xl bg-sand px-4 py-2 text-sm font-semibold text-warn">
            Free trial: {trialDays} day{trialDays === 1 ? '' : 's'} left
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
