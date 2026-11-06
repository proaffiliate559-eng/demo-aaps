'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/card', label: 'Card', d: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18' },
  { href: '/rewards', label: 'Rewards', d: 'M3 8h18v4H3zM12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5M12 8s1.5-5 4-5a2.5 2.5 0 0 1 0 5' },
  { href: '/history', label: 'History', d: 'M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5' },
  { href: '/profile', label: 'Profile', d: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0' },
];

export default function PortalNav({ slug }: { slug: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="fixed bottom-4 left-1/2 z-20 grid h-16 w-[min(416px,calc(100%-24px))] -translate-x-1/2 grid-cols-4 items-center rounded-[22px] border border-line bg-white shadow-lg">
      {TABS.map((t) => {
        const href = `/c/${slug}${t.href}`;
        const on = path.startsWith(href);
        return (
          <Link key={t.href} href={href} aria-current={on ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 text-[11px] ${on ? 'font-bold text-brand' : 'font-medium text-muted'}`}>
            <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={t.d} /></svg>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
