/**
 * Database permission tests against the local Supabase stack.
 * Run: npm run db:start && npm run test:db
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type Client = SupabaseClient<Database>;
const admin: Client = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });

async function makeUser(tag: string) {
  const email = `rls-${tag}-${Date.now()}@example.com`;
  const password = "Rls-test-1234";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `User ${tag}` },
  });
  if (error) throw error;
  const client = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, email, client };
}

let a: Awaited<ReturnType<typeof makeUser>>;
let b: Awaited<ReturnType<typeof makeUser>>;
let outfitA: string;

beforeAll(async () => {
  a = await makeUser("a");
  b = await makeUser("b");
  const { data, error } = await admin
    .from("outfits")
    .insert({
      user_id: a.id,
      request_id: crypto.randomUUID(),
      tier: "safe",
      name: "Test look",
      mood: "happy",
      occasion: "college",
      style: "casual",
      outfit_data: {},
      provider: "test",
    })
    .select("id")
    .single();
  if (error) throw error;
  outfitA = data.id;
});

afterAll(async () => {
  await admin.auth.admin.deleteUser(a.id);
  await admin.auth.admin.deleteUser(b.id);
});

describe("signup bootstrap", () => {
  it("creates profile and preferences rows with the display name", async () => {
    const { data } = await a.client.from("profiles").select("display_name, email").single();
    expect(data).toEqual({ display_name: "User a", email: a.email });
    const { count } = await a.client.from("user_preferences").select("*", { count: "exact", head: true });
    expect(count).toBe(1);
  });
});

describe("row level security", () => {
  it("users only see their own profile", async () => {
    const { data } = await b.client.from("profiles").select("id");
    expect(data?.map((r) => r.id)).toEqual([b.id]);
  });

  it("users cannot update another user's profile", async () => {
    const { data } = await b.client.from("profiles").update({ display_name: "Hacked" }).eq("id", a.id).select();
    expect(data).toEqual([]);
    const { data: check } = await admin.from("profiles").select("display_name").eq("id", a.id).single();
    expect(check?.display_name).toBe("User a");
  });

  it("users cannot change their email via profiles", async () => {
    const { error } = await a.client.from("profiles").update({ email: "x@evil.com" } as never).eq("id", a.id);
    expect(error?.code).toBe("42501");
  });

  it("users cannot grant themselves admin", async () => {
    const { error } = await a.client.from("user_roles").insert({ user_id: a.id, role: "admin" });
    expect(error).toBeTruthy();
    const { data } = await a.client.rpc("am_i_admin");
    expect(data).toBe(false);
    // Users can't probe whether OTHER accounts are admins.
    const probe = await a.client.rpc("is_admin", { uid: b.id });
    expect(probe.error).toBeTruthy();
  });

  it("users cannot insert outfits directly (server-only)", async () => {
    const { error } = await a.client.from("outfits").insert({
      user_id: a.id, request_id: crypto.randomUUID(), tier: "safe", name: "x", mood: "m",
      occasion: "o", style: "s", outfit_data: {}, provider: "fake",
    });
    expect(error).toBeTruthy();
  });

  it("users cannot read or save another user's outfit", async () => {
    const { data } = await b.client.from("outfits").select("id").eq("id", outfitA);
    expect(data).toEqual([]);
    const { error } = await b.client.from("saved_outfits").insert({ user_id: b.id, outfit_id: outfitA });
    expect(error).toBeTruthy();
  });

  it("owners can save and unsave their outfit", async () => {
    const ins = await a.client.from("saved_outfits").insert({ user_id: a.id, outfit_id: outfitA });
    expect(ins.error).toBeNull();
    const del = await a.client.from("saved_outfits").delete().eq("outfit_id", outfitA).select();
    expect(del.data).toHaveLength(1);
  });

  it("users cannot write usage or subscriptions", async () => {
    const u = await a.client.from("ai_usage").insert({ user_id: a.id, provider: "x", feature: "chat", status: "success" });
    expect(u.error).toBeTruthy();
    const { data: plan } = await a.client.from("plans").select("id").eq("slug", "premium").single();
    const s = await a.client.from("subscriptions").insert({ user_id: a.id, plan_id: plan!.id, status: "active" });
    expect(s.error).toBeTruthy();
  });

  it("anonymous visitors can read plans but no user data", async () => {
    const anon = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
    const { data: plans } = await anon.from("plans").select("slug").order("sort_order");
    expect(plans?.map((p) => p.slug)).toEqual(["free", "basic", "pro", "premium"]);
    const { data: profiles, error } = await anon.from("profiles").select("id");
    expect(profiles ?? []).toEqual([]);
    expect(error?.code ?? "42501").toBe("42501");
  });

  it("deleting the auth user cascades all their data", async () => {
    const c = await makeUser("c");
    await c.client.from("wardrobe_items").insert({ user_id: c.id, name: "Tee", category: "t_shirts" });
    await admin.auth.admin.deleteUser(c.id);
    const { count } = await admin.from("wardrobe_items").select("*", { count: "exact", head: true }).eq("user_id", c.id);
    expect(count).toBe(0);
    const { count: pc } = await admin.from("profiles").select("*", { count: "exact", head: true }).eq("id", c.id);
    expect(pc).toBe(0);
  });
});

describe("generation quota (atomic, server-only)", () => {
  it("users cannot call reserve_generation themselves", async () => {
    const { error } = await a.client.rpc("reserve_generation", { p_user: a.id, p_provider: "x" });
    expect(error).toBeTruthy();
  });

  it("reserves up to the free limit, then refuses — even under concurrency", async () => {
    const d = await makeUser("quota");
    const results = await Promise.all(
      Array.from({ length: 6 }, () => admin.rpc("reserve_generation", { p_user: d.id, p_provider: "test" })),
    );
    const granted = results.filter((r) => r.data).length;
    expect(granted).toBe(3);
    const { data: q } = await d.client.rpc("my_generation_quota").single();
    expect(q).toMatchObject({ plan_slug: "free", lim: 3, used: 3 });
    await admin.auth.admin.deleteUser(d.id);
  });

  it("failed generations refund the credit", async () => {
    const e = await makeUser("refund");
    const { data: id } = await admin.rpc("reserve_generation", { p_user: e.id, p_provider: "test" });
    await admin.from("ai_usage").update({ status: "error" }).eq("id", id!);
    const { data: q } = await e.client.rpc("my_generation_quota").single();
    expect(q?.used).toBe(0);
    await admin.auth.admin.deleteUser(e.id);
  });

  it("an active paid subscription switches to the monthly limit", async () => {
    const f = await makeUser("paid");
    const { data: plan } = await admin.from("plans").select("id").eq("slug", "basic").single();
    const now = Date.now();
    await admin.from("subscriptions").insert({
      user_id: f.id, plan_id: plan!.id, status: "active",
      started_at: new Date(now - 40 * 86400000).toISOString(),
      expires_at: new Date(now + 20 * 86400000).toISOString(),
    });
    const { data: q } = await f.client.rpc("my_generation_quota").single();
    expect(q).toMatchObject({ plan_slug: "basic", period: "month", lim: 30, used: 0 });
    expect(new Date(q!.period_start).getTime()).toBeGreaterThan(now - 31 * 86400000);
    await admin.auth.admin.deleteUser(f.id);
  });
});

describe("storage", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

  it("users can upload only into their own folder and cannot read others' files", async () => {
    const own = await a.client.storage.from("user-uploads").upload(`${a.id}/t.png`, png, { contentType: "image/png" });
    expect(own.error).toBeNull();
    const other = await b.client.storage.from("user-uploads").upload(`${a.id}/evil.png`, png, { contentType: "image/png" });
    expect(other.error).toBeTruthy();
    const read = await b.client.storage.from("user-uploads").download(`${a.id}/t.png`);
    expect(read.error).toBeTruthy();
    const signed = await b.client.storage.from("user-uploads").createSignedUrl(`${a.id}/t.png`, 60);
    expect(signed.error).toBeTruthy();
  });

  it("users cannot write to the AI image bucket or upload disallowed types", async () => {
    const r = await a.client.storage.from("outfit-images").upload(`${a.id}/x.png`, png, { contentType: "image/png" });
    expect(r.error).toBeTruthy();
    const svg = await a.client.storage.from("user-uploads").upload(`${a.id}/x.svg`, new TextEncoder().encode("<svg/>"), { contentType: "image/svg+xml" });
    expect(svg.error).toBeTruthy();
  });
});

describe("chat & wardrobe permissions", () => {
  it("users cannot write chat messages or conversations directly", async () => {
    const { error: e1 } = await a.client.from("chat_conversations").insert({ user_id: a.id, title: "x" });
    expect(e1).toBeTruthy();
    const { data: convo } = await admin.from("chat_conversations").insert({ user_id: a.id, title: "t" }).select("id").single();
    const { error: e2 } = await a.client.from("chat_messages").insert({ conversation_id: convo!.id, role: "assistant", content: "fake" });
    expect(e2).toBeTruthy();
    // Other users can't read it; the owner can delete it.
    const { data: peek } = await b.client.from("chat_conversations").select("id").eq("id", convo!.id);
    expect(peek).toEqual([]);
    const { data: del } = await a.client.from("chat_conversations").delete().eq("id", convo!.id).select();
    expect(del).toHaveLength(1);
  });

  it("wardrobe image paths must be inside the owner's wardrobe folder", async () => {
    const bad = await a.client.from("wardrobe_items").insert({ user_id: a.id, name: "x", category: "shoes", image_path: `${b.id}/wardrobe/x.jpg` });
    expect(bad.error).toBeTruthy();
    const good = await a.client.from("wardrobe_items").insert({ user_id: a.id, name: "x", category: "shoes", image_path: `${a.id}/wardrobe/x.jpg` });
    expect(good.error).toBeNull();
  });
});

describe("payments & admin functions", () => {
  async function order(userId: string, slug: string, orderId: string) {
    const { data: plan } = await admin.from("plans").select("id, price").eq("slug", slug).single();
    await admin.from("payments").insert({ user_id: userId, plan_id: plan!.id, razorpay_order_id: orderId, amount_paise: plan!.price * 100 });
  }

  it("fulfil_payment is idempotent and grants a one-month pass", async () => {
    const p = await makeUser("pay");
    const oid = `order_${Date.now()}`;
    const pid = (n: number) => `pay_${n}_${crypto.randomUUID().slice(0, 8)}`;
    const [p1, p2, p3] = [pid(1), pid(2), pid(3)];
    await order(p.id, "pro", oid);
    const [r1, r2] = await Promise.all([
      admin.rpc("fulfil_payment", { p_order_id: oid, p_payment_id: p1 }),
      admin.rpc("fulfil_payment", { p_order_id: oid, p_payment_id: p1 }),
    ]);
    expect([r1.data, r2.data]).toEqual(expect.arrayContaining([{ ok: true, already: false }, { ok: true, already: true }]));
    const { data: subs } = await admin.from("subscriptions").select("status, expires_at, plans(slug)").eq("user_id", p.id);
    expect(subs).toHaveLength(1);
    expect(subs![0].plans?.slug).toBe("pro");
    const days = (new Date(subs![0].expires_at!).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(27);
    expect(days).toBeLessThan(32);
    const { data: q } = await p.client.rpc("my_generation_quota").single();
    expect(q).toMatchObject({ plan_slug: "pro", lim: 100 });

    // Same plan again → extended, still one active subscription.
    await order(p.id, "pro", `${oid}_2`);
    await admin.rpc("fulfil_payment", { p_order_id: `${oid}_2`, p_payment_id: p2 });
    const { data: subs2 } = await admin.from("subscriptions").select("status, expires_at").eq("user_id", p.id).eq("status", "active");
    expect(subs2).toHaveLength(1);
    expect((new Date(subs2![0].expires_at!).getTime() - Date.now()) / 86400000).toBeGreaterThan(55);

    // Different plan → old pass cancelled, new one active.
    await order(p.id, "premium", `${oid}_3`);
    await admin.rpc("fulfil_payment", { p_order_id: `${oid}_3`, p_payment_id: p3 });
    const { data: all } = await admin.from("subscriptions").select("status, plans(slug)").eq("user_id", p.id).order("created_at");
    expect(all!.map((s) => `${s.plans?.slug}:${s.status}`)).toEqual(["pro:cancelled", "premium:active"]);

    expect((await admin.rpc("fulfil_payment", { p_order_id: "nope", p_payment_id: "x" })).data).toEqual({ ok: false, reason: "unknown_order" });
    await admin.auth.admin.deleteUser(p.id);
  });

  it("users can't call admin or payment functions, or read others' payments", async () => {
    for (const fn of ["admin_overview", "admin_daily_activity", "admin_outfit_breakdown", "admin_ai_usage", "admin_list_users", "expire_subscriptions"] as const) {
      const { error } = await a.client.rpc(fn as never);
      expect(error, fn).toBeTruthy();
    }
    const { error } = await a.client.rpc("fulfil_payment", { p_order_id: "x", p_payment_id: "y" });
    expect(error).toBeTruthy();
    const { error: insErr } = await a.client.from("payments").insert({ user_id: a.id, plan_id: crypto.randomUUID(), razorpay_order_id: "o", amount_paise: 1 } as never);
    expect(insErr).toBeTruthy();
    const { data: hooks } = await a.client.from("webhook_events").select("*");
    expect(hooks ?? []).toEqual([]);
  });

  it("admin functions return data for the service role", async () => {
    const { data: o } = await admin.rpc("admin_overview");
    expect((o as Record<string, number>).total_users).toBeGreaterThan(0);
    const { data: days } = await admin.rpc("admin_daily_activity", { p_days: 14 });
    expect(days).toHaveLength(14);
    const { data: users } = await admin.rpc("admin_list_users", { p_search: "rls-a", p_limit: 5, p_offset: 0 });
    expect(users!.every((u) => u.email.includes("rls-a"))).toBe(true);
    const { data: wild } = await admin.rpc("admin_list_users", { p_search: "%", p_limit: 5, p_offset: 0 });
    expect(wild).toEqual([]); // % is treated literally
  });
});

describe("hardening", () => {
  it("anonymous visitors can't call any function", async () => {
    const anon = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
    for (const fn of ["is_admin", "am_i_admin", "my_generation_quota", "generation_quota", "recent_upload_count"]) {
      const { error } = await anon.rpc(fn as never);
      expect(error, fn).toBeTruthy();
    }
  });

  it("users can't write server-owned tables even with crafted requests", async () => {
    const attempts = await Promise.all([
      a.client.from("plans").update({ price: 0 }).eq("slug", "pro").select(),
      a.client.from("app_settings").upsert({ key: "free_daily_generation_limit", value: 999 }).select(),
      a.client.from("ai_usage").delete().eq("user_id", a.id).select(),
      a.client.from("subscriptions").insert({ user_id: a.id, plan_id: crypto.randomUUID(), status: "active" }).select(),
    ]);
    for (const r of attempts) expect(r.error ?? (r.data?.length === 0 ? "no rows" : null)).toBeTruthy();
    const { data: pro } = await admin.from("plans").select("price").eq("slug", "pro").single();
    expect(pro!.price).toBeGreaterThan(0);
  });

  it("users can still save, rate and delete their own outfits", async () => {
    const r1 = await a.client.from("outfit_feedback").upsert({ user_id: a.id, outfit_id: outfitA, rating: 5 }, { onConflict: "user_id,outfit_id" });
    expect(r1.error).toBeNull();
    const r2 = await a.client.from("outfit_feedback").upsert({ user_id: a.id, outfit_id: outfitA, rating: 3 }, { onConflict: "user_id,outfit_id" });
    expect(r2.error).toBeNull();
  });
});
