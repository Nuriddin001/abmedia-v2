/* AB Media v2: content, the film in the wordmark, the crowd, the river, the chart, films, planner, form.
   Drawn effects live in fx.js, scroll choreography in motion.js; this file still works if either fails to load. */
(() => {
"use strict";

const DATA = window.ABM_DATA;
const { L, P, CASES } = window.ABM_I18N;
const FX = window.ABM_FX || {};
const FEAT = DATA.featured;
const MODEL = DATA.cjm;
const root = document.documentElement;

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
/* phones get light copies of the films (media/m/: 854 px, no sound, ~4x smaller) for the wordmark, the previews
   and the planner, so the photos are not stuck behind 14 MB downloads; the viewing room always plays the full film */
const LITE = matchMedia("(pointer: coarse)").matches || matchMedia("(max-width: 760px)").matches;
const vsrc = name => "media/" + (LITE ? "m/" : "") + name + ".mp4";
/* on phones the films wait until the page and its photos have arrived: on a slow connection the text and the photos come first */
const afterLoad = fn => { if (document.readyState === "complete") setTimeout(fn, 600); else addEventListener("load", () => setTimeout(fn, 600), { once: true }); };
let pageReady = !LITE;
if (LITE) afterLoad(() => { pageReady = true; if (reel.i >= 0) showClip(reel.i); monSync(); });
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const NS = "http://www.w3.org/2000/svg";
function icon(id, cls){ const s = document.createElementNS(NS, "svg"); s.setAttribute("class", "ic" + (cls ? " " + cls : "")); s.setAttribute("aria-hidden", "true"); const u = document.createElementNS(NS, "use"); u.setAttribute("href", "#i-" + id); s.append(u); return s; }
const svg = (tag, attrs) => { const e = document.createElementNS(NS, tag); Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
const fill = (str, v) => str.replace("{n}", v);
const pname = (id, l) => P[id][l] || P[id].en;
const byClient = n => CASES.findIndex(c => c.client === n);
const metric = n => DATA.metrics.find(m => m.client === n) || {};
const store = { get(k, s){ try { return (s ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } }, set(k, v, s){ try { (s ? sessionStorage : localStorage).setItem(k, v); } catch (e) {} } };
const M = () => window.ABM_MOTION && window.ABM_MOTION.ready ? window.ABM_MOTION : null;
/* known before motion.js starts: will the scroll scenes run? (decides the first state of every scene) */
const MOVES = !reduce && !!(window.gsap && window.ScrollTrigger && window.ABM_MOTION);
const ss = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

let lang = "en";
const qLang = new URLSearchParams(location.search).get("lang"), saved = store.get("abm2-lang");
if (qLang && L[qLang]) lang = qLang; else if (saved && L[saved]) lang = saved;
const T = () => L[lang];
const LOCALE = { en: "en-US", es: "es-ES", ru: "ru-RU", ar: "ar-u-nu-latn" };
const fmt = n => Math.round(n).toLocaleString(LOCALE[lang] || "en-US");
const dec = x => String(Math.round(x * 10) / 10).replace(".", lang === "en" ? "." : ",");
const tr = o => (o && (o[lang] || o.en)) || "";
function goTo(sel){ const t = $(sel); if (!t) return; if (M()) M().scrollTo(t); else t.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); }

const builder = { goal: "trust", have: "task", dist: "yes" };
let brief = null, calc = null, mode = 0, jmode = 1, reach = MODEL.reach_default, openIdx = -1, lastName = "", scene = "top";

/* split text into words; *marked* words get the accent */
function words(text){
  const marked = text.replace(/\*(.*?)\*/g, (_, s) => s.split(/\s+/).map(w => "\u0001" + w).join(" "));
  return marked.split(/\s+/).filter(Boolean).map(w => ({ text: w.replace("\u0001", ""), hl: w.startsWith("\u0001") }));
}
/* odometer: each digit is a rolling column */
function odo(node, str){
  node.replaceChildren(); node.classList.add("odo");
  String(str).split("").forEach((ch, k) => {
    if (/\d/.test(ch)) { const d = el("span", "dg"), col = el("i"); for (let i = 0; i <= 9; i++) col.append(el("b", null, String(i))); col.style.setProperty("--k", k); d.dataset.v = ch; d.append(col); node.append(d); }
    else node.append(el("span", null, ch));
  });
}
const odoRoll = node => node.querySelectorAll(".dg").forEach(d => d.firstChild.style.setProperty("--v", d.dataset.v));
const odoSet = (node, str) => { if (node.dataset.s !== String(str).length + "") { odo(node, str); node.dataset.s = String(str).length; requestAnimationFrame(() => requestAnimationFrame(() => odoRoll(node))); return; } const ds = node.querySelectorAll(".dg"), digits = String(str).replace(/\D/g, ""); ds.forEach((d, i) => { d.dataset.v = digits[i] || "0"; }); odoRoll(node); };

/* ---------- 01 hero: a montage plays inside the wordmark ---------- */
const MONT = FEAT.map(byClient).filter(i => i >= 0);
const reel = { i: -1, a: 0, timer: 0, on: true };
const hv = [$("#hv0"), $("#hv1")];
function clipStart(v){ const d = v.duration || 60; return Math.min(12, d * .12); }
function showClip(k){
  reel.i = k; const c = CASES[MONT[k]], v = hv[reel.a], other = hv[1 - reel.a];
  v.poster = "media/" + c.video + ".jpg";
  if (!pageReady) { v.classList.add("on"); nowTag(); return; }
  if (!v.dataset.src || v.dataset.src !== c.video) { v.dataset.src = c.video; v.src = vsrc(c.video); v.preload = "auto"; }
  const go = () => { try { v.currentTime = clipStart(v); } catch (e) {} const p = v.play(); if (p && p.catch) p.catch(() => {}); v.classList.add("on"); other.classList.remove("on"); setTimeout(() => { if (!other.classList.contains("on")) other.pause(); }, 1300); };
  if (v.readyState >= 1) go(); else v.addEventListener("loadedmetadata", go, { once: true });
  nowTag();
}
function nowTag(){ if (reel.i < 0) return; const c = CASES[MONT[reel.i]], m = metric(c.client); $("#now-c").textContent = c.client; $("#now-m").textContent = m.views ? m.views + " " + T().k_views : c.dur; }
function initReel(){
  if (!MONT.length) return;
  showClip(0);
  /* phones keep one film in the wordmark: switching 14 MB videos every few seconds stalls a phone */
  if (reduce || matchMedia("(pointer: coarse)").matches) { new IntersectionObserver(es => { const v = hv[reel.a]; if (es[0].isIntersecting) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } else v.pause(); }).observe($("#top")); $("#now").addEventListener("click", () => openRoom(MONT[reel.i])); return; }
  /* the next clip is loaded early, then cross-fades in */
  reel.timer = setInterval(() => {
    if (document.hidden || !reel.on) return;
    reel.a = 1 - reel.a; showClip((reel.i + 1) % MONT.length);
  }, 7000);
  new IntersectionObserver(es => { reel.on = es[0].isIntersecting; hv.forEach(v => { if (!reel.on) v.pause(); else if (v.classList.contains("on")) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } }); }).observe($("#top"));
  $("#now").addEventListener("click", () => openRoom(MONT[reel.i]));
}
function renderHero(){
  const t = T();
  $("#h1").textContent = "AB Media — " + t.hero_tag;
  const box = $("#hero-line"); box.replaceChildren();
  t.hero_line.split("\n").forEach(line => {
    const ln = el("span", "ln");
    if (lang === "ar") ln.textContent = line;
    else line.split("").forEach(ch => ln.append(ch === " " ? document.createTextNode(" ") : el("span", "ch", ch)));
    box.append(ln);
  });
}

/* ---------- 02 manifesto: 100 people ---------- */
const N_KNOW_NOW = Math.round(MODEL.now[1] / MODEL.now[0] * 100);      /* 12 remember */
const N_KNOW_FILM = Math.round(MODEL.film[1] / MODEL.film[0] * 100);    /* 21 remember */
const N_TRUST_FILM = Math.round(MODEL.film[2] / MODEL.film[0] * 100);   /* 6 trust */
const PERM = (() => { let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; const a = Array.from({ length: 100 }, (_, i) => i); for (let i = 99; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; })();
let mfSplit = 0, mfP = -1;
function renderManifest(){
  const p = $("#mf"); p.replaceChildren();
  const ws = words(T().mf); mfSplit = ws.findIndex(w => /[.!?。]$/.test(w.text)) + 1 || Math.ceil(ws.length / 2);
  ws.forEach((w, i) => { if (i) p.append(" "); p.append(el("span", "w" + (w.hl ? " hl" : "") + (w.hl && i < mfSplit ? " red" : ""), w.text)); });
  const crowd = $("#crowd");
  if (!crowd.children.length) for (let i = 0; i < 100; i++) { const d = el("i"); d.style.setProperty("--fy", (6 + (i * 37 % 14)) + "px"); crowd.append(d); }
  const q = mfP; mfP = -1; setManifest(q < 0 ? (MOVES ? 0 : 1) : q);
}
function setManifest(p){
  if (p === mfP) return; mfP = p;
  const ws = $$("#mf .w"), n1 = mfSplit, n2 = ws.length - n1;
  const a = ss(.04, .42, p), b = ss(.55, .9, p);
  ws.forEach((w, i) => w.classList.toggle("on", i < n1 ? i < Math.round(a * n1 + .001) : (i - n1) < Math.round(b * n2 + .001)));
  const dots = $("#crowd").children; if (!dots.length) return;
  const gone = Math.round(ss(.12, .45, p) * (100 - N_KNOW_NOW)), know = Math.round(ss(.6, .85, p) * N_KNOW_FILM), trust = Math.round(ss(.84, 1, p) * N_TRUST_FILM);
  PERM.forEach((idx, rank) => {
    const d = dots[idx];
    /* the first 12 never forget; the story brings 21 to remember and 6 to trust */
    const isTrust = rank < trust, isKnow = rank < know;
    const isGone = !isKnow && rank >= N_KNOW_NOW && rank - N_KNOW_NOW < gone;
    d.className = isTrust ? "trust" : isKnow ? "know" : isGone ? "gone" : "";
    d.style.setProperty("--d", String((rank % 23) * 14));
  });
}

/* ---------- numbers ticker ---------- */
function renderTicker(){
  const t = T(), row = $("#tk"); row.replaceChildren();
  for (let r = 0; r < 2; r++) [DATA.projects, DATA.years, DATA.total_views, DATA.per_month].forEach((v, i) => {
    const d = el("div", "tk"); const b = el("b"); odo(b, v); d.append(b, el("span", null, t.stat_l[i])); if (r) d.setAttribute("aria-hidden", "true"); row.append(d);
  });
  if (tickerRolled || !MOVES) requestAnimationFrame(() => $$("#tk .odo").forEach(odoRoll));
}
let tickerRolled = false;
function rollTicker(){ tickerRolled = true; $$("#tk .odo").forEach(odoRoll); }

/* ---------- 03 journey: the river ---------- */
const STAGE_NOW = MODEL.now, STAGE_FILM = MODEL.film;
const lvl = (arr, i) => Math.sqrt(arr[i] / arr[0]);
function storyVars(){
  const n = STAGE_NOW, f = STAGE_FILM;
  return { r0: fmt(n[0]), r1: fmt(n[1]), r2: fmt(n[2]), r3: fmt(n[3]), f1: fmt(f[1]), f2: fmt(f[2]), f3: fmt(f[3]),
    lost1: fmt(n[0] - n[1]), p2: Math.round((1 - n[2] / n[1]) * 100), x: dec(f[3] / n[3]) };
}
const fillVars = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] != null ? v[k] : "");
let river = null, storyStep = -1;
function renderStory(){
  const t = T(), v = storyVars();
  const ol = $("#beats"); ol.replaceChildren();
  t.s_steps.forEach(([h, p]) => { const li = el("li"); li.append(el("b", null, fillVars(h, v)), el("p", null, fillVars(p, v))); ol.append(li); });
  const gates = $("#gates"); gates.replaceChildren();
  t.j_stages.forEach((h, i) => {
    const g = el("div", "gate"), gv = el("div", "gv"), b = el("b", null, fmt(STAGE_NOW[i])); b.dataset.v = STAGE_NOW[i];
    gv.append(b, el("span", null, h)); g.append(gv);
    if (i) g.append(el("span", "gd", "+" + Math.round((STAGE_FILM[i] / STAGE_NOW[i] - 1) * 100) + "%"));
    gates.append(g);
  });
  if (river) river.layout();
  const s = storyStep; storyStep = -1; setStoryStep(s < 0 ? (MOVES ? 0 : 3) : s);
}
function setStory(p){ setStoryStep(p < 1 / 6 ? 0 : p < .5 ? 1 : p < 5 / 6 ? 2 : 3); }
function setStoryStep(step){
  if (step === storyStep) return; storyStep = step;
  const film = step === 3, arr = film ? STAGE_FILM : STAGE_NOW;
  $$("#beats li").forEach((li, i) => { li.classList.toggle("on", i === step); li.classList.toggle("past", i < step); });
  $("#river").classList.toggle("film", film);
  $$("#gates .gate").forEach((g, i) => { g.classList.toggle("off", !film && i > step); tweenNum(g.querySelector("b"), arr[i]); });
  if (river) river.set(step, [0, 1, 2, 3].map(i => lvl(arr, i)), film);
}
function tweenNum(node, to){
  const from = +node.dataset.v || 0; node.dataset.v = to;
  if (reduce || from === to) { node.textContent = fmt(to); return; }
  const t0 = performance.now(), d = 700;
  const tick = now => { const k = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - k, 3); node.textContent = fmt(from + (to - from) * e); if (k < 1 && +node.dataset.v === to) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

/* ---------- calculator ---------- */
const R_STEPS = 1000, LMIN = Math.log(MODEL.reach_min), LMAX = Math.log(MODEL.reach_max);
const toReach = v => { const r = Math.exp(LMIN + (LMAX - LMIN) * v / R_STEPS); const step = r < 200000 ? 10000 : r < 1000000 ? 50000 : 100000; return Math.min(MODEL.reach_max, Math.max(MODEL.reach_min, Math.round(r / step) * step)); };
const fromReach = r => Math.round((Math.log(r) - LMIN) / (LMAX - LMIN) * R_STEPS);
const scaled = (arr, i) => arr[i] * reach / MODEL.base_reach;
function journeyNumbers(){
  const now = [0, 1, 2, 3].map(i => scaled(MODEL.now, i)), film = [0, 1, 2, 3].map(i => scaled(MODEL.film, i));
  return { now, film, extra: film[3] - now[3], x: film[3] / now[3] };
}
function segKnob(seg){
  const b = seg.querySelector('button[aria-pressed="true"]'), k = seg.querySelector(".seg-k"); if (!b || !k) return;
  k.style.setProperty("--kw", b.offsetWidth + "px"); k.style.setProperty("--kx", b.offsetLeft + "px");
}
function renderJourney(){
  const t = T(), n = journeyNumbers(), cur = jmode ? n.film : n.now;
  $$("#jmode button").forEach(b => { const m = +b.dataset.m; b.textContent = t.j_modes[m]; b.setAttribute("aria-pressed", String(m === jmode)); });
  segKnob($("#jmode"));
  $("#reach-o").textContent = fmt(reach);
  $("#range-f").style.setProperty("--rp", (reachIn.value / R_STEPS * 100).toFixed(2) + "%");
  const box = $("#jstages");
  if (!box.children.length || box.dataset.lang !== lang) {
    box.replaceChildren(); box.dataset.lang = lang;
    t.j_stages.forEach((h, i) => {
      const ours = i === 1 || i === 2, d = el("article", "jc" + (ours ? " ours" : ""));
      const k = el("span", "k"); k.append(el("span", null, h)); if (ours) k.append(el("i", null, t.j_ours));
      const v = el("div", "v", fmt(cur[i])); v.dataset.v = cur[i];
      const bar = el("div", "bar"); bar.append(el("i"));
      d.append(k, v, bar);
      if (i > 0) { const row = el("div", "k"); row.append(el("span", "lost"), el("span", "delta")); d.append(row); }
      box.append(d);
    });
  }
  box.classList.toggle("film", !!jmode);
  $$("#jstages .jc").forEach((d, i) => {
    tweenNum(d.querySelector(".v"), cur[i]);
    d.querySelector(".bar i").style.setProperty("--s", lvl(cur, i).toFixed(4));
    if (i > 0) {
      const dl = d.querySelector(".delta"); dl.hidden = !jmode; dl.textContent = "+" + Math.round((n.film[i] / n.now[i] - 1) * 100) + "%";
      d.querySelector(".lost").textContent = "−" + fmt(cur[i - 1] - cur[i]);
    }
  });
  $("#jsum").innerHTML = t.j_sum.replace("{n}", fmt(n.extra)).replace("{x}", dec(n.x));
}
const reachIn = $("#reach");
reachIn.min = 0; reachIn.max = R_STEPS; reachIn.step = 1; reachIn.value = fromReach(reach);
reachIn.addEventListener("input", () => { reach = toReach(+reachIn.value); renderJourney(); });
$$("#jmode button").forEach(b => b.addEventListener("click", () => { jmode = +b.dataset.m; renderJourney(); }));
$("#jsend").addEventListener("click", () => {
  const n = journeyNumbers();
  calc = { reach, buyers_now: Math.round(n.now[3]), buyers_film: Math.round(n.film[3]), extra: Math.round(n.extra) };
  renderBrief(); goForm();
});

/* ---------- 04 ads vs story: glowing lines drawn by a playhead ---------- */
const AD_PATH = "M40 330 C 90 330, 110 110, 170 100 S 300 92, 420 96 S 540 92, 560 96 C 590 100, 610 300, 660 318 S 900 326, 960 326";
const FILM_PATH = "M40 330 C 160 326, 230 260, 330 210 S 520 130, 640 104 S 860 70, 960 58";
const X0 = 40, X1 = 960, XEND = 560, YB = 330, YT = 40;
const duel = { lut: null, p: -1, flashed: false };
function renderDuel(){
  const s = $("#scope-svg"); s.replaceChildren();
  const defs = svg("defs");
  const grad = svg("linearGradient", { id: "film-fade", x1: 0, y1: 0, x2: 0, y2: 1 });
  grad.append(svg("stop", { offset: "0", "stop-color": "#F4A62A", "stop-opacity": ".26" }), svg("stop", { offset: "1", "stop-color": "#F4A62A", "stop-opacity": "0" }));
  const soft = svg("filter", { id: "soft", x: "-10%", y: "-40%", width: "120%", height: "180%" }); soft.append(svg("feGaussianBlur", { stdDeviation: "6" }));
  const clip = svg("clipPath", { id: "duel-clip" }); const rect = svg("rect", { x: 0, y: -40, width: X0, height: 440 }); clip.append(rect);
  defs.append(grad, soft, clip); s.append(defs);
  [120, 200, 280].forEach(y => s.append(svg("line", { class: "g", x1: X0, x2: X1, y1: y, y2: y })));
  s.append(svg("line", { class: "g", x1: X0, x2: X1, y1: YB, y2: YB }));
  s.append(svg("line", { class: "end", x1: XEND, x2: XEND, y1: 10, y2: YB }));
  const grp = svg("g", { "clip-path": "url(#duel-clip)" });
  grp.append(svg("path", { class: "area", d: FILM_PATH + " L960 330 L40 330 Z" }), svg("path", { class: "glow glow-ad", d: AD_PATH }), svg("path", { class: "glow glow-film", d: FILM_PATH }), svg("path", { class: "ln ln-ad", d: AD_PATH }), svg("path", { class: "ln ln-film", d: FILM_PATH }));
  s.append(grp);
  const head = svg("line", { class: "head", x1: X0, x2: X0, y1: 10, y2: YB }); s.append(head);
  const sample = d => { const p = svg("path", { d }); s.append(p); const len = p.getTotalLength(), pts = []; for (let i = 0; i <= 600; i++) { const q = p.getPointAtLength(len * i / 600); pts.push([q.x, q.y]); } p.remove(); return pts; };
  duel.lut = { ad: sample(AD_PATH), film: sample(FILM_PATH) };
  duel.rect = rect; duel.head = head;
  $("#end-t").style.left = (XEND / 10) + "%";
  const p = duel.p; duel.p = -1; setDuel(p < 0 ? (MOVES ? 0 : 1) : p);
}
const yAt = (pts, x) => { let lo = 0, hi = pts.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m][0] < x) lo = m; else hi = m; } const a = pts[lo], b = pts[hi], k = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * k; };
function setDuel(p){
  if (!duel.lut || p === duel.p) return;
  duel.p = p;
  const x = X0 + (X1 - X0) * Math.max(0, Math.min(1, p));
  duel.rect.setAttribute("width", x); duel.head.setAttribute("x1", x); duel.head.setAttribute("x2", x);
  [["#dot-ad", "#r-ad", duel.lut.ad], ["#dot-film", "#r-film", duel.lut.film]].forEach(([d, r, lut]) => {
    const y = yAt(lut, x), dot = $(d);
    dot.style.setProperty("--px", (x / 10).toFixed(2) + "%"); dot.style.setProperty("--py", (y / 3.6).toFixed(2) + "%");
    $(r).textContent = Math.max(0, Math.round((YB - y) / (YB - YT) * 100)) + "%";
  });
  /* the ad peaks: one red flash */
  if (x > 150 && !duel.flashed) { duel.flashed = true; const sec = $("#diff"); sec.classList.remove("flash"); void sec.offsetWidth; sec.classList.add("flash"); }
  if (x < 120) duel.flashed = false;
}

