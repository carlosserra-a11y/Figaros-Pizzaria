/* ============================================================
   Animações e interações: farinha no fundo, brasas, ingredientes
   flutuando, inclinação 3D dos cartões, "voar para o carrinho",
   confete e revelar ao rolar (com títulos palavra por palavra).
   Tudo roda no laço único (motion.js) e respeita "reduzir movimento".
   ============================================================ */
import { finePointer } from "./util.js";
import { ticker, motion } from "./motion.js";
import { requestSafety } from "./scrollfx.js";

/* ---------- Partículas num canvas (farinha / brasas) ---------- */
// Brilho pré-desenhado (antes: shadowBlur por partícula a cada quadro, muito caro)
const glowCache = new Map();
function glowSprite(color) {
  if (glowCache.has(color)) return glowCache.get(color);
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, color);
  grad.addColorStop(0.18, color);
  grad.addColorStop(0.42, `${color}66`);
  grad.addColorStop(1, `${color}00`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowCache.set(color, c);
  return c;
}

function particleCanvas(canvas, { count, color, rise, size, glow = false, onlyWhenVisible = null }) {
  if (motion.reduced || !canvas) return null;
  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, dpr = 1, running = false, disabled = false, visible = !onlyWhenVisible;
  const parts = [];
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5); // partículas pequenas: mais resolução não aparece, só custa
    w = canvas.clientWidth; h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const spawn = (p = {}, initial = false) => Object.assign(p, {
    x: Math.random() * w,
    y: initial ? Math.random() * h : (rise > 0 ? h + 10 : -10),
    r: size[0] + Math.random() * (size[1] - size[0]),
    vy: (0.15 + Math.random() * 0.45) * (rise > 0 ? -1 : 1) * Math.abs(rise),
    vx: (Math.random() - 0.5) * 0.25,
    a: 0.25 + Math.random() * 0.55,
    t: Math.random() * Math.PI * 2,
    c: color[Math.floor(Math.random() * color.length)],
  });
  const tick = (f) => {
    if (!running || disabled || motion.reduced || !w) return false;
    const k = f.dt * 60; // velocidade igual em 60, 120 ou 144 Hz
    ctx.clearRect(0, 0, w, h);
    if (glow) ctx.globalCompositeOperation = "lighter";
    for (const p of parts) {
      p.t += 0.012 * k; p.x += (p.vx + Math.sin(p.t) * 0.2) * k; p.y += p.vy * k;
      if (p.y < -12 || p.y > h + 12 || p.x < -12 || p.x > w + 12) spawn(p);
      if (glow) {
        ctx.globalAlpha = p.a * (0.6 + Math.sin(p.t * 5) * 0.4);
        const s = p.r * 2 + 24;
        ctx.drawImage(glowSprite(p.c), p.x - s / 2, p.y - s / 2, s, s);
      } else {
        ctx.globalAlpha = p.a;
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    return true;
  };
  const sync = () => { running = visible && !document.hidden && !disabled; if (running) ticker.wake(); };
  resize();
  for (let i = 0; i < count; i++) parts.push(spawn({}, true));
  if ("ResizeObserver" in window) new ResizeObserver(() => { resize(); }).observe(canvas);
  else window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", sync);
  if (onlyWhenVisible) new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(onlyWhenVisible);
  ticker.add(tick);
  sync();
  return {
    disable() {
      disabled = true; running = false;
      // libera a memória do canvas (antes ficava um buffer de tela cheia alocado à toa)
      canvas.width = canvas.height = 0;
    },
  };
}

let flour = null;
/** O fundo 3D substitui a farinha 2D: desliga o laço dela para não gastar processamento. */
export const disableFlour = () => flour?.disable();

export function initBackgroundFx() {
  const small = window.innerWidth < 640;
  flour = particleCanvas(document.getElementById("fxCanvas"), { count: small ? 18 : 38, color: ["#fffdf8", "#e3a93b", "#ebdfc4"], rise: 0.6, size: [1.2, 3.4] });
  particleCanvas(document.getElementById("emberCanvas"), { count: small ? 26 : 56, color: ["#ff8a3d", "#e3a93b", "#ff5a1f", "#c0463d"], rise: 1.4, size: [1, 2.8], glow: true, onlyWhenVisible: document.getElementById("sobre") });
}

/* ---------- Ingredientes flutuando no topo (versão 2D, sem WebGL) ---------- */
const SVG = {
  basil: '<svg viewBox="0 0 64 64"><path d="M32 4C14 14 8 34 14 52c2 5 6 8 10 8 16-6 30-24 28-42-1-6-8-12-20-14Z" fill="#3f8a3b"/><path d="M18 56C26 40 34 26 46 12" stroke="#2b6327" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M26 42c4-1 8 0 11 2M30 32c4 0 7 1 10 3M34 23c3 0 6 1 8 2" stroke="#2b6327" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/></svg>',
  tomato: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="#d63a2f"/><circle cx="32" cy="32" r="22" fill="#ef5b45"/><g fill="#f9d3a8"><ellipse cx="32" cy="18" rx="4" ry="6"/><ellipse cx="45" cy="38" rx="6" ry="4" transform="rotate(-30 45 38)"/><ellipse cx="19" cy="38" rx="6" ry="4" transform="rotate(30 19 38)"/></g><circle cx="32" cy="33" r="4" fill="#f6b39a"/></svg>',
  olive: '<svg viewBox="0 0 64 64"><ellipse cx="32" cy="32" rx="22" ry="18" fill="#2b2420"/><ellipse cx="32" cy="32" rx="9" ry="7" fill="#e8d6b0"/><ellipse cx="25" cy="24" rx="6" ry="3" fill="#fff" opacity=".25"/></svg>',
  pepperoni: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" fill="#b8322a"/><circle cx="32" cy="32" r="27" fill="none" stroke="#8e2219" stroke-width="3"/><g fill="#f1c27d" opacity=".9"><circle cx="22" cy="24" r="3"/><circle cx="40" cy="20" r="2.5"/><circle cx="42" cy="40" r="3"/><circle cx="25" cy="42" r="2.2"/><circle cx="33" cy="31" r="2"/></g></svg>',
  mushroom: '<svg viewBox="0 0 64 64"><path d="M8 34C8 18 20 8 32 8s24 10 24 26c0 3-3 5-6 5H14c-3 0-6-2-6-5Z" fill="#c9a27a"/><path d="M24 39h16l-2 17c0 2-2 3-4 3h-4c-2 0-4-1-4-3Z" fill="#efe2cc"/><path d="M14 30c6-4 30-4 36 0" stroke="#a37a52" stroke-width="2" fill="none" opacity=".6"/></svg>',
  chili: '<svg viewBox="0 0 64 64"><path d="M50 10c-4 0-6 3-6 6-14 4-30 18-36 40 14-4 34-14 40-30 3-1 6-4 6-8 0-4-1-8-4-8Z" fill="#d9302b"/><path d="M44 16c2-4 6-8 10-9" stroke="#2f7a2b" stroke-width="4" stroke-linecap="round" fill="none"/></svg>',
  cheese: '<svg viewBox="0 0 64 64"><path d="M6 44 54 14l4 6v30H6Z" fill="#f2c14e"/><path d="M6 44h52v6H6Z" fill="#dca234"/><g fill="#d39a2b"><circle cx="24" cy="38" r="4"/><circle cx="42" cy="30" r="3"/><circle cx="46" cy="44" r="3.5"/></g></svg>',
};

export function initFloaters() {
  const wrap = document.getElementById("floaters");
  const hero = document.getElementById("heroVisual");
  if (!wrap || !hero) return;
  const items = [
    ["basil", 6, 12, 64, -20, 10], ["tomato", 82, 4, 58, 0, 25], ["olive", 92, 56, 34, 0, -20], ["pepperoni", 2, 62, 52, 10, 40],
    ["mushroom", 70, 86, 50, -10, 15], ["chili", 40, -4, 50, 30, 50], ["cheese", 20, 88, 48, -6, 12], ["basil", 88, 30, 40, 40, 70],
  ];
  wrap.innerHTML = items.map(([k, x, y, s, r0, r1], i) =>
    `<span class="floater" data-depth="${(0.4 + (i % 4) * 0.25).toFixed(2)}" style="left:${x}%;top:${y}%;--s:${s}px;--d:${5 + (i % 4)}s;--delay:${(i * 0.7).toFixed(1)}s;--r0:${r0}deg;--r1:${r1}deg">${SVG[k]}</span>`).join("");
  if (!finePointer()) return;
  const board = hero.querySelector(".board");
  const floaters = [...wrap.children];
  let tx = 0, ty = 0, cx = 0, cy = 0;
  // mouse + parallax da rolagem compostos pelo CSS (--fx/--fy somam com --py): um não apaga o outro
  ticker.add(() => {
    if (motion.reduced || hero.classList.contains("is-3d")) return false;
    if (Math.abs(tx - cx) < 0.001 && Math.abs(ty - cy) < 0.001) return false;
    cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
    board.style.transform = `rotateX(${(-cy * 10).toFixed(2)}deg) rotateY(${(cx * 12).toFixed(2)}deg)`;
    floaters.forEach((f) => {
      const d = +f.dataset.depth;
      f.style.setProperty("--fx", `${(cx * 40 * d).toFixed(1)}px`);
      f.style.setProperty("--fy", `${(cy * 40 * d).toFixed(1)}px`);
    });
    return true;
  });
  const section = hero.closest(".hero");
  section.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const r = hero.getBoundingClientRect();
    tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / r.width));
    ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / r.height));
    ticker.wake();
  }, { passive: true });
  section.addEventListener("pointerleave", () => { tx = 0; ty = 0; ticker.wake(); });
}

