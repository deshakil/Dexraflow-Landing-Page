/* Second Ring — page behaviour. No libraries. Transform/opacity animations
   live in CSS; this file only toggles state and runs the few counters. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("static");
  const yr = $("#year"); if (yr) yr.textContent = String(new Date().getFullYear());

  /* ---------- header: shrink + blur after 80px, ink colour on light zones ---------- */
  const hdr = $("#hdr");
  const onScrollHdr = () => hdr.classList.toggle("is-small", window.scrollY > 80);
  window.addEventListener("scroll", onScrollHdr, { passive: true }); onScrollHdr();

  /* ---------- background: Night -> Frost -> Paper across the first three sections ---------- */
  const hero = $("#hero"), problem = $("#problem"), how = $("#how");
  const NIGHT = [15, 27, 45], FROST = [234, 242, 248], PAPER = [251, 247, 242];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  let ticking = false;
  const paint = () => {
    ticking = false;
    if (!hero || !problem || !how) return;
    const vh = window.innerHeight, pivot = vh * 0.55;
    const pTop = problem.getBoundingClientRect().top, hTop = how.getBoundingClientRect().top;
    // 0 -> 1 as the problem section's top passes the pivot, then 1 -> 2 as "how" does.
    const t1 = clamp01(1 - (pTop - pivot + vh * 0.35) / (vh * 0.5));
    const t2 = clamp01(1 - (hTop - pivot + vh * 0.35) / (vh * 0.5));
    const rgb = t2 > 0 ? mix(FROST, PAPER, t2) : mix(NIGHT, FROST, t1);
    document.body.style.backgroundColor = `rgb(${rgb.join(",")})`;
    const light = t1 > 0.5;
    hdr.classList.toggle("is-light", light);
    document.body.dataset.zone = t2 > 0.5 ? "paper" : light ? "frost" : "night";
  };
  const requestPaint = () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } };
  if (hero && !document.body.classList.contains("page-light")) {
    window.addEventListener("scroll", requestPaint, { passive: true });
    window.addEventListener("resize", requestPaint);
    paint();
  } else { hdr.classList.add("is-light"); }

  /* ---------- hero loop (about 8.8s) ---------- */
  const scene = $("#scene");
  if (scene) {
    if (reduce) { scene.dataset.phase = "booked"; scene.classList.add("is-static"); }
    else {
      const steps = [["incoming", 0], ["missed", 2300], ["second", 3500], ["message", 4800], ["booked", 6300], ["out", 8300]];
      let timers = [];
      const run = () => {
        timers.forEach(clearTimeout);
        timers = steps.map(([phase, at]) => setTimeout(() => (scene.dataset.phase = phase), at));
        timers.push(setTimeout(run, 8900));
      };
      // Only loop while the hero is on screen, so nothing burns CPU off-screen.
      new IntersectionObserver(([e]) => { if (e.isIntersecting) run(); else timers.forEach(clearTimeout); }, { threshold: 0.2 }).observe(scene);
    }
  }

  /* ---------- scroll reveal ---------- */
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  $$("[data-reveal]").forEach((el) => io.observe(el));

  /* ---------- how it works: line draws with scroll, steps light up ---------- */
  const track = $("#howTrack"), fill = $("#howFill"), stepsEls = $$("[data-step]");
  if (track && fill && !reduce) {
    let t2 = false;
    const drawLine = () => {
      t2 = false;
      const r = track.getBoundingClientRect(), vh = window.innerHeight;
      const p = clamp01((vh * 0.75 - r.top) / (r.height * (window.innerWidth >= 900 ? 0.6 : 0.9)));
      fill.style.transform = window.innerWidth >= 900 ? `scaleX(${p})` : `scaleY(${p})`;
      stepsEls.forEach((s, i) => s.classList.toggle("is-lit", p >= (i + 0.35) / stepsEls.length));
    };
    const reqLine = () => { if (!t2) { t2 = true; requestAnimationFrame(drawLine); } };
    window.addEventListener("scroll", reqLine, { passive: true }); window.addEventListener("resize", reqLine); drawLine();
  } else if (track) { stepsEls.forEach((s) => s.classList.add("is-lit")); }

  /* ---------- report: count up ---------- */
  const rep = $("#rep");
  if (rep) {
    const counters = $$("[data-count]", rep);
    const finish = () => counters.forEach((c) => (c.textContent = (c.dataset.prefix || "") + Number(c.dataset.count).toLocaleString("en-US")));
    if (reduce) finish();
    else new IntersectionObserver(([e], obs) => {
      if (!e.isIntersecting) return; obs.disconnect();
      counters.forEach((c) => (c.textContent = (c.dataset.prefix || "") + "0"));
      const t0 = performance.now(), dur = 1400;
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / dur), ease = 1 - Math.pow(1 - p, 3);
        counters.forEach((c) => (c.textContent = (c.dataset.prefix || "") + Math.round(Number(c.dataset.count) * ease).toLocaleString("en-US")));
        if (p < 1) requestAnimationFrame(tick); else finish();
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 }).observe(rep);
  }

  /* ---------- emergency diagram + footer windows: play when visible ---------- */
  const emg = $("#emg");
  if (emg && !reduce) new IntersectionObserver(([e]) => emg.classList.toggle("is-play", e.isIntersecting), { threshold: 0.3 }).observe(emg);
  const ftr = $("#ftr");
  if (ftr && !reduce) new IntersectionObserver(([e], obs) => { if (e.isIntersecting) { ftr.classList.add("is-lit"); obs.disconnect(); } }, { threshold: 0.2 }).observe(ftr);

  /* ---------- atmosphere clip behind the problem section (desktop, wifi, motion allowed) ---------- */
  const vid = $("#problemVideo");
  if (vid) {
    const conn = navigator.connection || {};
    const cellular = conn.saveData || conn.type === "cellular" || /(^|-)2g|3g/.test(conn.effectiveType || "");
    const ok = !reduce && !cellular && window.innerWidth >= 760 && typeof vid.canPlayType === "function";
    if (!ok) vid.remove();
    else new IntersectionObserver(([e], obs) => {
      if (!e.isIntersecting) return; obs.disconnect();
      [["webm", "video/webm"], ["mp4", "video/mp4"]].forEach(([k, type]) => { const src = document.createElement("source"); src.src = vid.dataset[k]; src.type = type; vid.appendChild(src); });
      vid.load();
      vid.play().then(() => { vid.classList.add("is-on"); vid.closest(".sec--problem").classList.add("has-video"); }).catch(() => vid.remove());
    }, { rootMargin: "300px 0px" }).observe(vid);
  }

  /* ---------- audit form ---------- */
  /* Submissions are written to the Second Ring Supabase project. The key below is
     the project's publishable key: it is designed to ship in a browser, and row
     level security lets it insert a request and nothing else (no reads, no
     updates, no deletes). If the insert fails, the visitor gets a prefilled email. */
  const SUPABASE_URL = "https://smerteqnuoqzawmdwlod.supabase.co";
  const SUPABASE_KEY = "sb_publishable_pH-YD_cbbDqJIJh03OA0Cw_xyzddxLc";
  const CONTACT = "shakil@dexraflow.in";
  const form = $("#auditForm"); if (!form) return;
  const msg = $("#formMsg"), done = $("#formDone"), fb = $("#formFallback"), submit = $("#formSubmit");
  const show = (which) => { form.hidden = which !== "form"; done.hidden = which !== "done"; fb.hidden = which !== "fallback"; };
  const say = (text) => { msg.textContent = text; msg.hidden = !text; };
  const compose = (p) => ({ subject: `Free missed-call audit: ${p.shop}`, body: [`Name: ${p.name}`, `Shop: ${p.shop}`, `Email: ${p.email}`, `Phone: ${p.phone || "(not given)"}`, `Booking tool: ${p.tool}`, "", "Sent from secondring.dexraflow.in"].join("\n") });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const p = { name: (data.name || "").trim(), shop: (data.shop || "").trim(), email: (data.email || "").trim(), phone: (data.phone || "").trim(), tool: (data.tool || "").trim() };
    const bad = Object.keys(p).filter((k) => k !== "phone" && !p[k]);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) bad.push("email");
    form.querySelectorAll("input, select").forEach((el) => el.classList.toggle("is-bad", bad.includes(el.name)));
    if (bad.length) { say("Please fill in every field, including a valid email address."); form.querySelector(".is-bad")?.focus(); return; }
    if ((data.botcheck || "").trim()) { show("done"); return; }
    say(""); submit.disabled = true; submit.textContent = "Sending…";
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/audit_requests`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ name: p.name, shop: p.shop, email: p.email.toLowerCase(), phone: p.phone || null, booking_tool: p.tool, source: location.hostname, referrer: (document.referrer || "").slice(0, 500), botcheck: (data.botcheck || "").trim() }),
      });
      if (!r.ok) throw new Error(`insert failed: ${r.status}`);
      show("done"); done.focus();
    } catch {
      const { subject, body } = compose(p);
      $("#fbText").value = `To: ${CONTACT}\nSubject: ${subject}\n\n${body}`;
      $("#fbMail").href = `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      show("fallback");
    } finally { submit.disabled = false; submit.textContent = "Request my free audit"; }
  });
  $("#fbCopy")?.addEventListener("click", async () => {
    const btn = $("#fbCopy");
    try { await navigator.clipboard.writeText($("#fbText").value); btn.textContent = "Copied"; setTimeout(() => (btn.textContent = "Copy request"), 1600); }
    catch { $("#fbText").select(); }
  });
})();
