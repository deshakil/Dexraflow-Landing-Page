/* Silent Break Score — page logic. State lives in store.js, maths in score.js. */
import { BOOKING_LINK, SHARE_URL, UTM_KEY, MAX_WORKFLOWS, MIN_FOR_RESULTS } from "./config.js";
import { TOOLS, NOTICE_LABELS, FINDOUT_LABELS, DECISION_LABELS, COMPANY_SIZES, ROLES, score, verdict, fixFirst, shareText, toCSV, csvFilename, isValidEmail, buildPayload } from "./score.js";
import { createStore } from "./store.js";
import { track } from "./track.js";
import { getClient, insertSubmission } from "./supabase.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let storage = null; try { storage = window.localStorage; } catch { storage = null; }
const store = createStore({ storage });
let started = false;
const startedOnce = () => { if (!started) { started = true; track("inventory_started"); } };

/* ---------- nav (this page has no hero canvas, so keep it simple) ---------- */
const nav = $("#nav"), burger = $("#burger");
const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 24);
window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
burger?.addEventListener("click", () => { const open = !nav.classList.contains("is-open"); nav.classList.toggle("is-open", open); burger.setAttribute("aria-expanded", String(open)); });
$("#year").textContent = String(new Date().getFullYear());

/* ---------- UTM capture ---------- */
(() => {
  try {
    const q = new URLSearchParams(location.search);
    const utm = {}; ["utm_source", "utm_medium", "utm_campaign"].forEach((k) => { const v = q.get(k); if (v) utm[k] = v.slice(0, 200); });
    if (Object.keys(utm).length) sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
  } catch { /* ignore */ }
})();
const getUtm = () => { try { return JSON.parse(sessionStorage.getItem(UTM_KEY) || "{}"); } catch { return {}; } };

/* ---------- toast ---------- */
const toast = $("#toast");
let toastTimer = 0, toastAction = null;
function showToast(text, actionLabel, onAction, ms = 5000) {
  clearTimeout(toastTimer); toastAction = onAction;
  $("#toastText", toast).textContent = text;
  const btn = $("#toastBtn", toast); btn.textContent = actionLabel || ""; btn.hidden = !actionLabel;
  toast.hidden = false; requestAnimationFrame(() => toast.classList.add("is-in"));
  toastTimer = setTimeout(hideToast, ms);
}
function hideToast() { clearTimeout(toastTimer); toast.classList.remove("is-in"); toastAction = null; setTimeout(() => { if (!toast.classList.contains("is-in")) toast.hidden = true; }, 250); }
$("#toastBtn").addEventListener("click", () => { const fn = toastAction; hideToast(); fn?.(); });

/* ---------- confirm dialog (native dialog element) ---------- */
const dlg = $("#confirm");
function confirmDialog(title, body, okLabel) {
  return new Promise((resolve) => {
    $("#confirmTitle").textContent = title; $("#confirmBody").textContent = body; $("#confirmOk").textContent = okLabel;
    const done = (v) => { dlg.removeEventListener("close", onClose); resolve(v); };
    const onClose = () => done(dlg.returnValue === "ok");
    dlg.addEventListener("close", onClose);
    if (typeof dlg.showModal === "function") dlg.showModal(); else done(window.confirm(`${title}\n\n${body}`));
  });
}

/* ---------- workflow cards ---------- */
const list = $("#wfList");
const pill = (name, value, label, checked) => `<label class="pill pill--${value}"><input type="radio" name="${name}" value="${value}" ${checked ? "checked" : ""}><span>${label}</span></label>`;
const option = (v, label, sel) => `<option value="${esc(v)}" ${sel ? "selected" : ""}>${esc(label)}</option>`;