/* ---------- 05 work ---------- */
const ORDER = FEAT.map(byClient).concat(CASES.map((_, i) => i).filter(i => !FEAT.includes(CASES[i].client)));
const SHOWN = 2;
let filmsOpen = false;
function card(i, k){
  const t = T(), c = CASES[i], big = FEAT.includes(c.client), m = metric(c.client);
  const cc = el("article", "cc");
  const media = el("button", "cc-media dev"); media.type = "button"; media.dataset.cursor = "play"; media.dataset.video = c.video;
  media.setAttribute("aria-label", t.open_case + ": " + c.client);
  /* "lazy" must be set before the address, or the photo downloads at once even far down the page */
  const im = el("img"); im.loading = "lazy"; im.decoding = "async"; im.src = "media/" + c.video + ".jpg"; im.alt = "";
  const v = el("video"); v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.preload = "none";
  media.append(im, v, el("span", "tc", c.dur + (c.bts ? " + " + c.bts.dur : "")));
  media.addEventListener("click", () => openRoom(i));
  const head = el("div", "cc-head"), l = el("div");
  l.append(el("h3", null, c.client), el("span", "cat", t.cat[c.client])); head.append(l);
  if (big && m.views) { const pill = el("div", "pill"); pill.append(el("b", null, m.views), el("span", null, t.k_views)); head.append(pill); }
  cc.append(media, head);
  if (big && m.result) cc.append(el("p", "res", tr(m.result)));
  return cc;
}
function setFilmsLabel(){
  const t = T(), btn = $("#more-btn");
  $("#more-lbl").textContent = filmsOpen ? t.cs_less : t.cs_more;
  $("#more-n").textContent = filmsOpen ? "" : "+" + (ORDER.length - SHOWN);
  btn.setAttribute("aria-expanded", String(filmsOpen)); btn.classList.toggle("open", filmsOpen);
}
function toggleFilms(){
  filmsOpen = !filmsOpen;
  $("#grid").classList.toggle("open", filmsOpen); setFilmsLabel();
  if (filmsOpen && window.gsap && !reduce) gsap.fromTo("#grid .cc", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: .9, ease: "expo.out", stagger: .08, clearProps: "opacity,transform" });
  if (!filmsOpen) { $$("#grid .cc-media").forEach(m => preview(m, false)); goTo("#cases"); }
  requestAnimationFrame(() => { if (M()) { M().develop(); } });
}
$("#more-btn").addEventListener("click", toggleFilms);
function renderCases(){
  const t = T(), feat = $("#feat"), grid = $("#grid"); feat.replaceChildren(); grid.replaceChildren();
  ORDER.forEach((i, k) => (k < SHOWN ? feat : grid).append(card(i, k)));
  setFilmsLabel();
  $("#more").textContent = fill(t.more, DATA.more);
  const row = $("#marq-row"); row.replaceChildren();
  for (let r = 0; r < 2; r++) CASES.forEach(c => row.append(el("span", null, c.client)));
  $("#marq-sr").textContent = CASES.map(c => c.client).join(", ");
  bindPreviews();
  if (!MOVES) $$(".dev").forEach(d => d.style.setProperty("--neg", 0));
}
function preview(media, on){
  const v = media.querySelector("video");
  if (on && !reduce) {
    if (!v.src) v.src = vsrc(media.dataset.video) + "#t=8";
    const p = v.play(); if (p && p.then) p.then(() => media.classList.add("playing")).catch(() => {});
  } else { v.pause(); media.classList.remove("playing"); }
}
let previewIO = null;
function bindPreviews(){
  const medias = $$(".cc-media");
  if (finePointer) medias.forEach(m => { m.addEventListener("mouseenter", () => preview(m, true)); m.addEventListener("mouseleave", () => preview(m, false)); });
  else {
    if (previewIO) previewIO.disconnect();
    /* phones: a preview starts only after the film has stayed on screen for a moment, not while you scroll past it */
    previewIO = new IntersectionObserver(es => es.forEach(e => {
      const m = e.target; clearTimeout(m._pt);
      if (e.intersectionRatio > .7) m._pt = setTimeout(() => preview(m, true), 600); else preview(m, false);
    }), { threshold: [0, .7, 1] });
    medias.forEach(m => previewIO.observe(m));
  }
}

