/* Dexraflow — line illustrations
   Thin-stroke, mono-labelled drawings in the brand's teal and amber:
   the lead-temperature curve, step pictograms and the audit lookback strip.
   Each is generated here so the markup stays small, and each draws itself on
   when it scrolls into view (or sits fully drawn under reduced motion). */
(() => {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const motion = !!(window.gsap && window.ScrollTrigger) && !reduce;
  const NS = "http://www.w3.org/2000/svg";
  const onEnter = (el, fn, start = "top 85%") => { if (!motion) { fn(); return; } ScrollTrigger.create({ trigger: el, start, once: true, onEnter: fn }); };
  const drawOn = (svg, { duration = 1.4, stagger = 0.08, delay = 0 } = {}) => {
    const strokes = Array.from(svg.querySelectorAll("path, line, polyline, circle, rect, ellipse")).filter((e) => !e.classList.contains("fill") && !e.classList.contains("nodraw"));
    const fills = Array.from(svg.querySelectorAll(".fill, text, .pop"));
    if (!motion) return;
    strokes.forEach((e) => { let len = 100; try { len = e.getTotalLength(); } catch {} e.style.strokeDasharray = len; e.style.strokeDashoffset = len; });
    if (fills.length) gsap.set(fills, { autoAlpha: 0 });
    onEnter(svg, () => {
      if (strokes.length) gsap.to(strokes, { strokeDashoffset: 0, duration, stagger, delay, ease: "power2.inOut" });
      if (fills.length) gsap.to(fills, { autoAlpha: 1, duration: 0.6, delay: delay + 0.6, stagger: 0.05 });
    });
  };

  /* ---------- 1. lead temperature curve ---------- */
  const curve = document.getElementById("curveChart");
  if (curve) {
    const W = 640, H = 250, PL = 46, PR = 18, PT = 22, PB = 40;
    const xs = (t) => PL + (t / 48) * (W - PL - PR);
    const ys = (v) => PT + (1 - v) * (H - PT - PB);
    const f = (t) => Math.exp(-t / 9);
    let d = "";
    for (let t = 0; t <= 48; t += 0.5) d += `${t ? " L" : "M"}${xs(t).toFixed(1)},${ys(f(t)).toFixed(1)}`;
    const area = `${d} L${xs(48).toFixed(1)},${ys(0).toFixed(1)} L${xs(0).toFixed(1)},${ys(0).toFixed(1)} Z`;
    const ticks = [0, 12, 24, 36, 48].map((t) => `<line class="axis" x1="${xs(t)}" y1="${ys(0)}" x2="${xs(t)}" y2="${ys(0) + 5}"/><text x="${xs(t)}" y="${ys(0) + 20}" text-anchor="middle">${t}h</text>`).join("");
    const grid = [0.25, 0.5, 0.75, 1].map((v) => `<line class="grid" x1="${PL}" y1="${ys(v)}" x2="${W - PR}" y2="${ys(v)}"/>`).join("");
    const mark = (t, text, dy, anchor) => `<g class="curve__mark pop"><line class="axis" x1="${xs(t)}" y1="${ys(f(t))}" x2="${xs(t)}" y2="${ys(0)}" stroke-dasharray="3 3"/><circle cx="${xs(t)}" cy="${ys(f(t))}" r="5"/><text x="${xs(t) + (anchor === "end" ? -10 : 10)}" y="${ys(f(t)) + dy}" text-anchor="${anchor}">${text}</text></g>`;
    curve.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="An illustrative curve of how the chance to qualify a lead falls as hours pass, marked at one hour and at forty-two hours.">
        <defs><linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8962e" stop-opacity=".32"/><stop offset="1" stop-color="#e8962e" stop-opacity="0"/></linearGradient></defs>
        ${grid}
        <line class="axis" x1="${PL}" y1="${ys(0)}" x2="${W - PR}" y2="${ys(0)}"/>
        ${ticks}
        <text class="nodraw" transform="translate(14 ${(PT + ys(0)) / 2}) rotate(-90)" text-anchor="middle">chance to qualify</text>
        <path class="curve__area fill" d="${area}"/>
        <path class="curve__line" d="${d}"/>
        ${mark(1, "1 hr · 7× more likely", 4, "start")}
        ${mark(42, "42 hrs · average first response", -12, "end")}
        <text class="curve__cap nodraw" x="${W - PR}" y="${H - 2}" text-anchor="end">illustrative curve · source [4]</text>
      </svg>`;
    const svg = curve.querySelector("svg");
    if (motion) {
      const line = svg.querySelector(".curve__line"), len = line.getTotalLength();
      const marks = svg.querySelectorAll(".curve__mark"), areaEl = svg.querySelector(".curve__area");
      gsap.set(line, { strokeDasharray: len, strokeDashoffset: len });
      gsap.set(areaEl, { autoAlpha: 0 }); gsap.set(marks, { autoAlpha: 0, scale: 0.8, transformOrigin: "50% 50%" });
      onEnter(svg, () => {
        gsap.timeline()
          .to(line, { strokeDashoffset: 0, duration: 2.2, ease: "power2.inOut" })
          .to(areaEl, { autoAlpha: 1, duration: 1 }, 0.6)
          .to(marks[0], { autoAlpha: 1, scale: 1, duration: 0.6 }, 0.55)
          .to(marks[1], { autoAlpha: 1, scale: 1, duration: 0.6 }, 2.0);
      });
    }
  }

  /* ---------- 2. step pictograms ---------- */
  const PICTS = {
    connect: `<rect x="6" y="8" width="16" height="11" rx="2"/><rect x="6" y="26" width="16" height="11" rx="2"/><rect x="6" y="44" width="16" height="11" rx="2"/>
      <path class="dash" d="M22 13.5h10v18h8"/><path class="dash" d="M22 31.5h10"/><path class="dash" d="M22 49.5h10v-18"/>
      <rect x="40" y="18" width="20" height="28" rx="4"/><rect class="amber" x="45.5" y="31" width="9" height="7.5" rx="1.5"/><path class="amber" d="M47.5 31v-2.5a2.5 2.5 0 0 1 5 0V31"/>`,
    match: `<rect x="6" y="12" width="30" height="22" rx="3"/><path d="M12 19h12M12 24h18M12 29h8"/>
      <rect class="fill" x="26" y="28" width="30" height="22" rx="3"/><rect x="26" y="28" width="30" height="22" rx="3"/><path d="M32 35h12M32 40h18M32 45h8"/>
      <circle class="fill" cx="48" cy="18" r="8"/><circle cx="48" cy="18" r="8"/><path d="M44 18l3 3 5-6"/>`,
    catch: `<circle class="amber" cx="20" cy="10" r="3.5"/><path class="dash amber" d="M20 15v12"/>
      <path d="M6 30h52"/><path d="M6 30c8 26 44 26 52 0"/><path d="M14 30c6 15 30 15 36 0"/><path d="M22 30c4 7 16 7 20 0"/>
      <path d="M20 31v14M32 32v17M44 31v14"/><circle cx="20" cy="31" r="3.5" class="fill"/><circle cx="20" cy="31" r="3.5"/>`,
    alert: `<path d="M8 10h36a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H22l-8 7v-7H8a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3z"/><path d="M13 18h20M13 24h14"/><circle class="amber" cx="40" cy="21" r="2.5"/>
      <path d="M36 56h24"/><path d="M40 56v-9M48 56v-15M56 56v-22"/><path class="dash" d="M38 36l18-6"/>`,
  };
  document.querySelectorAll("[data-pict]").forEach((el) => {
    el.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">${PICTS[el.dataset.pict] || ""}</svg>`;
    drawOn(el.querySelector("svg"), { duration: 1.1, stagger: 0.06 });
  });

  /* ---------- 3. audit lookback strip (90 days, 13 weeks) ---------- */
  const strip = document.getElementById("auditStrip");
  if (strip) {
    const heights = [34, 28, 40, 52, 30, 26, 44, 60, 32, 38, 56, 30, 36];
    const hits = { 3: "no owner", 7: "silent failure", 10: "missed signal" };
    const BW = 28, G = 12, BASE = 92, X0 = 8;
    const bars = heights.map((h, i) => {
      const x = X0 + i * (BW + G), hit = hits[i];
      return `<g><rect class="bar${hit ? " bar--hit" : ""}" x="${x}" y="${BASE - h}" width="${BW}" height="${h}" rx="3"/>${hit ? `<text class="hit pop" x="${x + BW / 2}" y="${BASE - h - 8}" text-anchor="middle">${hit}</text>` : ""}</g>`;
    }).join("");
    strip.innerHTML = `<svg viewBox="0 0 ${X0 * 2 + 13 * (BW + G) - G} 118" aria-hidden="true">
      <line class="axis nodraw" x1="${X0}" y1="${BASE}" x2="${X0 + 13 * (BW + G) - G}" y2="${BASE}"/>
      ${bars}
      <text class="nodraw" x="${X0}" y="${BASE + 18}">wk 1</text><text class="nodraw" x="${X0 + 13 * (BW + G) - G}" y="${BASE + 18}" text-anchor="end">wk 13 · 90 days back</text>
    </svg>`;
    if (motion) {
      const svg = strip.querySelector("svg"), plain = svg.querySelectorAll(".bar:not(.bar--hit)"), hot = svg.querySelectorAll(".bar--hit"), labels = svg.querySelectorAll(".hit");
      gsap.set([plain, hot], { scaleY: 0, transformOrigin: "50% 100%" }); gsap.set(labels, { autoAlpha: 0, y: 6 });
      onEnter(svg, () => {
        gsap.timeline()
          .to(plain, { scaleY: 1, duration: 0.7, stagger: 0.05, ease: "power3.out" })
          .to(hot, { scaleY: 1, duration: 0.7, stagger: 0.18, ease: "back.out(1.6)" }, 0.5)
          .to(labels, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.18 }, 0.9);
      });
    }
  }
})();
