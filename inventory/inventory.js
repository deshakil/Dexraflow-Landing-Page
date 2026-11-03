/* Silent Break Score — page logic. State lives in store.js, maths in score.js,
   the spreadsheet in export.js. */
import { BOOKING_LINK, SHARE_URL, UTM_KEY, MAX_WORKFLOWS, MIN_FOR_RESULTS } from "./config.js";
import { TOOLS, NOTICE_LABELS, FINDOUT_LABELS, DECISION_LABELS, COMPANY_SIZES, ROLES, score, verdict, fixFirst, shareText, isValidEmail, buildPayload } from "./score.js";
import { createStore } from "./store.js";
import { buildWorkbook, xlsxFilename } from "./export.js";
import { track } from "./track.js";
import { getClient, insertSubmission } from "./supabase.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const EXCELJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
const SUGGESTIONS = ["Demo form → CRM", "Lead routing (round-robin)", "Enrichment (Clay / Apollo)", "Outbound sequence sync", "Webinar registrants → CRM", "Chatbot → CRM", "Lead scoring update", "New-lead Slack alert"];

let storage = null; try { storage = window.localStorage; } catch { storage = null; }
const store = createStore({ storage });
let started = false;
const startedOnce = () => { if (!started) { started = true; track("inventory_started"); } };

/* ---------- nav ---------- */
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
  $("#toastText").textContent = text;
  const btn = $("#toastBtn"); btn.textContent = actionLabel || ""; btn.hidden = !actionLabel;
  toast.hidden = false; requestAnimationFrame(() => toast.classList.add("is-in"));
  toastTimer = setTimeout(hideToast, ms);
}
function hideToast() { clearTimeout(toastTimer); toast.classList.remove("is-in"); toastAction = null; setTimeout(() => { if (!toast.classList.contains("is-in")) toast.hidden = true; }, 250); }
$("#toastBtn").addEventListener("click", () => { const fn = toastAction; hideToast(); fn?.(); });

/* ---------- confirm dialog ---------- */
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

/* ---------- rows ---------- */
const list = $("#wfList");
const pill = (name, value, label, checked) => `<label class="pill pill--${value}"><input type="radio" name="${name}" value="${value}" ${checked ? "checked" : ""}><span>${label}</span></label>`;
const option = (v, label, sel) => `<option value="${esc(v)}" ${sel ? "selected" : ""}>${esc(label)}</option>`;
const STATUS = {
  none: "Answer the question to count this one.",
  yes: "Someone would catch it. Good.",
  not_sure: "Worth checking. Counted as a blind spot.",
  no: "Blind spot. This could fail silently.",
};

function rowHTML(w, i) {
  const id = w.id;
  return `
    <div class="wf__row">
      <span class="wf__num mono">${String(i + 1).padStart(2, "0")}</span>
      <input class="wf__name" type="text" name="name" maxlength="120" value="${esc(w.name)}" placeholder="Workflow name" aria-label="Workflow name" autocomplete="off">
      <fieldset class="wf__q">
        <legend>Would anyone notice within a day?</legend>
        <div class="pills" role="radiogroup" aria-label="Would anyone notice within a day?">
          ${pill(`notice-${id}`, "yes", "Yes", w.notice === "yes")}${pill(`notice-${id}`, "not_sure", "Not sure", w.notice === "not_sure")}${pill(`notice-${id}`, "no", "No", w.notice === "no")}
        </div>
      </fieldset>
      <div class="wf__tools">
        <button class="wf__more" type="button" data-act="details" aria-expanded="false" aria-controls="d-${id}">Details</button>
        <button class="wf__x" type="button" data-act="remove" aria-label="Remove this workflow">×</button>
      </div>
    </div>
    <p class="wf__status" data-status></p>
    <div class="wf__details" id="d-${id}" hidden>
      <div class="wf__grid">
        <label class="field"><span>Tool</span><select name="tool"><option value="">Choose a tool</option>${TOOLS.map((t) => option(t, t, w.tool === t)).join("")}</select></label>
        <label class="field"><span>What triggers it</span><input type="text" name="trigger" maxlength="200" placeholder="Form submit, new contact, field change, schedule" value="${esc(w.trigger)}" autocomplete="off"></label>
        <label class="field"><span>Owner</span><input type="text" name="owner" maxlength="120" placeholder="A named person, not a team" value="${esc(w.owner)}" autocomplete="off"><small class="hint hint--owner" hidden>No owner = nobody fixes it.</small></label>
        <label class="field"><span>How would we find out?</span><select name="findOut"><option value="">Choose one</option>${Object.entries(FINDOUT_LABELS).map(([v, l]) => option(v, l, w.findOut === v)).join("")}</select><small class="hint hint--nudge" hidden>If the first sign is a complaint, that's usually a No.</small></label>
        <label class="field"><span>Leads touched per week</span><input type="number" name="leadsPerWeek" min="0" step="1" inputmode="numeric" placeholder="0" value="${w.leadsPerWeek ?? ""}"></label>
        <fieldset class="field field--pills"><legend>Decision</legend>
          <div class="pills pills--sm" role="radiogroup" aria-label="Decision">
            ${pill(`decision-${id}`, "keep", "Keep", w.decision === "keep")}${pill(`decision-${id}`, "fix", "Fix", w.decision === "fix")}${pill(`decision-${id}`, "kill", "Kill", w.decision === "kill")}
          </div>
        </fieldset>
      </div>
      <div class="wf__details-foot"><button class="linkbtn" type="button" data-act="duplicate">Duplicate row</button></div>
    </div>`;
}