/* ---------- 06 what we fix: strike, then decode ---------- */
const GLYPHS = { en: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", es: "ABCDEFGHIJKLMNÑOPQRSTUVWXYZabcdefghijklmnñopqrstuvwxyz", ru: "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯабвгдежзиклмнопрстуфхцчшэюя" };
function scramble(node, text){
  const set = GLYPHS[lang];
  if (!set || reduce) { node.textContent = text; return; }
  const t0 = performance.now(), dur = 900 + text.length * 14, out = el("span"), tail = el("span", "sc");
  node.replaceChildren(out, tail);
  const tick = now => {
    const k = Math.min(1, (now - t0) / dur), n = Math.floor(k * text.length);
    out.textContent = text.slice(0, n);
    let s = ""; for (let i = n; i < Math.min(text.length, n + 10); i++) s += text[i] === " " ? " " : set[(Math.random() * set.length) | 0];
    tail.textContent = s;
    if (k < 1 && node.isConnected) requestAnimationFrame(tick); else node.textContent = text;
  };
  requestAnimationFrame(tick);
}
let fixIO = null;
function renderFixes(){
  const ol = $("#fixlist"), hit = $$("#fixlist .fx.hit").length; ol.replaceChildren();
  T().fixes.forEach(([a, b], i) => { const li = el("li", "fx" + (i < hit ? " hit" : "")); li.dataset.fix = b; const nw = el("span", "fx-new"); const tx = el("span", null, i < hit ? b : ""); nw.append(tx); li.append(el("span", "fx-old", a), nw); ol.append(li); });
  if (reduce || !("IntersectionObserver" in window)) { $$(".fx").forEach(x => { x.classList.add("hit"); x.querySelector(".fx-new span").textContent = x.dataset.fix; }); return; }
  if (!fixIO) fixIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { const x = e.target; x.classList.add("hit"); setTimeout(() => scramble(x.querySelector(".fx-new span"), x.dataset.fix), 450); fixIO.unobserve(x); } }), { rootMargin: "0px 0px -30% 0px" });
  $$(".fx:not(.hit)").forEach(x => fixIO.observe(x));
}

