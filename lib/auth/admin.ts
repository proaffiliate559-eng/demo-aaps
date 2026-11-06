import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";

/** Server-side admin check via public.am_i_admin() (roles live in user_roles, not profiles). */
export const isCurrentUserAdmin = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("am_i_admin");
  return data === true;
});

/**
 * Use at the top of every admin page and action. Non-admins get a 404 so the
 * admin area's existence isn't revealed.
 */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !(await isCurrentUserAdmin())) notFound();
  return user;
}
