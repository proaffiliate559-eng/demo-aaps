import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export async function logAdminAction(adminId: string, action: string, targetUserId: string | null, details: Record<string, unknown> = {}) {
  await createAdminClient().from("admin_audit_log").insert({
    admin_id: adminId,
    action,
    target_user_id: targetUserId,
    details: details as NonNullable<Json>,
  });
}
