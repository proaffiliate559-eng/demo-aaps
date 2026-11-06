import type { Metadata } from 'next';
import { getPublicTenant, hexToRgb } from '@/lib/portal';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const t = await getPublicTenant(params.slug);
  return { title: { absolute: `${t.program?.name ?? t.name} · ${t.name}` }, robots: { index: false } };
}

export default async function PortalLayout({ children, params }: { children: React.ReactNode; params: { slug: string } }) {
  const t = await getPublicTenant(params.slug);
  return (
    <div style={{ ['--brand' as string]: hexToRgb(t.brand_color) }} className="mx-auto min-h-screen max-w-md px-5 pb-28 pt-5">
      {children}
    </div>
  );
}
