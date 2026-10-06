/* ============================================================
   Fundo 3D da página: ingredientes flutuando em profundidade.
   A câmera desce junto com a rolagem — objetos mais distantes
   andam mais devagar (parallax de verdade) e giram conforme a
   velocidade da rolagem. Névoa creme dá a sensação de profundidade.
   ============================================================ */
import {
  PerspectiveCamera, InstancedMesh, Object3D, Fog, Color, DirectionalLight, HemisphereLight,
  Points, BufferGeometry, Float32BufferAttribute, PointsMaterial, Scene, Euler, Quaternion, Vector3, DynamicDrawUsage,
} from "three";
import { createRenderer, studioEnvironment, registerScene, guardContext, damp, prefersReducedMotion } from "./core.js";
import { INGREDIENTS } from "./ingredients.js";
import { softSprite } from "./textures.js";

const FOV = 35;
const CAM_Z = 12;

export function createBackgroundScene({ canvas, tier, onFail }) {
  const scene = new Scene();
  const renderer = createRenderer(canvas, { ...tier, maxDpr: Math.min(tier.maxDpr, 1.5) });
  studioEnvironment(renderer, scene, 0.9);
  const cream = new Color(0xf4ecd9);
  scene.fog = new Fog(cream, 9, 30);
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 60);
  camera.position.z = CAM_Z;

  const sun = new DirectionalLight(0xfff0d8, 2.2);
  sun.position.set(-4, 6, 8);
  scene.add(sun, new HemisphereLight(0xfffaf0, 0xb48a5a, 0.9));

  // unidades do mundo por pixel no plano z=0
  let worldPerPx = 0, viewW = 0, viewH = 0, docH = 0;
  const reduced = prefersReducedMotion();

  const kinds = Object.keys(INGREDIENTS);
  const perKind = tier.low ? 2 : tier.small ? 3 : 4;
  const dummy = new Object3D();
  const meshes = [];
  const items = [];

  for (const k of kinds) {
    const { geometry, material } = INGREDIENTS[k]();
    const mesh = new InstancedMesh(geometry, material, perKind);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);
    meshes.push(mesh);
    for (let i = 0; i < perKind; i++) {
      items.push({
        mesh, i,
        side: Math.random() < 0.5 ? -1 : 1,
        lane: Math.random(),          // posição vertical ao longo da página (0–1)
        z: -2 - Math.random() * 14,   // profundidade
        scale: 0.55 + Math.random() * 0.55,
        rot: new Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        spin: new Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4),
        bob: Math.random() * Math.PI * 2,
        x: 0, y: 0,
      });
    }
  }
  // espalha as faixas verticais de forma uniforme (sem aglomerar)
  items.sort(() => Math.random() - 0.5).forEach((it, n) => { it.lane = (n + Math.random() * 0.8) / items.length; });

  // farinha no ar
  const flourN = tier.low ? 140 : 320;
  const fpos = new Float32Array(flourN * 3);
  const fgeo = new BufferGeometry();
  fgeo.setAttribute("position", new Float32BufferAttribute(fpos, 3));
  const flour = new Points(fgeo, new PointsMaterial({ map: softSprite(32, "255,250,238"), size: 0.12, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true, color: 0xfffaf0 }));
  flour.frustumCulled = false;
  scene.add(flour);
  const flourSeed = Array.from({ length: flourN }, () => [Math.random(), Math.random(), -1 - Math.random() * 16, Math.random() * 6]);

  function layout() {
    viewW = window.innerWidth; viewH = window.innerHeight;
    docH = Math.max(document.documentElement.scrollHeight, viewH);
    renderer.setSize(viewW, viewH, false);
    camera.aspect = viewW / viewH;
    camera.updateProjectionMatrix();
    worldPerPx = (2 * Math.tan((FOV * Math.PI) / 360) * CAM_Z) / viewH;
    const halfW0 = (viewW / 2) * worldPerPx, halfH0 = (viewH / 2) * worldPerPx;
    const travel = (docH - viewH) * worldPerPx; // quanto a câmera desce do topo ao fim da página
    for (const it of items) {
      const depthScale = (CAM_Z - it.z) / CAM_Z; // planos mais distantes mostram uma área maior
      // laterais: deixa o centro livre para o texto
      const edge = viewW < 700 ? 0.62 : 0.5;
      it.x = it.side * halfW0 * depthScale * (edge + Math.random() * (1 - edge) * 0.95);
      it.y = halfH0 * 0.8 - it.lane * (travel + halfH0 * 1.6);
    }
  }
  layout();
  window.addEventListener("resize", layout);
  if ("ResizeObserver" in window) new ResizeObserver(() => { const h = document.documentElement.scrollHeight; if (Math.abs(h - docH) > 40) layout(); }).observe(document.body);

  const st = { y: 0, vel: 0, lastScroll: window.scrollY, px: 0, tx: 0 };
  window.addEventListener("pointermove", (e) => { st.tx = (e.clientX / window.innerWidth) * 2 - 1; }, { passive: true });
  const q = new Quaternion(), e3 = new Euler();

  const self = {
    tick(dt, time) {
      const sy = window.scrollY;
      const v = (sy - st.lastScroll) / Math.max(dt, 0.001);
      st.lastScroll = sy;
      st.vel = damp(st.vel, Math.max(-3000, Math.min(3000, v)), 4, dt);
      st.y = -sy * worldPerPx;
      st.px = damp(st.px, st.tx, 2, dt);
      camera.position.set(st.px * 0.4, st.y, CAM_Z);
      camera.lookAt(st.px * 0.1, st.y, 0);

      const boost = reduced ? 0 : st.vel * 0.0009;
      for (const it of items) {
        if (!reduced) {
          it.rot.x += (it.spin.x + boost * it.spin.x * 3) * dt;
          it.rot.y += (it.spin.y + boost) * dt;
          it.rot.z += it.spin.z * dt;
        }
        const bob = reduced ? 0 : Math.sin(time * 0.6 + it.bob) * 0.12;
        dummy.position.set(it.x, it.y + bob, it.z);
        q.setFromEuler(e3.set(it.rot.x, it.rot.y, it.rot.z));
        dummy.quaternion.copy(q);
        dummy.scale.setScalar(it.scale);
        dummy.updateMatrix();
        it.mesh.setMatrixAt(it.i, dummy.matrix);
      }
      for (const m of meshes) m.instanceMatrix.needsUpdate = true;

      const halfH = (viewH / 2) * worldPerPx, halfW = (viewW / 2) * worldPerPx;
      for (let i = 0; i < flourN; i++) {
        const [fx, fy, fz, ph] = flourSeed[i];
        const depth = (CAM_Z - fz) / CAM_Z;
        const span = halfH * 2 * depth;
        const yy = ((fy * span + time * 0.25 * (0.5 + ph / 6) + (reduced ? 0 : st.vel * 0.00004)) % span + span) % span;
        fpos[i * 3] = (fx * 2 - 1) * halfW * depth + Math.sin(time * 0.3 + ph) * 0.2;
        fpos[i * 3 + 1] = st.y - halfH * depth + yy;
        fpos[i * 3 + 2] = fz;
      }
      fgeo.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    },
    fail() { self.dead = true; self.active = false; onFail?.(); },
  };
  guardContext(renderer, self, onFail);
  registerScene(self, null);
  return self;
}
