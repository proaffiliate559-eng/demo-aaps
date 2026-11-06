import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface Tier { key: string; name: string; min_points: number; multiplier: number }
export interface PublicTenant {
  id: string; name: string; slug: string; logo_url: string | null; brand_color: string;
  program: null | {
    name: string; points_enabled: boolean; stamps_enabled: boolean; cashback_enabled: boolean;
    points_per_100: number; cashback_percent: number; stamp_item_keyword: string | null; min_purchase_amount: number;
    signup_bonus_points: number; birthday_points: number; referral_referee_points: number; tiers: Tier[]; stamp_goal: number | null;
  };
  branches: { id: string; name: string; city: string | null }[];
  rewards: { id: string; name: string; cost_type: string; cost_value: number; reward_type: string }[];
}
export interface HistoryRow {
  id: string; kind: string; points_delta: number; stamps_delta: number; cashback_delta: number;
  note: string | null; created_at: string; branch: string | null; amount: number | null;
}
export interface MyCard {
  customer: { id: string; name: string | null; phone: string; email: string | null; birthday: string | null; referral_code: string;
    total_visits: number; member_since: string; last_visit_at: string | null };
  wallet: { points: number; stamps: number; cashback: number; lifetime_points: number; tier: string };
  tier: Tier; next_tier: Tier | null;
  consents: Record<string, boolean>;
  pending_redemptions: { id: string; code: string; reward: string; expires_at: string }[];
  history: HistoryRow[];
  visits: { id: string; created_at: string; branch: string | null; amount: number | null }[];
  referrals: { joined: number; completed: number; referrer_points: number; referee_points: number };
}

export const getPublicTenant = cache(async (slug: string): Promise<PublicTenant> => {
  const supabase = createClient();
  const { data } = await supabase.rpc('get_public_tenant', { p_slug: slug });
  if (!data) notFound();
  return data as PublicTenant;
});

export const getPortalSession = cache(async (slug: string) => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, card: null as MyCard | null };
  const { data } = await supabase.rpc('get_my_card', { p_tenant_slug: slug });
  return { user, card: (data ?? null) as MyCard | null };
});

export function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}` : '14 77 58';
}
