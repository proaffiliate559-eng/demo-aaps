import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="container-page flex min-h-dvh flex-col items-center justify-center text-center">
      <Logo />
      <p className="eyebrow mt-12">404</p>
      <h1 className="mt-3 font-display text-5xl sm:text-6xl">This look isn&apos;t in our collection</h1>
      <p className="mt-4 max-w-md text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Button asChild className="mt-8" size="lg">
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
