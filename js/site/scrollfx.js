/* ============================================================
   Animações ligadas à rolagem (sem bibliotecas):
   - barra de progresso tricolor
   - parallax por camadas ([data-depth])
   - faixa de sabores que acelera/inclina com a velocidade da rolagem
   - cartões que entram em 3D quando aparecem na tela
   Tudo desliga com "reduzir movimento".
   ============================================================ */
import { reducedMotion } from "./util.js";

const RM = reducedMotion();
const state = { y: window.scrollY, lastY: window.scrollY, vel: 0, raf: 0, t: 0 };
const depthEls = [];
let marquee = null;

function measure() {
  for (const d of depthEls) {
    const host = d.el.parentElement;
    const r = host.getBoundingClientRect();
    d.top = r.top + window.scrollY;
    d.h = r.height;
  }
}

function update(now) {
  state.raf = 0;
  const dt = Math.min(0.05, state.t ? (now - state.t) / 1000 : 0.016);
  state.t = now;
  const y = window.scrollY;
  const instant = (y - state.lastY) / Math.max(dt, 0.001);
  state.lastY = y;
  state.vel += (instant - state.vel) * Math.min(1, dt * 8);

  // barra de progresso
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const bar = document.getElementById("scrollProgress");
  if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;

  if (!RM) {
    const vh = window.innerHeight, mid = y + vh / 2;
    for (const d of depthEls) {
      if (d.top > mid + vh * 1.5 || d.top + d.h < mid - vh * 1.5) continue;
      const off = (d.top + d.h / 2 - mid) * d.depth;
      d.el.style.setProperty("--py", `${off.toFixed(1)}px`);
    }
    if (marquee && marquee.visible) {
      const speed = 60 + Math.min(900, Math.abs(state.vel) * 0.35);
      marquee.dir = state.vel < -40 ? 1 : state.vel > 40 ? -1 : marquee.dir;
      marquee.x += marquee.dir * speed * dt;
      const half = marquee.track.scrollWidth / 2 || 1;
      if (marquee.x < -half) marquee.x += half;
      if (marquee.x > 0) marquee.x -= half;
      const skew = Math.max(-8, Math.min(8, state.vel * -0.004));
      marquee.track.style.transform = `translate3d(${marquee.x.toFixed(1)}px,0,0) skewX(${skew.toFixed(2)}deg)`;
    }
  }
  // continua animando enquanto houver movimento (ou a faixa estiver visível)
  if (Math.abs(state.vel) > 2 || (marquee && marquee.visible && !RM)) state.raf = requestAnimationFrame(update);
  else state.t = 0;
}

const kick = () => { if (!state.raf) state.raf = requestAnimationFrame(update); };

export function initScrollFx() {
  document.querySelectorAll("[data-depth]").forEach((el) => depthEls.push({ el, depth: Number(el.dataset.depth) || 0, top: 0, h: 0 }));
  const track = document.getElementById("marqueeTrack");
  if (track && !RM) {
    document.documentElement.classList.add("js-marquee");
    marquee = { track, x: 0, dir: -1, visible: true };
    new IntersectionObserver(([e]) => { marquee.visible = e.isIntersecting; if (e.isIntersecting) kick(); }).observe(track.parentElement);
  }
  measure();
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", () => { measure(); kick(); });
  if ("ResizeObserver" in window) new ResizeObserver(() => { measure(); kick(); }).observe(document.body);
  kick();
}

/* ---------- Cartões que entram em 3D ---------- */
let cardObserver;
export function observeCards(root) {
  const cards = root.querySelectorAll(".card:not(.seen)");
  if (RM || !("IntersectionObserver" in window)) { cards.forEach((c) => c.classList.add("seen")); return; }
  cardObserver ||= new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("seen");
    cardObserver.unobserve(e.target);
  }), { rootMargin: "0px 0px -6% 0px", threshold: 0.08 });
  const vh = window.innerHeight;
  cards.forEach((c, i) => {
    // cartões que já estão na tela aparecem na hora; só os de baixo esperam a rolagem
    if (c.getBoundingClientRect().top < vh * 0.92) { c.classList.add("seen"); return; }
    c.style.setProperty("--d", `${(i % 4) * 70}ms`);
    c.classList.add("pre");
    cardObserver.observe(c);
  });
  scheduleSafety();
}

/** Garantia: se o aviso de "entrou na tela" atrasar, nenhum cartão visível fica escondido. */
let safetyTimer = 0;
function scheduleSafety() {
  clearTimeout(safetyTimer);
  safetyTimer = setTimeout(() => {
    const vh = window.innerHeight;
    document.querySelectorAll(".card.pre:not(.seen)").forEach((c) => {
      if (c.getBoundingClientRect().top < vh) { c.classList.add("seen"); cardObserver?.unobserve(c); }
    });
    document.querySelectorAll(".reveal:not(.in)").forEach((el) => {
      if (el.getBoundingClientRect().top < vh) el.classList.add("in");
    });
  }, 900);
}
window.addEventListener("scroll", () => { if (document.querySelector(".card.pre:not(.seen), .reveal:not(.in)")) scheduleSafety(); }, { passive: true });