/* ---------- Inclinação 3D + brilho nos cartões ---------- */
export function attachTilt(root) {
  if (!finePointer()) return;
  // o mouse pode disparar centenas de eventos por segundo: aplica no máximo 1 vez por quadro
  let pending = null;
  root.addEventListener("pointermove", (e) => {
    if (motion.reduced) return;
    const card = e.target.closest(".card");
    if (!card || !root.contains(card) || card.classList.contains("pre")) return;
    pending = { card, x: e.clientX, y: e.clientY };
    ticker.wake();
  }, { passive: true });
  ticker.add(() => {
    if (!pending) return false;
    const { card, x, y } = pending;
    pending = null;
    const r = card.getBoundingClientRect();
    const px = (x - r.left) / r.width, py = (y - r.top) / r.height;
    card.style.transform = `perspective(800px) rotateX(${((0.5 - py) * 7).toFixed(2)}deg) rotateY(${((px - 0.5) * 9).toFixed(2)}deg) translateY(-6px)`;
    card.style.setProperty("--mx", `${(px * 100).toFixed(0)}%`);
    card.style.setProperty("--my", `${(py * 100).toFixed(0)}%`);
    return false;
  });
  root.addEventListener("pointerout", (e) => {
    const card = e.target.closest(".card");
    if (card && !card.contains(e.relatedTarget)) { if (pending?.card === card) pending = null; card.style.transform = ""; }
  });
}

