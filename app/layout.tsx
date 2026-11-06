import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "StyleMood AI — Your Personal AI Stylist",
    template: "%s · StyleMood AI",
  },
  description:
    "Discover the perfect outfit for every mood, moment and occasion. Personalised AI outfit recommendations for India.",
  openGraph: {
    title: "StyleMood AI — Your Personal AI Stylist",
    description: "Discover the perfect outfit for every mood, moment and occasion.",
    type: "website",
    locale: "en_IN",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf8f5",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Reading headers makes every page render per request, so each gets a fresh CSP nonce.
  await headers();
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-dvh bg-background text-foreground">{children}</body>
    </html>
  );
}
