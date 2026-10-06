/* ============================================================
   Modelo 3D de pizza fatiada (8 fatias), feito em código:
   - topo com a FOTO REAL da pizza (e relevo a partir da própria foto)
   - corte lateral com massa, molho e queijo
   - borda (cornicione) com manchas de forno
   - fios de queijo que esticam quando uma fatia é puxada
   ============================================================ */
import {
  Group, Mesh, BufferGeometry, Float32BufferAttribute, BufferAttribute, MeshPhysicalMaterial, MeshStandardMaterial,
  TorusGeometry, CircleGeometry, Vector3, Quaternion, Color, DoubleSide, TextureLoader, SRGBColorSpace,
} from "three";
import { crustTexture, sliceCutTexture, bottomTexture, bumpNoise } from "./textures.js";
import { createLeafGeometry, leafMaterial } from "./ingredients.js";

const RI = 0.92; // raio do recheio
const RC = 0.955; // raio da borda
const TUBE = 0.085;
const TOP = 0.07; // espessura da base
const UVR = 0.47; // quanto da foto cobre o recheio

function geometry(pos, uv, idx, expected) {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // garante que as faces apontam para o lado certo
  if (expected) {
    const n = g.getAttribute("normal");
    let s = 0;
    for (let i = 0; i < n.count; i++) s += n.getX(i) * expected.x + n.getY(i) * expected.y + n.getZ(i) * expected.z;
    if (s < 0) {
      for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
      g.setIndex(idx);
      g.computeVertexNormals();
    }
  }
  return g;
}

