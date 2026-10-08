/* ============================================================
   Animações ligadas à rolagem (no laço único de motion.js):
   - barra de progresso tricolor (CSS puro quando o navegador suporta)
   - parallax por camadas ([data-depth]) com medidas em cache
   - faixa de sabores que acelera/inclina com a velocidade da rolagem
   - "Como pedir": a caixa abre e os passos acendem conforme a rolagem
   - traço de molho desenhado à mão sob os títulos, pintado pela rolagem
   - cartões que entram em 3D quando aparecem na tela
   Nada aqui lê o layout a cada quadro: as medidas só mudam em resize.
   ============================================================ */
import { ticker, motion, onReducedMotion } from "./motion.js";

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const scrollTimeline = typeof CSS !== "undefined" && CSS.supports?.("animation-timeline: scroll()");

const depthEls = [];
const swashes = []; // { path, len, top, last }
let bar = null, maxScroll = 1, lastY = -1, dirty = true;
let marquee = null;
const story = { el: null, pin: null, steps: [], top: 0, h: 1, pinned: false, p: 0, active: -1 };

/* ---------- Medidas (só em resize / mudança de altura da página) ---------- */
function measure() {
  for (const d of depthEls) {
    const r = d.host.getBoundingClientRect();
    d.top = r.top + window.scrollY;
    d.h = r.height;
  }
  for (const w of swashes) w.top = w.svg.getBoundingClientRect().top + window.scrollY;
  maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  if (story.el) {
    const r = story.el.getBoundingClientRect();
    story.top = r.top + window.scrollY;
    story.h = r.height;
    story.pinned = !!story.pin && getComputedStyle(story.pin).position === "sticky";
  }
  dirty = true;
  ticker.wake();
}

/* ---------- Quadro ---------- */
function parallax(y, vh) {
  const mid = y + vh / 2;
  for (const d of depthEls) {
    if (d.top > mid + vh * 1.5 || d.top + d.h < mid - vh * 1.5) continue;
    const off = (d.top + d.h / 2 - mid) * d.depth;
    if (Math.abs(off - d.last) < 0.25) continue;
    d.last = off;
    d.el.style.setProperty("--py", `${off.toFixed(1)}px`);
  }
}

function updateStory(y, vh) {
  if (!story.el) return;
  // fixa na tela (computador): 0→1 enquanto a seção está presa; senão: 0→1 enquanto atravessa a tela
  const p = story.pinned
    ? clamp01((y - story.top) / Math.max(1, story.h - vh))
    : clamp01((y + vh * 0.95 - story.top) / (vh * 0.7 + story.h));
  if (Math.abs(p - story.p) > 0.001 || story.active < 0) {
    story.p = p;
    story.el.style.setProperty("--story", p.toFixed(3));
  }
  const idx = p < 0.3 ? 0 : p < 0.62 ? 1 : 2;
  if (idx !== story.active) {
    story.active = idx;
    story.steps.forEach((s, i) => { s.classList.toggle("is-active", i === idx); s.classList.toggle("is-done", i < idx); });
  }
}
/** Progresso (0–1) da história da caixa — usado pelo 3D. */
export const getStoryProgress = () => story.p;

/** O traço aparece enquanto o título sobe do pé da tela até perto do meio. */
function drawSwashes(y, vh) {
  for (const w of swashes) {
    const top = w.top - y;
    const p = motion.reduced ? 1 : clamp01((vh * 0.96 - top) / (vh * 0.38));
    if (Math.abs(p - w.last) < 0.004) continue;
    w.last = p;
    w.path.style.strokeDashoffset = (w.len * (1 - p)).toFixed(1);
    w.svg.classList.toggle("done", p >= 0.999);
  }
}

function update(f) {
  const y = f.y;
  if (y !== lastY || dirty) {
    lastY = y;
    dirty = false;
    if (!scrollTimeline && bar) bar.style.transform = `scaleX(${Math.min(1, y / maxScroll).toFixed(4)})`;
    if (!motion.reduced) parallax(y, f.vh);
    drawSwashes(y, f.vh);
    updateStory(y, f.vh);
  }
  if (marquee && marquee.visible && !motion.reduced) {
    const speed = 60 + Math.min(900, Math.abs(f.vel) * 0.35);
    marquee.dir = f.vel < -40 ? 1 : f.vel > 40 ? -1 : marquee.dir;
    marquee.x += marquee.dir * speed * f.dt;
    const half = marquee.half || 1;
    if (marquee.x < -half) marquee.x += half;
    if (marquee.x > 0) marquee.x -= half;
    const skew = Math.max(-8, Math.min(8, f.vel * -0.004));
    marquee.track.style.transform = `translate3d(${marquee.x.toFixed(1)}px,0,0) skewX(${skew.toFixed(2)}deg)`;
    return true; // a faixa anda sozinha enquanto está na tela
  }
  return false;
}

