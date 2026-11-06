'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { toAppError } from '@/lib/errors';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your cafe name').max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/, 'Use 3–48 lowercase letters, numbers or dashes'),
  branch: z.string().trim().min(1, 'Enter your first branch').max(120),
  city: z.string().trim().max(80).optional(),
  ownerName: z.string().trim().max(120).optional(),
});

export interface OnboardingState { error?: string }

export async function createBusiness(_prev: OnboardingState, form: FormData): Promise<OnboardingState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = createClient();
  const { data, error } = await supabase.rpc('create_tenant', {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_branch_name: parsed.data.branch,
    p_city: parsed.data.city || null,
    p_owner_name: parsed.data.ownerName || null,
  });
  if (error) return { error: toAppError(error).message };
  redirect(`/dashboard/${(data as { slug: string }).slug}?welcome=1`);
}
