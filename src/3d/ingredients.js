/* ============================================================
   Ingredientes 3D feitos em código (alta qualidade, leves):
   manjericão, tomate-cereja, rodela de tomate, azeitona,
   cogumelo, pepperoni, queijo, pimenta e cebola.
   Cada um devolve { geometry, material } prontos para instanciar.
   As texturas chegam prontas (loadIngredientTextures) e, em aparelhos
   fracos, os materiais "físicos" (verniz/brilho) viram padrão.
   ============================================================ */
import {
  BufferGeometry, Float32BufferAttribute, MeshPhysicalMaterial, MeshStandardMaterial, Color, DoubleSide,
  SphereGeometry, CylinderGeometry, TorusGeometry, Shape, Path, ExtrudeGeometry, ShapeGeometry,
  TubeGeometry, QuadraticBezierCurve3, Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { leafTexture, pepperoniTexture, tomatoSliceTexture } from "./textures.js";

/** Texturas usadas pelos ingredientes (geradas no worker). */
export async function loadIngredientTextures() {
  const [leaf, pepperoni, tomatoSlice] = await Promise.all([leafTexture(), pepperoniTexture(), tomatoSliceTexture()]);
  return { leaf, pepperoni, tomatoSlice };
}

const PHYSICAL_ONLY = ["clearcoat", "clearcoatRoughness", "sheen", "sheenRoughness", "sheenColor"];
/** Material com verniz/brilho (alta qualidade) ou padrão, mais leve. */
function surface(params, hq) {
  if (hq) return new MeshPhysicalMaterial(params);
  const p = { ...params };
  PHYSICAL_ONLY.forEach((k) => delete p[k]);
  return new MeshStandardMaterial(p);
}

function paint(geo, hex) {
  const c = new Color(hex);
  const n = geo.getAttribute("position").count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute("color", new Float32BufferAttribute(arr, 3));
  return geo;
}
/** Junta geometrias mantendo só posição/normal/uv/cor (evita erro de atributos diferentes). */
function merge(list) {
  const clean = list.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(ng.attributes)) if (!["position", "normal", "uv", "color"].includes(k)) ng.deleteAttribute(k);
    if (!ng.getAttribute("uv")) ng.setAttribute("uv", new Float32BufferAttribute(new Float32Array(ng.getAttribute("position").count * 2), 2));
    return ng;
  });
  return mergeGeometries(clean, false);
}

/* ---------- Manjericão ---------- */
export function createLeafGeometry(U = 26, V = 10) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    const w = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), 0.85) * 0.42 * (1 - 0.15 * u);
    for (let j = 0; j <= V; j++) {
      const v = (j / V) * 2 - 1;
      const x = u * 1.6 - 0.8;
      const y = v * w;
      const z = 0.16 * Math.sin(Math.PI * u) - 0.14 * v * v * Math.sin(Math.PI * u) - 0.025 * Math.exp(-((v * 7) ** 2)) + 0.05 * Math.sin(u * 9 + v * 2) * 0.2;
      pos.push(x, y, z);
      uv.push(u, (v + 1) / 2);
    }
  }
  for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) {
    const a = i * (V + 1) + j, b = a + 1, c = a + V + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const leafMats = new Map();
export function leafMaterial(tex, hq = true) {
  if (!leafMats.has(hq)) leafMats.set(hq, surface({ map: tex.leaf, roughness: 0.42, sheen: 0.7, sheenRoughness: 0.5, sheenColor: new Color(0xa8e08a), clearcoat: 0.25, clearcoatRoughness: 0.5, side: DoubleSide }, hq));
  return leafMats.get(hq);
}

/* ---------- Tomate-cereja (corpo + sépalas) ---------- */
function tomato(tex, hq) {
  const body = new SphereGeometry(0.34, 40, 28);
  const p = body.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const v = new Vector3().fromBufferAttribute(p, i);
    const ang = Math.atan2(v.z, v.x);
    const lobes = 1 + 0.035 * Math.cos(ang * 5) * (1 - Math.abs(v.y) / 0.34);
    v.x *= lobes; v.z *= lobes; v.y *= 0.86;
    if (v.y > 0.25) v.y -= (v.y - 0.25) * 0.6; // leve afundado no topo
    p.setXYZ(i, v.x, v.y, v.z);
  }
  body.computeVertexNormals();
  paint(body, 0xd8301f);
  const star = new Shape();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2, r = i % 2 ? 0.05 : 0.2;
    i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(r, 0);
  }
  const sep = new ShapeGeometry(star, 3);
  sep.rotateX(-Math.PI / 2);
  const sp = sep.getAttribute("position");
  for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), z = sp.getZ(i); sp.setY(i, -0.06 * (x * x + z * z) * 9); }
  sep.translate(0, 0.27, 0);
  sep.computeVertexNormals();
  paint(sep, 0x3f7f2a);
  const stem = new CylinderGeometry(0.018, 0.026, 0.12, 8);
  stem.translate(0, 0.32, 0);
  paint(stem, 0x4d8a31);
  return { geometry: merge([body, sep, stem]), material: surface({ vertexColors: true, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, side: DoubleSide }, hq) };
}

