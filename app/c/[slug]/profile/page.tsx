import { redirect } from 'next/navigation';
import { getPortalSession, getPublicTenant } from '@/lib/portal';
import ProfileClient from '@/components/portal/ProfileClient';
import PortalNav from '@/components/portal/PortalNav';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({ params }: { params: { slug: string } }) {
  const t = await getPublicTenant(params.slug);
  const { card } = await getPortalSession(params.slug);
  if (!card) redirect(`/c/${params.slug}`);
  return (
    <main className="flex flex-col gap-5">
      <h1 className="font-display text-3xl font-extrabold">Profile</h1>
      <ProfileClient slug={params.slug} cafeName={t.name} appUrl={(process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')}
        customer={card.customer} consents={card.consents} referrals={card.referrals} />
      <PortalNav slug={params.slug} />
    </main>
  );
}
