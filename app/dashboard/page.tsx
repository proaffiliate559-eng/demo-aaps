import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMyBusinesses } from '@/lib/staff';
import { Card } from '@/components/ui';

export default async function DashboardIndex() {
  const mine = await getMyBusinesses();
  if (mine.length === 0) redirect('/onboarding');
  if (mine.length === 1) redirect(`/dashboard/${mine[0].tenant.slug}`);
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 px-5 py-10">
      <h1 className="font-display text-2xl font-bold">Choose a business</h1>
      {mine.map((m) => (
        <Link key={m.tenant.id} href={`/dashboard/${m.tenant.slug}`}>
          <Card className="flex items-center justify-between p-4 hover:border-brand">
            <span className="font-semibold">{m.tenant.name}</span>
            <span className="text-sm capitalize text-muted">{m.role}</span>
          </Card>
        </Link>
      ))}
      <Link href="/onboarding?new=1" className="text-sm font-semibold text-brand underline">+ Add another business</Link>
    </main>
  );
}
