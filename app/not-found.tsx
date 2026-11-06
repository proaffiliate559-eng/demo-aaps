import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-5 text-center">
      <p className="font-display text-5xl font-extrabold text-brand">404</p>
      <h1 className="font-display text-2xl font-bold">Page not found</h1>
      <p className="text-muted">This cafe or page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/" className="rounded-xl bg-brand px-5 py-3 font-semibold text-white">Go home</Link>
    </main>
  );
}
