/* Single source of truth for the inventory: a reducer, a tiny store, and
   versioned localStorage persistence that falls back to a clean state. */
import { MAX_WORKFLOWS, STORAGE_KEY } from "./config.js";
import { TOOLS } from "./score.js";

export const VERSION = 1;
const NOTICE = new Set(["yes", "not_sure", "no"]);
const FINDOUT = new Set(["alert", "report", "complaint", "wouldnt"]);
const DECISION = new Set(["keep", "fix", "kill"]);

export const uid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);

export function blankWorkflow(patch = {}) {
  // collapsed: true means the optional details panel is closed.
  return { id: uid(), name: "", tool: "", trigger: "", owner: "", notice: null, findOut: null, leadsPerWeek: null, decision: null, collapsed: true, ...patch };
}

export const EXAMPLE = () => [
  blankWorkflow({ name: "Demo form → HubSpot", tool: "HubSpot", trigger: "Demo form submitted", owner: "Priya (RevOps)", notice: "no", findOut: "complaint", leadsPerWeek: 40, decision: "keep", collapsed: true }),
  blankWorkflow({ name: "Round-robin routing", tool: "HubSpot", trigger: "New contact with source = Demo", owner: "", notice: "not_sure", findOut: "wouldnt", leadsPerWeek: 40, decision: "fix", collapsed: true }),
  blankWorkflow({ name: "Old webinar sync", tool: "Zapier", trigger: "New webinar registrant", owner: "", notice: "no", findOut: "wouldnt", leadsPerWeek: 0, decision: "kill", collapsed: true }),
];

export const initialState = () => ({ version: VERSION, workflows: [] });

/** Accepts anything from storage; returns a valid workflow or null. */
export function sanitizeWorkflow(x) {
  if (!x || typeof x !== "object") return null;
  const str = (v, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
  const n = Number(x.leadsPerWeek);
  return blankWorkflow({
    id: typeof x.id === "string" && x.id ? x.id : uid(),
    name: str(x.name, 120), tool: TOOLS.includes(x.tool) ? x.tool : "", trigger: str(x.trigger), owner: str(x.owner, 120),
    notice: NOTICE.has(x.notice) ? x.notice : null,
    findOut: FINDOUT.has(x.findOut) ? x.findOut : null,
    leadsPerWeek: Number.isFinite(n) && x.leadsPerWeek !== null && x.leadsPerWeek !== "" && n >= 0 ? Math.floor(n) : null,
    decision: DECISION.has(x.decision) ? x.decision : null,
    collapsed: x.collapsed !== false,
  });
}

export function reduce(state, action) {
  const ws = state.workflows;
  const at = (id) => ws.findIndex((w) => w.id === id);
  switch (action.type) {
    case "add": {
      if (ws.length >= MAX_WORKFLOWS) return state;
      return { ...state, workflows: [...ws, blankWorkflow({ name: typeof action.name === "string" ? action.name.trim().slice(0, 120) : "", collapsed: true })] };
    }
    case "update": {
      const i = at(action.id);
      if (i < 0) return state;
      const next = ws.slice(); next[i] = { ...ws[i], ...action.patch };
      return { ...state, workflows: next };
    }
    case "collapse": {
      const i = at(action.id);
      if (i < 0 || ws[i].collapsed === action.collapsed) return state;
      const next = ws.slice(); next[i] = { ...ws[i], collapsed: action.collapsed };
      return { ...state, workflows: next };
    }
    case "duplicate": {
      const i = at(action.id);
      if (i < 0 || ws.length >= MAX_WORKFLOWS) return state;
      const copy = { ...ws[i], id: uid(), collapsed: true };
      return { ...state, workflows: [...ws.slice(0, i + 1), copy, ...ws.slice(i + 1)] };
    }
    case "remove": {
      const i = at(action.id);
      if (i < 0) return state;
      return { ...state, workflows: [...ws.slice(0, i), ...ws.slice(i + 1)] };
    }
    case "restore": {
      if (ws.some((w) => w.id === action.workflow.id) || ws.length >= MAX_WORKFLOWS) return state;
      const i = Math.max(0, Math.min(action.index, ws.length));
      return { ...state, workflows: [...ws.slice(0, i), action.workflow, ...ws.slice(i)] };
    }
    case "example": return { ...state, workflows: EXAMPLE() };
    case "clear": return initialState();
    default: return state;
  }
}

export function load(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const data = JSON.parse(raw);
    if (!data || data.version !== VERSION || !Array.isArray(data.workflows)) return initialState();
    const workflows = data.workflows.map(sanitizeWorkflow).filter(Boolean).slice(0, MAX_WORKFLOWS);
    return { version: VERSION, workflows };
  } catch { return initialState(); }
}

export function createStore({ storage = null, debounceMs = 300 } = {}) {
  let state = load(storage);
  const listeners = new Set();
  let timer = 0;
  const persist = () => {
    if (!storage) return;
    clearTimeout(timer);
    timer = setTimeout(() => { try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable: keep in memory */ } }, debounceMs);
  };
  return {
    get: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    dispatch(action) {
      const next = reduce(state, action);
      if (next === state) return false;
      state = next; persist();
      listeners.forEach((fn) => fn(state, action));
      return true;
    },
  };
}
