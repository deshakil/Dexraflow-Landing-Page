/* Build step for static hosts (Vercel): writes inventory/env.js from the
   SUPABASE_URL and SUPABASE_ANON_KEY environment variables so the publishable
   key never has to be committed. Without both variables it writes nothing and
   the email form shows "Email reports are coming soon". */
import { writeFileSync, existsSync } from "node:fs";

const url = (process.env.SUPABASE_URL || "").trim();
const key = (process.env.SUPABASE_ANON_KEY || "").trim();
const target = new URL("../inventory/env.js", import.meta.url);

if (!url || !key) {
  console.log(`[write-env] SUPABASE_URL / SUPABASE_ANON_KEY not set; ${existsSync(target) ? "keeping existing" : "no"} inventory/env.js`);
  process.exit(0);
}
if (/service_role|^eyJ/.test(key) && !/^sb_publishable_/.test(key) && !/anon/.test(key)) {
  // A legacy anon JWT is fine; refuse anything that looks like a secret key.
  console.error("[write-env] Refusing to write a key that does not look like a publishable/anon key."); process.exit(1);
}
const body = `/* Generated at build time by scripts/write-env.mjs. Do not edit or commit. */\nwindow.DXF_ENV = ${JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key }, null, 2)};\n`;
writeFileSync(target, body);
console.log("[write-env] wrote inventory/env.js");
