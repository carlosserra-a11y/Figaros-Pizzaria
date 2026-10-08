/* ============================================================
   Cena do topo: pizza 3D na tábua.
   - entra com as fatias caindo no lugar, uma a uma (mola), e um sopro de vapor
   - gira devagar; o mouse inclina; arrastar (mouse ou dedo) gira com inércia
   - clique/toque puxa uma fatia com fios de queijo, que volta com mola
   - ao rolar: as fatias se abrem em leque e a câmera se aproxima
   Desenha a 60 fps só quando algo muda; parada, cai para ~30 fps.
   ============================================================ */
import {
  PerspectiveCamera, Group, Mesh, CircleGeometry, LatheGeometry, Vector2, MeshStandardMaterial, MeshBasicMaterial,
  DirectionalLight, HemisphereLight, Sprite, SpriteMaterial, Scene,
} from "three";
import { wake, damp, clamp01, easeOutCubic, spring, prefersReducedMotion, trackElement } from "./core.js";
import { createPizza, pizzaMaterials } from "./pizza.js";
import { woodTexture, blobShadow, softSprite, bumpNoise } from "./textures.js";

const BASE_SPIN = 0.12; // rad/s

export function createHeroScene({ stage, container, photoUrl, tier, onReady }) {
  const scene = new Scene();
  scene.environmentIntensity = 0.75;
  const camera = new PerspectiveCamera(32, 1, 0.1, 50);
  const reduced = prefersReducedMotion();

  // Luzes: sol quente (sombra) + recorte dourado por trás + preenchimento
  const sun = new DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(-2.2, 4.2, 2.4);
  sun.castShadow = tier.shadows;
  sun.shadow.mapSize.set(tier.shadowSize, tier.shadowSize);
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 12 });
  sun.shadow.radius = 5; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  const rim = new DirectionalLight(0xffc27a, 1.5);
  rim.position.set(2.6, 2.4, -3.4);
  scene.add(sun, rim, new HemisphereLight(0xfff6e8, 0x6b4a2e, 0.6));

  const world = new Group();
  scene.add(world);

  const st = {
    tx: 0, ty: 0, px: 0, py: 0,
    spin: 0, spinVel: reduced ? 0 : BASE_SPIN,
    drag: null, pull: { x: 0, v: 0 }, pullT: 0, pullUntil: 0,
    intro: reduced ? 1 : 0, scroll: 0, lastInput: -1,
  };
  let pizza = null, steam = [], lastRender = -1;

  const section = container.closest("section") || container;
  const sec = trackElement(section);
  const now = () => performance.now() / 1000;

  /* ---------- Interação ---------- */
  // Mouse inclina a cena (no celular o dedo rola a página: não inclina)
  section.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const r = container.getBoundingClientRect();
    st.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    st.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    st.lastInput = now();
    wake();
  }, { passive: true });
  section.addEventListener("pointerleave", () => { st.tx = 0; st.ty = 0; wake(); });

  // Arrastar gira (com inércia); clique rápido puxa uma fatia
  container.addEventListener("pointerdown", (e) => {
    if (!pizza || e.button !== 0 || !container.classList.contains("is-3d")) return;
    st.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, t: performance.now(), t0: performance.now(), vel: 0, moved: false, w: Math.max(200, container.clientWidth) };
    wake();
  });
  window.addEventListener("pointermove", (e) => {
    const d = st.drag;
    if (!d || e.pointerId !== d.id) return;
    const ax = Math.abs(e.clientX - d.x0), ay = Math.abs(e.clientY - d.y0);
    if (!d.moved && ax > 6 && ax > ay) { d.moved = true; container.classList.add("dragging"); }
    if (d.moved) {
      const t = performance.now();
      const rad = ((e.clientX - d.x) / d.w) * Math.PI * 1.3;
      st.spin += rad;
      d.vel = damp(d.vel, rad / Math.max(0.008, (t - d.t) / 1000), 18, 0.016);
      d.t = t;
      st.lastInput = now();
      wake();
    }
    d.x = e.clientX;
  }, { passive: true });
  const endDrag = (e) => {
    const d = st.drag;
    if (!d || e.pointerId !== d.id) return;
    st.drag = null;
    container.classList.remove("dragging");
    if (d.moved) st.spinVel = Math.max(-7, Math.min(7, d.vel));
    else if (e.type === "pointerup" && performance.now() - d.t0 < 400) {
      // clique: puxa (ou devolve) uma fatia
      st.pullT = st.pullT ? 0 : 1;
      st.pullUntil = now() + 2.4;
      // gira para a fatia puxada ficar de frente para quem clicou
      st.spinVel = reduced ? 0 : BASE_SPIN;
    }
    st.lastInput = now();
    wake();
  };
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  /* ---------- Montagem (texturas vêm do worker) ---------- */
  const self = {
    tick(dt, time, f) {
      if (!pizza) return false;
      // progresso da rolagem dentro do topo (medidas em cache)
      const target = clamp01((f.y - sec.top) / (sec.height * 0.75));
      st.scroll = damp(st.scroll, target, 6, dt);
      st.px = damp(st.px, st.tx, 4, dt);
      st.py = damp(st.py, st.ty, 4, dt);
      if (!reduced && st.intro < 1) st.intro = Math.min(1, st.intro + dt / 2.1);
      if (!st.drag) {
        st.spinVel = damp(st.spinVel, reduced ? 0 : BASE_SPIN - st.scroll * 0.1, 1.4, dt);
        st.spin += st.spinVel * dt;
      }
      if (st.pullT && time > st.pullUntil) st.pullT = 0;
      spring(st.pull, st.pullT, dt, 70, 7.5);

      const s = st.scroll;
      const explode = easeOutCubic(clamp01(s * 1.6)) * 0.85;
      const pull = Math.max(easeOutCubic(clamp01((s - 0.12) * 1.8)), Math.max(0, st.pull.x));
      pizza.setExplode(explode, pull, time, st.intro);

      world.rotation.y = st.spin + st.px * 0.35;
      world.rotation.x = st.py * 0.12 + s * 0.25;
      world.position.y = reduced ? 0 : Math.sin(time * 0.8) * 0.015;

      // câmera: aproxima e desce um pouco ao rolar
      const dist = 6.3 - s * 0.9;
      const elev = 0.95 - s * 0.25;
      camera.position.set(0, Math.sin(elev) * dist, Math.cos(elev) * dist);
      camera.lookAt(0, 0.15 + s * 0.2, 0);

      // vapor + "sopro" quando a pizza termina de montar
      const introE = easeOutCubic(st.intro);
      const puff = st.intro > 0.6 && st.intro < 1 ? Math.sin(((st.intro - 0.6) / 0.4) * Math.PI) : 0;
      steam.forEach((sp) => {
        const u = (time * 0.18 + sp.userData.phase) % 1;
        sp.position.set(sp.userData.x * (1 + u), 0.2 + u * 1.4, sp.userData.z * (1 + u));
        sp.scale.setScalar(0.35 + u * 0.9 + puff * 0.5);
        sp.material.opacity = Math.sin(u * Math.PI) * (0.22 + puff * 0.3) * (1 - s) * introE;
      });

      // Só desenha a 60 fps quando algo está mudando; parada, ~30 fps (economiza bateria/GPU)
      const lively = st.drag || st.intro < 1 || Math.abs(f.vel) > 4 || time - st.lastInput < 1.2
        || Math.abs(st.scroll - target) > 0.0005 || Math.abs(st.pull.v) > 0.005 || Math.abs(st.pull.x - st.pullT) > 0.002
        || Math.abs(st.spinVel - (BASE_SPIN - st.scroll * 0.1)) > 0.02;
      if (!lively && time - lastRender < 1 / tier.idleFps) return true;
      if (lively) stage.quality(dt);
      lastRender = time;
      stage.render(scene, camera);
      return true;
    },
    dropShadows() {
      sun.castShadow = false;
      scene.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; [].concat(o.material).forEach((m) => (m.needsUpdate = true)); } });
    },
  };
  const entry = { container, cls: "hero-3d", scene: self, ready: false };
  stage.add(entry);

  (async () => {
    const [mats, wood, woodBump] = await Promise.all([pizzaMaterials({ photoUrl, tier }), woodTexture(tier.texSize), bumpNoise(256, 30), stage.envReady]);
    scene.environment = stage.env;

    // Tábua de madeira (topo + borda arredondada)
    const boardTop = new Mesh(new CircleGeometry(1.24, 96), new MeshStandardMaterial({ map: wood, roughness: 0.62, bumpMap: woodBump, bumpScale: 1.2 }));
    boardTop.rotation.x = -Math.PI / 2;
    boardTop.position.y = -0.005;
    boardTop.receiveShadow = true;
    const profile = [[0, -0.1], [1.2, -0.1], [1.25, -0.085], [1.27, -0.05], [1.25, -0.015], [1.235, -0.005]].map(([x, y]) => new Vector2(x, y));
    const rimMesh = new Mesh(new LatheGeometry(profile, 96), new MeshStandardMaterial({ color: 0x9a6232, roughness: 0.55, bumpMap: woodBump, bumpScale: 0.8, side: 2 }));
    rimMesh.castShadow = true; rimMesh.receiveShadow = true;
    const board = new Group();
    board.add(boardTop, rimMesh);
    world.add(board);

    // Sombra de contato sob a tábua (apoia a cena na página creme)
    const blob = new Mesh(new CircleGeometry(1.7, 48), new MeshBasicMaterial({ map: blobShadow(), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = -0.11;
    world.add(blob);

    pizza = createPizza({ mats, slices: 8 });
    pizza.group.position.y = 0.002;
    world.add(pizza.group);

    const steamTex = softSprite(64);
    steam = Array.from({ length: tier.low ? 4 : 7 }, (_, i) => {
      const s = new Sprite(new SpriteMaterial({ map: steamTex, transparent: true, opacity: 0, depthWrite: false, color: 0xffffff }));
      s.userData = { phase: i / 7, x: (Math.random() - 0.5) * 0.9, z: (Math.random() - 0.5) * 0.9 };
      world.add(s);
      return s;
    });

    // compila os shaders sem travar (paralelo quando o navegador suporta) antes do 1º quadro
    // (com todas as fatias visíveis: o compile ignora objetos escondidos)
    pizza.setExplode(0, 0, 0, 1);
    await stage.renderer.compileAsync?.(scene, camera).catch(() => {});
    stage.markReady(entry);
    onReady?.();
    wake();
  })().catch((e) => console.warn("[3D] topo desligado:", e));

  return self;
}