/* ---------- Rodela de tomate ---------- */
function tomatoSlice(tex, hq) {
  const g = new CylinderGeometry(0.42, 0.42, 0.06, 40, 1);
  const face = surface({ map: tex.tomatoSlice, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 }, hq);
  return { geometry: g, material: [surface({ color: 0xc8261a, roughness: 0.3, clearcoat: 0.8 }, hq), face, face] };
}

/* ---------- Azeitona preta (anel) ---------- */
function olive(tex, hq) {
  const g = new TorusGeometry(0.17, 0.075, 18, 36);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * 1.12);
  g.computeVertexNormals();
  return { geometry: g, material: surface({ color: 0x241a1d, roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.18, sheen: 0.4, sheenColor: new Color(0x6b4a62) }, hq) };
}

/* ---------- Fatia de cogumelo ---------- */
function mushroom(tex, hq) {
  const s = new Shape();
  s.moveTo(-0.13, -0.38);
  s.lineTo(-0.12, -0.05);
  s.bezierCurveTo(-0.42, -0.05, -0.46, 0.08, -0.44, 0.14);
  s.bezierCurveTo(-0.4, 0.42, 0.4, 0.42, 0.44, 0.14);
  s.bezierCurveTo(0.46, 0.08, 0.42, -0.05, 0.12, -0.05);
  s.lineTo(0.13, -0.38);
  s.quadraticCurveTo(0, -0.42, -0.13, -0.38);
  const g = new ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 3, curveSegments: 24 });
  g.center();
  return { geometry: g, material: surface({ color: 0xe8dcc6, roughness: 0.55, sheen: 0.6, sheenColor: new Color(0xb08a60) }, hq) };
}

/* ---------- Pepperoni (encurva nas bordas, como no forno) ---------- */
function pepperoni(tex, hq) {
  const g = new CylinderGeometry(0.32, 0.31, 0.045, 48, 1);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.sqrt(x * x + z * z) / 0.32;
    p.setY(i, p.getY(i) + 0.05 * r * r);
  }
  g.computeVertexNormals();
  const top = surface({ map: tex.pepperoni, roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.3 }, hq);
  return { geometry: g, material: [surface({ color: 0x8a1c14, roughness: 0.45, clearcoat: 0.4 }, hq), top, top] };
}

/* ---------- Queijo com furos ---------- */
function cheese(tex, hq) {
  const s = new Shape();
  s.moveTo(-0.45, -0.25); s.lineTo(0.45, -0.25); s.lineTo(-0.45, 0.32); s.lineTo(-0.45, -0.25);
  for (const [x, y, r] of [[-0.26, -0.08, 0.07], [-0.05, -0.13, 0.045], [-0.33, 0.14, 0.05]]) {
    const h = new Path(); h.absarc(x, y, r, 0, Math.PI * 2, true); s.holes.push(h);
  }
  const g = new ExtrudeGeometry(s, { depth: 0.32, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 18 });
  g.center();
  return { geometry: g, material: surface({ color: 0xf2c14e, roughness: 0.5, sheen: 0.8, sheenColor: new Color(0xffe39a), clearcoat: 0.15 }, hq) };
}

/* ---------- Pimenta dedo-de-moça ---------- */
function chili(tex, hq) {
  const curve = new QuadraticBezierCurve3(new Vector3(-0.45, 0, 0), new Vector3(0.05, -0.28, 0), new Vector3(0.5, 0.12, 0));
  const segs = 48, rad = 10;
  const body = new TubeGeometry(curve, segs, 0.1, rad, false);
  const p = body.getAttribute("position");
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, c = curve.getPointAt(t);
    const taper = t < 0.08 ? 0.75 + t * 3 : Math.pow(1 - (t - 0.08) / 0.92, 0.7) * 0.98 + 0.02;
    for (let j = 0; j <= rad; j++) {
      const k = i * (rad + 1) + j;
      p.setXYZ(k, c.x + (p.getX(k) - c.x) * taper, c.y + (p.getY(k) - c.y) * taper, c.z + (p.getZ(k) - c.z) * taper);
    }
  }
  body.computeVertexNormals();
  paint(body, 0xd2231c);
  const stemCurve = new QuadraticBezierCurve3(new Vector3(-0.44, 0, 0), new Vector3(-0.58, 0.02, 0), new Vector3(-0.62, 0.14, 0));
  const stem = new TubeGeometry(stemCurve, 10, 0.03, 8, false);
  paint(stem, 0x3f7a2a);
  const cap = new SphereGeometry(0.075, 16, 10);
  cap.scale(0.7, 1, 1); cap.translate(-0.45, 0, 0);
  paint(cap, 0x3f7a2a);
  return { geometry: merge([body, stem, cap]), material: surface({ vertexColors: true, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }, hq) };
}

/* ---------- Anel de cebola roxa ---------- */
function onion(tex, hq) {
  const g = new TorusGeometry(0.27, 0.03, 12, 48);
  return { geometry: g, material: surface({ color: 0xead7ea, roughness: 0.3, sheen: 1, sheenColor: new Color(0x9b4f8a), clearcoat: 0.5, transparent: true, opacity: 0.92 }, hq) };
}

/* ---------- Folha (para o fundo) ---------- */
function basil(tex, hq) {
  return { geometry: createLeafGeometry(), material: leafMaterial(tex, hq) };
}

export const INGREDIENTS = { basil, tomato, tomatoSlice, olive, mushroom, pepperoni, cheese, chili, onion };