function refreshRow(el, w, i) {
  el.classList.toggle("is-no", w.notice === "no");
  el.classList.toggle("is-not-sure", w.notice === "not_sure");
  el.classList.toggle("is-yes", w.notice === "yes");
  el.classList.toggle("is-kill", w.decision === "kill");
  el.classList.toggle("is-open", !w.collapsed);
  $(".wf__num", el).textContent = String(i + 1).padStart(2, "0");
  const st = $("[data-status]", el);
  st.textContent = (w.decision === "kill" ? "Marked to kill. " : "") + STATUS[w.notice || "none"];
  st.className = `wf__status wf__status--${w.notice || "none"}`;
  const det = $(".wf__details", el); det.hidden = !!w.collapsed;
  const btn = $("[data-act=details]", el); btn.setAttribute("aria-expanded", String(!w.collapsed)); btn.textContent = w.collapsed ? "Details" : "Hide details";
  $(".hint--owner", el).hidden = !(w.name.trim() && !w.owner.trim());
  $(".hint--nudge", el).hidden = !(w.notice === "yes" && (w.findOut === "complaint" || w.findOut === "wouldnt"));
}

function rowEl(w, i) {
  const el = document.createElement("article");
  el.className = "wf card"; el.dataset.id = w.id; el.innerHTML = rowHTML(w, i);
  refreshRow(el, w, i);
  el.addEventListener("input", (e) => {
    const t = e.target; if (!t.name) return;
    startedOnce();
    let v = t.value;
    if (t.name.startsWith("notice-")) { store.dispatch({ type: "update", id: w.id, patch: { notice: v } }); return; }
    if (t.name.startsWith("decision-")) { store.dispatch({ type: "update", id: w.id, patch: { decision: v } }); return; }
    if (t.name === "leadsPerWeek") v = t.value === "" ? null : Math.max(0, Math.floor(Number(t.value) || 0));
    else if (t.name === "findOut") v = t.value || null;
    store.dispatch({ type: "update", id: w.id, patch: { [t.name]: v } });
  });
  el.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act; if (!act) return;
    const cur = store.get().workflows.find((x) => x.id === w.id); if (!cur) return;
    if (act === "details") store.dispatch({ type: "collapse", id: w.id, collapsed: !cur.collapsed });
    if (act === "duplicate") { if (!store.dispatch({ type: "duplicate", id: w.id })) showToast(`You can list up to ${MAX_WORKFLOWS} workflows.`); else track("workflow_added", { via: "duplicate" }); }
    if (act === "remove") {
      const ws = store.get().workflows, index = ws.findIndex((x) => x.id === w.id), removed = ws[index];
      store.dispatch({ type: "remove", id: w.id });
      showToast(`Removed "${removed.name.trim() || "Untitled workflow"}".`, "Undo", () => store.dispatch({ type: "restore", index, workflow: removed }));
    }
  });
  return el;
}

let rendered = new Map();
function renderList() {
  const ws = store.get().workflows;
  const next = new Map(), frag = document.createDocumentFragment();
  ws.forEach((w, i) => { let el = rendered.get(w.id); if (!el) el = rowEl(w, i); else refreshRow(el, w, i); next.set(w.id, el); frag.appendChild(el); });
  rendered = next; list.replaceChildren(frag);
  const has = ws.length > 0;
  $("#listHead").hidden = !has; $("#listFoot").hidden = !has;
  $("#wfCount").textContent = `${ws.length} of ${MAX_WORKFLOWS}`;
  renderHint(); renderChips();
  $("#addInput").disabled = ws.length >= MAX_WORKFLOWS;
}