/* ---------- Botões "magnéticos" ---------- */
export function initMagnetic() {
  if (!finePointer()) return;
  document.querySelectorAll("[data-magnetic]").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      if (motion.reduced) return;
      const r = el.getBoundingClientRect();
      el.style.translate = `${((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1)}px ${((e.clientY - r.top - r.height / 2) * 0.25).toFixed(1)}px`;
    });
    el.addEventListener("pointerleave", () => { el.style.translate = ""; });
  });
}

/* ---------- Títulos que entram palavra por palavra ---------- */
function splitWords(el) {
  if (el.classList.contains("split")) return;
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = child.textContent.split(/(\s+)/).filter(Boolean);
        if (!parts.some((p) => p.trim())) continue;
        const frag = document.createDocumentFragment();
        for (const part of parts) {
          if (!part.trim()) { frag.append(part); continue; }
          const w = document.createElement("span");
          w.className = "w";
          w.textContent = part;
          frag.append(w);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) walk(child);
    }
  };
  walk(el);
  el.querySelectorAll(".w").forEach((w, i) => w.style.setProperty("--wi", i));
  el.classList.add("split");
}

/* ---------- Revelar ao rolar ---------- */
let revealObserver;
export function observeReveal(root = document) {
  // listas com [data-stagger]: cada item entra um pouco depois do anterior
  root.querySelectorAll("[data-stagger]").forEach((list) => {
    [...list.children].forEach((child, i) => { child.classList.add("reveal"); child.style.setProperty("--ri", i); });
    list.removeAttribute("data-stagger");
  });
  if (!motion.reduced) root.querySelectorAll("[data-split]").forEach((el) => { splitWords(el); el.removeAttribute("data-split"); });
  const els = root.querySelectorAll(".reveal:not(.in), .split:not(.in)");
  if (motion.reduced || !("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("in")); return; }
  revealObserver ||= new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); revealObserver.unobserve(e.target); }
  }), { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  els.forEach((el) => revealObserver.observe(el));
  requestSafety();
}

