'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { can, type Permission, type Role } from '@/lib/permissions';
import { cx } from '@/components/ui';

const ITEMS: { href: string; label: string; perm: Permission }[] = [
  { href: '', label: 'Overview', perm: 'view_dashboard' },
  { href: '/cashier', label: 'Cashier', perm: 'record_purchases' },
  { href: '/customers', label: 'Customers', perm: 'view_customers' },
  { href: '/rewards', label: 'Rewards', perm: 'manage_loyalty' },
  { href: '/loyalty', label: 'Loyalty rules', perm: 'manage_loyalty' },
  { href: '/qr', label: 'QR codes', perm: 'manage_qr' },
  { href: '/branches', label: 'Branches', perm: 'manage_branches' },
];

export default function Nav({ slug, name, role, email }: { slug: string; name: string; role: Role; email: string | null }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const base = `/dashboard/${slug}`;
  const items = ITEMS.filter((i) => can(role, i.perm));

  const links = (
    <nav aria-label="Dashboard" className="flex flex-col gap-1">
      {items.map((i) => {
        const href = base + i.href;
        const active = i.href === '' ? path === base : path.startsWith(href);
        return (
          <Link key={i.href} href={href} aria-current={active ? 'page' : undefined} onClick={() => setOpen(false)}
            className={cx('rounded-xl px-3 py-2.5 text-[15px]', active ? 'bg-white/15 font-bold text-white' : 'text-[#E3F1E8] hover:bg-white/10')}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <div className="no-print sticky top-0 z-30 flex items-center justify-between bg-brand px-4 py-3 text-white md:hidden">
        <span className="font-display text-lg font-extrabold">{name}</span>
        <button aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}
          className="rounded-lg border border-white/40 px-3 py-1.5 text-sm font-semibold">{open ? 'Close' : 'Menu'}</button>
      </div>
      {open && <div id="mobile-nav" className="no-print bg-brand px-4 pb-4 md:hidden">{links}</div>}

      <aside className="no-print hidden w-64 shrink-0 flex-col gap-6 bg-brand px-4 py-6 text-white md:flex">
        <div className="px-2">
          <p className="font-display text-xl font-extrabold leading-tight">{name}</p>
          <p className="text-xs capitalize opacity-80">{role}</p>
        </div>
        {links}
        <div className="mt-auto flex flex-col gap-2 px-2 text-xs opacity-90">
          <span className="truncate">{email}</span>
          <form action="/auth/signout" method="post">
            <button className="font-semibold underline">Log out</button>
          </form>
        </div>
      </aside>
    </>
  );
}