/* ---------- 08 process ---------- */
let stepI = 0;
function renderProcess(){
  const t = T();
  $$("#modes button").forEach(b => { const m = +b.dataset.m; b.textContent = t.modes[m]; b.setAttribute("aria-pressed", String(m === mode)); });
  segKnob($("#modes"));
  $("#mode-d").textContent = t.mode_d[mode];
  const kinds = mode === 0 ? ["full", "full", "full", "full", "full", "full"] : ["full", "full", "full", "you", "sup", "sup"];
  const ol = $("#steps"), on = $$("#steps .step.on").length;
  ol.querySelectorAll(".step").forEach(n => n.remove());
  t.steps.forEach(([h, p], i) => {
    const li = el("li", "step" + (kinds[i] === "you" ? " off" : "") + (i < on || !MOVES ? " on" : ""));
    li.append(el("h3", null, h), el("p", null, p), el("span", "chip " + kinds[i], t.chip[kinds[i]]));
    ol.append(li);
  });
  setStep(stepI, true);
}
function setStep(i, force){
  if (i === stepI && !force) return; stepI = i;
  const t = T(); odoSet($("#how-n"), String(i + 1).padStart(2, "0"));
  const ht = $("#how-t"), txt = t.steps[i][0];
  if (ht.textContent !== txt) { if (window.gsap && !reduce && !force) gsap.fromTo(ht, { yPercent: 40, opacity: 0, filter: "blur(6px)" }, { yPercent: 0, opacity: 1, filter: "blur(0px)", duration: .7, ease: "expo.out" }); ht.textContent = txt; }
}
$$("#modes button").forEach(b => b.addEventListener("click", () => { mode = +b.dataset.m; renderProcess(); if (M()) M().bindSteps(); }));

