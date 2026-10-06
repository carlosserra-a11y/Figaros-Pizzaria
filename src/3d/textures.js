/* Texturas procedurais (geradas no navegador — sem downloads extras). */
import { NoColorSpace } from "three";
import { pixelTexture, wrapCanvas, canvas2d, fbm, noise2 } from "./core.js";

const mix = (a, b, t) => a + (b - a) * t;
const mixC = (c1, c2, t) => [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)];
const clamp = (v) => Math.max(0, Math.min(255, v));

/** Tábua de madeira (veios + riscos de faca). */
export function woodTexture(size) {
  const light = [196, 138, 82], dark = [128, 78, 40];
  const tex = pixelTexture(size, size, (u, v) => {
    const warp = fbm(u * 3, v * 14, 4) * 2.2;
    const rings = Math.sin((v * 38 + warp * 6) * Math.PI);
    const grain = fbm(u * 60, v * 6, 3);
    const t = Math.pow((rings + 1) / 2, 2.2) * 0.55 + grain * 0.45;
    const c = mixC(light, dark, t);
    const fleck = noise2(u * 400, v * 400) > 0.93 ? -18 : 0;
    return [clamp(c[0] + fleck), clamp(c[1] + fleck), clamp(c[2] + fleck)];
  });
  // riscos de faca
  const ctx = tex.image.getContext("2d");
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "#f3d6ae";
  for (let i = 0; i < 28; i++) {
    const x = Math.random() * size, y = Math.random() * size, a = Math.random() * Math.PI, l = size * (0.08 + Math.random() * 0.25);
    ctx.lineWidth = 0.6 + Math.random();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  tex.needsUpdate = true;
  return tex;
}

/** Borda da pizza: dourada com manchas de forno a lenha ("leopardo"). */
export function crustTexture(w) {
  const h = Math.max(64, w / 4);
  const spots = Array.from({ length: 70 }, () => ({ x: Math.random(), y: 0.15 + Math.random() * 0.55, r: 0.004 + Math.random() * 0.02 }));
  return pixelTexture(w, h, (u, v) => {
    // v=0..1 ao redor do "tubo" da borda: topo mais tostado
    const top = Math.pow(Math.sin(v * Math.PI), 1.5);
    let c = mixC([236, 196, 128], [196, 120, 52], top * 0.85 + fbm(u * 40, v * 8) * 0.3);
    for (const s of spots) {
      const dx = Math.min(Math.abs(u - s.x), 1 - Math.abs(u - s.x)) * 4, dy = v - s.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < s.r * 4) c = mixC(c, [58, 30, 16], Math.pow(1 - d / (s.r * 4), 2) * 0.85);
    }
    const flour = noise2(u * 900, v * 260) > 0.965 ? 40 : 0;
    return [clamp(c[0] + flour), clamp(c[1] + flour), clamp(c[2] + flour)];
  }, { repeat: true });
}

/** Mapa de relevo genérico (ruído) — dá textura de pão/massa. */
export function bumpNoise(size, scale = 18) {
  return pixelTexture(size, size, (u, v) => {
    const n = fbm(u * scale, v * scale, 5) * 255;
    return [n, n, n];
  }, { repeat: true, colorSpace: NoColorSpace });
}

/** Corte da fatia: massa por baixo, molho e queijo por cima. u = raio, v = altura. */
export function sliceCutTexture() {
  return pixelTexture(256, 64, (u, v) => {
    const y = 1 - v; // 0 embaixo, 1 em cima
    const holes = fbm(u * 30, y * 10) > 0.62 ? 0.75 : 1;
    if (y < 0.18) return mixC([176, 104, 44], [214, 156, 88], y / 0.18).map(clamp);
    if (y < 0.66) { const c = mixC([238, 214, 170], [246, 228, 190], fbm(u * 20, y * 20)); return c.map((x) => clamp(x * holes)); }
    if (y < 0.76) return [190, 44, 30];
    return mixC([250, 214, 120], [236, 176, 70], fbm(u * 16, y * 6)).map(clamp);
  });
}

/** Fundo da pizza (massa assada). */
export function bottomTexture(size) {
  return pixelTexture(size, size, (u, v) => {
    const n = fbm(u * 10, v * 10, 5);
    const char = noise2(u * 60, v * 60) > 0.86 ? 0.5 : 0;
    return mixC([222, 166, 96], [120, 70, 32], n * 0.6 + char).map(clamp);
  });
}

/** Pepperoni com gordura marmorizada. */
export function pepperoniTexture(size = 256) {
  return pixelTexture(size, size, (u, v) => {
    const dx = u - 0.5, dy = v - 0.5, r = Math.sqrt(dx * dx + dy * dy) * 2;
    if (r > 1) return [120, 24, 18];
    let c = mixC([196, 46, 30], [140, 22, 18], fbm(u * 12, v * 12));
    if (fbm(u * 28 + 5, v * 28) > 0.63) c = mixC(c, [242, 190, 160], 0.75);
    if (r > 0.86) c = mixC(c, [96, 16, 12], (r - 0.86) / 0.14);
    return c.map(clamp);
  });
}

