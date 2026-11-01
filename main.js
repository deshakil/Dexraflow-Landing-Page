/* Dexraflow — motion layer
   Libraries: GSAP 3 + ScrollTrigger, Lenis. Everything degrades to a readable
   static page if a library fails to load or the viewer prefers reduced motion. */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasGsap = typeof window.gsap !== "undefined";
  const EASE = "expo.out";
  const MCP_URL = "https://mcp.dexraflow.com/mcp";

  $("#year").textContent = String(new Date().getFullYear());

  if (!hasGsap) {
    const intro = $("#intro"); if (intro) intro.remove();
  } else {
    gsap.registerPlugin(ScrollTrigger);
    gsap.defaults({ ease: EASE, duration: 1 });
  }

  /* ---------------- smooth scroll ---------------- */
  let lenis = null;
  if (hasGsap && !reduce && typeof window.Lenis !== "undefined") {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollTo = (target, offset = -90) => {
    const el = typeof target === "string" ? $(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset, duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const el = $(id);
      if (!el) return;
      e.preventDefault();
      closeSheet();
      scrollTo(el, id === "#top" ? -200 : -90);
      history.replaceState(null, "", id);
    });
  });

  /* ---------------- nav ---------------- */
  const nav = $("#nav");
  const burger = $("#burger");
  const progress = $("#progress span");
  let lastY = 0;
  const onScroll = (y, dir) => {
    nav.classList.toggle("is-scrolled", y > 24);
    const goingDown = dir > 0 && y > lastY;
    nav.classList.toggle("is-hidden", goingDown && y > 140 && !nav.classList.contains("is-open"));
    lastY = y;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
  };
  if (lenis) lenis.on("scroll", ({ scroll, direction }) => onScroll(scroll, direction));
  else window.addEventListener("scroll", () => onScroll(window.scrollY, window.scrollY > lastY ? 1 : -1), { passive: true });
  onScroll(window.scrollY, 0);

  function closeSheet() {
    nav.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
  }
  burger.addEventListener("click", () => {
    const open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
  });

  if (hasGsap) {
    // Which surface sits under the nav decides its ink colour.
    $$(".band:not(.band--night), .footer").forEach((band) => {
      ScrollTrigger.create({ trigger: band, start: "top 48px", end: "bottom 48px", toggleClass: { targets: nav, className: "on-light" } });
    });
    $$("[data-nav]").forEach((link) => {
      const sec = $(link.getAttribute("href"));
      if (!sec) return;
      ScrollTrigger.create({
        trigger: sec, start: "top 50%", end: "bottom 50%",
        onToggle: (st) => link.classList.toggle("is-active", st.isActive),
      });
    });
  }

  /* ---------------- cursor + magnetic ---------------- */
  if (hasGsap && finePointer && !reduce) {
    const cur = $("#cursor");
    const xDot = gsap.quickTo(cur.querySelector(".cursor__dot"), "x", { duration: 0.12, ease: "power3" });
    const yDot = gsap.quickTo(cur.querySelector(".cursor__dot"), "y", { duration: 0.12, ease: "power3" });
    const xRing = gsap.quickTo(cur.querySelector(".cursor__ring"), "x", { duration: 0.45, ease: "power3" });
    const yRing = gsap.quickTo(cur.querySelector(".cursor__ring"), "y", { duration: 0.45, ease: "power3" });
    window.addEventListener("pointermove", (e) => { cur.classList.add("is-live"); xDot(e.clientX); yDot(e.clientY); xRing(e.clientX); yRing(e.clientY); });
    window.addEventListener("pointerdown", () => cur.classList.add("is-down"));
    window.addEventListener("pointerup", () => cur.classList.remove("is-down"));
    document.addEventListener("pointerover", (e) => {
      cur.classList.toggle("is-hover", !!e.target.closest("a, button, summary, [role=tab], .tilt"));
    });

    $$(".magnetic").forEach((btn) => {
      const toX = gsap.quickTo(btn, "x", { duration: 0.6, ease: "power3" });
      const toY = gsap.quickTo(btn, "y", { duration: 0.6, ease: "power3" });
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        toX((e.clientX - (r.left + r.width / 2)) * 0.28);
        toY((e.clientY - (r.top + r.height / 2)) * 0.28);
      });
      btn.addEventListener("pointerleave", () => { toX(0); toY(0); });
    });

    $$(".tilt").forEach((card) => {
      const rx = gsap.quickTo(card, "rotationX", { duration: 0.6, ease: "power3" });
      const ry = gsap.quickTo(card, "rotationY", { duration: 0.6, ease: "power3" });
      gsap.set(card, { transformPerspective: 900 });
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        rx(-py * 7); ry(px * 7);
      });
      card.addEventListener("pointerleave", () => { rx(0); ry(0); });
    });
  }

  /* ---------------- hero canvas: records + packets ---------------- */
  function heroCanvas() {
    const c = $("#heroCanvas");
    const ctx = c && c.getContext("2d");
    if (!ctx) return;
    let seed = 7;
    const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let W = 0, H = 0, nodes = [], edges = [], packets = [], last = 0, running = false, raf = 0;

    const ortho = (a, b) => {
      const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2, mx = (ax + bx) / 2;
      return [[ax, ay], [mx, ay], [mx, by], [bx, by]];
    };
    const plen = (p) => { let l = 0; for (let i = 1; i < p.length; i++) l += Math.abs(p[i][0] - p[i - 1][0]) + Math.abs(p[i][1] - p[i - 1][1]); return l; };
    const at = (p, d) => {
      for (let i = 1; i < p.length; i++) {
        const s = Math.abs(p[i][0] - p[i - 1][0]) + Math.abs(p[i][1] - p[i - 1][1]);
        if (d <= s || i === p.length - 1) { const k = s ? Math.min(1, d / s) : 1; return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k]; }
        d -= s;
      }
      return p[p.length - 1];
    };

    const build = () => {
      seed = 7; nodes = []; edges = []; packets = [];
      const cols = Math.max(4, Math.round(W / 220)), rows = Math.max(3, Math.round(H / 150));
      const cw = W / cols, ch = H / rows;
      for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
        const cx = (q + 0.5) * cw, cy = (r + 0.5) * ch;
        const centrality = 1 - Math.min(1, Math.hypot((cx - W / 2) / (W * 0.42), (cy - H / 2) / (H * 0.42)));
        if (rnd() < 0.35 + centrality * 0.5) continue;
        const w = 42 + rnd() * 46, h = 18 + rnd() * 12;
        nodes.push({ x: cx - w / 2 + (rnd() - 0.5) * cw * 0.5, y: cy - h / 2 + (rnd() - 0.5) * ch * 0.5, w, h, heat: 0 });
      }
      nodes.forEach((n, i) => {
        nodes.map((m, j) => ({ j, d: Math.hypot(m.x - n.x, m.y - n.y) }))
          .filter((o) => o.j !== i && o.d < Math.max(cw, ch) * 1.8)
          .sort((a, b) => a.d - b.d).slice(0, rnd() < 0.4 ? 2 : 1)
          .forEach(({ j }) => {
            if (edges.some((e) => (e.a === i && e.b === j) || (e.a === j && e.b === i))) return;
            const pts = ortho(n, nodes[j]);
            edges.push({ a: i, b: j, pts, len: plen(pts) });
          });
      });
    };
    const spawn = () => {
      if (!edges.length || packets.length > 18) return;
      const e = Math.floor(rnd() * edges.length);
      packets.push({ e, s: 0, v: 90 + rnd() * 70, fwd: rnd() < 0.5 });
    };
    const draw = (dt) => {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(230,238,236,0.035)"; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0.5; x < W; x += 48) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = 0.5; y < H; y += 48) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      ctx.strokeStyle = "rgba(230,238,236,0.09)"; ctx.lineWidth = 1.25; ctx.beginPath();
      edges.forEach((e) => { e.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); });
      ctx.stroke();
      nodes.forEach((n) => {
        n.heat = Math.max(0, n.heat - dt * 0.6);
        ctx.fillStyle = "rgba(19,29,32,0.95)";
        ctx.strokeStyle = `rgba(${n.heat > 0 ? "59,191,175" : "230,238,236"},${0.16 + n.heat * 0.7})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(n.x, n.y, n.w, n.h, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = `rgba(230,238,236,${0.18 + n.heat * 0.4})`;
        ctx.fillRect(n.x + 7, n.y + n.h / 2 - 1, n.w * 0.45, 2);
        if (n.heat > 0) { ctx.shadowColor = "rgba(59,191,175,0.9)"; ctx.shadowBlur = 18 * n.heat; ctx.stroke(); ctx.shadowBlur = 0; }
      });
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i], e = edges[p.e];
        p.s += p.v * dt;
        const d = p.fwd ? p.s : e.len - p.s;
        const [x, y] = at(e.pts, Math.max(0, Math.min(e.len, d)));
        ctx.fillStyle = "rgba(59,191,175,0.95)"; ctx.shadowColor = "rgba(59,191,175,0.9)"; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        if (p.s >= e.len) { nodes[p.fwd ? e.b : e.a].heat = 1; packets.splice(i, 1); }
      }
    };
    const loop = (t) => {
      if (!running) return;
      const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
      if (rnd() < dt * 2.2) spawn();
      draw(dt);
      raf = requestAnimationFrame(loop);
    };
    const resize = () => {
      const r = c.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      if (reduce) { for (let i = 0; i < 6; i++) spawn(); draw(0.3); }
    };
    resize();
    window.addEventListener("resize", resize);
    if (reduce) return;
    const io = new IntersectionObserver(([en]) => {
      running = en.isIntersecting && !document.hidden;
      if (running) { last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
    }, { threshold: 0.05 });
    io.observe(c);
    document.addEventListener("visibilitychange", () => { if (document.hidden) running = false; else io.unobserve(c), io.observe(c); });
  }
  heroCanvas();

  /* ---------------- hero copy ---------------- */
  const WORDS = ["drop silently", "route to nobody", "mark as success"];
  function rotator() {
    const box = $("#rotator");
    if (!box) return;
    let i = 0;
    const tick = () => {
      i = (i + 1) % WORDS.length;
      const old = box.querySelector(".rotator__word");
      const nu = document.createElement("span");
      nu.className = "rotator__word"; nu.textContent = WORDS[i];
      box.appendChild(nu);
      gsap.fromTo(nu, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.55 });
      gsap.to(old, { yPercent: -100, opacity: 0, duration: 0.45, onComplete: () => old.remove() });
    };
    setInterval(tick, 2600);
  }
  function heroReveal() {
    if (!hasGsap) return;
    const tl = gsap.timeline();
    tl.fromTo("[data-hero='0']", { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 0)
      .fromTo(".hero__line .w", { yPercent: 110 }, { yPercent: 0, duration: 1.1, stagger: 0.06 }, 0.05)
      .fromTo("#rotator", { yPercent: 110 }, { yPercent: 0, duration: 1.1 }, 0.4)
      .fromTo("[data-hero='3'], [data-hero='4'], [data-hero='5']", { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.1 }, 0.55)
      .add(() => { if (!reduce) rotator(); }, 1.2);
    return tl;
  }
  if (hasGsap) { gsap.set("[data-hero='0'], [data-hero='3'], [data-hero='4'], [data-hero='5']", { autoAlpha: 0 }); gsap.set(".hero__line .w, #rotator", { yPercent: 110 }); }

  /* ---------------- intro ---------------- */
  function intro() {
    const el = $("#intro");
    if (!hasGsap || reduce || !el) { if (el) el.classList.add("is-done"); heroReveal(); return; }
    const tl = gsap.timeline({ onComplete: () => el.classList.add("is-done") });
    tl.set(".intro__logo", { opacity: 1 })
      .from([".intro__bar", ".intro__d", ".intro__bridge", ".intro__dot"], { scale: 0, transformOrigin: "50% 50%", duration: 0.6, stagger: 0.07 }, 0.1)
      .from(".intro__word span", { yPercent: 110, duration: 0.8 }, 0.35)
      .to(".intro__mark", { autoAlpha: 0, y: -16, duration: 0.5 }, 1.25)
      .to(".intro__panel--a", { yPercent: -100, duration: 1.1, ease: "expo.inOut" }, 1.35)
      .to(".intro__panel--b", { yPercent: 100, duration: 1.1, ease: "expo.inOut" }, 1.35)
      .add(() => heroReveal(), 1.55);
  }
  intro();

  /* ---------------- reveals ---------------- */
  if (hasGsap) {
    $$("[data-split] .line").forEach((line) => {
      const inner = document.createElement("span");
      while (line.firstChild) inner.appendChild(line.firstChild);
      line.appendChild(inner);
    });
    $$("[data-split]").forEach((h) => {
      const inners = $$(".line > span", h);
      if (reduce) return;
      gsap.set(inners, { yPercent: 108 });
      ScrollTrigger.create({ trigger: h, start: "top 88%", once: true, onEnter: () => gsap.to(inners, { yPercent: 0, duration: 1.2, stagger: 0.09 }) });
    });
    if (!reduce) {
      $$("[data-reveal]").forEach((el) => {
        gsap.set(el, { autoAlpha: 0, y: 26 });
        ScrollTrigger.create({ trigger: el, start: "top 90%", once: true, onEnter: () => gsap.to(el, { autoAlpha: 1, y: 0, duration: 1.1 }) });
      });
      $$(".icon").forEach((ic) => {
        const parts = $$("path, rect, circle", ic);
        gsap.set(parts, { strokeDashoffset: 80 });
        ScrollTrigger.create({ trigger: ic, start: "top 88%", once: true, onEnter: () => gsap.to(parts, { strokeDashoffset: 0, duration: 1.4, stagger: 0.12, ease: "power2.out" }) });
      });
    }
  }

  /* ---------------- wires (orthogonal connectors in an SVG overlay) ---------------- */
  const NS = "http://www.w3.org/2000/svg";
  function wires(svg, container) {
    const rect = container.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    svg.innerHTML = "";
    const vertical = rect.width < 720;
    const anchor = (el, side) => {
      const r = el.getBoundingClientRect();
      if (vertical) return side === "out" ? [r.left + r.width / 2 - rect.left, r.bottom - rect.top] : [r.left + r.width / 2 - rect.left, r.top - rect.top];
      return side === "out" ? [r.right - rect.left, r.top + r.height / 2 - rect.top] : [r.left - rect.left, r.top + r.height / 2 - rect.top];
    };
    const path = (from, to, cls) => {
      const [x1, y1] = anchor(from, "out"), [x2, y2] = anchor(to, "in");
      const p = document.createElementNS(NS, "path");
      const d = vertical ? `M${x1},${y1} V${(y1 + y2) / 2} H${x2} V${y2}` : `M${x1},${y1} H${(x1 + x2) / 2} V${y2} H${x2}`;
      p.setAttribute("d", d); p.setAttribute("class", cls);
      svg.appendChild(p);
      return p;
    };
    const packet = (cls, r = 4) => {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("r", r); c.setAttribute("class", cls); c.setAttribute("opacity", "0");
      svg.appendChild(c);
      return c;
    };
    const travel = (tl, p, c, dur, pos) => {
      const len = p.getTotalLength();
      const o = { t: 0 };
      tl.set(c, { attr: { opacity: 1 } }, pos)
        .to(o, { t: 1, duration: dur, ease: "power2.inOut", onUpdate: () => { const pt = p.getPointAtLength(o.t * len); c.setAttribute("cx", pt.x); c.setAttribute("cy", pt.y); } }, pos)
        .set(c, { attr: { opacity: 0 } }, pos + dur);
    };
    return { path, packet, travel };
  }
  const debounce = (fn, ms) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };

  /* ---------------- flow (what Dexraflow does) ---------------- */
  function flow() {
    const box = $("#flow"), svg = $("#flowWires");
    if (!hasGsap || !box) return;
    const tools = $$("[data-flow-src]", box), engine = $("[data-flow-engine]", box), dst = $("[data-flow-dst]", box), stages = $$("[data-stage]", box);
    let tl = null;
    const build = () => {
      if (tl) tl.kill();
      [...tools, engine, dst].forEach((e) => e.classList.remove("is-hot"));
      stages.forEach((s) => s.classList.remove("is-on"));
      const w = wires(svg, box);
      const inPaths = tools.map((t) => w.path(t, engine, "flow__path"));
      const outPath = w.path(engine, dst, "flow__path");
      if (reduce) { inPaths[0].classList.add("flow__path--on"); outPath.classList.add("flow__path--on"); tools[0].classList.add("is-hot"); engine.classList.add("is-hot"); dst.classList.add("is-hot"); stages.forEach((s) => s.classList.add("is-on")); return; }
      const pk = w.packet("flow__packet");
      tl = gsap.timeline({ repeat: -1, paused: true });
      tools.forEach((tool, i) => {
        const p = inPaths[i], t0 = i * 5.2;
        tl.add(() => { tool.classList.add("is-hot"); p.classList.add("flow__path--on"); }, t0);
        w.travel(tl, p, pk, 0.9, t0 + 0.15);
        tl.add(() => engine.classList.add("is-hot"), t0 + 1.0);
        stages.forEach((s, k) => tl.add(() => s.classList.add("is-on"), t0 + 1.1 + k * 0.32));
        tl.add(() => outPath.classList.add("flow__path--on"), t0 + 2.8);
        w.travel(tl, outPath, pk, 0.9, t0 + 2.85);
        tl.add(() => dst.classList.add("is-hot"), t0 + 3.7);
        tl.fromTo(dst, { y: 6 }, { y: 0, duration: 0.6 }, t0 + 3.7);
        tl.add(() => { tool.classList.remove("is-hot"); p.classList.remove("flow__path--on"); outPath.classList.remove("flow__path--on"); engine.classList.remove("is-hot"); dst.classList.remove("is-hot"); stages.forEach((s) => s.classList.remove("is-on")); }, t0 + 4.9);
      });
      ScrollTrigger.create({ trigger: box, start: "top 85%", end: "bottom 15%", onToggle: (st) => (st.isActive ? tl.play() : tl.pause()) });
    };
    build();
    window.addEventListener("resize", debounce(build, 200));
  }
  flow();

  /* ---------------- slips scenes ---------------- */
  function scenes() {
    if (!hasGsap || reduce) return;
    const owner = $("[data-scene='owner']");
    if (owner) {
      const clock = $("[data-clock]", owner), o = { h: 0 };
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2, paused: true });
      tl.fromTo(o, { h: 0 }, { h: 42, duration: 5, ease: "power1.inOut", onUpdate: () => { const h = Math.floor(o.h), m = Math.floor((o.h - h) * 60); clock.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; } });
      ScrollTrigger.create({ trigger: owner, start: "top 85%", end: "bottom 15%", onToggle: (st) => (st.isActive ? tl.play() : tl.pause()) });
    }
    const silent = $("[data-scene='silent']");
    if (silent) {
      const lines = $$("[data-t]", silent), rows = $("[data-rows]", silent), o = { n: 14 };
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.6, paused: true });
      tl.set(lines, { autoAlpha: 0, x: -6 }).set(rows, { textContent: "14" }).add(() => rows.classList.remove("is-zero"))
        .to(lines, { autoAlpha: 1, x: 0, duration: 0.5, stagger: 0.55 }, 0.3)
        .fromTo(o, { n: 14 }, { n: 0, duration: 0.9, ease: "power3.in", onUpdate: () => (rows.textContent = String(Math.round(o.n))) }, 1.9)
        .add(() => rows.classList.add("is-zero"), 2.8);
      ScrollTrigger.create({ trigger: silent, start: "top 85%", end: "bottom 15%", onToggle: (st) => (st.isActive ? tl.play() : tl.pause()) });
    }
    const signal = $("[data-scene='signal']");
    if (signal) {
      const days = $$("[data-day]", signal), count = $("[data-days]", signal);
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.4, paused: true });
      tl.add(() => { days.forEach((d) => { d.classList.remove("is-past"); const p = d.querySelector(".ping"); if (p) p.classList.remove("is-on"); }); count.textContent = "0"; });
      days.forEach((d, i) => {
        tl.add(() => { d.classList.add("is-past"); const p = d.querySelector(".ping"); if (p) p.classList.add("is-on"); count.textContent = String(i + 1); }, 0.4 + i * 0.75);
      });
      tl.to({}, { duration: 1 });
      ScrollTrigger.create({ trigger: signal, start: "top 85%", end: "bottom 15%", onToggle: (st) => (st.isActive ? tl.play() : tl.pause()) });
    }
  }
  scenes();

  /* ---------------- cost counters ---------------- */
  function cost() {
    if (!hasGsap) return;
    const stats = $$("[data-stat]");
    if (!stats.length) return;
    if (reduce) { $$("[data-count]").forEach((n) => (n.textContent = n.dataset.count)); stats[0].classList.add("is-on"); return; }
    ScrollTrigger.create({
      trigger: "#stats", start: "top 80%", once: true,
      onEnter: () => $$("[data-count]").forEach((n) => { const o = { v: 0 }; gsap.to(o, { v: +n.dataset.count, duration: 1.8, ease: "power3.out", onUpdate: () => (n.textContent = String(Math.round(o.v))) }); }),
    });
    let i = -1, timer = 0;
    const step = () => { stats.forEach((s) => s.classList.remove("is-on")); i = (i + 1) % stats.length; stats[i].classList.add("is-on"); };
    ScrollTrigger.create({
      trigger: "#stats", start: "top 80%", end: "bottom 10%",
      onToggle: (st) => { clearInterval(timer); if (st.isActive) { step(); timer = setInterval(step, 2400); } },
    });
  }
  cost();

  /* ---------------- steps rail ---------------- */
  function steps() {
    if (!hasGsap) return;
    const box = $("#steps"), fill = $("#stepsFill"), items = $$("[data-step]");
    if (!box) return;
    if (reduce) { items.forEach((s) => s.classList.add("is-on")); return; }
    const vertical = () => window.innerWidth <= 860;
    ScrollTrigger.create({
      trigger: box, start: "top 75%", end: "bottom 60%", scrub: 0.6,
      onUpdate: (st) => {
        const p = st.progress;
        gsap.set(fill, vertical() ? { scaleY: p, scaleX: 1 } : { scaleX: p, scaleY: 1 });
        items.forEach((s, k) => s.classList.toggle("is-on", p >= (k + 0.2) / items.length));
      },
    });
  }
  steps();

  /* ---------------- MCP demo ---------------- */
  function mcp() {
    const demo = $("#mcpDemo"), stage = $("#mcpStage"), svg = $("#mcpWires");
    if (!demo) return;
    const tabs = $$(".mcp__tab", demo), agents = $$("[data-agent]", demo), engine = $("[data-mcp-engine]", demo), contact = $("[data-mcp-contact]", demo);
    const slack = $("[data-mcp-slack]", demo), ok = $("[data-mcp-ok]", demo), errs = $$(".chip", $("[data-mcp-errors]", demo)), rows = $$("[data-row]", demo), title = $("[data-title]", demo);
    let mode = "with", tl = null, timer = 0, active = false;

    const setTab = (m) => {
      tabs.forEach((t) => { const on = t.dataset.mode === m; t.classList.toggle("is-on", on); t.setAttribute("aria-selected", String(on)); const bar = t.querySelector(".mcp__bar"); bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = ""; });
      demo.dataset.mode = m;
      stage.setAttribute("aria-label", m === "without"
        ? "Three AI agents act on the same contact at once, causing duplicate emails and overwritten data."
        : "The same three agents ask Dexraflow first; it holds one, allows one and tells one to wait, so the contact gets a single touch.");
    };
    const build = () => {
      if (tl) tl.kill();
      if (!hasGsap) { setTab(mode); return; }
      setTab(mode);
      gsap.set([rows, slack, ok, errs], { clearProps: "all" });
      const w = wires(svg, stage);
      tl = gsap.timeline({ paused: true });
      if (mode === "without") {
        title.textContent = "VP Sales";
        const paths = agents.map((a) => w.path(a, contact, "mcp__wire"));
        gsap.set(errs, { autoAlpha: 0, x: -8 });
        agents.forEach((a, i) => {
          const pk = w.packet("mcp__packet mcp__packet--bad", 4);
          tl.add(() => paths[i].classList.add("mcp__wire--bad"), 0.2 + i * 0.5);
          w.travel(tl, paths[i], pk, 0.8, 0.2 + i * 0.5);
        });
        tl.to(contact, { x: "+=3", yoyo: true, repeat: 9, duration: 0.05, ease: "none" }, 1.0)
          .add(() => (title.textContent = "Head of Revenue"), 1.6)
          .to(errs, { autoAlpha: 1, x: 0, duration: 0.5, stagger: 0.55 }, 1.0)
          .to({}, { duration: 2.5 });
      } else {
        const paths = agents.map((a) => w.path(a, engine, "mcp__wire"));
        const out = w.path(engine, slack, "mcp__wire");
        gsap.set(rows, { autoAlpha: 0, y: 6 }); gsap.set([slack, ok], { autoAlpha: 0, y: 10 });
        const delays = [0.3, 1.7, 2.9];
        agents.forEach((a, i) => {
          const pk = w.packet("mcp__packet", 4);
          tl.add(() => paths[i].classList.add("mcp__wire--on"), delays[i]);
          w.travel(tl, paths[i], pk, 0.7, delays[i]);
          tl.to(rows[i], { autoAlpha: 1, y: 0, duration: 0.45 }, delays[i] + 0.7);
        });
        const pk2 = w.packet("mcp__packet", 4);
        tl.add(() => out.classList.add("mcp__wire--on"), 1.2);
        w.travel(tl, out, pk2, 0.7, 1.2);
        tl.to(slack, { autoAlpha: 1, y: 0, duration: 0.5 }, 1.9)
          .to(ok, { autoAlpha: 1, y: 0, duration: 0.5 }, 3.9)
          .to({}, { duration: 1.5 });
      }
      if (active && !reduce) tl.play(); else if (reduce) tl.progress(1);
    };
    const schedule = () => {
      clearTimeout(timer);
      if (reduce || !active) return;
      timer = setTimeout(() => { mode = mode === "with" ? "without" : "with"; build(); schedule(); }, 6000);
    };
    tabs.forEach((t) => t.addEventListener("click", () => { mode = t.dataset.mode; build(); schedule(); }));
    build();
    if (hasGsap) {
      ScrollTrigger.create({
        trigger: demo, start: "top 80%", end: "bottom 10%",
        onToggle: (st) => { active = st.isActive; if (active) { build(); schedule(); } else { clearTimeout(timer); if (tl) tl.pause(); } },
      });
    }
    window.addEventListener("resize", debounce(build, 200));
  }
  mcp();

  /* ---------------- agents + code panel ---------------- */
  const SNIPPETS = {
    "claude-code": { lang: "bash", code: `claude mcp add --transport http dexraflow ${MCP_URL} \\\n  --header "Authorization: Bearer $DEXRAFLOW_API_KEY"` },
    "claude-desktop": { lang: "steps", steps: [["Customize → Connectors", "Click + Add, then Add custom connector."], ["Paste the server URL", MCP_URL], ["Add a request header", "Authorization: Bearer <your key>"]] },
    cursor: { lang: "json", code: `{\n  "mcpServers": {\n    "dexraflow": {\n      "url": "${MCP_URL}",\n      "headers": { "Authorization": "Bearer \${env:DEXRAFLOW_API_KEY}" }\n    }\n  }\n}` },
    openai: { lang: "python", code: `from agents import Agent, Runner\nfrom agents.mcp import MCPServerStreamableHttp\n\nasync with MCPServerStreamableHttp(\n    name="Dexraflow",\n    params={\n        "url": "${MCP_URL}",\n        "headers": {"Authorization": f"Bearer {DEXRAFLOW_API_KEY}"},\n    },\n) as dexraflow:\n    sdr = Agent(\n        name="AI SDR",\n        instructions="Before any outreach or CRM write, call check_action and follow the decision.",\n        mcp_servers=[dexraflow],\n    )\n    result = await Runner.run(sdr, "Follow up with jane@acme.com")` },
    langchain: { lang: "python", code: `from langchain_mcp_adapters.client import MultiServerMCPClient\n\nclient = MultiServerMCPClient({\n    "dexraflow": {\n        "transport": "http",\n        "url": "${MCP_URL}",\n        "headers": {"Authorization": f"Bearer {DEXRAFLOW_API_KEY}"},\n    }\n})\ntools = await client.get_tools()` },
    n8n: { lang: "steps", steps: [["Add an MCP Client node", "Tools → MCP Client → Add node."], ["Paste the server URL", MCP_URL], ["Add a request header", "Authorization: Bearer <your key>"]] },
    any: { lang: "steps", steps: [["Remote MCP, Streamable HTTP", MCP_URL], ["Bearer auth", "Authorization: Bearer <your key>"], ["Tools to include", "check_action · explain_decision · log_outcome"]] },
  };
  function code() {
    const panel = $("#codepanel"), block = $("#codeBlock code"), pre = $("#codeBlock"), stepsEl = $("#codeSteps"), lang = $("#codeLang"), copy = $("#copyBtn");
    if (!panel) return;
    const tabs = $$("[role=tab]", panel), cards = $$(".agentcard");
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const hl = (s) => esc(s)
      .replace(/("(?:[^"\\]|\\.)*")/g, '<span class="s">$1</span>')
      .replace(/\b(from|import|async|with|as|await|claude|mcp|add|const)\b/g, '<span class="k">$1</span>');
    let current = "";
    const show = (id) => {
      const snip = SNIPPETS[id] || SNIPPETS.any;
      current = snip.code || snip.steps.map((s) => s[1]).join("\n");
      tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === id)));
      cards.forEach((c) => c.classList.toggle("is-on", c.dataset.tab === id));
      lang.textContent = snip.lang === "steps" ? "steps" : snip.lang;
      if (snip.code) {
        pre.hidden = false; stepsEl.hidden = true;
        block.innerHTML = snip.code.split("\n").map((l) => `<span class="ln">${hl(l) || " "}</span>`).join("");
        if (hasGsap && !reduce) gsap.fromTo($$(".ln", block), { autoAlpha: 0, x: -6 }, { autoAlpha: 1, x: 0, duration: 0.4, stagger: 0.04 });
      } else {
        pre.hidden = true; stepsEl.hidden = false;
        stepsEl.innerHTML = snip.steps.map((s) => `<li><b>${esc(s[0])}</b><span>${esc(s[1])}</span></li>`).join("");
        if (hasGsap && !reduce) gsap.fromTo($$("li", stepsEl), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08 });
      }
    };
    tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.tab)));
    cards.forEach((c) => c.addEventListener("click", () => { show(c.dataset.tab); scrollTo(panel, -110); }));
    copy.addEventListener("click", async () => {
      const done = () => { copy.textContent = "Copied"; copy.classList.add("is-done"); setTimeout(() => { copy.textContent = "Copy"; copy.classList.remove("is-done"); }, 1600); };
      try { await navigator.clipboard.writeText(current); done(); }
      catch { const r = document.createRange(); r.selectNodeContents(pre.hidden ? stepsEl : pre); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
    });
    show("claude-code");
  }
  code();

  /* ---------------- FAQ ---------------- */
  $$(".faq__item").forEach((d) => {
    const sum = $("summary", d), body = $(".faq__a", d);
    if (!hasGsap || reduce) return;
    sum.addEventListener("click", (e) => {
      e.preventDefault();
      if (d.open) {
        gsap.to(body, { height: 0, duration: 0.45, ease: "power3.inOut", onComplete: () => { d.open = false; gsap.set(body, { clearProps: "height" }); } });
      } else {
        $$(".faq__item[open]").forEach((o) => { if (o === d) return; const b = $(".faq__a", o); gsap.to(b, { height: 0, duration: 0.4, ease: "power3.inOut", onComplete: () => { o.open = false; gsap.set(b, { clearProps: "height" }); } }); });
        d.open = true;
        gsap.from(body, { height: 0, duration: 0.55, ease: "power3.out", clearProps: "height" });
        gsap.from($("p", body), { autoAlpha: 0, y: 8, duration: 0.5, delay: 0.1 });
      }
    });
  });

  /* ---------------- modal + form ---------------- */
  const COPY = {
    "early-access": { eyebrow: "Early access", title: "Request early access", desc: "We're working with a small group of revenue teams. Tell us a little about yours.", note: "What are you hoping to solve?", submit: "Request access" },
    "founder-conversation": { eyebrow: "Founder conversation", title: "Talk to the founder", desc: "Share a little context and we'll set up a conversation.", note: "What would you like to talk about?", submit: "Request a conversation" },
  };
  const API = "https://dexraflow-poster-pipeline-e7behqgjfqfresgf.canadacentral-01.azurewebsites.net/demo/request";
  function modal() {
    const m = $("#modal"), panel = $(".modal__panel", m), form = $("#leadForm"), done = $("#formDone"), err = $("#formErr"), submit = $("#formSubmit");
    let intent = "early-access", lastFocus = null;
    const open = (i) => {
      intent = COPY[i] ? i : "early-access";
      const c = COPY[intent];
      $("#modalEyebrow").textContent = c.eyebrow; $("#modalTitle").textContent = c.title; $("#modalDesc").textContent = c.desc;
      $("#modalNoteLabel").innerHTML = `${c.note} <em>optional</em>`; submit.textContent = c.submit;
      form.hidden = false; done.hidden = true; err.hidden = true;
      lastFocus = document.activeElement;
      m.hidden = false; document.body.classList.add("is-locked"); if (lenis) lenis.stop();
      closeSheet();
      if (hasGsap && !reduce) { gsap.fromTo(".modal__backdrop", { opacity: 0 }, { opacity: 1, duration: 0.4 }); gsap.fromTo(panel, { y: 28, opacity: 0, scale: 0.98 }, { y: 0, opacity: 1, scale: 1, duration: 0.7 }); }
      setTimeout(() => $("#f-name").focus(), 60);
    };
    const close = () => {
      const finish = () => { m.hidden = true; document.body.classList.remove("is-locked"); if (lenis) lenis.start(); if (lastFocus) lastFocus.focus(); };
      if (hasGsap && !reduce) gsap.to(panel, { y: 16, opacity: 0, duration: 0.3, onComplete: finish }); else finish();
    };
    $$("[data-open]").forEach((b) => b.addEventListener("click", () => open(b.dataset.open)));
    $$("[data-close]", m).forEach((b) => b.addEventListener("click", close));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !m.hidden) close(); });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.hidden = true;
      const data = Object.fromEntries(new FormData(form).entries());
      const bad = ["name", "email", "company", "role"].filter((k) => !String(data[k] || "").trim());
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email || "")) bad.push("email");
      $$("input", form).forEach((i) => i.classList.toggle("is-bad", bad.includes(i.name)));
      if (bad.length) { err.textContent = "Please fill in your name, a valid work email, company and role."; err.hidden = false; return; }
      submit.disabled = true; submit.textContent = "Sending…";
      try {
        const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, intent }) });
        if (!res.ok) throw new Error("bad");
        form.hidden = true; done.hidden = false;
      } catch {
        err.innerHTML = "Couldn't send right now. Email <b>support@dexraflow.com</b> and we'll pick it up from there.";
        err.hidden = false;
      } finally { submit.disabled = false; submit.textContent = COPY[intent].submit; }
    });
  }
  modal();

  if (hasGsap) { window.addEventListener("load", () => ScrollTrigger.refresh()); }
})();
