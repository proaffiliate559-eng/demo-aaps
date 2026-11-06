#!/usr/bin/env node
/**
 * One-command local start for StyleMood AI.
 *   npm run local            (or double-click start-windows.bat / start-mac.command)
 *
 * 1. Checks Node.js and Docker
 * 2. Starts the local Supabase stack (database, login, storage, email inbox)
 * 3. Writes .env.local (asks once for a Gemini key; Enter = demo mode)
 * 4. Creates a ready-to-use demo admin account
 * 5. Builds the app (first time) and opens http://localhost:3000
 */
import { execSync, spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";

const isWin = process.platform === "win32";
const npx = isWin ? "npx.cmd" : "npx";
const say = (m) => console.log(`\n\x1b[1m▸ ${m}\x1b[0m`);
const fail = (m) => {
  console.error(`\n\x1b[31m✖ ${m}\x1b[0m\n`);
  process.exit(1);
};

// 1. Prerequisites ────────────────────────────────────────────────────────
const major = Number(process.versions.node.split(".")[0]);
if (major < 20) fail(`Node.js 20 or newer is needed (you have ${process.versions.node}). Install the LTS version from https://nodejs.org`);
try {
  execSync("docker info", { stdio: "ignore" });
} catch {
  fail("Docker isn't running. Open Docker Desktop, wait until it says 'Running', then try again.\n  Download: https://www.docker.com/products/docker-desktop/");
}

// 2. Database & auth ──────────────────────────────────────────────────────
say("Starting the local database (first time downloads ~2 GB, please wait)…");
// After a reboot Docker restarts the old containers; `supabase start` refuses
// while they're still booting, so wait and retry for up to ~2 minutes.
let started = false;
for (let attempt = 1; attempt <= 12 && !started; attempt++) {
  const r = spawnSync(npx, ["supabase", "start"], { encoding: "utf8", shell: isWin });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.status === 0) {
    started = true;
  } else if (/not ready|starting|unhealthy/i.test(out)) {
    process.stdout.write(attempt === 1 ? "  Database is still waking up, waiting" : ".");
    await new Promise((res) => setTimeout(res, 10_000));
  } else {
    console.error(out.trim());
    break;
  }
}
if (!started) fail("Couldn't start the local database. Make sure Docker Desktop is running and has at least 4 GB memory.");

const statusOut = spawnSync(npx, ["supabase", "status", "-o", "env"], { encoding: "utf8", shell: isWin }).stdout ?? "";
const status = Object.fromEntries(
  statusOut
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
if (!status.API_URL || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) fail("Couldn't read the local database settings.");

// 3. Settings (.env.local) ────────────────────────────────────────────────
const existing = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
const keep = (name) => existing.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() ?? "";
let geminiKey = process.env.GEMINI_API_KEY ?? keep("GEMINI_API_KEY");
let provider = process.env.AI_PROVIDER ?? keep("AI_PROVIDER");

if (!geminiKey && provider !== "mock" && process.stdin.isTTY) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log("\nFor real AI outfits, paste your Gemini API key (free at https://aistudio.google.com/apikey).");
  geminiKey = (await rl.question("Gemini key (or just press Enter for demo mode): ")).trim();
  rl.close();
}
if (!geminiKey) provider = "mock";
if (!provider) provider = "gemini";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "false",
  AI_PROVIDER: provider,
  GEMINI_API_KEY: geminiKey,
  GEMINI_MODEL: keep("GEMINI_MODEL") || "gemini-3.5-flash",
  GEMINI_FALLBACK_MODELS: keep("GEMINI_FALLBACK_MODELS") || "gemini-3.5-flash-lite",
  IMAGE_PROVIDER: keep("IMAGE_PROVIDER") || "none",
};
writeFileSync(
  ".env.local",
  "# Written by `npm run local` — local development only. Never commit this file.\n" +
    Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") +
    "\n",
);

// 4. Demo admin account ───────────────────────────────────────────────────
say("Creating your demo login…");
const demoEmail = "demo@stylemood.test";
const demoPassword = `Style-${randomBytes(4).toString("hex")}`;
const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
const found = users?.users.find((u) => u.email === demoEmail);
if (found) {
  await admin.auth.admin.updateUserById(found.id, { password: demoPassword });
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: demoEmail,
    password: demoPassword,
    email_confirm: true,
    user_metadata: { display_name: "Demo" },
  });
  if (error) fail(`Couldn't create the demo login: ${error.message}`);
  await admin.from("user_roles").upsert({ user_id: data.user.id, role: "admin" });
}

// 5. Build & run ──────────────────────────────────────────────────────────
if (!existsSync(".next/BUILD_ID") || process.argv.includes("--rebuild")) {
  say("Preparing the website (first time takes 1–2 minutes)…");
  const build = spawnSync(npx, ["next", "build"], { stdio: "inherit", shell: isWin });
  if (build.status !== 0) fail("The build failed — see the messages above.");
}

say("Starting StyleMood AI…");
const server = spawn(npx, ["next", "start", "-p", "3000"], { stdio: ["ignore", "pipe", "inherit"], shell: isWin });
let opened = false;
server.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  if (!opened && /Ready|started server|Local:/i.test(text)) {
    opened = true;
    console.log(`
\x1b[32m✔ StyleMood AI is running!\x1b[0m

   Website:        http://localhost:3000
   Demo login:     ${demoEmail}
   Password:       ${demoPassword}      (also an admin — see "Admin" in the menu)
   Email inbox:    http://localhost:54324   (sign-up confirmation emails arrive here)
   AI mode:        ${provider === "mock" ? "DEMO (placeholder looks, clearly labelled — add a Gemini key for real AI)" : "Real AI (Gemini)"}

   Keep this window open. To stop: press Ctrl + C.
`);
    const url = "http://localhost:3000";
    const opener = isWin ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
    try {
      execSync(opener, { stdio: "ignore" });
    } catch {
      /* no desktop browser (e.g. a server) — the URL is printed above */
    }
  }
});
server.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => server.kill("SIGINT"));
