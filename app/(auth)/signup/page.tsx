import Link from 'next/link';
import { Suspense } from 'react';
import StaffAuthForm from '@/components/auth/StaffAuthForm';
import { Card } from '@/components/ui';

export const metadata = { title: 'Create your cafe' };

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-5 py-10">
      <Link href="/" className="font-display text-xl font-extrabold text-brand">CafeRepeat AI</Link>
      <Card className="flex flex-col gap-5 p-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Start your 14-day free trial</h1>
          <p className="text-sm text-muted">Create the owner account first. Next you add your cafe.</p>
        </div>
        <Suspense>
          <StaffAuthForm mode="signup" />
        </Suspense>
      </Card>
      <p className="text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-semibold text-brand underline">Log in</Link>
      </p>
    </main>
  );
}