/* ---------- 09 planner: a storyboard ---------- */
function recommend(){
  const { goal, have, dist } = builder; let fmtI, stages;
  if (have === "agency") { fmtI = 0; stages = ["aud", "story", "contS", "gtm"]; }
  else if (have === "idea") { fmtI = 1; stages = ["aud", "story", "cont", "gtm"]; }
  else { fmtI = 1; stages = ["aud", "pos", "story", "cont", "gtm"]; }
  if (dist === "yes") { stages = stages.concat("run"); if (fmtI === 1) fmtI = 2; }
  const pick = have === "agency"
    ? { launch: "IMZO", trust: "Grand Capital", explain: "Uztelecom", social: "ZO'R TV" }[goal]
    : { launch: "Good Day Cappuccino", trust: "To'xtaniyoz Ota", explain: "Sales Doctor Academy", social: "ZO'R TV" }[goal];
  return { fmt: fmtI, stages, ci: byClient(pick) };
}
function renderBuilder(){
  const t = T(), f = $("#bq"); f.replaceChildren();
  [["goal", t.b_goal], ["have", t.b_have], ["dist", t.b_dist]].forEach(([key, opts], gi) => {
    const fs = el("fieldset"); const lg = el("legend"); lg.append(el("b", null, String(gi + 1).padStart(2, "0")), t.b_q[gi]); fs.append(lg);
    const row = el("div", "opts");
    Object.entries(opts).forEach(([v, label]) => {
      const id = "b-" + key + "-" + v; const inp = el("input"); inp.type = "radio"; inp.name = "b-" + key; inp.id = id; inp.value = v; inp.checked = builder[key] === v;
      inp.addEventListener("change", () => { builder[key] = v; renderResult(); });
      const lab = el("label", null, label); lab.htmlFor = id; row.append(inp, lab);
    });
    fs.append(row); f.append(fs);
  });
  renderResult();
}
function goForm(){ goTo("#request"); setTimeout(() => $("#f-name").focus({ preventScroll: true }), reduce ? 0 : 1200); }
const desk = { raf: 0, on: false, t0: performance.now(), lastCase: -1 };
function renderResult(){
  const t = T(), r = recommend(), box = $("#board"), cs = CASES[r.ci];
  const changed = desk.lastCase !== r.ci; desk.lastCase = r.ci;
  let mon = box.querySelector(".mon");
  if (!mon || changed) {
    mon = el("button", "mon"); mon.type = "button"; mon.dataset.cursor = "play";
    const v = el("video"); v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.dataset.poster = "media/" + cs.video + ".jpg";
    /* the film (and its cover) load only once the planner is near the screen (see runDesk), so they never compete with the photos above */
    if (!reduce) { v.preload = "none"; v.dataset.src = vsrc(cs.video) + "#t=6"; } else v.poster = v.dataset.poster;
    const rec = el("span", "rec"); rec.append(el("i"), document.createTextNode("REC"));
    mon.append(v, rec, el("span", "l3"));
    mon.addEventListener("click", () => openRoom(desk.lastCase));
  }
  const l3 = mon.querySelector(".l3"); l3.replaceChildren(el("small", null, t.r_format), el("b", null, t.fm[r.fmt][0]), el("em", null, t.r_focus + ": " + t.focus[builder.goal] + " · " + cs.client));
  const panels = el("div", "panels");
  r.stages.forEach((k, i) => { const p = el("div", "panel" + (/S$/.test(k) ? " sup" : "")); p.style.setProperty("--i", i); p.append(el("b", null, String(i + 1).padStart(2, "0")), el("i"), el("span", null, t.sc[k])); panels.append(p); });
  const acts = el("div", "acts");
  const send = el("button", "btn mag"); send.type = "button"; send.append(el("span", null, t.r_send), icon("arrow"));
  send.addEventListener("click", () => { brief = { fmt: r.fmt, goal: builder.goal, have: builder.have, dist: builder.dist }; renderBrief(); goForm(); });
  const watch = el("button", "linkbtn"); watch.type = "button"; watch.append(el("span", null, t.r_watch + ": " + cs.client), icon("arrow"));
  watch.addEventListener("click", () => openRoom(r.ci));
  acts.append(send, watch);
  box.replaceChildren(mon, panels, acts);
  runDesk(); monSync();
}
function monSync(){
  const v = $("#board .mon video"); if (!v || reduce) return;
  if (desk.on && !v.poster) v.poster = v.dataset.poster;
  if (desk.on && pageReady) { if (!v.src && v.dataset.src) { v.src = v.dataset.src; v.preload = "auto"; } const p = v.play(); if (p && p.catch) p.catch(() => {}); }
  else if (v.src) v.pause();
}
/* a light runs along the storyboard, panel by panel */
function runDesk(){
  if (desk.io) return;
  desk.io = new IntersectionObserver(es => { desk.on = es[0].isIntersecting && !reduce; monSync(); if (desk.on && !desk.raf) desk.raf = requestAnimationFrame(step); }, { threshold: .1, rootMargin: "200px 0px" });
  desk.io.observe($("#board"));
  function step(now){
    desk.raf = 0;
    const ps = $$("#board .panel"); const k = Math.floor((now - desk.t0) / 900) % (ps.length || 1);
    ps.forEach((p, i) => p.classList.toggle("hot", i === k));
    if (desk.on) desk.raf = requestAnimationFrame(step);
  }
}
function renderBrief(){
  const box = $("#brief"), t = T(); box.replaceChildren();
  if (!brief && !calc) { box.hidden = true; return; }
  box.hidden = false;
  const s = el("span", "bt");
  if (brief) s.append(el("small", null, t.brief_l), document.createTextNode(t.fm[brief.fmt][0] + " · " + t.b_goal[brief.goal]));
  if (calc) s.append(el("small", null, t.calc_l), document.createTextNode(t.calc_s.replace("{r}", fmt(calc.reach)).replace("{n}", fmt(calc.extra))));
  const x = el("button", "bx"); x.type = "button"; x.setAttribute("aria-label", t.remove); x.append(icon("x"));
  x.addEventListener("click", () => { brief = null; calc = null; renderBrief(); });
  box.append(s, x);
}

