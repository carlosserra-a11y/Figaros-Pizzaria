/* ============================================================
   Texturas do 3D (sem downloads extras): os pixels pesados vêm do
   worker (texpool.js); aqui só montamos o canvas e os detalhes
   desenhados à mão (riscos de faca, impressão da tampa).
   Tudo é guardado em cache: topo e caixa usam as mesmas texturas.
   ============================================================ */
import { CanvasTexture, Texture, SRGBColorSpace, NoColorSpace, RepeatWrapping, LinearMipmapLinearFilter } from "three";
import { pixels } from "./texpool.js";

const cache = new Map();
const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

export function canvas2d(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")];
}

export function wrapCanvas(canvas, { repeat = false, colorSpace = SRGBColorSpace, anisotropy = 4 } = {}) {
  const t = new CanvasTexture(canvas);
  t.colorSpace = colorSpace;
  t.anisotropy = anisotropy;
  t.minFilter = LinearMipmapLinearFilter;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

async function pixelCanvas(name, w, h, args) {
  const { data } = await pixels(name, w, h, args);
  const [c, ctx] = canvas2d(w, h);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), w, h), 0, 0);
  return [c, ctx];
}

/** Tábua de madeira (veios + riscos de faca). */
export const woodTexture = (size) => once(`wood:${size}`, async () => {
  const [c, ctx] = await pixelCanvas("wood", size, size);
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "#f3d6ae";
  for (let i = 0; i < 28; i++) {
    const x = Math.random() * size, y = Math.random() * size, a = Math.random() * Math.PI, l = size * (0.08 + Math.random() * 0.25);
    ctx.lineWidth = 0.6 + Math.random();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  return wrapCanvas(c);
});

export const crustTexture = (w) => once(`crust:${w}`, async () => wrapCanvas((await pixelCanvas("crust", w, Math.max(64, w / 4)))[0], { repeat: true }));
export const bumpNoise = (size, scale = 18) => once(`bump:${size}:${scale}`, async () => wrapCanvas((await pixelCanvas("bump", size, size, { scale }))[0], { repeat: true, colorSpace: NoColorSpace }));
export const sliceCutTexture = () => once("cut", async () => wrapCanvas((await pixelCanvas("sliceCut", 256, 64))[0]));
export const bottomTexture = (size) => once(`bottom:${size}`, async () => wrapCanvas((await pixelCanvas("bottom", size, size))[0]));
export const pepperoniTexture = (size = 256) => once(`pep:${size}`, async () => wrapCanvas((await pixelCanvas("pepperoni", size, size))[0]));
export const tomatoSliceTexture = (size = 256) => once(`tom:${size}`, async () => wrapCanvas((await pixelCanvas("tomatoSlice", size, size))[0]));
export const leafTexture = (size = 256) => once(`leaf:${size}`, async () => wrapCanvas((await pixelCanvas("leaf", size, size))[0]));
const cardboardCanvas = (size, inside) => once(`cbc:${size}:${inside}`, () => pixelCanvas("cardboard", size, size, { inside }));
export const cardboardTexture = (size, inside = false) => once(`cb:${size}:${inside}`, async () => wrapCanvas((await cardboardCanvas(size, inside))[0], { repeat: true }));

/** Foto da pizza (decodificada fora da thread principal antes de ir para a GPU). */
export const photoTexture = (url) => once(`photo:${url}`, async () => {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  const t = new Texture(img);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
});

/** Partícula macia (vapor, farinha). */
export function softSprite(size = 64, color = "255,255,255") {
  return once(`sprite:${size}:${color}`, () => {
    const [c, ctx] = canvas2d(size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, `rgba(${color},1)`);
    g.addColorStop(0.4, `rgba(${color},0.45)`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return wrapCanvas(c);
  });
}

/** Sombra de contato (mancha suave) para "apoiar" objetos na página. */
export function blobShadow(size = 256) {
  return once(`blob:${size}`, () => {
    const [c, ctx] = canvas2d(size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(43,29,23,0.55)");
    g.addColorStop(0.55, "rgba(43,29,23,0.22)");
    g.addColorStop(1, "rgba(43,29,23,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return wrapCanvas(c);
  });
}

/** Carrega uma imagem; resolve null se falhar (a tampa sai sem a logo, mas sai). */
function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Tampa impressa da caixa com a logo da Figaro's.
 * Espera a fonte Alfa Slab One e a logo antes de desenhar (texto e logo sempre nítidos).
 */
export const lidTexture = (size, logoUrl) => once(`lid:${size}:${logoUrl}`, async () => {
  const fontReady = document.fonts?.load ? document.fonts.load(`900 ${Math.round(size * 0.04)}px "Alfa Slab One"`).catch(() => null) : null;
  const [[board], logoImg] = await Promise.all([cardboardCanvas(size, false), loadImage(logoUrl), fontReady]);
  const [c, base] = canvas2d(size, size);
  base.drawImage(board, 0, 0);
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
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(logoImg, cx - s / 2, cy - s / 2, s, s); ctx.restore();
  }
  // leve desgaste da tinta
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 900; i++) { ctx.globalAlpha = Math.random() * 0.25; ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2); }
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  base.globalAlpha = 0.94;
  base.drawImage(print, 0, 0);
  return wrapCanvas(c, { anisotropy: 8 });
});
