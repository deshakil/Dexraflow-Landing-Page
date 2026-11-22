/* Dexraflow — audit form and small page helpers. No libraries. */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);

  /* Form delivery. Create a free access key at https://web3forms.com for
     shakil@dexraflow.in and paste it here. While it is empty, the form shows
     the visitor a prefilled email instead of failing. */
  const WEB3FORMS_KEY = "";
  const CONTACT = "shakil@dexraflow.in";

  const yr = $("#year"); if (yr) yr.textContent = String(new Date().getFullYear());

  /* Sticky mobile button: show once the hero's own button has scrolled away. */
  const sticky = $("#stickyCta"), heroBtn = document.querySelector(".hero .btn"), audit = $("#audit");
  if (sticky && heroBtn && audit && "IntersectionObserver" in window) {
    let heroGone = false, formVisible = false;
    const update = () => { const on = heroGone && !formVisible; sticky.classList.toggle("is-on", on); sticky.setAttribute("aria-hidden", String(!on)); sticky.querySelector("a").tabIndex = on ? 0 : -1; document.body.classList.toggle("has-sticky", on); };
    new IntersectionObserver(([e]) => { heroGone = !e.isIntersecting && e.boundingClientRect.top < 0; update(); }).observe(heroBtn);
    new IntersectionObserver(([e]) => { formVisible = e.isIntersecting; update(); }, { threshold: 0.1 }).observe(audit);
  }

  const form = $("#auditForm"); if (!form) return;
  const msg = $("#formMsg"), done = $("#formDone"), fb = $("#formFallback"), submit = $("#formSubmit");
  const show = (which) => { form.hidden = which !== "form"; done.hidden = which !== "done"; fb.hidden = which !== "fallback"; };
  const say = (text, ok) => { msg.textContent = text; msg.className = "form__msg" + (ok ? " form__msg--ok" : ""); msg.hidden = !text; };
  const compose = (p) => {
    const subject = `Free missed-call audit: ${p.shop}`;
    const body = [`Name: ${p.name}`, `Shop: ${p.shop}`, `Email: ${p.email}`, `Phone: ${p.phone}`, `Booking tool: ${p.tool}`, "", "Sent from dexraflow.in"].join("\n");
    return { subject, body };
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const p = { name: (data.name || "").trim(), shop: (data.shop || "").trim(), email: (data.email || "").trim(), phone: (data.phone || "").trim(), tool: (data.tool || "").trim() };
    const bad = Object.keys(p).filter((k) => !p[k]);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) bad.push("email");
    form.querySelectorAll("input, select").forEach((el) => el.classList.toggle("is-bad", bad.includes(el.name)));
    if (bad.length) { say("Please fill in every field, including a valid email address."); form.querySelector(".is-bad")?.focus(); return; }
    if ((data.botcheck || "").trim()) { show("done"); return; } // spam: pretend success
    say("", false);
    submit.disabled = true; submit.textContent = "Sending…";
    try {
      if (!WEB3FORMS_KEY) throw new Error("no-key");
      const { subject } = compose(p);
      const r = await fetch("https://api.web3forms.com/submit", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ access_key: WEB3FORMS_KEY, subject, from_name: p.name, email: p.email, name: p.name, shop: p.shop, phone: p.phone, booking_tool: p.tool, botcheck: "" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.success === false) throw new Error(j.message || "send-failed");
      show("done"); done.focus();
    } catch {
      const { subject, body } = compose(p);
      $("#fbText").value = `To: ${CONTACT}\nSubject: ${subject}\n\n${body}`;
      $("#fbMail").href = `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      show("fallback"); fb.focus?.();
    } finally { submit.disabled = false; submit.textContent = "Request my free audit"; }
  });
  $("#fbCopy")?.addEventListener("click", async () => {
    const btn = $("#fbCopy"), text = $("#fbText").value;
    try { await navigator.clipboard.writeText(text); btn.textContent = "Copied"; setTimeout(() => (btn.textContent = "Copy request"), 1600); }
    catch { $("#fbText").select(); }
  });
})();