/* ---------- viewing room ---------- */
const room = $("#room"), rv = $("#room-v");
function openRoom(i){
  if (i < 0) return;
  openIdx = i; rv.src = "media/" + CASES[i].video + ".mp4"; rv.poster = "media/" + CASES[i].video + ".jpg"; fillRoom();
  if (room.showModal) room.showModal(); else room.setAttribute("open", "");
  if (M()) M().pause(true);
  const p = rv.play(); if (p && p.catch) p.catch(() => {});
}
function fillRoom(){
  if (openIdx < 0) return;
  const t = T(), c = CASES[openIdx], [task, concept] = c.t[lang] || c.t.en;
  $("#room-title").textContent = c.client; $("#room-x").setAttribute("aria-label", t.close); $("#room-c").textContent = concept;
  const dl = $("#room-dl"); dl.replaceChildren();
  const add = (k, node) => { const d = el("div"); d.append(el("dt", null, k)); const dd = el("dd"); if (typeof node === "string") dd.textContent = node; else dd.append(node); d.append(dd); dl.append(d); };
  add(t.l_exec, c.exec); add(t.l_task, task);
  const s = el("span", "sl"); c.scope.forEach(k => s.append(el("span", null, t.sc[k]))); add(t.l_scope, s);
  const cr = el("div", "cr"); c.credits.forEach(([role, ids]) => { const row = el("div"); row.append(el("span", "r", t[role]), el("span", ids.includes("AB") ? "me" : null, ids.map(id => pname(id, lang)).join(lang === "ar" ? "، " : ", "))); cr.append(row); });
  add(t.l_team, cr);
  const tabs = $("#room-tabs"); tabs.replaceChildren(); tabs.hidden = !c.bts;
  if (c.bts) [[t.v_film, c.video], [t.v_bts, c.bts.video]].forEach(([label, src]) => {
    const b = el("button", null, label); b.type = "button"; b.setAttribute("aria-pressed", String(rv.src.endsWith("/" + src + ".mp4")));
    b.addEventListener("click", () => { rv.src = "media/" + src + ".mp4"; rv.poster = "media/" + src + ".jpg"; const p = rv.play(); if (p && p.catch) p.catch(() => {}); tabs.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); });
    tabs.append(b);
  });
}
function closeRoom(){ rv.pause(); if (room.open) room.close(); }
$("#room-x").addEventListener("click", closeRoom);
room.addEventListener("click", e => { if (e.target === room) closeRoom(); });
room.addEventListener("close", () => { rv.pause(); rv.removeAttribute("src"); rv.load(); openIdx = -1; if (M()) M().pause(false); });

/* ---------- 10 request: three frames ---------- */
const SHOTS = [
  { img: "media/portrait.jpg", pos: "30% 40%" },
  { img: "media/abror-timessquare.jpg", pos: "50% 38%" },
  { img: "media/sales-doctor-backstage.jpg", pos: "50% 45%" }
];
function renderFrames(){
  const t = T(), box = $("#frames"), first = !box.children.length;
  if (first) SHOTS.forEach((s, i) => {
    const f = el("figure", "frame"), ph = el("div", "ph"), im = el("img"); im.loading = "lazy"; im.decoding = "async"; im.src = s.img; im.alt = ""; im.style.objectPosition = s.pos;
    ph.append(im); const cap = el("figcaption"); cap.append(el("b", null, String(i + 1).padStart(2, "0")), el("h3")); f.append(ph, cap); box.append(f);
  });
  $$("#frames .frame").forEach((f, i) => { f.querySelector("h3").textContent = t.nx[i]; f.querySelector("img").alt = i < 2 ? t.name : ""; });
  if (!MOVES) $$("#frames .ph").forEach(p => p.style.setProperty("--cr", "75%"));
}