/** Leque (topo ou fundo da fatia). */
function wedgeFan(a0, a1, { y, dome = 0, K = 10, J = 18, uvFn, up = true }) {
  const pos = [], uv = [], idx = [];
  pos.push(0, y + dome, 0); uv.push(...uvFn(0, 0));
  for (let k = 1; k <= K; k++) {
    const r = (RI * k) / K;
    for (let j = 0; j <= J; j++) {
      const t = a0 + ((a1 - a0) * j) / J;
      const x = r * Math.cos(t), z = -r * Math.sin(t);
      const yy = y + dome * (1 - (r / RI) ** 2);
      pos.push(x, yy, z); uv.push(...uvFn(x, z));
    }
  }
  const row = J + 1;
  for (let j = 0; j < J; j++) idx.push(0, 1 + j, 2 + j);
  for (let k = 1; k < K; k++) {
    for (let j = 0; j < J; j++) {
      const a = 1 + (k - 1) * row + j, b = a + 1, c = 1 + k * row + j, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  return geometry(pos, uv, idx, new Vector3(0, up ? 1 : -1, 0));
}

/** Face do corte (retângulo do centro até a borda). */
function cutFace(a, outwardAngle) {
  const pos = [], uv = [];
  const cx = Math.cos(a), cz = -Math.sin(a);
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const r = (RI * i) / steps;
    pos.push(cx * r, 0, cz * r, cx * r, TOP + 0.02 * (1 - (r / RI) ** 2), cz * r);
    uv.push(i / steps, 0, i / steps, 1);
  }
  const idx = [];
  for (let i = 0; i < steps; i++) { const a0 = i * 2; idx.push(a0, a0 + 2, a0 + 1, a0 + 1, a0 + 2, a0 + 3); }
  return geometry(pos, uv, idx, new Vector3(Math.cos(outwardAngle), 0, -Math.sin(outwardAngle)));
}

/* ---------- Fio de queijo (tubo atualizado a cada quadro) ---------- */
class CheeseStrand {
  constructor(material, M = 18, K = 7) {
    this.M = M; this.K = K;
    const n = (M + 1) * K;
    this.pos = new Float32Array(n * 3);
    this.nor = new Float32Array(n * 3);
    const idx = [];
    for (let i = 0; i < M; i++) for (let k = 0; k < K; k++) {
      const a = i * K + k, b = i * K + ((k + 1) % K), c = a + K, d = b + K;
      idx.push(a, c, b, b, c, d);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new BufferAttribute(this.nor, 3));
    g.setIndex(idx);
    this.mesh = new Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.tmp = { P: new Vector3(), T: new Vector3(), N: new Vector3(), B: new Vector3(), up: new Vector3(0, 1, 0) };
  }
  update(A, Bp, sag, radius) {
    const { P, T, N, B, up } = this.tmp;
    const { M, K, pos, nor } = this;
    T.subVectors(Bp, A);
    const len = T.length() || 1e-4;
    for (let i = 0; i <= M; i++) {
      const t = i / M;
      P.lerpVectors(A, Bp, t);
      P.y -= sag * 4 * t * (1 - t);
      T.subVectors(Bp, A).divideScalar(len);
      T.y -= (sag * 4 * (1 - 2 * t)) / len;
      T.normalize();
      N.crossVectors(T, up);
      if (N.lengthSq() < 1e-6) N.set(1, 0, 0);
      N.normalize();
      B.crossVectors(T, N).normalize();
      const r = radius * (0.45 + 0.55 * (2 * t - 1) ** 2);
      for (let k = 0; k < K; k++) {
        const ph = (k / K) * Math.PI * 2, c = Math.cos(ph), s = Math.sin(ph);
        const o = (i * K + k) * 3;
        const nx = N.x * c + B.x * s, ny = N.y * c + B.y * s, nz = N.z * c + B.z * s;
        nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz;
        pos[o] = P.x + nx * r; pos[o + 1] = P.y + ny * r; pos[o + 2] = P.z + nz * r;
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.normal.needsUpdate = true;
  }
}

/**
 * Cria a pizza. `photoUrl` = foto de cima da pizza (quadrada).
 * Retorna { group, setExplode(e, pull), ready }.
 */
export function createPizza({ photoUrl, tier, slices = 8, garnish = true }) {
  const group = new Group();
  const texSize = tier.texSize;

  const topMat = new MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.45, bumpScale: 2.2 });
  topMat.color = new Color(0xe9a94f);
  const ready = new Promise((resolve) => {
    new TextureLoader().load(photoUrl, (tex) => {
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = 8;
      topMat.map = tex;
      topMat.bumpMap = tex; // o próprio relevo da foto vira volume nos ingredientes
      topMat.color.set(0xffffff);
      topMat.needsUpdate = true;
      resolve();
    }, undefined, () => resolve());
  });

  const crustMap = crustTexture(texSize);
  const bump = bumpNoise(256, 22);
  const crustMat = new MeshStandardMaterial({ map: crustMap, roughness: 0.82, bumpMap: bump, bumpScale: 3 });
  const cutMat = new MeshStandardMaterial({ map: sliceCutTexture(), roughness: 0.7, side: DoubleSide });
  const bottomMat = new MeshStandardMaterial({ map: bottomTexture(Math.min(512, texSize)), roughness: 0.9, bumpMap: bump, bumpScale: 2 });
  const capMat = new MeshStandardMaterial({ color: 0xf1dcae, roughness: 0.85, bumpMap: bump, bumpScale: 4 });
  const cheeseMat = new MeshPhysicalMaterial({ color: 0xf6dc8f, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.3, sheen: 0.5, sheenColor: new Color(0xfff2c8) });

  const step = (Math.PI * 2) / slices;
  const topUV = (x, z) => [0.5 + (x / RI) * UVR, 0.5 + (-z / RI) * UVR];
  const bottomUV = (x, z) => [0.5 + x * 0.5, 0.5 + z * 0.5];
  const leafGeo = garnish ? createLeafGeometry() : null;
  const leafMat = garnish ? leafMaterial() : null;

  const parts = [];
  for (let i = 0; i < slices; i++) {
    const a0 = i * step, a1 = a0 + step, mid = a0 + step / 2;
    const g = new Group();
    const top = new Mesh(wedgeFan(a0, a1, { y: TOP, dome: 0.02, uvFn: topUV }), topMat);
    const bottom = new Mesh(wedgeFan(a0, a1, { y: 0.0, uvFn: bottomUV, up: false, K: 4 }), bottomMat);
    const cut0 = new Mesh(cutFace(a0, a0 - Math.PI / 2), cutMat);
    const cut1 = new Mesh(cutFace(a1, a1 + Math.PI / 2), cutMat);

    const tg = new TorusGeometry(RC, TUBE, 14, 26, step);
    tg.rotateX(-Math.PI / 2); tg.scale(1, 0.8, 1); tg.rotateY(a0); tg.translate(0, 0.075, 0);
    const crust = new Mesh(tg, crustMat);

    for (const [ang, sign] of [[a0, -1], [a1, 1]]) {
      const cap = new Mesh(new CircleGeometry(TUBE * 0.94, 18), capMat);
      const c = new Vector3(RC * Math.cos(ang), 0.075, -RC * Math.sin(ang));
      const tangent = new Vector3(-Math.sin(ang), 0, -Math.cos(ang)).multiplyScalar(sign);
      cap.position.copy(c);
      cap.lookAt(c.clone().add(tangent));
      cap.scale.set(1, 0.8, 1);
      g.add(cap);
    }
    for (const m of [top, bottom, cut0, cut1, crust]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }

    if (leafGeo && i % 3 === 0) {
      const leaf = new Mesh(leafGeo, leafMat);
      const r = 0.42 + (i % 2) * 0.12;
      leaf.position.set(Math.cos(mid) * r, TOP + 0.035, -Math.sin(mid) * r);
      leaf.rotation.set(-Math.PI / 2 + 0.12, 0, mid + 1.2);
      leaf.scale.setScalar(0.32);
      leaf.castShadow = true;
      g.add(leaf);
    }
    g.userData = { mid, dir: new Vector3(Math.cos(mid), 0, -Math.sin(mid)), axis: new Vector3(Math.sin(mid), 0, Math.cos(mid)), seed: Math.random() };
    group.add(g);
    parts.push(g);
  }

  // Fios de queijo entre a fatia "puxada" (0) e as vizinhas
  const strands = [];
  for (let k = 0; k < 5; k++) {
    const s = new CheeseStrand(cheeseMat);
    s.mesh.visible = false;
    s.cfg = { side: k % 2 ? 1 : -1, r: 0.18 + k * 0.13, rad: 0.014 + (k % 3) * 0.005 };
    group.add(s.mesh);
    strands.push(s);
  }

  const q = new Quaternion();
  const A = new Vector3(), B = new Vector3();
  const local = new Vector3();

  /** e = afastamento geral (0–1); pull = quanto a fatia 0 é levantada (0–1). */
  function setExplode(e, pull = 0, time = 0) {
    parts.forEach((g, i) => {
      const { dir, axis, seed } = g.userData;
      const isHero = i === 0;
      const out = e * (0.16 + seed * 0.06) + (isHero ? pull * 0.55 : 0);
      g.position.copy(dir).multiplyScalar(out);
      g.position.y = e * (0.05 + seed * 0.08) + (isHero ? pull * 0.42 : 0) + Math.sin(time * 1.3 + seed * 6) * 0.01 * e;
      const tilt = (isHero ? pull * 0.55 : e * (seed - 0.5) * 0.25);
      q.setFromAxisAngle(axis, tilt);
      g.quaternion.copy(q);
    });
    const show = pull > 0.04;
    const hero = parts[0];
    strands.forEach((s) => {
      s.mesh.visible = show;
      if (!show) return;
      const { side, r, rad } = s.cfg;
      const neighbor = parts[side > 0 ? 1 : parts.length - 1];
      const ang = side > 0 ? hero.userData.mid + (Math.PI / slices) * 0.98 : hero.userData.mid - (Math.PI / slices) * 0.98;
      local.set(Math.cos(ang) * r, TOP + 0.005, -Math.sin(ang) * r);
      A.copy(local).applyQuaternion(hero.quaternion).add(hero.position);
      B.copy(local).applyQuaternion(neighbor.quaternion).add(neighbor.position);
      const len = A.distanceTo(B);
      const thin = Math.sqrt(0.05 / Math.max(0.05, len));
      s.update(A, B, Math.min(0.12, len * 0.22), rad * thin);
    });
  }
  setExplode(0, 0);
  return { group, parts, setExplode, ready };
}
