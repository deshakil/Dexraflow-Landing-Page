/* Pure scoring functions for the Silent Break Score. No DOM, no side effects. */

export const TOOLS = ["HubSpot", "Salesforce", "Zapier", "Make", "n8n", "Clay", "Outreach", "Salesloft", "Apollo", "Other"];
export const NOTICE_LABELS = { yes: "Yes", not_sure: "Not sure", no: "No" };
export const FINDOUT_LABELS = { alert: "An alert fires", report: "A report shows it", complaint: "A rep or customer complains", wouldnt: "We wouldn't" };
export const DECISION_LABELS = { keep: "Keep", fix: "Fix", kill: "Kill" };
export const COMPANY_SIZES = [["1-50", "1–50"], ["51-200", "51–200"], ["201-500", "201–500"], ["500+", "500+"]];
export const ROLES = ["Head of RevOps", "RevOps / Sales Ops", "GTM engineer", "CRM admin", "Founder / exec", "Other"];

/** The only keys ever sent to Supabase. Workflow text is never among them. */
export const ALLOWED_FIELDS = [
  "email", "consent", "company_size", "role",
  "total_workflows", "no_count", "not_sure_count", "no_owner_count", "fix_count", "kill_count",
  "leads_at_risk_per_week", "tools_used", "utm_source", "utm_medium", "utm_campaign", "referrer",
];

const has = (s) => typeof s === "string" && s.trim().length > 0;
const leads = (w) => (Number.isFinite(w.leadsPerWeek) && w.leadsPerWeek > 0 ? Math.floor(w.leadsPerWeek) : 0);

export function namedWorkflows(workflows) {
  return workflows.filter((w) => has(w.name));
}

export function score(workflows) {
  const named = namedWorkflows(workflows);
  const count = (fn) => named.filter(fn).length;
  const atRisk = named.filter((w) => w.notice === "no" || w.notice === "not_sure");
  return {
    total: named.length,
    yes: count((w) => w.notice === "yes"),
    notSure: count((w) => w.notice === "not_sure"),
    no: count((w) => w.notice === "no"),
    unanswered: count((w) => !w.notice),
    noOwner: count((w) => !has(w.owner)),
    fix: count((w) => w.decision === "fix"),
    kill: count((w) => w.decision === "kill"),
    leadsAtRisk: atRisk.reduce((sum, w) => sum + leads(w), 0),
    tools: [...new Set(named.map((w) => (w.tool || "").trim()).filter(Boolean))],
  };
}

export function verdict(s) {
  if (!s.total) return "";
  const blind = s.no + s.notSure;
  if (blind === 0) return "You'd catch breaks fast. Nice.";
  if (blind <= 2) return "A couple of blind spots worth watching.";
  return "Several workflows could fail silently. These are where leads disappear.";
}

/** Rank: No before Not sure, then most leads touched, then no owner first. */
export function fixFirst(workflows, limit = 3) {
  const rank = (w) => (w.notice === "no" ? 0 : 1);
  return namedWorkflows(workflows)
    .filter((w) => w.notice === "no" || w.notice === "not_sure")
    .map((w, i) => ({ w, i }))
    .sort((a, b) =>
      rank(a.w) - rank(b.w) ||
      leads(b.w) - leads(a.w) ||
      Number(has(a.w.owner)) - Number(has(b.w.owner)) ||
      a.i - b.i)
    .slice(0, limit)
    .map(({ w }) => w);
}

export function shareText(s, shareUrl) {
  return `${s.no} of ${s.total} of our lead workflows could break with nobody noticing. Checked with ${shareUrl}`;
}

export const CSV_COLUMNS = ["Name", "Tool", "What triggers it", "Owner", "Would anyone notice within a day?", "How would we find out?", "Leads touched per week", "Decision"];

export function toCSV(workflows) {
  const cell = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = namedWorkflows(workflows).map((w) => [
    w.name.trim(), w.tool || "", w.trigger || "", w.owner || "",
    NOTICE_LABELS[w.notice] || "", FINDOUT_LABELS[w.findOut] || "",
    Number.isFinite(w.leadsPerWeek) ? w.leadsPerWeek : "", DECISION_LABELS[w.decision] || "",
  ]);
  // BOM so Excel reads UTF-8 (arrows, en dashes); CRLF line ends for both Excel and Sheets.
  return "﻿" + [CSV_COLUMNS, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function csvFilename(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `dexraflow-workflow-inventory-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.csv`;
}

export function isValidEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || "").trim()) && String(email).trim().length <= 254;
}

/** Builds the Supabase row from the score summary and the form. Never includes workflow text. */
export function buildPayload({ score: s, email, consent, companySize, role, utm = {}, referrer = "" }) {
  const sizes = COMPANY_SIZES.map(([v]) => v);
  const row = {
    email: String(email || "").trim().toLowerCase(),
    consent: consent === true,
    company_size: sizes.includes(companySize) ? companySize : null,
    role: has(role) ? String(role).trim().slice(0, 60) : null,
    total_workflows: Math.min(50, s.total),
    no_count: s.no,
    not_sure_count: s.notSure,
    no_owner_count: s.noOwner,
    fix_count: s.fix,
    kill_count: s.kill,
    leads_at_risk_per_week: s.leadsAtRisk,
    tools_used: s.tools.slice(0, 15),
    utm_source: has(utm.utm_source) ? utm.utm_source.slice(0, 200) : null,
    utm_medium: has(utm.utm_medium) ? utm.utm_medium.slice(0, 200) : null,
    utm_campaign: has(utm.utm_campaign) ? utm.utm_campaign.slice(0, 200) : null,
    referrer: has(referrer) ? String(referrer).slice(0, 500) : null,
  };
  return Object.fromEntries(Object.entries(row).filter(([k]) => ALLOWED_FIELDS.includes(k)));
}
