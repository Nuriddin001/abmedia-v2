/* AB Media v2: scroll choreography (GSAP + ScrollTrigger + Lenis).
   Pinned scenes move one step per wheel notch, slow or fast: hero (wordmark, film, line), manifesto (two sentences),
   journey (four beats), ads vs story (one sweep). Everything else plays as it scrolls past, each section its own way. */
(() => {
"use strict";
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const ABM = window.ABM_MOTION = { ready: false, init, refresh, scrollTo, pause, settle: () => built && settle() };
let api = null, lenis = null, built = false, heroST = null, mfST = null, storyST = null, duelST = null;

function init(a){
  api = a;
  if (!window.gsap || !window.ScrollTrigger) return false;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  ABM.ready = true;
  if (a.reduce) { document.documentElement.classList.add("no-motion"); leaderOff(); chrome(); a.finalStates(); return true; }
  if (window.Lenis) {
    lenis = new Lenis({ lerp: .1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.documentElement.classList.add("lenis");
  }
  anchors(); stepper(); chrome();
  hero(); manifest(); ticker(); story(); duel(); marquee(); develop(); slats(); process(); frames();
  ScrollTrigger.addEventListener("refresh", () => api.layout());
  built = true;
  settle();
  leader();
  return true;
}

/* ---------- utilities ---------- */
function scrollTo(t){
  if (lenis) lenis.scrollTo(t === "#top" ? 0 : t, { offset: t === "#top" ? 0 : -70, duration: 1.4, easing: x => 1 - Math.pow(1 - x, 4) });
  else (typeof t === "string" ? $(t) : t).scrollIntoView({ behavior: "smooth" });
}
function pause(on){ if (lenis) on ? lenis.stop() : lenis.start(); }
function refresh(){ if (built) settle(); }
function settle(){ if (ScrollTrigger.sort) ScrollTrigger.sort(); ScrollTrigger.refresh(); }
function anchors(){
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const id = a.getAttribute("href"); if (id.length < 2) return;
    const t = id === "#top" ? "#top" : $(id); if (!t) return;
    e.preventDefault(); scrollTo(t);
  });
}

/* ---------- film leader: 3, 2, 1, the letterbox opens (once per visit) ---------- */
function leaderOff(){ const l = $("#leader"); if (l) l.classList.add("done"); }
function leader(){
  const box = $("#leader");
  if (!box || api.introSeen) { leaderOff(); heroIn(.1); return; }
  if (lenis) lenis.stop();
  const n = $("#ld-n"), sw = $("#ld-sweep"), o = { a: 0 };
  const arc = a => { const r = 200, x = 100 + r * Math.sin(a), y = 100 - r * Math.cos(a); return "M100 100 L100 -100 A" + r + " " + r + " 0 " + (a > Math.PI ? 1 : 0) + " 1 " + x.toFixed(2) + " " + y.toFixed(2) + " Z"; };
  const tl = gsap.timeline({ onComplete: () => { api.markIntro(); } });
  [3, 2, 1].forEach((k, i) => {
    tl.call(() => { n.textContent = k; }, null, i * .55);
    tl.fromTo(o, { a: 0 }, { a: Math.PI * 2 - .001, duration: .55, ease: "none", onUpdate: () => sw.setAttribute("d", arc(o.a)) }, i * .55);
  });
  tl.call(() => { box.classList.add("open"); gsap.set(".leader .lb", { scaleY: 1 }); }, null, 1.65);
  tl.to(".leader .lb", { scaleY: 0, duration: 1.05, ease: "expo.inOut" }, 1.7);
  tl.call(() => { heroIn(0); if (lenis) lenis.start(); }, null, 2.0);
  tl.call(() => box.classList.add("done"), null, 2.8);
}
function heroIn(d){
  gsap.from("#hero-mask", { scale: 1.12, duration: 1.8, ease: "expo.out", delay: d, transformOrigin: "50% 46%" });
  gsap.from("#hero-q > *", { y: 24, opacity: 0, duration: 1.1, ease: "expo.out", stagger: .12, delay: d + .5 });
}

/* ---------- header, progress, scene rail, offer ---------- */
function chrome(){
  const hd = $("#hd"), prog = $("#prog");
  let lastY = 0;
  ScrollTrigger.create({ start: 0, end: "max", onUpdate: s => {
    prog.style.transform = "scaleX(" + s.progress.toFixed(4) + ")";
    const y = s.scroll(), heroEnd = heroST ? heroST.end : innerHeight;
    hd.classList.toggle("solid", y > heroEnd - 80);
    hd.classList.toggle("hide", y > heroEnd && y > lastY + 4 && !api.menuOpen());
    if (y < lastY - 4) hd.classList.remove("hide");
    lastY = y;
  } });
  $$("[data-scene]").forEach(sec => ScrollTrigger.create({ trigger: sec, start: "top 55%", end: "bottom 55%", onToggle: s => { if (s.isActive) api.setScene(sec.dataset.scene); } }));
  ScrollTrigger.create({ trigger: "#manifest", start: "top 70%", once: true, onEnter: () => $("#offer").classList.remove("away") });
  ScrollTrigger.create({ trigger: "#journey", start: "top bottom", endTrigger: "#foot", end: "top bottom", onToggle: s => $("#rail").classList.toggle("off", !s.isActive) });
  $("#rail").classList.add("off");
}

/* ---------- 01 hero: wordmark window -> zoom through the I -> full film -> the line ---------- */
function hero(){
  const o = { z: 0 };
  const tl = gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: {
    trigger: "#top", start: "top top", end: () => "+=" + Math.round(innerHeight * 1.6), pin: "#hero-pin", scrub: .55, invalidateOnRefresh: true
  } });
  tl.to("#hero-q", { opacity: 0, y: -30, duration: .12 }, 0)
    .to(o, { z: 1, duration: .55, ease: "power1.in", onUpdate: () => api.zoom(o.z) }, 0)
    .to(api.beam, { k: 0, duration: .3 }, 0)
    .fromTo("#hero-film", { "--fz": 1.12 }, { "--fz": 1, duration: .6 }, 0)
    .fromTo("#hero-film", { "--shade": 0 }, { "--shade": 1, duration: .2 }, .55)
    .to("#hero-hud", { opacity: 1, duration: .12, onStart: () => $("#hero-hud").classList.add("on"), onReverseComplete: () => $("#hero-hud").classList.remove("on") }, .6)
    .to("#hero-line .ch", { y: "0%", duration: .26, stagger: { amount: .1 }, ease: "power3.out" }, .7)
    .to("#hero-line .ln", { "--lv": 1, duration: .26 }, .7)
    .to({}, { duration: .04 }, .96);
  heroST = tl.scrollTrigger;
}