/* ---------- contacts, footer wordmark, scene rail ---------- */
function contactHref(i, v){ const h = String(v).replace(/^@/, ""); return ["tel:" + String(v).replace(/[^\d+]/g, ""), "https://t.me/" + h, "https://instagram.com/" + h, "mailto:" + v][i]; }
function renderMark(){
  const fm = $("#fm"); if (fm.children.length) return;
  "AB MEDIA".split("").forEach(ch => fm.append(ch === " " ? el("span", "sp") : el("span", "ch", ch)));
}
const RAIL = ["top", "manifest", "journey", "diff", "cases", "fixes", "why", "how", "plan", "request", "faq"];
function renderRail(){
  const t = T(), r = $("#rail"); r.replaceChildren();
  RAIL.forEach(id => { const a = el("a"); a.href = "#" + id; a.dataset.s = id; a.append(el("span", null, t.scene[id] || ""), el("i")); r.append(a); });
  setScene(scene);
}
function setScene(id){
  scene = id;
  $$("#rail a").forEach(a => a.classList.toggle("on", a.dataset.s === id));
  const map = { journey: 0, diff: 0, cases: 1, fixes: 1, why: 1, how: 2, plan: 2, faq: 3 };
  $$("#nav a").forEach((a, i) => a.classList.toggle("on", map[id] === i));
}

/* ---------- reveals ---------- */
let revealIO = null;
function bindReveals(){
  if (!revealIO) revealIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); revealIO.unobserve(e.target); } }), { rootMargin: "0px 0px -10% 0px" });
  $$(".rv:not(.in), .reasons:not(.in)").forEach(n => revealIO.observe(n));
}

/* ---------- FAQ: answers open with a measured height ---------- */
function renderFaq(){
  const fq = $("#faqlist"); fq.replaceChildren();
  T().faq.forEach(([q, a]) => {
    const d = el("details"), s = el("summary"); s.append(el("span", null, q), el("i"));
    const box = el("div", "a"); box.append(el("p", null, a)); d.append(s, box); fq.append(d);
    s.addEventListener("click", e => {
      if (reduce || !box.animate) return;
      e.preventDefault();
      if (d.open) { const h = box.offsetHeight; d.classList.add("closing"); box.animate([{ height: h + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 380, easing: "cubic-bezier(.65,0,.35,1)" }).onfinish = () => { d.open = false; d.classList.remove("closing"); }; }
      else { d.open = true; const h = box.offsetHeight; box.animate([{ height: "0px", opacity: 0 }, { height: h + "px", opacity: 1 }], { duration: 480, easing: "cubic-bezier(.16,1,.3,1)" }); }
    });
  });
}

/* ---------- full render ---------- */
const WHY_IC = ["reel", "clap", "link", "target"];
function render(){
  const t = T();
  root.lang = lang; root.dir = lang === "ar" ? "rtl" : "ltr";
  $$("[data-i]").forEach(n => { const v = t[n.dataset.i]; if (typeof v === "string") n.textContent = v; });
  $$(".langs button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  $$("#nav a").forEach((a, i) => { a.textContent = t.nav[i]; });
  $("#offer").hidden = DATA.offer_bar === false || left < 0;
  $("#bar-t").replaceChildren(el("span", "bar-l", t.bar.replace("5", String(DATA.offer_minutes)) + " "), el("b", null, tr(DATA.bonus)));
  $("#why-img").alt = t.alt_p;
  renderHero(); nowTag();
  renderManifest();
  renderTicker();
  renderStory();
  renderJourney();
  renderDuel();
  renderCases();
  renderFixes();
  const rs = $("#reasons"); rs.replaceChildren();
  t.why.forEach((h, i) => { const li = el("li"); li.style.setProperty("--d", i * 140); li.append(icon(WHY_IC[i]), el("span", null, h)); rs.append(li); });
  renderProcess();
  renderBuilder();
  renderFrames();
  $("#slots").textContent = fill(t.slots, DATA.slots);
  renderBrief();
  $$(".err[data-k], #send-err[data-k]").forEach(n => { if (!n.hidden) n.textContent = t[n.dataset.k]; });
  if (!$("#done").hidden) $("#done-msg").textContent = t.ok.replace("{n}", lastName);
  renderFaq();
  const ct = $("#contacts"); ct.replaceChildren();
  const cv = DATA.contacts;
  [cv.phone, cv.telegram, cv.instagram, cv.email].forEach((v, i) => {
    const d = el("a", "ct"); d.href = contactHref(i, v); if (i === 1 || i === 2) { d.target = "_blank"; d.rel = "noopener"; }
    d.append(el("span", null, t.ct[i]), el("b", null, v)); ct.append(d);
  });
  renderMark(); renderRail();
  fillRoom();
  bindReveals();
  if (M()) { M().develop(); M().bindSteps(); M().refresh(); }
  if (FX.word && FX.word.layout) FX.word.layout();
}

$$(".langs button").forEach(b => b.addEventListener("click", () => { if (b.dataset.lang === lang) return; lang = b.dataset.lang; store.set("abm2-lang", lang); render(); }));

/* ---------- form ---------- */
const form = $("#form");
function setErr(input, id, key){
  const e = $("#" + id);
  if (key) { e.dataset.k = key; e.textContent = T()[key]; e.hidden = false; input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", id); }
  else { delete e.dataset.k; e.hidden = true; input.removeAttribute("aria-invalid"); input.removeAttribute("aria-describedby"); }
}
function utm(){ const q = new URLSearchParams(location.search), o = {}; ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(k => { const v = q.get(k); if (v) o[k] = v.slice(0, 100); }); return o; }
const FIELD = { name: ["#f-name", "e-name", "e_name"], phone: ["#f-phone", "e-phone", "e_phone"], email: ["#f-email", "e-email", "e_email"] };
form.addEventListener("submit", async e => {
  e.preventDefault();
  const t = T(), n = $("#f-name"), p = $("#f-phone"), m = $("#f-email"), btn = form.querySelector('button[type="submit"]'), se = $("#send-err");
  const okN = n.value.trim().length >= 2;
  const digits = p.value.replace(/\D/g, "");
  const okP = /^\+?[\d\s().-]+$/.test(p.value.trim()) && digits.length >= 7 && digits.length <= 15;
  const okM = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m.value.trim());
  setErr(n, "e-name", okN ? null : "e_name"); setErr(p, "e-phone", okP ? null : "e_phone"); setErr(m, "e-email", okM ? null : "e_email");
  if (!okN) return n.focus(); if (!okP) return p.focus(); if (!okM) return m.focus();
  se.hidden = true;
  const lead = { name: n.value.trim(), phone: p.value.trim(), email: m.value.trim(), lang, brief, calc, website: $("#f-web").value, utm: utm(), page: location.pathname, referrer: document.referrer.slice(0, 300) };
  const label = btn.querySelector("span"); btn.disabled = true; label.textContent = t.sending;
  const fail = key => { btn.disabled = false; label.textContent = T().f_btn; se.dataset.k = key; se.textContent = T()[key]; se.hidden = false; };
  /* the static preview has no server behind it: show the success state without sending */
  if (!window.ABM_PREVIEW) try {
    const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) });
    if (res.status === 422) { const j = await res.json().catch(() => ({})); const f = FIELD[j.field]; btn.disabled = false; label.textContent = T().f_btn; if (f) { setErr($(f[0]), f[1], f[2]); $(f[0]).focus(); } else fail("e_send"); return; }
    if (res.status === 429) return fail("e_rate");
    if (!res.ok) throw new Error("HTTP " + res.status);
  } catch (err) { return fail("e_send"); }
  btn.disabled = false; label.textContent = T().f_btn;
  lastName = lead.name;
  form.hidden = true; $("#done").hidden = false;
  $("#done-msg").textContent = T().ok.replace("{n}", lastName);
  $("#done-h").focus({ preventScroll: true });
});
Object.values(FIELD).forEach(([s, id]) => $(s).addEventListener("input", e => { if (e.target.getAttribute("aria-invalid")) setErr(e.target, id, null); }));
$("#again").addEventListener("click", () => { form.reset(); brief = null; calc = null; renderBrief(); $("#done").hidden = true; form.hidden = false; $("#f-name").focus(); });