function renderHint() {
  const ws = store.get().workflows, named = ws.filter((w) => w.name.trim()), answered = named.filter((w) => w.notice).length;
  $("#listHint").textContent = !ws.length ? "" : answered < named.length
    ? `${answered} of ${named.length} answered. Answer each row to count it.`
    : named.length < MIN_FOR_RESULTS ? `All answered. Add ${MIN_FOR_RESULTS - named.length} more for a score you can share.` : "All answered. Your score is ready on the right.";
}

function renderChips() {
  const box = $("#chips");
  const names = new Set(store.get().workflows.map((w) => w.name.trim().toLowerCase()));
  $$("button", box).forEach((b) => b.remove());
  SUGGESTIONS.filter((s) => !names.has(s.toLowerCase())).forEach((s) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "chip chip--add"; b.textContent = `+ ${s}`;
    b.addEventListener("click", () => addWorkflow(s, "chip"));
    box.appendChild(b);
  });
  box.hidden = $$("button", box).length === 0;
}

function addWorkflow(name, via) {
  if (!store.dispatch({ type: "add", name })) { showToast(`You can list up to ${MAX_WORKFLOWS} workflows.`); return; }
  startedOnce(); track("workflow_added", { via });
  const last = store.get().workflows.at(-1);
  const el = rendered.get(last.id);
  el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  $(`input[name="notice-${last.id}"]`, el)?.focus({ preventScroll: true });
}

/* ---------- score panel ---------- */
const live = $("#scoreLive");
let liveTimer = 0;
function renderScore() {
  const ws = store.get().workflows, s = score(ws), named = s.total;
  $("#scorePanel").classList.toggle("is-empty", named === 0);
  $("#scoreHeadline").innerHTML = named === 0 ? "Add your first workflow to see your score."
    : `<b class="mono">${s.no}</b> of <b class="mono">${s.total}</b> workflows could break and nobody would notice within a day`;
  $("#scoreMeaning").textContent = named === 0 ? 'A "No" means a broken workflow would quietly drop leads until a rep or a customer complains.'
    : s.unanswered ? `${s.unanswered} ${s.unanswered === 1 ? "row is" : "rows are"} unanswered and not counted yet.` : 'Counting every row answered "No". "Not sure" rows are listed as blind spots too.';
  $("#tNotSure").textContent = s.notSure; $("#tNoOwner").textContent = s.noOwner; $("#tFix").textContent = s.fix; $("#tKill").textContent = s.kill; $("#tLeads").textContent = s.leadsAtRisk;
  const answered = s.yes + s.notSure + s.no || 1;
  $("#barYes").style.width = `${(s.yes / answered) * 100}%`; $("#barNotSure").style.width = `${(s.notSure / answered) * 100}%`; $("#barNo").style.width = `${(s.no / answered) * 100}%`;
  $("#legYes").textContent = s.yes; $("#legNotSure").textContent = s.notSure; $("#legNo").textContent = s.no;
  $("#bar").setAttribute("aria-label", `Yes ${s.yes}, Not sure ${s.notSure}, No ${s.no}${s.unanswered ? `, unanswered ${s.unanswered}` : ""}`);
  $("#verdict").textContent = verdict(s); $("#verdict").hidden = !verdict(s);
  const top = fixFirst(ws);
  $("#fixFirst").hidden = !top.length;
  $("#fixFirstList").innerHTML = top.map((w) => `<li><span class="tagpill tagpill--${w.notice}">${NOTICE_LABELS[w.notice]}</span><b>${esc(w.name.trim())}</b><span class="mono muted">${Number.isFinite(w.leadsPerWeek) ? `${w.leadsPerWeek} leads/wk` : "no lead count"}${w.owner.trim() ? "" : " · no owner"}</span></li>`).join("");
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => { live.textContent = named ? `Score updated: ${s.no} of ${s.total} workflows could break unnoticed. ${verdict(s)}` : ""; }, 700);
  const results = $("#results"), show = named >= MIN_FOR_RESULTS;
  if (show && results.hidden) track("results_visible", { total: named });
  results.hidden = !show;
  $("#resultsSummary").textContent = named ? shareText(s, SHARE_URL) : "";
  return s;
}

