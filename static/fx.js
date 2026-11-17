/* AB Media v2: the drawn effects. Flat 2D only (canvas + SVG), no 3D.
   grain   film grain over the whole page
   beam    a projector beam with dust over the hero; the pointer is a hand-held lamp
   word    the wordmark is a window onto the film; zooming through the "I" opens the film to full screen
   river   the customer journey as one ribbon of people that narrows at every stage */
(() => {
"use strict";
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const dprOf = () => Math.min(window.devicePixelRatio || 1, 2);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const FX = window.ABM_FX = {};

/* ---------- grain: six pre-rendered noise tiles, swapped at 12 fps ---------- */
FX.grain = function(cv){
  if (reduce) { cv.remove(); return; }
  const g = cv.getContext("2d"), tiles = [];
  for (let k = 0; k < 6; k++) {
    const t = document.createElement("canvas"); t.width = t.height = 160;
    const x = t.getContext("2d"), im = x.createImageData(160, 160);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255 | 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    x.putImageData(im, 0, 0); tiles.push(t);
  }
  let k = 0, last = 0;
  const size = () => { cv.width = Math.ceil(innerWidth / 2); cv.height = Math.ceil(innerHeight / 2); };
  size(); addEventListener("resize", size);
  (function loop(now){
    if (now - last > 83 && !document.hidden) {
      last = now; k = (k + 1) % tiles.length;
      const p = g.createPattern(tiles[k], "repeat"); g.fillStyle = p;
      g.setTransform(1, 0, 0, 1, (Math.random() * 160) | 0, (Math.random() * 160) | 0);
      g.fillRect(-160, -160, cv.width + 320, cv.height + 320);
    }
    requestAnimationFrame(loop);
  })(0);
};

/* ---------- the wordmark window and the zoom through the "I" ---------- */
FX.word = function(svgEl){
  const t = svgEl.querySelector("#wm-t"), g = svgEl.querySelector("#wm-g");
  const bg = svgEl.querySelector("#wm-bg"), cover = svgEl.querySelector("#wm-cover");
  const st = { W: 0, H: 0, ox: 0, oy: 0, smax: 60, z: 0 };
  function layout(){
    const W = svgEl.clientWidth, H = svgEl.clientHeight; st.W = W; st.H = H;
    svgEl.setAttribute("viewBox", "0 0 " + W + " " + H);
    [bg, cover].forEach(r => { r.setAttribute("x", -W); r.setAttribute("y", -H); r.setAttribute("width", W * 3); r.setAttribute("height", H * 3); });
    t.setAttribute("font-size", 100); t.setAttribute("x", W / 2); t.setAttribute("y", H * .46);
    const len = t.getComputedTextLength() || 600;
    const fs = Math.min(W * (W < 700 ? .9 : .84) / len * 100, H * .34);
    t.setAttribute("font-size", fs.toFixed(1));
    /* the centre of the "I" (index 6 of "AB MEDIA"): the film is reached through it */
    let ext = null; try { ext = t.getExtentOfChar(6); } catch (e) {}
    if (ext && ext.width) { st.ox = ext.x + ext.width / 2; st.oy = ext.y + ext.height * .52; st.smax = Math.max(W, H) * 1.6 / (ext.width * .42); }
    else { st.ox = W * .7; st.oy = H * .46; st.smax = 80; }
    set(st.z);
  }
  function set(z){
    st.z = z;
    const e = z < 1 ? 1 - Math.pow(1 - z, 2.2) : 1;
    const s = Math.exp(Math.log(st.smax) * e);
    const tr = "translate(" + st.ox.toFixed(2) + " " + st.oy.toFixed(2) + ") scale(" + s.toFixed(4) + ") translate(" + (-st.ox).toFixed(2) + " " + (-st.oy).toFixed(2) + ")";
    g.setAttribute("transform", tr);
    cover.style.opacity = z > .985 ? "0" : "1";
  }
  FX.word.layout = layout; FX.word.set = set;
  const go = () => layout();
  if (document.fonts && document.fonts.load) document.fonts.load('700 100px "Unbounded"').then(go, go); else go();
  addEventListener("resize", layout);
  return { layout, set, st };
};

/* ---------- projector beam with dust ---------- */
FX.beam = function(cv, host){
  const g = cv.getContext("2d");
  let W = 0, H = 0, cone = null, dust = [], raf = 0, on = true, last = 0, t = 0;
  const mouse = { x: -999, y: -999, a: 0, tx: -999, ty: -999 };
  const st = { k: 1 };
  function layout(){
    const d = dprOf(); W = host.clientWidth; H = host.clientHeight;
    cv.width = W * d; cv.height = H * d; g.setTransform(d, 0, 0, d, 0, 0);
    /* the cone is painted once, blurred, then reused */
    cone = document.createElement("canvas"); cone.width = W; cone.height = H;
    const c = cone.getContext("2d"), sx = W * .5, sy = -H * .18;
    c.filter = "blur(" + Math.round(Math.min(W, H) * .04) + "px)";
    const gr = c.createLinearGradient(0, sy, 0, H);
    gr.addColorStop(0, "rgba(255,214,150,.42)"); gr.addColorStop(.45, "rgba(244,166,42,.12)"); gr.addColorStop(1, "rgba(244,166,42,0)");
    c.fillStyle = gr; c.beginPath(); c.moveTo(sx - 8, sy); c.lineTo(sx + 8, sy); c.lineTo(W * .98, H * 1.05); c.lineTo(W * .02, H * 1.05); c.closePath(); c.fill();
    const n = W < 700 ? 140 : 300;
    dust = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, r: .4 + Math.random() * 1.6, vx: (Math.random() - .5) * 6, vy: -2 - Math.random() * 6, ph: Math.random() * 6.28 }));
  }
  const inCone = (x, y) => { const sy = -H * .18, k = (y - sy) / (H * 1.05 - sy); const half = 8 + k * (W * .48); return Math.abs(x - W * .5) < half ? 1 - Math.abs(x - W * .5) / half : 0; };
  function frame(now){
    raf = 0; const dt = Math.min(.05, (now - last) / 1000 || 0); last = now; t += dt;
    g.clearRect(0, 0, W, H);
    const k = st.k;
    if (k > .01) {
      /* projector flicker: a few percent, irregular */
      const fl = .92 + Math.sin(t * 47) * .03 + Math.sin(t * 13.3) * .03 + (Math.random() - .5) * .04;
      g.globalAlpha = k * fl; g.drawImage(cone, 0, 0); g.globalAlpha = 1;
      mouse.x += (mouse.tx - mouse.x) * .16; mouse.y += (mouse.ty - mouse.y) * .16;
      mouse.a += ((mouse.tx > -900 ? 1 : 0) - mouse.a) * .08;
      if (mouse.a > .01) {
        const r = Math.min(W, H) * .32, gr = g.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, r);
        gr.addColorStop(0, "rgba(255,214,150," + (.16 * mouse.a * k).toFixed(3) + ")"); gr.addColorStop(1, "rgba(244,166,42,0)");
        g.fillStyle = gr; g.fillRect(mouse.x - r, mouse.y - r, r * 2, r * 2);
      }
      g.globalCompositeOperation = "lighter";
      for (const p of dust) {
        p.x += (p.vx + Math.sin(t * .6 + p.ph) * 4) * dt; p.y += p.vy * dt;
        const dx = p.x - mouse.x, dy = p.y - mouse.y, dd = dx * dx + dy * dy;
        if (dd < 22000) { const f = (1 - dd / 22000) * 40 * dt; p.x += dx * f * .02; p.y += dy * f * .02; }
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
        const lit = Math.max(inCone(p.x, p.y), dd < 30000 ? (1 - dd / 30000) * mouse.a : 0);
        if (lit < .03) continue;
        const a = lit * (.35 + .65 * (.5 + .5 * Math.sin(t * 2 + p.ph))) * k;
        g.fillStyle = "rgba(255,226,180," + a.toFixed(3) + ")"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill();
      }
      g.globalCompositeOperation = "source-over";
    }
    if (on && !reduce) raf = requestAnimationFrame(frame);
  }
  const start = () => { if (!raf && on) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  host.addEventListener("pointermove", e => { const b = host.getBoundingClientRect(); mouse.tx = e.clientX - b.left; mouse.ty = e.clientY - b.top; if (mouse.x < -900) { mouse.x = mouse.tx; mouse.y = mouse.ty; } }, { passive: true });
  host.addEventListener("pointerleave", () => { mouse.tx = -999; mouse.ty = -999; });
  new IntersectionObserver(es => { on = es[0].isIntersecting; start(); }).observe(host);
  addEventListener("resize", layout);
  layout(); if (reduce) frame(performance.now()); else start();
  return st;
};

