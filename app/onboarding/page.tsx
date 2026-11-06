import { redirect } from 'next/navigation';
import { Card } from '@/components/ui';
import { getMyBusinesses, getUser } from '@/lib/staff';
import OnboardingForm from './OnboardingForm';

export const metadata = { title: 'Set up your cafe' };

export default async function OnboardingPage({ searchParams }: { searchParams: { new?: string } }) {
  const user = await getUser();
  if (!user) redirect('/login?next=/onboarding');
  const mine = await getMyBusinesses();
  if (mine.length > 0 && !searchParams.new) redirect(`/dashboard/${mine[0].tenant.slug}`);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-5 py-10">
      <div>
        <p className="font-display text-xl font-extrabold text-brand">CafeRepeat AI</p>
        <h1 className="mt-4 font-display text-3xl font-extrabold">Add your cafe</h1>
        <p className="text-muted">Takes a minute. You can add more branches later.</p>
      </div>
      <Card className="p-6">
        <OnboardingForm ownerName={String(user.user_metadata?.full_name ?? '')} />
      </Card>
    </main>
  );
}