/* ---------- Voar para o carrinho (em arco, com rastro) ---------- */
export function flyToCart(src, fromEl) {
  const target = document.querySelector(window.innerWidth < 641 && !document.getElementById("floatingCart").hidden ? "#floatingCart" : "#cartBtn");
  const bump = () => { target?.classList.remove("bump"); void target?.offsetWidth; target?.classList.add("bump"); };
  if (motion.reduced || !src || !fromEl || !target) return bump();
  const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const lift = Math.min(180, 80 + Math.abs(dx) * 0.15);
  const frames = [
    { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 },
    { transform: `translate(${dx * 0.25}px, ${dy * 0.25 - lift * 0.8}px) scale(1.08) rotate(90deg)`, opacity: 1, offset: 0.3 },
    { transform: `translate(${dx * 0.6}px, ${dy * 0.6 - lift}px) scale(.85) rotate(220deg)`, opacity: 1, offset: 0.6 },
    { transform: `translate(${dx}px, ${dy}px) scale(.18) rotate(360deg)`, opacity: 0.7 },
  ];
  // a foto e dois "fantasmas" atrasados formam um rastro
  [0, 70, 140].forEach((delay, k) => {
    const img = document.createElement("img");
    img.className = k ? "fly ghost" : "fly";
    img.src = src; img.alt = "";
    img.style.left = `${a.left + a.width / 2 - 32}px`; img.style.top = `${a.top + a.height / 2 - 32}px`;
    if (k) img.style.opacity = "0";
    document.body.appendChild(img);
    const anim = img.animate(frames.map((f) => (k ? { ...f, opacity: f.opacity * (k === 1 ? 0.45 : 0.22) } : f)), { duration: 780, delay, easing: "cubic-bezier(.45,0,.35,1)", fill: "backwards" });
    anim.onfinish = () => { img.remove(); if (!k) bump(); };
  });
}

/* ---------- Confete tricolor ---------- */
export function confetti() {
  if (motion.reduced) return;
  const c = document.createElement("canvas");
  c.className = "confetti";
  document.body.appendChild(c);
  const ctx = c.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const colors = ["#2e6b3f", "#fffdf8", "#982c27", "#e3a93b"];
  const ps = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.45,
    vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, r: 4 + Math.random() * 5,
    rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[Math.floor(Math.random() * colors.length)],
  }));
  let age = 0;
  const stop = ticker.add((f) => {
    age += f.dt;
    const k = f.dt * 60;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ps.forEach((p) => {
      p.vy += 0.35 * k; p.vx *= Math.pow(0.99, k); p.x += p.vx * k; p.y += p.vy * k; p.rot += p.vr * k;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
      ctx.strokeStyle = "rgba(43,29,23,.25)"; ctx.lineWidth = 0.5;
      ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.strokeRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore();
    });
    if (age < 2.6) return true;
    stop();
    c.remove();
    return false;
  });
}

/* ---------- Toasts ---------- */
export function toast(message, type = "", ms = 2800) {
  const box = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.setAttribute("role", type === "err" ? "alert" : "status");
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 260); }, ms);
}
