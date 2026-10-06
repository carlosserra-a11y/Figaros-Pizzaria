/* ============================================================
   Cena do topo: pizza 3D na tábua.
   - entra montando as fatias
   - gira devagar e inclina seguindo o mouse/dedo
   - ao rolar a página: as fatias se abrem e uma é "puxada" com fios de queijo
   ============================================================ */
import {
  PerspectiveCamera, Group, Mesh, CircleGeometry, LatheGeometry, Vector2, MeshStandardMaterial, MeshBasicMaterial,
  DirectionalLight, HemisphereLight, Sprite, SpriteMaterial, Scene,
} from "three";
import { createRenderer, studioEnvironment, autoResize, registerScene, guardContext, damp, clamp01, easeOutCubic, prefersReducedMotion } from "./core.js";
import { createPizza } from "./pizza.js";
import { woodTexture, blobShadow, softSprite, bumpNoise } from "./textures.js";

export function createHeroScene({ container, canvas, photoUrl, tier, onReady, onFail }) {
  const scene = new Scene();
  const renderer = createRenderer(canvas, tier, { shadows: true });
  studioEnvironment(renderer, scene, 0.75);
  const camera = new PerspectiveCamera(32, 1, 0.1, 50);
  const target = { x: 0, y: 0.15, z: 0 };

  // Luzes: sol quente (sombra) + preenchimento
  const sun = new DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(-2.2, 4.2, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(tier.shadowSize, tier.shadowSize);
  sun.shadow.camera.left = -2; sun.shadow.camera.right = 2; sun.shadow.camera.top = 2; sun.shadow.camera.bottom = -2;
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 12;
  sun.shadow.radius = 5; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  scene.add(sun, new HemisphereLight(0xfff6e8, 0x6b4a2e, 0.6));

  const world = new Group();
  scene.add(world);

  // Tábua de madeira (topo + borda arredondada)
  const wood = woodTexture(tier.texSize);
  const woodBump = bumpNoise(256, 30);
  const boardMat = new MeshStandardMaterial({ map: wood, roughness: 0.62, bumpMap: woodBump, bumpScale: 1.2 });
  const boardTop = new Mesh(new CircleGeometry(1.24, 96), boardMat);
  boardTop.rotation.x = -Math.PI / 2;
  boardTop.position.y = -0.005;
  boardTop.receiveShadow = true;
  const profile = [[0, -0.1], [1.2, -0.1], [1.25, -0.085], [1.27, -0.05], [1.25, -0.015], [1.235, -0.005]].map(([x, y]) => new Vector2(x, y));
  const rim = new Mesh(new LatheGeometry(profile, 96), new MeshStandardMaterial({ color: 0x9a6232, roughness: 0.55, bumpMap: woodBump, bumpScale: 0.8, side: 2 }));
  rim.castShadow = true; rim.receiveShadow = true;
  const board = new Group();
  board.add(boardTop, rim);
  world.add(board);

  // Sombra de contato sob a tábua (apoia a cena na página creme)
  const blob = new Mesh(new CircleGeometry(1.7, 48), new MeshBasicMaterial({ map: blobShadow(), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = -0.11;
  world.add(blob);

  const pizza = createPizza({ photoUrl, tier, slices: 8 });
  pizza.group.position.y = 0.002;
  world.add(pizza.group);

  // Vapor
  const steamTex = softSprite(64);
  const steam = Array.from({ length: tier.low ? 4 : 7 }, (_, i) => {
    const s = new Sprite(new SpriteMaterial({ map: steamTex, transparent: true, opacity: 0, depthWrite: false, color: 0xffffff }));
    s.userData = { phase: i / 7, x: (Math.random() - 0.5) * 0.9, z: (Math.random() - 0.5) * 0.9 };
    world.add(s);
    return s;
  });

  // Interação
  const st = { px: 0, py: 0, tx: 0, ty: 0, scroll: 0, scrollT: 0, intro: prefersReducedMotion() ? 1 : 0, spin: 0 };
  const onMove = (e) => {
    const r = container.getBoundingClientRect();
    st.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    st.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
  };
  const section = container.closest("section") || container;
  section.addEventListener("pointermove", onMove, { passive: true });
  section.addEventListener("pointerleave", () => { st.tx = 0; st.ty = 0; });

  const resize = autoResize(renderer, camera, container);
  const reduced = prefersReducedMotion();

  const self = {
    tick(dt, time) {
      // progresso da rolagem dentro do topo
      const r = section.getBoundingClientRect();
      st.scrollT = clamp01(-r.top / (r.height * 0.75));
      st.scroll = damp(st.scroll, st.scrollT, 6, dt);
      st.px = damp(st.px, st.tx, 4, dt);
      st.py = damp(st.py, st.ty, 4, dt);
      if (!reduced) st.intro = Math.min(1, st.intro + dt * 0.55);
      if (!reduced) st.spin += dt * (0.12 - st.scroll * 0.1);

      const intro = easeOutCubic(st.intro);
      const s = st.scroll;
      const explode = (1 - intro) * 0.9 + easeOutCubic(clamp01(s * 1.6)) * 0.85;
      const pull = easeOutCubic(clamp01((s - 0.12) * 1.8));
      pizza.setExplode(explode, pull, time);

      world.rotation.y = st.spin + st.px * 0.35;
      world.rotation.x = st.py * 0.12 + s * 0.25;
      world.position.y = (1 - intro) * 0.6 + Math.sin(time * 0.8) * 0.015;

      // câmera: aproxima e desce um pouco ao rolar
      const dist = 6.3 - s * 0.9;
      const elev = 0.95 - s * 0.25;
      camera.position.set(0, Math.sin(elev) * dist, Math.cos(elev) * dist);
      camera.lookAt(target.x, target.y + s * 0.2, target.z);

      steam.forEach((sp) => {
        const u = (time * 0.18 + sp.userData.phase) % 1;
        sp.position.set(sp.userData.x * (1 + u), 0.2 + u * 1.4, sp.userData.z * (1 + u));
        sp.scale.setScalar(0.35 + u * 0.9);
        sp.material.opacity = Math.sin(u * Math.PI) * 0.22 * (1 - s) * intro;
      });

      renderer.render(scene, camera);
    },
    fail() { self.dead = true; self.active = false; onFail?.(); },
  };
  guardContext(renderer, self, onFail);
  registerScene(self, container);
  pizza.ready.then(() => { resize(); onReady?.(); });
  return self;
}
