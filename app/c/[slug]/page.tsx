import { redirect } from 'next/navigation';
import { getPortalSession, getPublicTenant } from '@/lib/portal';
import JoinFlow from '@/components/portal/JoinFlow';

export const dynamic = 'force-dynamic';

export default async function PortalHome({ params, searchParams }: { params: { slug: string }; searchParams: { b?: string; qr?: string; ref?: string } }) {
  const t = await getPublicTenant(params.slug);
  const { user, card } = await getPortalSession(params.slug);
  if (card) redirect(`/c/${params.slug}/card`);

  const p = t.program;
  const perks = [
    p?.points_enabled && `${p.points_per_100} points on every ₹100`,
    p?.stamps_enabled && p.stamp_goal && `Free treat after ${p.stamp_goal} ${p.stamp_item_keyword ? p.stamp_item_keyword + 's' : 'visits'}`,
    p?.cashback_enabled && Number(p.cashback_percent) > 0 && `${p.cashback_percent}% cashback`,
    p?.signup_bonus_points ? `${p.signup_bonus_points} welcome points` : null,
    p?.birthday_points ? 'Birthday reward every year' : null,
  ].filter(Boolean) as string[];

  return (
    <main className="flex flex-col gap-6">
      <section className="-mx-5 -mt-5 flex flex-col gap-4 rounded-b-[32px] bg-brand px-6 pb-8 pt-10 text-white">
        <span className="text-sm font-semibold uppercase tracking-wider opacity-90">{t.name}</span>
        <h1 className="font-display text-4xl font-extrabold leading-tight">{p?.name ?? 'Rewards'}</h1>
        <ul className="flex flex-col gap-2 text-[15px]">
          {perks.map((x) => <li key={x} className="flex items-center gap-2"><span aria-hidden className="h-2 w-2 rounded-full bg-accent" />{x}</li>)}
        </ul>
        <p className="text-sm opacity-90">No app to download.</p>
      </section>
      <JoinFlow
        slug={params.slug}
        cafeName={t.name}
        signedInPhone={user?.phone ? `+${user.phone.replace(/^\+/, '')}` : null}
        signedInWithoutPhone={!!user && !user.phone}
        branchId={t.branches.some((b) => b.id === searchParams.b) ? searchParams.b! : null}
        qrId={searchParams.qr && /^[0-9a-f-]{36}$/i.test(searchParams.qr) ? searchParams.qr : null}
        referralCode={searchParams.ref?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) ?? ''}
      />
    </main>
  );
}
