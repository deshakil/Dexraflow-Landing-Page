import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore, reduce, initialState, load, blankWorkflow } from "./store.js";
import { STORAGE_KEY } from "./config.js";

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };

test("starts with three blank cards and caps at 50", () => {
  let s = initialState();
  assert.equal(s.workflows.length, 3);
  for (let i = 0; i < 60; i++) s = reduce(s, { type: "add" });
  assert.equal(s.workflows.length, 50);
});

test("update, duplicate, remove, restore", () => {
  let s = initialState();
  const id = s.workflows[0].id;
  s = reduce(s, { type: "update", id, patch: { name: "Routing", notice: "no" } });
  assert.equal(s.workflows[0].name, "Routing");
  s = reduce(s, { type: "duplicate", id });
  assert.equal(s.workflows.length, 4); assert.equal(s.workflows[1].name, "Routing"); assert.notEqual(s.workflows[1].id, id);
  const removed = s.workflows[1];
  s = reduce(s, { type: "remove", id: removed.id });
  assert.equal(s.workflows.length, 3);
  s = reduce(s, { type: "restore", index: 1, workflow: removed });
  assert.equal(s.workflows[1].id, removed.id);
  assert.equal(reduce(s, { type: "restore", index: 1, workflow: removed }), s, "no double restore");
});

test("corrupt or old storage falls back to empty state", () => {
  const st = mem();
  st.setItem(STORAGE_KEY, "{not json");
  assert.equal(load(st).workflows.length, 3);
  st.setItem(STORAGE_KEY, JSON.stringify({ version: 0, workflows: [{ name: "old" }] }));
  assert.equal(load(st).workflows[0].name, "");
  st.setItem(STORAGE_KEY, JSON.stringify({ version: 1, workflows: [{ name: "ok", notice: "bogus", leadsPerWeek: "12", tool: "Nope", decision: "kill" }] }));
  const w = load(st).workflows[0];
  assert.equal(w.name, "ok"); assert.equal(w.notice, null); assert.equal(w.leadsPerWeek, 12); assert.equal(w.tool, ""); assert.equal(w.decision, "kill");
});

test("store persists (debounced) and notifies", async () => {
  const st = mem();
  const store = createStore({ storage: st, debounceMs: 5 });
  let calls = 0; store.subscribe(() => calls++);
  store.dispatch({ type: "update", id: store.get().workflows[0].id, patch: { name: "A" } });
  assert.equal(calls, 1);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(JSON.parse(st.getItem(STORAGE_KEY)).workflows[0].name, "A");
  store.dispatch({ type: "clear" });
  assert.equal(store.get().workflows.every((w) => !w.name), true);
  assert.equal(blankWorkflow().collapsed, false);
});