/* ---------- 02 manifesto: 100 people; 88 forget, the story brings them back ---------- */
function manifest(){
  api.manifest(0);
  mfST = ScrollTrigger.create({
    trigger: "#manifest", start: "top top", end: () => "+=" + Math.round(innerHeight * 1.3), pin: "#mf-pin", invalidateOnRefresh: true,
    onUpdate: s => api.manifest(s.progress), onRefresh: s => api.manifest(s.progress)
  });
}

/* ---------- numbers ticker: drifts with scroll, digits roll in once ---------- */
function ticker(){
  gsap.fromTo("#tk", { x: 0 }, { x: () => -Math.max(0, $("#tk").scrollWidth - innerWidth) * (document.dir === "rtl" ? -1 : 1), ease: "none", scrollTrigger: { trigger: ".ticker", start: "top bottom", end: "bottom top", scrub: .6, invalidateOnRefresh: true } });
  ScrollTrigger.create({ trigger: ".ticker", start: "top 85%", once: true, onEnter: () => api.rollTicker() });
}

/* ---------- 03 journey: four beats ---------- */
function story(){
  api.setStory(0);
  storyST = ScrollTrigger.create({
    trigger: "#story", start: "top top", end: () => "+=" + Math.round(innerHeight * 1.5), pin: true, invalidateOnRefresh: true,
    onUpdate: s => api.setStory(s.progress), onRefresh: s => api.setStory(s.progress)
  });
}

/* ---------- 04 ads vs story ---------- */
function duel(){
  const o = { p: 0 };
  api.setDuel(0);
  duelST = gsap.to(o, { p: 1, ease: "none", onUpdate: () => api.setDuel(o.p),
    scrollTrigger: { trigger: "#diff", start: "top top", end: () => "+=" + Math.round(innerHeight * 1.1), pin: "#duel-pin", scrub: .5, invalidateOnRefresh: true } }).scrollTrigger;
}

