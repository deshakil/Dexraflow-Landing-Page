/* Dexraflow — hero 3D scene
   A stack of translucent GTM-tool layers with gaps. Leads roll across the top
   layer, slip through the gaps, and the Dexraflow net at the bottom catches
   them and routes them to Slack. Falls back to a static isometric drawing when
   WebGL, Three.js or motion are unavailable. */
(() => {
  "use strict";
  const host = document.getElementById("heroVisual");
  const fallback = document.getElementById("heroFallback");
  if (!host || !fallback) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const LAYERS = [
    { name: "HubSpot", gx: -1.3, gw: 0.95 },
    { name: "Clay", gx: 1.25, gw: 0.9 },
    { name: "Apollo", gx: -0.2, gw: 0.85 },
    { name: "Outreach", gx: 1.7, gw: 0.95 },
    { name: "Gong", gx: -1.6, gw: 0.9 },
  ];
  const W = 6.2, D = 3.4, T = 0.14, STEP = 1.0, TOP = 2.0;
  const yOf = (i) => TOP - i * STEP;
  const NETY = TOP - LAYERS.length * STEP - 0.15;
  const EXIT = { x: W / 2 + 1.3, y: NETY + 0.4, z: 0 };
  const C = { slab: "#131d20", edge: "#34454c", teal: "#3bbfaf", amber: "#e8962e", ink: "#95a7a3", night: "#0c1315" };

  /* ---------- static isometric fallback (2D canvas) ---------- */
  function drawStatic() {
    const ctx = fallback.getContext("2d");
    if (!ctx) return;
    const r = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    fallback.width = Math.round(r.width * dpr); fallback.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = r.width, h = r.height, s = Math.min(w, h) / 10.5, cx = w * 0.5, cy = h * 0.44;
    const P = (x, y, z) => [cx + (x - z) * Math.cos(Math.PI / 6) * s, cy + (x + z) * Math.sin(Math.PI / 6) * s - y * s];
    const poly = (pts, fill, stroke) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); } };
    ctx.clearRect(0, 0, w, h);
    ctx.font = `500 ${Math.max(9, s * 0.42)}px "JetBrains Mono", monospace`;
    // net
    ctx.strokeStyle = "rgba(59,191,175,0.45)"; ctx.lineWidth = 1;
    for (let i = 0; i <= 12; i++) { const x = -W / 2 - 0.4 + (i / 12) * (W + 0.8); const a = P(x, NETY, -D / 2 - 0.4), b = P(x, NETY, D / 2 + 0.4); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    for (let i = 0; i <= 7; i++) { const z = -D / 2 - 0.4 + (i / 7) * (D + 0.8); const a = P(-W / 2 - 0.4, NETY, z), b = P(W / 2 + 0.4, NETY, z); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    ctx.fillStyle = C.teal; const nl = P(-W / 2 - 0.3, NETY, D / 2 + 0.9); ctx.fillText("DEXRAFLOW", nl[0], nl[1]);
    // exit node
    const e = EXIT; poly([P(e.x - 0.25, e.y + 0.25, -0.25), P(e.x + 0.25, e.y + 0.25, -0.25), P(e.x + 0.25, e.y + 0.25, 0.25), P(e.x - 0.25, e.y + 0.25, 0.25)], "rgba(59,191,175,.9)");
    poly([P(e.x - 0.25, e.y + 0.25, 0.25), P(e.x + 0.25, e.y + 0.25, 0.25), P(e.x + 0.25, e.y - 0.25, 0.25), P(e.x - 0.25, e.y - 0.25, 0.25)], "rgba(37,140,128,.9)");
    ctx.fillStyle = C.ink; const el = P(e.x - 0.2, e.y - 0.5, 0.6); ctx.fillText("SLACK", el[0], el[1]);
    // layers, bottom first
    for (let i = LAYERS.length - 1; i >= 0; i--) {
      const L = LAYERS[i], y = yOf(i);
      [[-W / 2, L.gx - L.gw / 2], [L.gx + L.gw / 2, W / 2]].forEach(([x0, x1]) => {
        poly([P(x0, y, D / 2), P(x1, y, D / 2), P(x1, y - T, D / 2), P(x0, y - T, D / 2)], "#0f171a", C.edge);
        poly([P(x1, y, -D / 2), P(x1, y, D / 2), P(x1, y - T, D / 2), P(x1, y - T, -D / 2)], "#101a1d", C.edge);
        poly([P(x0, y, -D / 2), P(x1, y, -D / 2), P(x1, y, D / 2), P(x0, y, D / 2)], C.slab, C.edge);
      });
      ctx.strokeStyle = C.amber; ctx.lineWidth = 1.25;
      [L.gx - L.gw / 2, L.gx + L.gw / 2].forEach((x) => { const a = P(x, y, -D / 2), b = P(x, y, D / 2); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
    }
    // labels on top, at the visible front-right edge of each layer
    ctx.textAlign = "right"; ctx.fillStyle = "#aebbb8";
    LAYERS.forEach((L, i) => { const lp = P(W / 2 - 0.15, yOf(i) + 0.05, D / 2 - 0.3); ctx.fillText(L.name.toUpperCase(), lp[0], lp[1] - 3); });
    ctx.textAlign = "left";
    // a few leads
    const leads = [[-2.2, yOf(0) + 0.12, -0.6], [0.4, yOf(0) + 0.12, 0.7], [1.25, yOf(1) - 0.3, 0.2], [-0.2, yOf(3) - 0.4, -0.3], [-1.6, NETY + 0.12, 0.4]];
    leads.forEach(([x, y, z]) => { const p = P(x, y, z); ctx.fillStyle = C.teal; ctx.shadowColor = C.teal; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; });
  }

  const webglOK = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } })();
  if (!window.THREE || !webglOK || reduce) { drawStatic(); window.addEventListener("resize", drawStatic); return; }

  /* ---------- three.js scene ---------- */
  const THREE = window.THREE;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" }); }
  catch { drawStatic(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.domElement.className = "hero__gl";
  host.appendChild(renderer.domElement);
  fallback.remove();

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0c1315, 19, 32);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(8.9, 6.8, 10.6);
  camera.lookAt(0.6, -0.9, 0);
  const rig = new THREE.Group();
  scene.add(rig);

  scene.add(new THREE.AmbientLight(0xe6eeec, 0.32));
  const key = new THREE.DirectionalLight(0xdfe9e6, 0.42); key.position.set(4, 9, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x3bbfaf, 0.22); rim.position.set(-6, 2, -4); scene.add(rim);
  const netLight = new THREE.PointLight(0x3bbfaf, 1.5, 9, 2); netLight.position.set(0, NETY + 0.6, 0); rig.add(netLight);

  const label = (text, color, w = 2.2, align = "left") => {
    const c = document.createElement("canvas"); c.width = 512; c.height = 96;
    const x = c.getContext("2d");
    x.font = '500 44px "JetBrains Mono", ui-monospace, monospace'; x.fillStyle = color; x.textBaseline = "middle"; x.textAlign = align;
    x.fillText(text.toUpperCase(), align === "right" ? 500 : 12, 50);
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4; tex.encoding = THREE.sRGBEncoding;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, opacity: 0.95 }));
    sp.scale.set(w, w * 96 / 512, 1); sp.center.set(align === "right" ? 1 : 0, 0.5); sp.renderOrder = 10;
    return sp;
  };

  const slabMat = new THREE.MeshStandardMaterial({ color: 0x0f191c, roughness: 0.92, metalness: 0.05, transparent: true, opacity: 0.96 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x46595f, transparent: true, opacity: 0.95 });
  const gapMat = new THREE.LineBasicMaterial({ color: 0xe8962e, transparent: true, opacity: 0.85 });
  LAYERS.forEach((L, i) => {
    const y = yOf(i);
    [[-W / 2, L.gx - L.gw / 2], [L.gx + L.gw / 2, W / 2]].forEach(([x0, x1]) => {
      const g = new THREE.BoxGeometry(x1 - x0, T, D);
      const m = new THREE.Mesh(g, slabMat); m.position.set((x0 + x1) / 2, y - T / 2, 0); rig.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat); e.position.copy(m.position); rig.add(e);
    });
    const gp = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(L.gx - L.gw / 2, y + 0.005, -D / 2), new THREE.Vector3(L.gx - L.gw / 2, y + 0.005, D / 2),
      new THREE.Vector3(L.gx + L.gw / 2, y + 0.005, -D / 2), new THREE.Vector3(L.gx + L.gw / 2, y + 0.005, D / 2),
    ]);
    rig.add(new THREE.LineSegments(gp, gapMat));
    const lb = label(L.name, "#b9c6c3", 2.4, "right"); lb.position.set(W / 2 - 0.12, y + 0.1, D / 2 - 0.3); rig.add(lb);
  });

  // net
  const netGeo = new THREE.PlaneGeometry(W + 0.8, D + 0.8, 14, 8);
  const net = new THREE.Mesh(netGeo, new THREE.MeshBasicMaterial({ color: 0x3bbfaf, wireframe: true, transparent: true, opacity: 0.38 }));
  net.rotation.x = -Math.PI / 2; net.position.y = NETY; rig.add(net);
  const netFill = new THREE.Mesh(netGeo, new THREE.MeshBasicMaterial({ color: 0x3bbfaf, transparent: true, opacity: 0.07, side: THREE.DoubleSide }));
  netFill.rotation.x = -Math.PI / 2; netFill.position.y = NETY - 0.01; rig.add(netFill);
  const netLabel = label("Dexraflow", "#3bbfaf", 3.1); netLabel.position.set(-W / 2 + 0.1, NETY + 0.14, D / 2 + 0.55); rig.add(netLabel);

  // exit node (Slack)
  const exitMat = new THREE.MeshStandardMaterial({ color: 0x3bbfaf, emissive: 0x3bbfaf, emissiveIntensity: 0.45, roughness: 0.4 });
  const exitNode = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), exitMat); exitNode.position.set(EXIT.x, EXIT.y, EXIT.z); rig.add(exitNode);
  const exitLabel = label("Slack", "#e6eeec", 2.0); exitLabel.position.set(EXIT.x - 0.2, EXIT.y - 0.55, EXIT.z + 0.4); rig.add(exitLabel);
  const chute = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(W / 2 + 0.4, NETY, 0), new THREE.Vector3(EXIT.x, NETY, 0), new THREE.Vector3(EXIT.x, EXIT.y - 0.25, 0)]), new THREE.LineBasicMaterial({ color: 0x3bbfaf, transparent: true, opacity: 0.6 }));
  rig.add(chute);

  // leads
  const orbGeo = new THREE.SphereGeometry(0.11, 18, 18);
  const orbMat = new THREE.MeshStandardMaterial({ color: 0x2aa596, emissive: 0x3bbfaf, emissiveIntensity: 0.85, roughness: 0.4 });
  const haloGeo = new THREE.SphereGeometry(0.2, 12, 12);
  const haloMat = new THREE.MeshBasicMaterial({ color: 0x3bbfaf, transparent: true, opacity: 0.12, depthWrite: false });
  const ripples = [];
  const rippleGeo = new THREE.RingGeometry(0.1, 0.14, 32);
  const orbs = Array.from({ length: 9 }, (_, k) => {
    const mesh = new THREE.Mesh(orbGeo, orbMat); const halo = new THREE.Mesh(haloGeo, haloMat); mesh.add(halo); rig.add(mesh);
    const o = { mesh, layer: 0, x: 0, y: 0, z: 0, vx: 1, vy: 0, state: "roll", t: 0, delay: k * 0.7 };
    spawn(o, true); return o;
  });
  function spawn(o, first) {
    o.layer = Math.random() < 0.65 ? 0 : Math.floor(Math.random() * 3);
    o.x = first ? -W / 2 + 0.3 + Math.random() * (W - 1.2) : -W / 2 + 0.3;
    o.z = (Math.random() - 0.5) * (D - 1.1);
    o.vx = 0.75 + Math.random() * 0.7; o.vy = 0; o.state = "roll"; o.t = 0;
    o.y = yOf(o.layer) + 0.11;
    const L = LAYERS[o.layer]; if (Math.abs(o.x - L.gx) < L.gw / 2 + 0.2) o.x = L.gx + L.gw / 2 + 0.3;
    o.mesh.scale.setScalar(1); o.mesh.visible = true;
  }
  function ripple(x, z) {
    const m = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color: 0x3bbfaf, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, NETY + 0.02, z); rig.add(m); ripples.push({ m, t: 0 });
  }
  function step(o, dt) {
    if (o.delay > 0) { o.delay -= dt; o.mesh.visible = false; return; }
    o.mesh.visible = true;
    if (o.state === "roll") {
      o.x += o.vx * dt;
      const L = LAYERS[o.layer];
      if (Math.abs(o.x - L.gx) < L.gw / 2 - 0.09) { o.state = "fall"; o.vy = 0; }
      else if (o.x > W / 2 - 0.25) { o.state = "fade"; o.t = 0; }
    } else if (o.state === "fall") {
      o.vy -= 7.5 * dt; o.y += o.vy * dt;
      const next = o.layer + 1;
      if (next < LAYERS.length) {
        const top = yOf(next) + 0.11;
        if (o.y <= top) {
          const Ln = LAYERS[next];
          if (Math.abs(o.x - Ln.gx) < Ln.gw / 2 - 0.09) { o.layer = next; }
          else { o.y = top; o.layer = next; o.vy = 0; o.state = "roll"; o.vx *= 0.92; }
        }
      } else if (o.y <= NETY + 0.11) { o.y = NETY + 0.11; o.state = "caught"; o.t = 0; ripple(o.x, o.z); }
    } else if (o.state === "caught") {
      o.t += dt; const k = Math.min(1, o.t / 0.45);
      o.mesh.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.9);
      if (o.t > 0.5) { o.state = "route"; o.t = 0; }
    } else if (o.state === "route") {
      o.t += dt;
      const ease = Math.min(1, dt * 2.6);
      o.x += (EXIT.x - o.x) * ease; o.z += (EXIT.z - o.z) * ease;
      if (Math.abs(o.x - (W / 2 + 0.4)) < 0.15 || o.x > W / 2 + 0.4) o.y += (EXIT.y - o.y) * ease;
      if (Math.hypot(EXIT.x - o.x, EXIT.y - o.y, EXIT.z - o.z) < 0.18 || o.t > 3) { exitPulse = 1; spawn(o); }
    } else if (o.state === "fade") {
      o.t += dt; o.mesh.scale.setScalar(Math.max(0.001, 1 - o.t / 0.5));
      if (o.t > 0.5) spawn(o);
    }
    o.mesh.position.set(o.x, o.y, o.z);
  }
  let exitPulse = 0;

  // pointer parallax + scroll
  let px = 0, py = 0, tx = 0, ty = 0, scrollK = 0;
  if (window.matchMedia("(hover: hover)").matches) {
    window.addEventListener("pointermove", (e) => { tx = (e.clientX / window.innerWidth - 0.5) * 2; ty = (e.clientY / window.innerHeight - 0.5) * 2; });
  }
  if (window.gsap && window.ScrollTrigger) {
    ScrollTrigger.create({ trigger: ".hero", start: "top top", end: "bottom top", scrub: true, onUpdate: (st) => (scrollK = st.progress) });
  }

  const resize = () => {
    const r = host.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const fit = Math.max(1, 1.08 / camera.aspect);
    camera.position.set(8.9 * fit, 6.8 * fit, 10.6 * fit); camera.lookAt(0.6, -0.9, 0);
  };
  resize(); window.addEventListener("resize", resize);

  let running = false, raf = 0, last = 0, clock = 0;
  const loop = (t) => {
    if (!running) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t; clock += dt;
    px += (tx - px) * 0.05; py += (ty - py) * 0.05;
    rig.rotation.y = -0.25 + px * 0.16 + scrollK * 0.35 + Math.sin(clock * 0.25) * 0.03;
    rig.rotation.x = py * 0.06 + scrollK * 0.08;
    rig.position.y = -0.1 + scrollK * 1.4;
    orbs.forEach((o) => step(o, dt));
    for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.t += dt; const k = r.t / 0.8; r.m.scale.setScalar(1 + k * 7); r.m.material.opacity = Math.max(0, 0.9 * (1 - k)); if (k >= 1) { rig.remove(r.m); r.m.material.dispose(); ripples.splice(i, 1); } }
    if (exitPulse > 0) { exitPulse = Math.max(0, exitPulse - dt * 2); exitNode.scale.setScalar(1 + exitPulse * 0.35); exitMat.emissiveIntensity = 0.45 + exitPulse * 1.2; }
    netLight.intensity = 1.4 + Math.sin(clock * 1.7) * 0.25;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  const io = new IntersectionObserver(([en]) => {
    running = en.isIntersecting && !document.hidden;
    if (running) { last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
  }, { threshold: 0.05 });
  io.observe(host);
  document.addEventListener("visibilitychange", () => { if (document.hidden) running = false; else { io.unobserve(host); io.observe(host); } });
  renderer.render(scene, camera);
})();