function cardHTML(w, i) {
  const id = w.id;
  return `
    <button class="wf__summary" type="button" aria-expanded="false" aria-controls="body-${id}">
      <span class="wf__num mono">${String(i + 1).padStart(2, "0")}</span>
      <span class="wf__sname"></span>
      <span class="wf__stool mono"></span>
      <span class="wf__snotice"></span>
      <span class="wf__sleads mono"></span>
      <span class="wf__sdecision mono"></span>
      <span class="wf__expand mono">Edit</span>
    </button>
    <div class="wf__body" id="body-${id}">
      <div class="wf__head">
        <span class="wf__num mono">${String(i + 1).padStart(2, "0")}</span>
        <label class="field field--grow"><span>Name <em class="req">required</em></span><input type="text" name="name" maxlength="120" placeholder="e.g. Demo form → HubSpot" value="${esc(w.name)}" autocomplete="off"></label>
      </div>
      <div class="wf__grid">
        <label class="field"><span>Tool</span><select name="tool"><option value="">Choose a tool</option>${TOOLS.map((t) => option(t, t, w.tool === t)).join("")}</select></label>
        <label class="field"><span>What triggers it</span><input type="text" name="trigger" maxlength="200" placeholder="Form submit, new contact, field change, schedule" value="${esc(w.trigger)}" autocomplete="off"></label>
        <label class="field"><span>Owner</span><input type="text" name="owner" maxlength="120" placeholder="A named person, not a team" value="${esc(w.owner)}" autocomplete="off"><small class="hint hint--owner" hidden>No owner = nobody fixes it.</small></label>
        <fieldset class="field field--pills"><legend>Would anyone notice within a day? <em class="req">required</em></legend>
          <div class="pills" role="radiogroup" aria-label="Would anyone notice within a day?">
            ${pill(`notice-${id}`, "yes", "Yes", w.notice === "yes")}${pill(`notice-${id}`, "not_sure", "Not sure", w.notice === "not_sure")}${pill(`notice-${id}`, "no", "No", w.notice === "no")}
          </div>
        </fieldset>
        <label class="field"><span>How would we find out?</span><select name="findOut"><option value="">Choose one</option>${Object.entries(FINDOUT_LABELS).map(([v, l]) => option(v, l, w.findOut === v)).join("")}</select>
          <small class="hint hint--nudge" hidden>If the first sign is a complaint, that's usually a No.</small></label>
        <label class="field"><span>Leads touched per week <em>optional</em></span><input type="number" name="leadsPerWeek" min="0" step="1" inputmode="numeric" placeholder="0" value="${w.leadsPerWeek ?? ""}"></label>
        <fieldset class="field field--pills"><legend>Decision <em>optional</em></legend>
          <div class="pills" role="radiogroup" aria-label="Decision">
            ${pill(`decision-${id}`, "keep", "Keep", w.decision === "keep")}${pill(`decision-${id}`, "fix", "Fix", w.decision === "fix")}${pill(`decision-${id}`, "kill", "Kill", w.decision === "kill")}
          </div>
        </fieldset>
      </div>
    </div>
    <div class="wf__actions">
      <button class="linkbtn" type="button" data-act="duplicate">Duplicate</button>
      <button class="linkbtn linkbtn--danger" type="button" data-act="remove">Remove</button>
    </div>`;
}

function refreshCard(el, w, i) {
  el.classList.toggle("is-collapsed", !!w.collapsed);
  el.classList.toggle("is-no", w.notice === "no");
  el.classList.toggle("is-not-sure", w.notice === "not_sure");
  el.classList.toggle("is-yes", w.notice === "yes");
  el.classList.toggle("is-kill", w.decision === "kill");
  $$(".wf__num", el).forEach((n) => (n.textContent = String(i + 1).padStart(2, "0")));
  $(".wf__summary", el).setAttribute("aria-expanded", String(!w.collapsed));
  $(".wf__sname", el).textContent = w.name.trim() || "Untitled workflow";
  $(".wf__stool", el).textContent = w.tool || "";
  const sn = $(".wf__snotice", el); sn.textContent = w.notice ? NOTICE_LABELS[w.notice] : ""; sn.className = `wf__snotice ${w.notice ? "tagpill tagpill--" + w.notice : ""}`;
  $(".wf__sleads", el).textContent = Number.isFinite(w.leadsPerWeek) ? `${w.leadsPerWeek}/wk` : "";
  $(".wf__sdecision", el).textContent = w.decision ? DECISION_LABELS[w.decision] : "";
  $(".hint--owner", el).hidden = !(w.name.trim() && !w.owner.trim());
  $(".hint--nudge", el).hidden = !(w.notice === "yes" && (w.findOut === "complaint" || w.findOut === "wouldnt"));
}

