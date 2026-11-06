/**
 * Make an existing user an admin.
 *   npm run admin:grant -- someone@example.com
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (reads .env.local).
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
const email = process.argv[2]?.toLowerCase();
if (!email) {
  console.error("Usage: npm run admin:grant -- <email>");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
(async () => {
  for (let page = 1; page < 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) {
      const { error: e } = await admin.from("user_roles").upsert({ user_id: user.id, role: "admin" });
      if (e) throw e;
      await admin.from("admin_audit_log").insert({ admin_id: null, action: "role.grant_admin", target_user_id: user.id, details: { via: "cli" } });
      console.log(`✓ ${email} is now an admin. Sign in and open /admin.`);
      return;
    }
    if (data.users.length < 1000) break;
  }
  console.error(`No user with email ${email}. Sign up first, then run this again.`);
  process.exit(1);
})();