/** Rodela de tomate (casca, polpa, sementes). */
export function tomatoSliceTexture(size = 256) {
  const seeds = [];
  for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) {
    const a = (k / 4) * Math.PI * 2 + 0.4 + (Math.random() - 0.5) * 0.4, r = 0.18 + Math.random() * 0.16;
    seeds.push([0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r]);
  }
  return pixelTexture(size, size, (u, v) => {
    const dx = u - 0.5, dy = v - 0.5, r = Math.sqrt(dx * dx + dy * dy) * 2, a = Math.atan2(dy, dx);
    if (r > 0.98) return [168, 26, 18];
    if (r > 0.86) return [214, 40, 28];
    const wall = Math.abs(Math.sin(a * 2)) < 0.12 || r < 0.18;
    let c = wall ? [230, 70, 52] : mixC([240, 104, 74], [246, 130, 96], fbm(u * 18, v * 18));
    for (const [sx, sy] of seeds) { const d = Math.hypot(u - sx, v - sy); if (d < 0.028) c = mixC(c, [250, 222, 150], 1 - d / 0.028); }
    return c.map(clamp);
  });
}

/** Nervuras da folha de manjericão. u = comprimento, v = largura. */
export function leafTexture(size = 256) {
  return pixelTexture(size, size, (u, v) => {
    const mid = Math.abs(v - 0.5);
    let c = mixC([62, 140, 52], [36, 104, 36], fbm(u * 8, v * 8) * 0.8 + mid);
    if (mid < 0.012) c = mixC(c, [150, 200, 120], 0.8);
    const vein = Math.abs(((u * 7 + mid * 3.2) % 1) - 0.5) < 0.03 && mid < 0.42;
    if (vein) c = mixC(c, [120, 180, 96], 0.5);
    return c.map(clamp);
  });
}

/** Partícula macia (vapor, farinha). */
export function softSprite(size = 64, color = "255,255,255") {
  const [c, ctx] = canvas2d(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${color},1)`);
  g.addColorStop(0.4, `rgba(${color},0.45)`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return wrapCanvas(c);
}

/** Sombra de contato (mancha suave) para "apoiar" objetos na página. */
export function blobShadow(size = 256) {
  const [c, ctx] = canvas2d(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(43,29,23,0.55)");
  g.addColorStop(0.55, "rgba(43,29,23,0.22)");
  g.addColorStop(1, "rgba(43,29,23,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return wrapCanvas(c);
}

/** Papelão kraft da caixa (fibras + leve ondulado). */
export function cardboardTexture(size, inside = false) {
  const base = inside ? [222, 196, 156] : [196, 150, 100];
  return pixelTexture(size, size, (u, v) => {
    const fiber = fbm(u * 120, v * 9, 3) * 0.18 + fbm(u * 6, v * 6, 3) * 0.12;
    const flute = Math.sin(v * size * 0.6) * 0.03;
    const k = 0.92 + fiber + flute;
    return [clamp(base[0] * k), clamp(base[1] * k), clamp(base[2] * k)];
  }, { repeat: true });
}

/** Tampa impressa da caixa com a logo da Figaro's. */
export function lidTexture(size, logoImg) {
  const [c, base] = canvas2d(size, size);
  base.drawImage(cardboardTexture(size).image, 0, 0);
  // a impressão é desenhada numa camada separada (para o "desgaste" não furar o papelão)
  const [print, ctx] = canvas2d(size, size);
  const cx = size / 2, cy = size / 2;
  // faixa tricolor nas bordas
  const band = size * 0.035;
  [["#2e6b3f", 0], ["#fffdf8", 1], ["#982c27", 2]].forEach(([col, i]) => {
    ctx.fillStyle = col;
    ctx.fillRect(size * 0.06 + i * (size * 0.88 / 3), size * 0.06, size * 0.88 / 3, band);
    ctx.fillRect(size * 0.06 + i * (size * 0.88 / 3), size * 0.94 - band, size * 0.88 / 3, band);
  });
  // anel vermelho como na logo
  ctx.strokeStyle = "#982c27"; ctx.lineWidth = size * 0.022;
  ctx.beginPath(); ctx.arc(cx, cy, size * 0.36, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = size * 0.006;
  ctx.beginPath(); ctx.arc(cx, cy, size * 0.335, 0, Math.PI * 2); ctx.stroke();
  // texto circular
  const text = "  FIGARO'S PIZZA  •  FORNO ACESO  •  PALHOÇA · SC  •";
  ctx.fillStyle = "#982c27";
  ctx.font = `900 ${Math.round(size * 0.04)}px "Alfa Slab One", Georgia, serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const R = size * 0.405;
  for (let i = 0; i < text.length; i++) {
    const a = (i / text.length) * Math.PI * 2 - Math.PI / 2;
    ctx.save(); ctx.translate(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.rotate(a + Math.PI / 2);
    ctx.fillText(text[i], 0, 0); ctx.restore();
  }
  if (logoImg) {
    const s = size * 0.6;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, s / 2, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(logoImg, cx - s / 2, cy - s / 2, s, s); ctx.restore();
  }
  // leve desgaste da tinta
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 900; i++) { ctx.globalAlpha = Math.random() * 0.25; ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2); }
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  base.globalAlpha = 0.94;
  base.drawImage(print, 0, 0);
  return wrapCanvas(c);
}