function cardEl(w, i) {
  const el = document.createElement("article");
  el.className = "wf card"; el.dataset.id = w.id; el.innerHTML = cardHTML(w, i);
  refreshCard(el, w, i);
  el.addEventListener("input", (e) => {
    const t = e.target; if (!t.name) return;
    startedOnce();
    let v = t.value;
    if (t.name === "leadsPerWeek") { v = t.value === "" ? null : Math.max(0, Math.floor(Number(t.value) || 0)); }
    else if (t.name.startsWith("notice-")) { store.dispatch({ type: "update", id: w.id, patch: { notice: v } }); return;}
    else if (t.name.startsWith("decision-")) { store.dispatch({ type: "update", id: w.id, patch: { decision: v } }); return; }
    else if (t.name === "findOut" || t.name === "tool") { v = t.value || (t.name === "tool" ? "" : null); }
    store.dispatch({ type: "update", id: w.id, patch: { [t.name]: v } });
  });
  el.addEventListener("focusout", (e) => {
    if (el.contains(e.relatedTarget)) return;
    const cur = store.get().workflows.find((x) => x.id === w.id);
    if (cur && !cur.collapsed && cur.name.trim() && cur.notice) store.dispatch({ type: "collapse", id: w.id, collapsed: true });
  });
  $(".wf__summary", el).addEventListener("click", () => { store.dispatch({ type: "collapse", id: w.id, collapsed: false }); $(`[data-id="${w.id}"] input[name=name]`)?.focus(); });
  el.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act; if (!act) return;
    if (act === "duplicate") { if (!store.dispatch({ type: "duplicate", id: w.id })) showToast(`You can list up to ${MAX_WORKFLOWS} workflows.`); else track("workflow_added", { via: "duplicate" }); }
    if (act === "remove") {
      const ws = store.get().workflows, index = ws.findIndex((x) => x.id === w.id), removed = ws[index];
      store.dispatch({ type: "remove", id: w.id });
      showToast(`Removed "${removed.name.trim() || "Untitled workflow"}".`, "Undo", () => store.dispatch({ type: "restore", index, workflow: removed }));
    }
  });
  return el;
}

let rendered = new Map(); // id -> element
function renderList() {
  const ws = store.get().workflows;
  const next = new Map();
  const frag = document.createDocumentFragment();
  ws.forEach((w, i) => {
    let el = rendered.get(w.id);
    if (!el) el = cardEl(w, i); else refreshCard(el, w, i);
    next.set(w.id, el); frag.appendChild(el);
  });
  rendered = next; list.replaceChildren(frag);
  $("#addWf").disabled = ws.length >= MAX_WORKFLOWS;
  $("#wfCount").textContent = `${ws.length} of ${MAX_WORKFLOWS}`;
}

/* ---------- score panel ---------- */
const live = $("#scoreLive");
let liveTimer = 0;
function renderScore() {
  const ws = store.get().workflows, s = score(ws), named = s.total;
  const panel = $("#scorePanel");
  panel.classList.toggle("is-empty", named === 0);
  $("#scoreHeadline").innerHTML = named === 0 ? "Add your first workflow to see your score."
    : `<b class="mono">${s.no}</b> of <b class="mono">${s.total}</b> workflows could break and nobody would notice within a day`;
  $("#tNotSure").textContent = s.notSure; $("#tNoOwner").textContent = s.noOwner; $("#tFix").textContent = s.fix; $("#tKill").textContent = s.kill; $("#tLeads").textContent = s.leadsAtRisk;
  const answered = s.yes + s.notSure + s.no || 1;
  $("#barYes").style.width = `${(s.yes / answered) * 100}%`; $("#barNotSure").style.width = `${(s.notSure / answered) * 100}%`; $("#barNo").style.width = `${(s.no / answered) * 100}%`;
  $("#legYes").textContent = s.yes; $("#legNotSure").textContent = s.notSure; $("#legNo").textContent = s.no;
  $("#bar").setAttribute("aria-label", `Yes ${s.yes}, Not sure ${s.notSure}, No ${s.no}${s.unanswered ? `, unanswered ${s.unanswered}` : ""}`);
  $("#verdict").textContent = verdict(s);
  const top = fixFirst(ws);
  const ff = $("#fixFirst"); ff.hidden = !top.length;
  $("#fixFirstList").innerHTML = top.map((w) => `<li><span class="tagpill tagpill--${w.notice}">${NOTICE_LABELS[w.notice]}</span><b>${esc(w.name.trim())}</b><span class="mono muted">${Number.isFinite(w.leadsPerWeek) ? `${w.leadsPerWeek} leads/wk` : "no lead count"}${w.owner.trim() ? "" : " · no owner"}</span></li>`).join("");
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => { live.textContent = named ? `Score updated: ${s.no} of ${s.total} workflows could break unnoticed. ${verdict(s)}` : ""; }, 700);
  // results step
  const results = $("#results"); const show = named >= MIN_FOR_RESULTS;
  if (show && results.hidden) track("results_visible", { total: named });
  results.hidden = !show;
  $("#resultsSummary").textContent = named ? shareText(s, SHARE_URL) : "";
  return s;
}

store.subscribe((state, action) => {
  if (["add", "duplicate", "remove", "restore", "example", "clear", "collapse"].includes(action.type)) renderList();
  else { const el = rendered.get(action.id); const i = state.workflows.findIndex((w) => w.id === action.id); if (el && i >= 0) refreshCard(el, state.workflows[i], i); }
  renderScore();
});

