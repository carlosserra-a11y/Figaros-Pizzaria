/* ============================================================
   Geradores de pixels das texturas procedurais (madeira, borda,
   papelão, massa, ingredientes). Código puro, sem three.js e sem
   DOM: roda dentro de um Web Worker (js/site/3d-worker.js) para
   não travar a página. Se o worker falhar, roda na thread
   principal em fatias pequenas (veja texpool.js).

   Cada gerador recebe (w, h, args) e devolve { row(out, y), post?(out) }:
   `row` pinta uma linha inteira (RGBA) e `post` faz um passe final.
   ============================================================ */

/* ---------- Ruído ---------- */
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

const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Escreve um pixel (RGB opaco). */
function put(out, i, r, g, b) { out[i] = clamp(r); out[i + 1] = clamp(g); out[i + 2] = clamp(b); out[i + 3] = 255; }
/** Mistura duas cores em `tmp` (evita criar arrays por pixel). */
function mixInto(tmp, c1, c2, t) { tmp[0] = mix(c1[0], c2[0], t); tmp[1] = mix(c1[1], c2[1], t); tmp[2] = mix(c1[2], c2[2], t); return tmp; }

/* ---------- Geradores ---------- */
const GEN = {
  /** Tábua de madeira (veios). Os riscos de faca são desenhados depois, no canvas. */
  wood(w, h) {
    const light = [196, 138, 82], dark = [128, 78, 40], c = [0, 0, 0];
    return {
      row(out, y) {
        const v = y / h;
        for (let x = 0; x < w; x++) {
          const u = x / w;
          const warp = fbm(u * 3, v * 14, 4) * 2.2;
          const rings = Math.sin((v * 38 + warp * 6) * Math.PI);
          const grain = fbm(u * 60, v * 6, 3);
          mixInto(c, light, dark, Math.pow((rings + 1) / 2, 2.2) * 0.55 + grain * 0.45);
          const fleck = noise2(u * 400, v * 400) > 0.93 ? -18 : 0;
          put(out, (y * w + x) * 4, c[0] + fleck, c[1] + fleck, c[2] + fleck);
        }
      },
    };
  },

  /** Borda da pizza: dourada com manchas de forno a lenha ("leopardo"). */
  crust(w, h) {
    const spots = Array.from({ length: 70 }, () => ({ x: Math.random(), y: 0.15 + Math.random() * 0.55, r: 0.004 + Math.random() * 0.02 }));
    const c = [0, 0, 0];
    return {
      row(out, y) {
        const v = y / h;
        const top = Math.pow(Math.sin(v * Math.PI), 1.5);
        for (let x = 0; x < w; x++) {
          const u = x / w;
          mixInto(c, [236, 196, 128], [196, 120, 52], top * 0.85 + fbm(u * 40, v * 8) * 0.3);
          put(out, (y * w + x) * 4, c[0], c[1], c[2]);
        }
      },
      // manchas: cada uma pinta só a sua vizinhança (antes eram 70 testes por pixel)
      post(out) {
        for (const s of spots) {
          const R = s.r * 4;
          const y0 = Math.max(0, Math.floor((s.y - R) * h)), y1 = Math.min(h - 1, Math.ceil((s.y + R) * h));
          const rx = R / 4; // dx é multiplicado por 4 na distância
          for (let y = y0; y <= y1; y++) {
            const dy = y / h - s.y;
            for (let k = Math.floor((s.x - rx) * w) - 1; k <= Math.ceil((s.x + rx) * w) + 1; k++) {
              const x = ((k % w) + w) % w;
              const u = x / w;
              const dx = Math.min(Math.abs(u - s.x), 1 - Math.abs(u - s.x)) * 4;
              const d = Math.sqrt(dx * dx + dy * dy);
              if (d >= R) continue;
              const t = Math.pow(1 - d / R, 2) * 0.85, i = (y * w + x) * 4;
              out[i] = mix(out[i], 58, t); out[i + 1] = mix(out[i + 1], 30, t); out[i + 2] = mix(out[i + 2], 16, t);
            }
          }
        }
        // pontinhos de farinha por cima
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (noise2((x / w) * 900, (y / h) * 260) > 0.965) { const i = (y * w + x) * 4; out[i] = clamp(out[i] + 40); out[i + 1] = clamp(out[i + 1] + 40); out[i + 2] = clamp(out[i + 2] + 40); }
        }
      },
    };
  },

  /** Mapa de relevo genérico (ruído) — textura de pão/massa. */
  bump(w, h, { scale = 18 } = {}) {
    return {
      row(out, y) {
        for (let x = 0; x < w; x++) { const n = fbm((x / w) * scale, (y / h) * scale, 5) * 255; put(out, (y * w + x) * 4, n, n, n); }
      },
    };
  },

  /** Corte da fatia: massa por baixo, molho e queijo por cima. */
  sliceCut(w, h) {
    const c = [0, 0, 0];
    return {
      row(out, yy) {
        const y = 1 - yy / h;
        for (let x = 0; x < w; x++) {
          const u = x / w, i = (yy * w + x) * 4;
          if (y < 0.18) { mixInto(c, [176, 104, 44], [214, 156, 88], y / 0.18); put(out, i, c[0], c[1], c[2]); continue; }
          if (y < 0.66) {
            const holes = fbm(u * 30, y * 10) > 0.62 ? 0.75 : 1;
            mixInto(c, [238, 214, 170], [246, 228, 190], fbm(u * 20, y * 20));
            put(out, i, c[0] * holes, c[1] * holes, c[2] * holes); continue;
          }
          if (y < 0.76) { put(out, i, 190, 44, 30); continue; }
          mixInto(c, [250, 214, 120], [236, 176, 70], fbm(u * 16, y * 6));
          put(out, i, c[0], c[1], c[2]);
        }
      },
    };
  },

  /** Fundo da pizza (massa assada). */
  bottom(w, h) {
    const c = [0, 0, 0];
    return {
      row(out, y) {
        for (let x = 0; x < w; x++) {
          const u = x / w, v = y / h;
          const char = noise2(u * 60, v * 60) > 0.86 ? 0.5 : 0;
          mixInto(c, [222, 166, 96], [120, 70, 32], fbm(u * 10, v * 10, 5) * 0.6 + char);
          put(out, (y * w + x) * 4, c[0], c[1], c[2]);
        }
      },
    };
  },

  /** Pepperoni com gordura marmorizada. */
  pepperoni(w, h) {
    const c = [0, 0, 0];
    return {
      row(out, y) {
        for (let x = 0; x < w; x++) {
          const u = x / w, v = y / h, i = (y * w + x) * 4;
          const dx = u - 0.5, dy = v - 0.5, r = Math.sqrt(dx * dx + dy * dy) * 2;
          if (r > 1) { put(out, i, 120, 24, 18); continue; }
          mixInto(c, [196, 46, 30], [140, 22, 18], fbm(u * 12, v * 12));
          if (fbm(u * 28 + 5, v * 28) > 0.63) mixInto(c, c, [242, 190, 160], 0.75);
          if (r > 0.86) mixInto(c, c, [96, 16, 12], (r - 0.86) / 0.14);
          put(out, i, c[0], c[1], c[2]);
        }
      },
    };
  },

  /** Rodela de tomate (casca, polpa, sementes). */
  tomatoSlice(w, h) {
    const seeds = [];
    for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) {
      const a = (k / 4) * Math.PI * 2 + 0.4 + (Math.random() - 0.5) * 0.4, r = 0.18 + Math.random() * 0.16;
      seeds.push([0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r]);
    }
    const c = [0, 0, 0];
    return {
      row(out, y) {
        for (let x = 0; x < w; x++) {
          const u = x / w, v = y / h, i = (y * w + x) * 4;
          const dx = u - 0.5, dy = v - 0.5, r = Math.sqrt(dx * dx + dy * dy) * 2, a = Math.atan2(dy, dx);
          if (r > 0.98) { put(out, i, 168, 26, 18); continue; }
          if (r > 0.86) { put(out, i, 214, 40, 28); continue; }
          if (Math.abs(Math.sin(a * 2)) < 0.12 || r < 0.18) { c[0] = 230; c[1] = 70; c[2] = 52; }
          else mixInto(c, [240, 104, 74], [246, 130, 96], fbm(u * 18, v * 18));
          for (const [sx, sy] of seeds) { const d = Math.hypot(u - sx, v - sy); if (d < 0.028) mixInto(c, c, [250, 222, 150], 1 - d / 0.028); }
          put(out, i, c[0], c[1], c[2]);
        }
      },
    };
  },

  /** Nervuras da folha de manjericão. u = comprimento, v = largura. */
  leaf(w, h) {
    const c = [0, 0, 0];
    return {
      row(out, y) {
        for (let x = 0; x < w; x++) {
          const u = x / w, v = y / h, mid = Math.abs(v - 0.5);
          mixInto(c, [62, 140, 52], [36, 104, 36], fbm(u * 8, v * 8) * 0.8 + mid);
          if (mid < 0.012) mixInto(c, c, [150, 200, 120], 0.8);
          if (Math.abs(((u * 7 + mid * 3.2) % 1) - 0.5) < 0.03 && mid < 0.42) mixInto(c, c, [120, 180, 96], 0.5);
          put(out, (y * w + x) * 4, c[0], c[1], c[2]);
        }
      },
    };
  },

  /** Papelão kraft da caixa (fibras + leve ondulado). */
  cardboard(w, h, { inside = false } = {}) {
    const base = inside ? [222, 196, 156] : [196, 150, 100];
    return {
      row(out, y) {
        const v = y / h, flute = Math.sin(v * h * 0.6) * 0.03;
        for (let x = 0; x < w; x++) {
          const u = x / w;
          const k = 0.92 + fbm(u * 120, v * 9, 3) * 0.18 + fbm(u * 6, v * 6, 3) * 0.12 + flute;
          put(out, (y * w + x) * 4, base[0] * k, base[1] * k, base[2] * k);
        }
      },
    };
  },
};

export const GENERATOR_NAMES = Object.keys(GEN);

/** Prepara um gerador. */
export function makeGenerator(name, w, h, args) {
  const g = GEN[name];
  if (!g) throw new Error(`Textura desconhecida: ${name}`);
  return g(w, h, args || {});
}

/** Gera tudo de uma vez (usado dentro do worker). */
export function generate(name, w, h, args) {
  const out = new Uint8ClampedArray(w * h * 4);
  const g = makeGenerator(name, w, h, args);
  for (let y = 0; y < h; y++) g.row(out, y);
  g.post?.(out);
  return out;
}