/* ---------- the customer river ---------- */
FX.river = function(cv, box, gatesEl){
  const g = cv.getContext("2d");
  const XS = [.03, .36, .66, .97];
  const st = { step: 0, film: 0, filmT: 0, vals: [1, 1, 1, 1], target: [1, 1, 1, 1], rev: 0, revT: 0 };
  let W = 0, H = 0, y0 = 0, TMAX = 0, raf = 0, on = false, last = 0, t = 0;
  const ps = [];
  function layout(){
    const d = dprOf(); W = box.clientWidth; H = box.clientHeight;
    cv.width = W * d; cv.height = H * d; g.setTransform(d, 0, 0, d, 0, 0);
    y0 = H * .2; TMAX = H * .42;
    Array.from(gatesEl.children).forEach((n, i) => { n.style.insetInlineStart = (XS[i] * 100).toFixed(2) + "%"; });
  }
  const gx = i => XS[i] * W;
  /* thickness of the main ribbon at x: smooth steps between the gates */
  function thick(x){
    const v = st.vals;
    if (x <= gx(0)) return TMAX * v[0];
    for (let i = 0; i < 3; i++) { const a = gx(i), b = gx(i + 1); if (x <= b) { const k = ss(a + (b - a) * .55, b, x); return TMAX * (v[i] + (v[i + 1] - v[i]) * k); } }
    return TMAX * v[3];
  }
  function spawn(p, x){ p.x = x; p.u = Math.random(); p.s = 0; p.vy = 0; p.y = 0; p.a = 0; p.sp = 70 + Math.random() * 50; p.r = .9 + Math.random() * 1.3; }
  for (let i = 0; i < 260; i++) { const p = {}; spawn(p, Math.random() * 900 - 900); ps.push(p); }
  const mix = (a, b, k) => Math.round(a + (b - a) * k);
  function frame(now){
    raf = 0; const dt = Math.min(.05, (now - last) / 1000 || 0); last = now; t += dt;
    for (let i = 0; i < 4; i++) st.vals[i] += (st.target[i] - st.vals[i]) * Math.min(1, dt * 5);
    st.rev += (st.revT - st.rev) * Math.min(1, dt * 3.2);
    st.film += (st.filmT - st.film) * Math.min(1, dt * 3);
    g.clearRect(0, 0, W, H);
    const rx = st.rev * W, f = st.film;
    const cr = mix(237, 244, f), cg = mix(241, 166, f), cb = mix(241, 42, f);
    g.save(); g.beginPath(); g.rect(0, 0, rx, H); g.clip();
    /* lost streams: the part of the ribbon that does not reach the next gate peels away and sinks */
    for (let i = 0; i < 3; i++) {
      const a = gx(i), b = gx(i + 1), tA = TMAX * st.vals[i], tB = TMAX * st.vals[i + 1];
      if (tA - tB < .5) continue;
      const m = a + (b - a) * .55;
      const gr = g.createLinearGradient(0, y0 + tB, 0, H);
      gr.addColorStop(0, "rgba(229,72,60," + (.22 - f * .08).toFixed(3) + ")"); gr.addColorStop(.7, "rgba(229,72,60,0)");
      g.fillStyle = gr; g.beginPath();
      g.moveTo(m, y0 + tB); g.bezierCurveTo(m + (b - m) * .5, y0 + tB, b, y0 + tB + (H - y0 - tB) * .3, b + (b - a) * .1, H);
      g.lineTo(b + (b - a) * .1 - (tA - tB), H);
      g.bezierCurveTo(b - (tA - tB), y0 + tA + (H - y0 - tA) * .25, m + (b - m) * .3, y0 + tA, m - 2, y0 + tA);
      g.closePath(); g.fill();
    }
    /* main ribbon */
    const top = y0;
    const grd = g.createLinearGradient(0, 0, W, 0);
    grd.addColorStop(0, "rgba(" + cr + "," + cg + "," + cb + ",.22)"); grd.addColorStop(1, "rgba(" + cr + "," + cg + "," + cb + "," + (.16 + f * .2).toFixed(3) + ")");
    g.fillStyle = grd; g.beginPath(); g.moveTo(0, top);
    for (let x = 0; x <= W; x += 6) g.lineTo(x, top);
    for (let x = W; x >= 0; x -= 6) g.lineTo(x, top + thick(x));
    g.closePath(); g.fill();
    g.strokeStyle = "rgba(" + cr + "," + cg + "," + cb + ",.75)"; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, top); g.lineTo(W, top); g.stroke();
    g.beginPath(); for (let x = 0; x <= W; x += 6) { const y = top + thick(x); if (!x) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
    /* people */
    g.globalCompositeOperation = "lighter";
    for (const p of ps) {
      if (p.s === 0) {
        p.x += p.sp * dt;
        /* each person keeps a lane; when the ribbon narrows below that lane, the person drops out */
        const off = p.u * TMAX * st.vals[0] * .98;
        p.y = top + 1 + off + Math.sin(t * 2 + p.u * 40) * .8;
        if (p.x > gx(0) && off > thick(p.x)) { p.s = 1; p.vy = 8; }
        p.a = Math.min(1, p.a + dt * 2);
        if (p.x > rx + 30 || p.x > W + 10) spawn(p, -10 - Math.random() * 200);
        if (p.x > 0 && p.s === 0) { g.fillStyle = "rgba(" + mix(255, 255, f) + "," + mix(240, 205, f) + "," + mix(220, 120, f) + "," + (.85 * p.a).toFixed(3) + ")"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill(); }
      } else {
        p.vy += 160 * dt; p.y += p.vy * dt; p.x += p.sp * .35 * dt; p.a -= dt * .7;
        if (p.a <= 0 || p.y > H) { spawn(p, -10 - Math.random() * 200); continue; }
        g.fillStyle = "rgba(229,110,96," + (.6 * p.a).toFixed(3) + ")"; g.beginPath(); g.arc(p.x, p.y, p.r * .9, 0, 6.283); g.fill();
      }
    }
    g.globalCompositeOperation = "source-over";
    g.restore();
    /* the reveal edge: a thin light line */
    if (st.rev < .995) { g.fillStyle = "rgba(244,166,42,.5)"; g.fillRect(rx - 1, 0, 1, H); }
    if (on) raf = requestAnimationFrame(frame);
  }
  const start = () => { if (!raf && on) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  new IntersectionObserver(es => { on = es[0].isIntersecting; if (reduce) { on = false; frame(performance.now()); } start(); }).observe(box);
  new ResizeObserver(() => { layout(); if (!on) frame(performance.now()); }).observe(box);
  layout();
  /* step 0..3: how far the ribbon is revealed; vals are the stage shares (0..1, already scaled for display) */
  function set(step, vals, film){
    st.step = step; st.target = vals.slice(); st.filmT = film ? 1 : 0;
    st.revT = step >= 3 ? 1 : Math.min(1, XS[step] + .1 + (step ? .02 : .05));
    if (reduce) { st.vals = vals.slice(); st.rev = st.revT; st.film = st.filmT; frame(performance.now()); }
  }
  return { set, layout };
};
})();
