import type { Metadata, Viewport } from 'next';
import { Inter, Bricolage_Grotesque } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', weight: ['500', '700', '800'] });

export const metadata: Metadata = {
  title: { default: 'CafeRepeat AI', template: '%s · CafeRepeat AI' },
  description: 'Digital loyalty, rewards and repeat-customer tools for Indian cafes and restaurants.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0E4D3A' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
