import Link from 'next/link';
import { Suspense } from 'react';
import StaffAuthForm from '@/components/auth/StaffAuthForm';
import { Card } from '@/components/ui';

export const metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-5 py-10">
      <Link href="/" className="font-display text-xl font-extrabold text-brand">CafeRepeat AI</Link>
      <Card className="flex flex-col gap-5 p-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Log in</h1>
          <p className="text-sm text-muted">For cafe owners and staff.</p>
        </div>
        <Suspense>
          <StaffAuthForm mode="login" />
        </Suspense>
      </Card>
      <p className="text-center text-sm text-muted">
        New here? <Link href="/signup" className="font-semibold text-brand underline">Create your cafe</Link>
      </p>
    </main>
  );
}