store.subscribe((state, action) => {
  if (["add", "duplicate", "remove", "restore", "example", "clear", "collapse"].includes(action.type)) renderList();
  else { const el = rendered.get(action.id); const i = state.workflows.findIndex((w) => w.id === action.id); if (el && i >= 0) refreshRow(el, state.workflows[i], i); if (action.patch && "name" in action.patch) renderChips(); renderHint(); }
  renderScore();
});

/* ---------- adder + controls ---------- */
$("#addForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#addInput"), name = input.value.trim();
  if (!name) { input.focus(); return; }
  input.value = ""; addWorkflow(name, "typed");
});
async function loadExample() {
  const hasData = store.get().workflows.some((w) => w.name.trim() || w.notice);
  if (hasData && !(await confirmDialog("Replace your workflows with the example?", "Your current list will be replaced by three sample rows.", "Load example"))) return;
  store.dispatch({ type: "example" }); track("example_loaded"); startedOnce();
  $("#tool").scrollIntoView({ behavior: "smooth", block: "start" });
}
$$("[data-example]").forEach((b) => b.addEventListener("click", loadExample));
$("#clearAll").addEventListener("click", async () => {
  if (!(await confirmDialog("Clear all workflows?", "This removes every row from this browser. There is no undo.", "Clear all"))) return;
  store.dispatch({ type: "clear" }); try { storage?.removeItem("dxf_inventory_v1"); } catch { /* ignore */ }
});
$("#startBtn").addEventListener("click", () => { $("#tool").scrollIntoView({ behavior: "smooth", block: "start" }); setTimeout(() => $("#addInput").focus({ preventScroll: true }), 500); });

/* ---------- spreadsheet + copy ---------- */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { const t = setInterval(() => { if (window.ExcelJS) { clearInterval(t); resolve(); } }, 50); setTimeout(() => { clearInterval(t); reject(new Error("timeout")); }, 15000); return; }
    const s = document.createElement("script"); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("load failed")); document.head.appendChild(s);
  });
}
$("#xlsxBtn").addEventListener("click", async () => {
  const btn = $("#xlsxBtn"), note = $("#xlsxNote"), label = btn.textContent;
  btn.disabled = true; btn.textContent = "Preparing…";
  try {
    if (!window.ExcelJS) await loadScript(EXCELJS_URL);
    const ws = store.get().workflows, wb = buildWorkbook(window.ExcelJS, ws, score(ws));
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = xlsxFilename(); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    track("xlsx_downloaded", { total: score(ws).total });
  } catch (err) {
    note.textContent = "The spreadsheet couldn't be built right now. Check your connection and try again."; console.debug("xlsx failed", err?.message);
  } finally { btn.disabled = false; btn.textContent = label; }
});
$("#copyBtn").addEventListener("click", async () => {
  const text = shareText(score(store.get().workflows), SHARE_URL), btn = $("#copyBtn");
  const done = () => { btn.textContent = "Copied"; setTimeout(() => (btn.textContent = "Copy my score"), 1600); track("score_copied"); };
  try { await navigator.clipboard.writeText(text); done(); }
  catch { const r = document.createRange(); r.selectNodeContents($("#resultsSummary")); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
});

/* ---------- email form ---------- */
const form = $("#emailForm"), formState = $("#formState"), submitBtn = $("#emailSubmit");
$("#companySize").innerHTML = `<option value="">Prefer not to say</option>` + COMPANY_SIZES.map(([v, l]) => option(v, l, false)).join("");
$("#role").innerHTML = `<option value="">Prefer not to say</option>` + ROLES.map((r) => option(r, r, false)).join("");
let submitted = false;
if (!getClient()) { $("#emailSoon").hidden = false; form.hidden = true; }
$("#bookBtn").href = BOOKING_LINK;
$("#bookBtn").addEventListener("click", () => track("booking_clicked"));
function setFormState(kind, msg) { formState.className = `form__state form__state--${kind}`; formState.textContent = msg || ""; formState.hidden = !msg; }
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (submitted) { setFormState("ok", "Already sent for this visit."); return; }
  const email = $("#email").value, consent = $("#consent").checked, honey = $("#website").value;
  $("#email").classList.toggle("is-bad", !isValidEmail(email));
  if (!isValidEmail(email)) { setFormState("err", "Enter a valid work email."); $("#email").focus(); return; }
  if (!consent) { setFormState("err", "Tick the consent box so we can send the report."); $("#consent").focus(); return; }
  const success = () => { submitted = true; form.hidden = true; $("#emailDone").hidden = false; $("#emailDone").focus(); track("email_submitted", { total: score(store.get().workflows).total }); };
  if (honey) { success(); return; }
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
