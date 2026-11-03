/* Insert-only Supabase client for email submissions.
   The UMD build of @supabase/supabase-js is loaded by inventory.html and
   exposes window.supabase; env.js (git-ignored) exposes window.DXF_ENV.
   Returns null when either is missing so the form can show a friendly notice. */
let client;
export function getClient() {
  if (client !== undefined) return client;
  const env = (typeof window !== "undefined" && window.DXF_ENV) || {};
  const lib = typeof window !== "undefined" && window.supabase;
  const url = String(env.SUPABASE_URL || "");
  const key = String(env.SUPABASE_ANON_KEY || "");
  const placeholder = /YOUR-PROJECT-REF|YOUR-ANON/.test(url + key);
  client = lib && /^https:\/\//.test(url) && key && !placeholder
    ? lib.createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  return client;
}
export async function insertSubmission(row) {
  const c = getClient();
  if (!c) throw new Error("Supabase is not configured");
  // No .select(): the anon role can insert but never read rows.
  const { error } = await c.from("inventory_submissions").insert(row);
  if (error) throw error;
}