/* ---------- 05 work: client names drift faster and lean when you scroll fast ---------- */
function marquee(){
  const row = $("#marq-row"); let x = 0, v = 0, skew = 0;
  const vel = ScrollTrigger.create({ trigger: "#cases", start: "top bottom", end: "bottom top" });
  gsap.ticker.add((t, dt) => {
    const half = row.scrollWidth / 2; if (!half) return;
    const sv = vel.isActive ? vel.getVelocity() : 0;
    v += ((1.2 + Math.min(14, Math.abs(sv) / 180)) * (sv < 0 ? -1 : 1) - v) * .08;
    x -= v * dt * .06; if (x <= -half) x += half; if (x > 0) x -= half;
    skew += (Math.max(-12, Math.min(12, sv / 260)) - skew) * .1;
    row.style.transform = "translate3d(" + x.toFixed(1) + "px,0,0) skewX(" + (-skew).toFixed(2) + "deg)";
  });
}
/* film frames enter as a negative and develop */
function develop(){
  $$(".dev").forEach(d => { if (d.dataset.dev) return; d.dataset.dev = "1";
    gsap.fromTo(d, { "--neg": 1 }, { "--neg": 0, ease: "none", scrollTrigger: { trigger: d, start: "top 96%", end: "top 42%", scrub: .4 } });
    const im = d.querySelector("img"); if (im) gsap.fromTo(d, { "--iz": 1.22 }, { "--iz": 1.04, ease: "none", scrollTrigger: { trigger: d, start: "top bottom", end: "bottom top", scrub: true } });
  });
}
ABM.develop = () => { if (built) { develop(); settle(); } };

/* ---------- 07 Abror: the photo opens through blinds ---------- */
function slats(){
  const box = $("#slats"); if (!box) return;
  const n = 9;
  for (let i = 0; i < n; i++) { const s = document.createElement("i"); s.className = "sl"; s.style.top = (i * 100 / n) + "%"; s.style.height = (100 / n + .3) + "%"; box.append(s); }
  const tl = gsap.timeline({ scrollTrigger: { trigger: "#why-ph", start: "top 85%", end: "top 25%", scrub: .5 } });
  $$("#slats .sl").forEach((s, i) => tl.fromTo(s, { "--c": 1 }, { "--c": 0, duration: 1, ease: "power2.inOut" }, i * .12));
  gsap.fromTo("#why-img", { "--py": "-6%", "--sz": 1.18 }, { "--py": "6%", "--sz": 1.02, ease: "none", scrollTrigger: { trigger: "#why-ph", start: "top bottom", end: "bottom top", scrub: true } });
}

/* ---------- 08 process: the line fills, the big number rolls to the step in view ---------- */
function process(){
  gsap.fromTo("#steps-fill", { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: "#steps", start: "top 60%", end: "bottom 60%", scrub: .4 } });
  bindSteps();
}
function bindSteps(){
  ScrollTrigger.getAll().filter(s => s.vars && s.vars.id && String(s.vars.id).startsWith("step-")).forEach(s => s.kill());
  $$("#steps .step").forEach((li, i) => ScrollTrigger.create({ id: "step-" + i, trigger: li, start: "top 62%", end: "bottom 62%",
    onToggle: s => { if (s.isActive) api.setStep(i); }, onEnter: () => li.classList.add("on"), onLeaveBack: () => li.classList.remove("on") }));
}
ABM.bindSteps = () => { if (built) { bindSteps(); settle(); } };

/* ---------- 10 request: three frames open like an iris ---------- */
function frames(){
  $$("#frames .ph").forEach((p, i) => {
    gsap.fromTo(p, { "--cr": "8%" }, { "--cr": "75%", ease: "power1.inOut", scrollTrigger: { trigger: "#frames", start: "top " + (88 - i * 6) + "%", end: "top " + (40 - i * 6) + "%", scrub: .5 } });
    gsap.fromTo(p.querySelector("img"), { "--fy": "-5%" }, { "--fy": "5%", ease: "none", scrollTrigger: { trigger: p, start: "top bottom", end: "bottom top", scrub: true } });
  });
}
ABM.frames = () => { if (built) { frames(); settle(); } };

