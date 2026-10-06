/* ============================================================
   Caixa de pizza da Figaro's em 3D: abre conforme a rolagem
   e revela a pizza (com vapor). Tampa com a logo impressa.
   ============================================================ */
import {
  PerspectiveCamera, Group, Mesh, BoxGeometry, PlaneGeometry, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial,
  DirectionalLight, HemisphereLight, Sprite, SpriteMaterial, Scene, CircleGeometry,
} from "three";
import { createRenderer, studioEnvironment, autoResize, registerScene, guardContext, damp, clamp01, easeInOut, scrollProgress, prefersReducedMotion } from "./core.js";
import { createPizza } from "./pizza.js";
import { cardboardTexture, lidTexture, softSprite, blobShadow } from "./textures.js";

const W = 2.5, D = 2.5, H = 0.4, T = 0.03;

export function createBoxScene({ container, canvas, photoUrl, logoUrl, tier, onFail }) {
  const scene = new Scene();
  const renderer = createRenderer(canvas, tier, { shadows: true });
  studioEnvironment(renderer, scene, 0.7);
  const camera = new PerspectiveCamera(30, 1, 0.1, 60);

  const sun = new DirectionalLight(0xfff0da, 2.6);
  sun.position.set(-3, 6, 3.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(tier.shadowSize, tier.shadowSize);
  Object.assign(sun.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 0.5, far: 16 });
  sun.shadow.radius = 6; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  scene.add(sun, new HemisphereLight(0xfff8ec, 0x7a5636, 0.7));

  const outside = new MeshStandardMaterial({ map: cardboardTexture(512), roughness: 0.9 });
  const inside = new MeshStandardMaterial({ map: cardboardTexture(512, true), roughness: 0.92 });
  const print = new MeshStandardMaterial({ map: lidTexture(tier.texSize, null), roughness: 0.8 });
  const logo = new Image();
  logo.onload = () => { print.map.dispose(); print.map = lidTexture(tier.texSize, logo); print.needsUpdate = true; };
  logo.src = logoUrl;

  const panel = (w, h, d, mats) => { const m = new Mesh(new BoxGeometry(w, h, d), mats); m.castShadow = true; m.receiveShadow = true; return m; };
  // ordem das faces do BoxGeometry: +x, -x, +y, -y, +z, -z
  const sideMats = (inFace) => [0, 1, 2, 3, 4, 5].map((i) => (i === inFace ? inside : outside));

  const box = new Group();
  const base = new Group();
  const bottom = panel(W, T, D, [outside, outside, inside, outside, outside, outside]);
  bottom.position.y = T / 2;
  const front = panel(W, H, T, sideMats(5)); front.position.set(0, H / 2, D / 2 - T / 2);
  const back = panel(W, H, T, sideMats(4)); back.position.set(0, H / 2, -D / 2 + T / 2);
  const left = panel(T, H, D - 2 * T, sideMats(0)); left.position.set(-W / 2 + T / 2, H / 2, 0);
  const right = panel(T, H, D - 2 * T, sideMats(1)); right.position.set(W / 2 - T / 2, H / 2, 0);
  base.add(bottom, front, back, left, right);
  box.add(base);

  // Tampa articulada na borda de trás
  const lid = new Group();
  lid.position.set(0, H, -D / 2);
  const LW = W + 2 * T, LD = D + T;
  const lidTop = panel(LW, T, LD, [outside, outside, print, inside, outside, outside]);
  lidTop.position.set(0, T / 2, LD / 2);
  const lip = panel(LW, H * 0.55, T, sideMats(5));
  lip.position.set(0, -H * 0.275 + T, LD + T / 2);
  const lipL = panel(T, H * 0.55, LD, sideMats(0)); lipL.position.set(-LW / 2 + T / 2, -H * 0.275 + T, LD / 2);
  const lipR = panel(T, H * 0.55, LD, sideMats(1)); lipR.position.set(LW / 2 - T / 2, -H * 0.275 + T, LD / 2);
  lid.add(lidTop, lip, lipL, lipR);
  box.add(lid);

  const pizza = createPizza({ photoUrl, tier, slices: 8 });
  pizza.group.scale.setScalar(1.08);
  pizza.group.position.y = T + 0.004;
  box.add(pizza.group);

  const ground = new Mesh(new PlaneGeometry(14, 14), new ShadowMaterial({ opacity: 0.22 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  const blob = new Mesh(new CircleGeometry(2.4, 48), new MeshBasicMaterial({ map: blobShadow(), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.002;
  scene.add(ground, blob, box);

  const steamTex = softSprite(64);
  const steam = Array.from({ length: tier.low ? 4 : 8 }, (_, i) => {
    const s = new Sprite(new SpriteMaterial({ map: steamTex, transparent: true, opacity: 0, depthWrite: false }));
    s.userData = { phase: i / 8, x: (Math.random() - 0.5) * 1.4, z: (Math.random() - 0.5) * 1.2 };
    box.add(s);
    return s;
  });

  autoResize(renderer, camera, container);
  const reduced = prefersReducedMotion();
  const st = { p: reduced ? 0.7 : 0 };
  const section = container.closest("section") || container;

  const self = {
    tick(dt, time) {
      const target = reduced ? 0.7 : scrollProgress(section, { start: 0.95, end: 0.25 });
      st.p = damp(st.p, target, 5, dt);
      const p = st.p;
      const open = easeInOut(clamp01((p - 0.12) / 0.5));
      lid.rotation.x = -open * 1.95;
      box.rotation.y = -0.55 + p * 0.75 + (reduced ? 0 : Math.sin(time * 0.4) * 0.03);
      box.position.y = Math.sin(time * 0.9) * (reduced ? 0 : 0.02);
      pizza.setExplode(0, 0, time);
      pizza.group.position.y = T + 0.004 + open * 0.05;

      const dist = 7.6 - open * 0.9;
      const elev = 0.62 + open * 0.28;
      camera.position.set(0, Math.sin(elev) * dist + 0.2, Math.cos(elev) * dist);
      camera.lookAt(0, 0.35, 0.15);

      steam.forEach((sp) => {
        const u = (time * 0.16 + sp.userData.phase) % 1;
        sp.position.set(sp.userData.x, 0.3 + u * 1.8, sp.userData.z);
        sp.scale.setScalar(0.5 + u * 1.1);
        sp.material.opacity = Math.sin(u * Math.PI) * 0.26 * open;
      });
      renderer.render(scene, camera);
    },
    fail() { self.dead = true; self.active = false; onFail?.(); },
  };
  guardContext(renderer, self, onFail);
  registerScene(self, container);
  return self;
}
