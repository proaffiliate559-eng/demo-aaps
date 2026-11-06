'use client';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-5 text-center">
      <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted">Please try again. If it keeps happening, contact support{error.digest ? ` with code ${error.digest}` : ''}.</p>
      <button onClick={reset} className="rounded-xl bg-brand px-5 py-3 font-semibold text-white">Try again</button>
    </main>
  );
}