export function initScrollFx() {
  bar = document.getElementById("scrollProgress");
  if (scrollTimeline) document.documentElement.classList.add("sdt");

  document.querySelectorAll("[data-depth]").forEach((el) => depthEls.push({ el, host: el.parentElement, depth: Number(el.dataset.depth) || 0, top: 0, h: 0, last: 0 }));

  const track = document.getElementById("marqueeTrack");
  if (track && !motion.reduced) {
    document.documentElement.classList.add("js-marquee");
    marquee = { track, x: 0, dir: -1, visible: true, half: 0 };
    const measureTrack = () => { marquee.half = track.scrollWidth / 2; };
    new IntersectionObserver(([e]) => { marquee.visible = e.isIntersecting; if (e.isIntersecting) { measureTrack(); ticker.wake(); } }).observe(track.parentElement);
    if ("ResizeObserver" in window) new ResizeObserver(measureTrack).observe(track);
  }

  // traço de molho sob os títulos marcados com data-swash
  const SWASH = "M4 17C40 6 70 22 108 13s62-9 98 1 60 8 90-5";
  document.querySelectorAll("[data-swash]").forEach((title) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 300 26");
    svg.setAttribute("class", `swash ${title.dataset.swash}`);
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = `<path d="${SWASH}"/><circle cx="292" cy="20" r="2.4"/><circle cx="283" cy="23" r="1.6"/>`;
    title.after(svg);
    const path = svg.querySelector("path");
    const len = Math.ceil(path.getTotalLength?.() || 320);
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;
    swashes.push({ svg, path, len, top: 0, last: -1 });
  });

  story.el = document.getElementById("como-funciona");
  story.pin = story.el?.querySelector(".steps-pin") || null;
  story.steps = story.el ? [...story.el.querySelectorAll(".step")] : [];

  measure();
  window.addEventListener("resize", measure, { passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(document.body);
  onReducedMotion((r) => { if (r) depthEls.forEach((d) => { d.el.style.removeProperty("--py"); d.last = 0; }); measure(); });
  ticker.add(update);
  ticker.add(safetyTick);
}

/* ---------- Cartões que entram em 3D ---------- */
let cardObserver;
function settle(card) {
  cardObserver?.unobserve(card);
  if (card.classList.contains("seen")) return;
  card.classList.add("seen");
  // terminada a entrada, tira a transição longa (senão o tilt do mouse fica atrasado)
  let done = false;
  const onEnd = (ev) => { if (ev.target === card && ev.propertyName === "transform") finish(); };
  const finish = () => {
    if (done) return;
    done = true;
    card.removeEventListener("transitionend", onEnd);
    card.classList.remove("pre");
    card.style.removeProperty("--d");
  };
  card.addEventListener("transitionend", onEnd);
  setTimeout(finish, 1600);
}

export function observeCards(root) {
  const cards = [...root.querySelectorAll(".card:not(.seen)")];
  if (motion.reduced || !("IntersectionObserver" in window)) { cards.forEach((c) => c.classList.add("seen")); return; }
  cardObserver ||= new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) settle(e.target); }), { rootMargin: "0px 0px -6% 0px", threshold: 0.08 });
  const vh = window.innerHeight;
  // lê todas as posições ANTES de mexer nas classes (evita recalcular o layout a cada cartão)
  const tops = cards.map((c) => c.getBoundingClientRect().top);
  cards.forEach((c, i) => {
    // cartões que já estão na tela aparecem na hora; só os de baixo esperam a rolagem
    if (tops[i] < vh * 0.92) { c.classList.add("seen"); return; }
    c.style.setProperty("--d", `${(i % 4) * 70}ms`);
    c.classList.add("pre");
    cardObserver.observe(c);
  });
  requestSafety();
}

/* ---------- Garantia: se o aviso de "entrou na tela" atrasar, nada visível fica escondido ---------- */
let needsSafety = false, safetyAt = 0, safetyTimer = 0;
function runSafety() {
  const vh = window.innerHeight;
  const els = document.querySelectorAll(".card.pre:not(.seen), .reveal:not(.in), .split:not(.in)");
  const tops = [...els].map((el) => el.getBoundingClientRect().top);
  let left = 0;
  els.forEach((el, i) => {
    if (tops[i] >= vh) { left++; return; }
    if (el.classList.contains("card")) settle(el);
    else el.classList.add("in");
  });
  needsSafety = left > 0;
}
function safetyTick(f) {
  if (needsSafety && f.t >= safetyAt) { safetyAt = f.t + 0.5; runSafety(); }
  return false;
}
export function requestSafety() {
  needsSafety = true;
  clearTimeout(safetyTimer);
  safetyTimer = setTimeout(runSafety, 900);
}
