import { test } from "node:test";
import assert from "node:assert/strict";
import { score, verdict, fixFirst, shareText, toCSV, csvFilename, buildPayload, ALLOWED_FIELDS, isValidEmail } from "./score.js";
import { blankWorkflow, EXAMPLE } from "./store.js";

const w = (p) => blankWorkflow(p);

test("counts only named workflows", () => {
  const s = score([w({ name: "A", notice: "no" }), w({ name: "  ", notice: "no" }), w({ name: "B", notice: "yes" })]);
  assert.equal(s.total, 2); assert.equal(s.no, 1); assert.equal(s.yes, 1); assert.equal(s.notSure, 0);
});

test("no owner, fix, kill and unique tools", () => {
  const s = score([w({ name: "A", owner: "", decision: "fix", tool: "HubSpot" }), w({ name: "B", owner: "Sam", decision: "kill", tool: "HubSpot" }), w({ name: "C", owner: " ", tool: "Zapier" })]);
  assert.equal(s.noOwner, 2); assert.equal(s.fix, 1); assert.equal(s.kill, 1);
  assert.deepEqual(s.tools, ["HubSpot", "Zapier"]);
});

test("leads at risk sums No and Not sure only, treating null as 0", () => {
  const s = score([w({ name: "A", notice: "no", leadsPerWeek: 40 }), w({ name: "B", notice: "not_sure", leadsPerWeek: 10 }), w({ name: "C", notice: "yes", leadsPerWeek: 99 }), w({ name: "D", notice: "no", leadsPerWeek: null })]);
  assert.equal(s.leadsAtRisk, 50);
});

test("example rows score as expected", () => {
  const s = score(EXAMPLE());
  assert.equal(s.total, 3); assert.equal(s.no, 2); assert.equal(s.notSure, 1); assert.equal(s.noOwner, 2);
  assert.equal(s.fix, 1); assert.equal(s.kill, 1); assert.equal(s.leadsAtRisk, 80);
});

test("verdict thresholds", () => {
  assert.equal(verdict(score([])), "");
  assert.equal(verdict(score([w({ name: "A", notice: "yes" })])), "You'd catch breaks fast. Nice.");
  assert.equal(verdict(score([w({ name: "A", notice: "no" })])), "A couple of blind spots worth watching.");
  assert.equal(verdict(score([w({ name: "A", notice: "no" }), w({ name: "B", notice: "not_sure" })])), "A couple of blind spots worth watching.");
  assert.equal(verdict(score([w({ name: "A", notice: "no" }), w({ name: "B", notice: "not_sure" }), w({ name: "C", notice: "no" })])), "Several workflows could fail silently. These are where leads disappear.");
});

test("fix first: No before Not sure, then leads, then no owner first, max 3", () => {
  const list = [
    w({ name: "ns-big", notice: "not_sure", leadsPerWeek: 500 }),
    w({ name: "no-small-owned", notice: "no", leadsPerWeek: 5, owner: "Sam" }),
    w({ name: "no-small-unowned", notice: "no", leadsPerWeek: 5, owner: "" }),
    w({ name: "no-big", notice: "no", leadsPerWeek: 50 }),
    w({ name: "yes", notice: "yes", leadsPerWeek: 1000 }),
    w({ name: "ns-small", notice: "not_sure", leadsPerWeek: 1 }),
  ];
  assert.deepEqual(fixFirst(list).map((x) => x.name), ["no-big", "no-small-unowned", "no-small-owned"]);
  assert.deepEqual(fixFirst(list, 10).map((x) => x.name), ["no-big", "no-small-unowned", "no-small-owned", "ns-big", "ns-small"]);
});

test("share text", () => {
  assert.equal(shareText({ no: 4, total: 11 }, "dexraflow.com/inventory"), "4 of 11 of our lead workflows could break with nobody noticing. Checked with dexraflow.com/inventory");
});

test("csv has header, labels, escaping and BOM", () => {
  const csv = toCSV([w({ name: 'Form, "demo"', tool: "HubSpot", trigger: "Submit", owner: "", notice: "no", findOut: "wouldnt", leadsPerWeek: 40, decision: "keep" }), w({ name: "" })]);
  const lines = csv.split("\r\n");
  assert.ok(csv.startsWith("﻿"));
  assert.equal(lines[0].replace("﻿", ""), "Name,Tool,What triggers it,Owner,Would anyone notice within a day?,How would we find out?,Leads touched per week,Decision");
  assert.equal(lines[1], '"Form, ""demo""",HubSpot,Submit,,No,We wouldn\'t,40,Keep');
  assert.equal(lines.length, 3);
  assert.equal(csvFilename(new Date(2026, 10, 4)), "dexraflow-workflow-inventory-2026-11-04.csv");
});

test("email validation", () => {
  assert.ok(isValidEmail("a@b.co")); assert.ok(!isValidEmail("a@b")); assert.ok(!isValidEmail("")); assert.ok(!isValidEmail("a b@c.io"));
});

test("payload contains only allowed fields and never workflow text", () => {
  const workflows = [w({ name: "SECRET-NAME", trigger: "SECRET-TRIGGER", owner: "SECRET-OWNER", tool: "Clay", notice: "no", leadsPerWeek: 7, decision: "fix" })];
  const row = buildPayload({ score: score(workflows), email: "  Jane@Acme.COM ", consent: true, companySize: "51-200", role: "CRM admin", utm: { utm_source: "li", utm_medium: "post", utm_campaign: "launch", utm_term: "ignored" }, referrer: "https://x.y/" });
  assert.deepEqual(Object.keys(row).sort(), [...ALLOWED_FIELDS].sort());
  assert.ok(!JSON.stringify(row).includes("SECRET"));
  assert.equal(row.email, "jane@acme.com"); assert.equal(row.company_size, "51-200"); assert.equal(row.role, "CRM admin");
  assert.equal(row.total_workflows, 1); assert.equal(row.no_count, 1); assert.equal(row.leads_at_risk_per_week, 7);
  assert.deepEqual(row.tools_used, ["Clay"]); assert.equal(row.utm_source, "li"); assert.equal("utm_term" in row, false);
  const bare = buildPayload({ score: score(workflows), email: "a@b.co", consent: true, companySize: "huge", role: "", utm: {}, referrer: "" });
  assert.equal(bare.company_size, null); assert.equal(bare.role, null); assert.equal(bare.referrer, null); assert.equal(bare.utm_source, null);
});
