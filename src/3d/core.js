/* ============================================================
   Núcleo 3D: renderer, ambiente PBR, laço único de animação,
   pausa fora da tela, perda de contexto e nível do aparelho.
   ============================================================ */
import {
  WebGLRenderer, SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap,
  PMREMGenerator, Scene, CanvasTexture, RepeatWrapping, LinearMipmapLinearFilter,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Detecta se dá para usar WebGL (e qual qualidade). */
export function detectTier() {
  let gl = null;
  try {
    const c = document.createElement("canvas");
    gl = c.getContext("webgl2") || c.getContext("webgl");
  } catch { /* sem WebGL */ }
  if (!gl) return null;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const small = Math.min(screen.width, screen.height) < 700;
  const saveData = navigator.connection?.saveData;
  const low = saveData || cores <= 4 || mem <= 3 || (small && cores <= 6);
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return {
    low,
    small,
    maxDpr: low ? 1.25 : small ? 1.75 : 2,
    shadowSize: low ? 512 : 1024,
    texSize: low ? 512 : 1024,
  };
}

/* ---------- Laço único (todas as cenas no mesmo requestAnimationFrame) ---------- */
const scenes = new Set();
let raf = 0;
let last = 0;

function frame(t) {
  raf = 0;
  const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016);
  last = t;
  let any = false;
  for (const s of scenes) {
    if (s.active) { any = true; try { s.tick(dt, t / 1000); } catch (e) { console.error("[3D]", e); s.fail?.(e); } }
  }
  if (any && !document.hidden) raf = requestAnimationFrame(frame);
  else last = 0;
}
export function wake() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }
document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });

/**
 * Registra uma cena. `tick(dt, time)` desenha um quadro.
 * A cena só roda enquanto `el` estiver visível na tela.
 */
export function registerScene(scene, el, { margin = "120px" } = {}) {
  scenes.add(scene);
  scene.active = false;
  if (el && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(([e]) => { scene.active = e.isIntersecting && !scene.dead; if (scene.active) wake(); }, { rootMargin: margin });
    io.observe(el);
    scene.unobserve = () => io.disconnect();
  } else {
    scene.active = true;
    wake();
  }
  return () => { scenes.delete(scene); scene.unobserve?.(); };
}

/* ---------- Renderer ---------- */
export function createRenderer(canvas, tier, { shadows = false, alpha = true } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: !tier.low, alpha, powerPreference: "high-performance", premultipliedAlpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.maxDpr));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  if (alpha) renderer.setClearColor(0x000000, 0);
  if (shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
  }
  return renderer;
}

/** Iluminação de estúdio (reflexos realistas em queijo, azeitona, tomate…). */
export function studioEnvironment(renderer, scene, intensity = 1) {
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = intensity;
  pmrem.dispose();
  return env;
}

/** Ajusta o tamanho do canvas ao elemento (com ResizeObserver). */
export function autoResize(renderer, camera, el, onResize) {
  const apply = () => {
    const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    onResize?.(w, h);
  };
  apply();
  if ("ResizeObserver" in window) new ResizeObserver(apply).observe(el);
  else window.addEventListener("resize", apply);
  return apply;
}

/** Se o navegador derrubar o WebGL, volta para a versão 2D sem quebrar a página. */
export function guardContext(renderer, scene, onLost) {
  renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    scene.dead = true;
    scene.active = false;
    onLost?.();
  });
}

/* ---------- Ruído para texturas procedurais ---------- */
function hash(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const smooth = (t) => t * t * (3 - 2 * t);
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}

/** Gera uma textura desenhando pixel a pixel (rápido o bastante para 512–1024 px). */
export function pixelTexture(w, h, fn, { repeat = false, colorSpace = SRGBColorSpace } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = fn(x / w, y / h, x, y);
      const i = (y * w + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return wrapCanvas(c, { repeat, colorSpace });
}

export function wrapCanvas(canvas, { repeat = false, colorSpace = SRGBColorSpace, anisotropy = 4 } = {}) {
  const t = new CanvasTexture(canvas);
  t.colorSpace = colorSpace;
  t.anisotropy = anisotropy;
  t.minFilter = LinearMipmapLinearFilter;
  if (repeat) { t.wrapS = t.wrapT = RepeatWrapping; }
  t.needsUpdate = true;
  return t;
}

export function canvas2d(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")];
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Aproximação suave e independente de FPS. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

/** Progresso (0→1) de um elemento atravessando a tela. */
export function scrollProgress(el, { start = 1, end = 0 } = {}) {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  // 0 quando o topo do elemento está em `start`*vh; 1 quando o fim do elemento chega em `end`*vh
  const from = vh * start, to = vh * end - r.height;
  return clamp01((from - r.top) / (from - to));
}

export { Scene };