/* ---------- one scroll = one step inside the pinned scenes ---------- */
function stepper(){
  const zones = () => {
    const z = [], at = (st, ks) => ks.map(k => st.start + (st.end - st.start) * k);
    if (heroST) z.push(at(heroST, [0, .55, 1]));
    if (mfST) z.push(at(mfST, [0, .5, 1]));
    if (storyST) z.push(at(storyST, [0, 1 / 3, 2 / 3, 1]));
    if (duelST) z.push(at(duelST, [0, 1]));
    return z.map(s => s.map(Math.round));
  };
  let busy = false, moving = false, quietT = 0, endT = 0;
  const locked = () => !!document.querySelector("dialog[open]") || (lenis && lenis.isStopped && !busy);
  const y = () => lenis ? lenis.animatedScroll : scrollY;
  const goal = () => lenis ? lenis.targetScroll : scrollY;
  /* after a step, input is ignored until it has been quiet for a moment, so flick momentum can't stack steps */
  const settleQ = () => { clearTimeout(quietT); quietT = setTimeout(() => { if (!moving) busy = false; }, 220); };
  function go(to){
    busy = moving = true; clearTimeout(quietT); clearTimeout(endT);
    const done = () => { moving = false; settleQ(); };
    if (lenis) lenis.scrollTo(to, { duration: 1.1, easing: x => 1 - Math.pow(1 - x, 3), force: true, onComplete: done });
    else { window.scrollTo({ top: to, behavior: "smooth" }); endT = setTimeout(done, 900); }
  }
  function target(dir, projected){
    const cur = y(), z = zones();
    for (const s of z) {
      if (cur >= s[0] - 2 && cur <= s[s.length - 1] + 2) {
        const nxt = dir > 0 ? s.find(v => v > cur + 2) : [...s].reverse().find(v => v < cur - 2);
        if (nxt != null) return nxt;
      }
    }
    /* outside a scene: if the next one is about a screen away, one notch goes straight to it,
       and a fast move stops at its start (or end, going up) instead of flying through */
    const reach = innerHeight * 1.3;
    projected = dir > 0 ? Math.max(projected, cur + reach) : Math.min(projected, cur - reach);
    for (const s of (dir > 0 ? z : [...z].reverse())) {
      const a = s[0], b = s[s.length - 1];
      if (dir > 0 && cur < a - 2 && projected >= a) return a;
      if (dir < 0 && cur > b + 2 && projected <= b) return b;
    }
    return null;
  }
  addEventListener("wheel", e => {
    if (e.ctrlKey || locked()) return;
    const dir = Math.sign(e.deltaY); if (!dir) return;
    if (busy) { e.preventDefault(); e.stopImmediatePropagation(); settleQ(); return; }
    const t = target(dir, goal() + e.deltaY * 1.2);
    if (t == null) return;
    e.preventDefault(); e.stopImmediatePropagation(); go(t);
  }, { capture: true, passive: false });
  addEventListener("keydown", e => {
    if (locked() || (e.target.closest && e.target.closest("input,textarea,select,button,summary,[contenteditable]"))) return;
    const dir = ["ArrowDown", "PageDown", " "].includes(e.key) ? (e.shiftKey && e.key === " " ? -1 : 1) : ["ArrowUp", "PageUp"].includes(e.key) ? -1 : 0;
    if (!dir) return;
    if (busy) { e.preventDefault(); return; }
    const t = target(dir, goal() + dir * innerHeight * .9);
    if (t == null) return;
    e.preventDefault(); go(t);
  }, { capture: true });
  const inside = () => { const cur = y(); return zones().some(s => cur >= s[0] - 2 && cur <= s[s.length - 1] + 2); };
  let ty = null;
  addEventListener("touchstart", e => { ty = e.touches[0].clientY; }, { passive: true });
  addEventListener("touchmove", e => { if (ty == null || locked()) return; const dir = Math.sign(ty - e.touches[0].clientY); if (busy || (dir && inside() && target(dir, y()) != null)) e.preventDefault(); }, { passive: false });
  addEventListener("touchend", e => {
    if (ty == null) return; const dy = ty - e.changedTouches[0].clientY; ty = null;
    if (busy || locked() || Math.abs(dy) < 24) return;
    const t = target(Math.sign(dy), y() + dy * 3); if (t != null) go(t);
  }, { passive: true });
  /* a scroll that comes to rest between two stops inside a scene finishes to the nearest one */
  let restT = 0;
  addEventListener("scroll", () => {
    clearTimeout(restT);
    restT = setTimeout(() => {
      if (busy || locked()) return;
      const cur = y();
      for (const s of zones()) {
        if (cur > s[0] + 2 && cur < s[s.length - 1] - 2 && !s.some(v => Math.abs(v - cur) <= 2)) {
          go(s.reduce((p, v) => Math.abs(v - cur) < Math.abs(p - cur) ? v : p, s[0])); return;
        }
      }
    }, 160);
  }, { passive: true });
}
})();