/* ---------- list controls ---------- */
$("#addWf").addEventListener("click", () => {
  if (!store.dispatch({ type: "add" })) return;
  track("workflow_added", { via: "button" }); startedOnce();
  const last = store.get().workflows.at(-1); $(`[data-id="${last.id}"] input[name=name]`)?.focus();
});
async function loadExample() {
  const hasData = store.get().workflows.some((w) => w.name.trim() || w.notice || w.trigger || w.owner);
  if (hasData && !(await confirmDialog("Replace your workflows with the example?", "Your current list will be replaced by three sample rows.", "Load example"))) return;
  store.dispatch({ type: "example" }); track("example_loaded"); startedOnce();
  $("#tool").scrollIntoView({ behavior: "smooth", block: "start" });
}
$$("[data-example]").forEach((b) => b.addEventListener("click", loadExample));
$("#clearAll").addEventListener("click", async () => {
  if (!(await confirmDialog("Clear all workflows?", "This removes every row from this browser. There is no undo.", "Clear all"))) return;
  store.dispatch({ type: "clear" }); try { storage?.removeItem("dxf_inventory_v1"); } catch { /* ignore */ }
});
$("#startBtn").addEventListener("click", () => { $("#tool").scrollIntoView({ behavior: "smooth", block: "start" }); setTimeout(() => $("#wfList input[name=name]")?.focus({ preventScroll: true }), 500); });

/* ---------- CSV + copy ---------- */
$("#csvBtn").addEventListener("click", () => {
  const blob = new Blob([toCSV(store.get().workflows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = csvFilename(); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  track("csv_downloaded", { total: score(store.get().workflows).total });
});
$("#copyBtn").addEventListener("click", async () => {
  const text = shareText(score(store.get().workflows), SHARE_URL);
  const btn = $("#copyBtn");
  const done = () => { btn.textContent = "Copied"; setTimeout(() => (btn.textContent = "Copy my score"), 1600); track("score_copied"); };
  try { await navigator.clipboard.writeText(text); done(); }
  catch { const r = document.createRange(); r.selectNodeContents($("#resultsSummary")); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
});

/* ---------- email form ---------- */
const form = $("#emailForm"), formState = $("#formState"), submitBtn = $("#emailSubmit");
$("#companySize").innerHTML = `<option value="">Prefer not to say</option>` + COMPANY_SIZES.map(([v, l]) => option(v, l, false)).join("");
$("#role").innerHTML = `<option value="">Prefer not to say</option>` + ROLES.map((r) => option(r, r, false)).join("");
let submitted = false;
if (!getClient()) { $("#emailWrap").classList.add("is-unavailable"); $("#emailSoon").hidden = false; form.hidden = true; }
$("#bookBtn").href = BOOKING_LINK;
$("#bookBtn").addEventListener("click", () => track("booking_clicked"));

function setFormState(kind, msg) {
  formState.className = `form__state form__state--${kind}`; formState.textContent = msg || ""; formState.hidden = !msg;
}
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (submitted) { setFormState("ok", "Already sent for this visit."); return; }
  const email = $("#email").value, consent = $("#consent").checked, honey = $("#website").value;
  $("#email").classList.toggle("is-bad", !isValidEmail(email));
  if (!isValidEmail(email)) { setFormState("err", "Enter a valid work email."); $("#email").focus(); return; }
  if (!consent) { setFormState("err", "Tick the consent box so we can send the report."); $("#consent").focus(); return; }
  const success = () => { submitted = true; form.hidden = true; $("#emailDone").hidden = false; $("#emailDone").focus(); track("email_submitted", { total: score(store.get().workflows).total }); };
  if (honey) { success(); return; } // spam: pretend, store nothing
  const row = buildPayload({ score: score(store.get().workflows), email, consent, companySize: $("#companySize").value, role: $("#role").value, utm: getUtm(), referrer: document.referrer });
  submitBtn.disabled = true; submitBtn.textContent = "Sending…"; setFormState("", "");
  try { await insertSubmission(row); success(); }
  catch (err) { setFormState("err", "That didn't send. Your inventory is still here. Check your connection and try again."); console.debug("submission failed", err?.message); }
  finally { submitBtn.disabled = false; submitBtn.textContent = "Email me my report"; }
});

/* ---------- FAQ ---------- */
$$(".faq__item").forEach((d) => d.addEventListener("toggle", () => { if (d.open) $$(".faq__item[open]").forEach((o) => { if (o !== d) o.open = false; }); }));

/* ---------- boot ---------- */
renderList(); renderScore(); track("inventory_viewed");