/* ---------- offer timer ---------- */
let left = (DATA.offer_minutes || 5) * 60; const tm = $("#timer");
const tick = () => { if (left < 0) return; tm.textContent = String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0"); if (left === 0) { clearInterval(cd); $("#offer").hidden = true; } left--; };
const cd = setInterval(tick, 1000); tick();

/* ---------- cursor, magnetic buttons, footer light (real pointers only) ---------- */
if (finePointer && !reduce) {
  root.classList.add("has-cursor");
  const cur = $("#cursor"); let x = -100, y = -100, rx = -100, ry = -100;
  addEventListener("pointermove", e => {
    x = e.clientX; y = e.clientY;
    const tg = e.target;
    const play = !!(tg.closest && tg.closest('[data-cursor="play"]'));
    cur.classList.toggle("play", play);
    cur.classList.toggle("hot", !play && !!(tg.closest && tg.closest("a,button,label,summary,input")));
  }, { passive: true });
  (function loop(){ rx += (x - rx) * .2; ry += (y - ry) * .2; cur.style.setProperty("--dx", x + "px"); cur.style.setProperty("--dy", y + "px"); cur.style.setProperty("--rx", rx.toFixed(1) + "px"); cur.style.setProperty("--ry", ry.toFixed(1) + "px"); requestAnimationFrame(loop); })();
  document.addEventListener("pointermove", e => {
    const b = e.target.closest && e.target.closest(".mag"); if (!b) return;
    const r = b.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    b.style.setProperty("--mx", (dx * .2).toFixed(1) + "px"); b.style.setProperty("--my", (dy * .3).toFixed(1) + "px");
    b.style.setProperty("--hx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%"); b.style.setProperty("--hy", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
  }, { passive: true });
  document.addEventListener("pointerout", e => { const b = e.target.closest && e.target.closest(".mag"); if (b && !b.contains(e.relatedTarget)) { b.style.setProperty("--mx", "0px"); b.style.setProperty("--my", "0px"); } });
  const fm = $("#fm");
  addEventListener("pointermove", e => {
    const r = fm.getBoundingClientRect(); if (e.clientY < r.top - 300 || e.clientY > r.bottom + 300) return;
    fm.querySelectorAll(".ch").forEach(s => { const b = s.getBoundingClientRect(); s.style.setProperty("--lx", ((e.clientX - b.left) / b.width * 100).toFixed(1) + "%"); s.style.setProperty("--ly", ((e.clientY - b.top) / b.height * 100).toFixed(1) + "%"); });
  }, { passive: true });
}

/* ---------- start ---------- */
if (FX.grain) FX.grain($("#grain"));
const word = FX.word ? FX.word($("#hero-mask")) : null;
const beam = FX.beam ? FX.beam($("#beam"), $("#hero-pin")) : { k: 1 };
river = FX.river ? FX.river($("#river-cv"), $("#river"), $("#gates")) : null;
render();
initReel();
function finalStates(){
  setManifest(1); setStoryStep(3); setDuel(1); if (word) word.set(0);
  $$(".fx").forEach(x => { x.classList.add("hit"); x.querySelector(".fx-new span").textContent = x.dataset.fix; });
  $$("#hero-line .ch").forEach(c => c.style.transform = "none"); $("#offer").classList.remove("away");
  $$(".dev").forEach(d => d.style.setProperty("--neg", 0)); $$("#frames .ph").forEach(p => p.style.setProperty("--cr", "75%"));
  $$(".step").forEach(s => s.classList.add("on")); $$("#tk .odo").forEach(odoRoll);
}
const motionOK = !!(window.ABM_MOTION && window.ABM_MOTION.init({
  setStory, setScene, setDuel, setStep, reduce, beam, finalStates, rollTicker,
  manifest: setManifest, zoom: z => word && word.set(z), menuOpen: () => false,
  layout: () => { if (river) river.layout(); if (word) word.layout(); segKnob($("#jmode")); segKnob($("#modes")); },
  introSeen: !!store.get("abm2-intro", true), markIntro: () => store.set("abm2-intro", "1", true)
}));
if (!motionOK) { root.classList.add("no-motion"); const l = $("#leader"); if (l) l.classList.add("done"); finalStates(); }
addEventListener("resize", () => { segKnob($("#jmode")); segKnob($("#modes")); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { segKnob($("#jmode")); segKnob($("#modes")); if (M()) M().refresh(); });
})();
