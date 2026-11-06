import type { LucideIcon } from "lucide-react";
import { Home, WandSparkles, Shirt, Heart, MessageCircle, UserRound, Settings, CreditCard } from "lucide-react";

export interface AppNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** false = feature ships in a later phase; rendered as a non-interactive "Soon" item. */
  available: boolean;
  /** Admin feature switch that can hide this item. */
  feature?: "stylist_chat" | "wardrobe";
}

export const APP_NAV: AppNavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home, available: true },
  { href: "/generate", label: "Generate Outfit", icon: WandSparkles, available: true },
  { href: "/wardrobe", label: "My Wardrobe", icon: Shirt, available: true, feature: "wardrobe" },
  { href: "/saved", label: "Saved Looks", icon: Heart, available: true },
  { href: "/stylist", label: "AI Stylist", icon: MessageCircle, available: true, feature: "stylist_chat" },
  { href: "/profile", label: "Fashion Profile", icon: UserRound, available: true },
  { href: "/billing", label: "Plans & Billing", icon: CreditCard, available: true },
  { href: "/settings", label: "Settings", icon: Settings, available: true },
];

export const isNavAvailable = (href: string) => APP_NAV.find((n) => n.href === href)?.available ?? false;
