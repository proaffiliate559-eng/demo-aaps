"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "@/lib/zod";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/lib/admin/audit";
import { removeUserFiles } from "@/lib/storage/cleanup";
import { featureFlagsSchema } from "@/lib/settings/features";

export type AdminResult = { ok: true; message?: string } | { ok: false; message: string };

const uuid = z.uuid();

export async function setUserSuspended(userId: string, suspend: boolean): Promise<AdminResult> {
  const me = await requireAdmin();
  if (!uuid.safeParse(userId).success) return { ok: false, message: "Invalid user." };
  if (userId === me.id) return { ok: false, message: "You can't suspend your own account." };
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: suspend ? "876000h" : "none" });
  if (error) return { ok: false, message: error.message };
  await logAdminAction(me.id, suspend ? "user.suspend" : "user.unsuspend", userId);
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true, message: suspend ? "User suspended. They can't sign in." : "User reactivated." };
}

export async function setUserAdmin(userId: string, makeAdmin: boolean): Promise<AdminResult> {
  const me = await requireAdmin();
  if (!uuid.safeParse(userId).success) return { ok: false, message: "Invalid user." };
  if (userId === me.id && !makeAdmin) return { ok: false, message: "You can't remove your own admin role." };
  const admin = createAdminClient();
  const { error } = makeAdmin
    ? await admin.from("user_roles").upsert({ user_id: userId, role: "admin" })
    : await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
  if (error) return { ok: false, message: error.message };
  await logAdminAction(me.id, makeAdmin ? "role.grant_admin" : "role.revoke_admin", userId);
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true, message: makeAdmin ? "Admin role granted." : "Admin role removed." };
}

const grantSchema = z.object({ planSlug: z.string().max(40), days: z.coerce.number().int().min(1).max(366) });

/** Complimentary plan (support, testing, partners). */
export async function grantPlan(userId: string, input: z.input<typeof grantSchema>): Promise<AdminResult> {
  const me = await requireAdmin();
  const parsed = grantSchema.safeParse(input);
  if (!uuid.safeParse(userId).success || !parsed.success) return { ok: false, message: "Choose a plan and 1–366 days." };
  const admin = createAdminClient();
  const { data: plan } = await admin.from("plans").select("id, price").eq("slug", parsed.data.planSlug).maybeSingle();
  if (!plan || plan.price === 0) return { ok: false, message: "Choose a paid plan." };
  await admin.from("subscriptions").update({ status: "cancelled" }).eq("user_id", userId).eq("status", "active");
  const now = Date.now();
  const { error } = await admin.from("subscriptions").insert({
    user_id: userId,
    plan_id: plan.id,
    status: "active",
    started_at: new Date(now).toISOString(),
    expires_at: new Date(now + parsed.data.days * 86400_000).toISOString(),
    payment_reference: `admin-grant:${randomUUID()}`,
  });
  if (error) return { ok: false, message: error.message };
  await logAdminAction(me.id, "plan.grant", userId, parsed.data);
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true, message: `Granted ${parsed.data.planSlug} for ${parsed.data.days} days.` };
}

export async function revokePlan(userId: string): Promise<AdminResult> {
  const me = await requireAdmin();
  if (!uuid.safeParse(userId).success) return { ok: false, message: "Invalid user." };
  await createAdminClient().from("subscriptions").update({ status: "cancelled" }).eq("user_id", userId).eq("status", "active");
  await logAdminAction(me.id, "plan.revoke", userId);
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true, message: "Back on the Free plan." };
}

export async function deleteUserAsAdmin(userId: string): Promise<AdminResult> {
  const me = await requireAdmin();
  if (!uuid.safeParse(userId).success) return { ok: false, message: "Invalid user." };
  if (userId === me.id) return { ok: false, message: "Delete your own account from Settings instead." };
  const admin = createAdminClient();
  await removeUserFiles(admin, userId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, message: error.message };
  await logAdminAction(me.id, "user.delete", userId);
  revalidatePath("/admin/users");
  redirect("/admin/users?deleted=1");
}

const planSchema = z.object({
  name: z.string().trim().min(2).max(30),
  price: z.coerce.number().int().min(0).max(100_000),
  generationLimit: z.coerce.number().int().min(0).max(10_000),
  savedLimit: z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.number().int().min(0).max(100_000).nullable()),
  isActive: z.boolean(),
  features: z.array(z.string().trim().min(1).max(80)).max(8),
});

export async function updatePlan(slug: string, input: z.input<typeof planSchema>): Promise<AdminResult> {
  const me = await requireAdmin();
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid plan." };
  const d = parsed.data;
  if (slug === "free" && (d.price !== 0 || !d.isActive)) return { ok: false, message: "The Free plan must stay active and free." };
  if (slug !== "free" && d.price === 0) return { ok: false, message: "Paid plans need a price above ₹0." };
  const { error, count } = await createAdminClient()
    .from("plans")
    .update({ name: d.name, price: d.price, generation_limit: d.generationLimit, saved_limit: d.savedLimit, is_active: d.isActive, features: d.features }, { count: "exact" })
    .eq("slug", slug);
  if (error || !count) return { ok: false, message: error?.message ?? "Plan not found." };
  await logAdminAction(me.id, "plan.update", null, { slug, ...d });
  revalidatePath("/admin/plans");
  revalidatePath("/");
  return { ok: true, message: "Plan saved." };
}

export async function updateAppSettings(input: { freeDailyLimit: number; features: unknown }): Promise<AdminResult> {
  const me = await requireAdmin();
  const limit = z.coerce.number().int().min(0).max(100).safeParse(input.freeDailyLimit);
  const flags = featureFlagsSchema.safeParse(input.features);
  if (!limit.success) return { ok: false, message: "Free daily limit must be 0–100." };
  if (!flags.success) return { ok: false, message: "Invalid feature settings." };
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from("app_settings").upsert([
    { key: "free_daily_generation_limit", value: limit.data, updated_at: now },
    { key: "features", value: flags.data, updated_at: now },
  ]);
  if (error) return { ok: false, message: error.message };
  await logAdminAction(me.id, "settings.update", null, { freeDailyLimit: limit.data, features: flags.data });
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

export async function setReportStatus(reportId: string, status: "open" | "reviewed" | "dismissed"): Promise<AdminResult> {
  const me = await requireAdmin();
  if (!uuid.safeParse(reportId).success || !["open", "reviewed", "dismissed"].includes(status)) return { ok: false, message: "Invalid." };
  const { error } = await createAdminClient().from("content_reports").update({ status }).eq("id", reportId);
  if (error) return { ok: false, message: error.message };
  await logAdminAction(me.id, `report.${status}`, null, { reportId });
  revalidatePath("/admin/reports");
  return { ok: true };
}

export async function runExpireSubscriptions(): Promise<AdminResult> {
  const me = await requireAdmin();
  const { data, error } = await createAdminClient().rpc("expire_subscriptions");
  if (error) return { ok: false, message: error.message };
  await logAdminAction(me.id, "subscriptions.expire", null, { expired: data });
  revalidatePath("/admin");
  return { ok: true, message: `${data ?? 0} expired passes closed.` };
}
