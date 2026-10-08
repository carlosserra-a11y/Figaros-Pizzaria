/* ============================================================
   Caixa de pizza da Figaro's em 3D, contada pela rolagem
   (seção "Como pedir", que fica fixa na tela no computador):
   caixa fechada → tampa destrava com um pulinho e abre com mola
   → vapor → a pizza sobe e se inclina para quem está olhando.
   A tampa tem a logo impressa.
   ============================================================ */
import {
  PerspectiveCamera, Group, Mesh, BoxGeometry, PlaneGeometry, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial,
  DirectionalLight, HemisphereLight, Sprite, SpriteMaterial, Scene, CircleGeometry,
} from "three";
import { wake, damp, clamp01, easeInOut, easeOutBack, easeOutCubic, prefersReducedMotion, trackElement } from "./core.js";
import { createPizza, pizzaMaterials } from "./pizza.js";
import { cardboardTexture, lidTexture, softSprite, blobShadow } from "./textures.js";

const W = 2.5, D = 2.5, H = 0.4, T = 0.03;

export function createBoxScene({ stage, container, photoUrl, logoUrl, tier, storyProgress, onReady }) {
  const scene = new Scene();
  scene.environmentIntensity = 0.7;
  const camera = new PerspectiveCamera(33, 1, 0.1, 60);
  const reduced = prefersReducedMotion();

  const sun = new DirectionalLight(0xfff0da, 2.6);
  sun.position.set(-3, 6, 3.5);
  sun.castShadow = tier.shadows;
  sun.shadow.mapSize.set(tier.shadowSize, tier.shadowSize);
  Object.assign(sun.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 0.5, far: 16 });
  sun.shadow.radius = 6; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  const rim = new DirectionalLight(0xffc27a, 1.2);
  rim.position.set(3, 2.5, -4);
  scene.add(sun, rim, new HemisphereLight(0xfff8ec, 0x7a5636, 0.7));

  const section = container.closest("section") || container;
  const sec = trackElement(section);
  // Sem a função do site, calcula o progresso da seção atravessando a tela
  const fallbackProgress = (f) => clamp01((f.y + f.vh * 0.95 - sec.top) / (f.vh * 0.7 + sec.height));

  let box = null, lid = null, pizza = null, steam = [], lastRender = -1;
  const st = { p: reduced ? 0.75 : 0 };

  const self = {
    tick(dt, time, f) {
      if (!box) return false;
      const target = reduced ? 0.75 : (storyProgress ? storyProgress() : fallbackProgress(f));
      const prev = st.p;
      st.p = damp(st.p, target, 6, dt);
      const p = st.p;

      const openRaw = clamp01((p - 0.2) / 0.38);
      const open = easeInOut(openRaw);
      const rise = easeOutCubic(clamp01((p - 0.58) / 0.3));
      const pop = Math.sin(clamp01((p - 0.14) / 0.12) * Math.PI) * 0.07; // a tampa "destrava"

      lid.rotation.x = -easeOutBack(openRaw, 1.4) * 1.95;
      box.rotation.y = -0.55 + p * 0.75 + (reduced ? 0 : Math.sin(time * 0.4) * 0.03);
      box.position.y = pop + (reduced ? 0 : Math.sin(time * 0.9) * 0.02);
      pizza.setExplode(rise * 0.3, 0, time);
      pizza.group.position.y = T + 0.004 + open * 0.05 + rise * 0.3;
      pizza.group.rotation.x = rise * 0.32;

      // câmera recua e mira mais alto conforme a tampa abre (a tampa aberta fica inteira no quadro)
      const dist = 7.6 + open * 0.75 - rise * 0.35;
      const elev = 0.62 + open * 0.05;
      camera.position.set(0, Math.sin(elev) * dist + 0.2, Math.cos(elev) * dist);
      camera.lookAt(0, 0.35 + open * 0.8 + rise * 0.1, 0.15);

      steam.forEach((sp) => {
        const u = (time * 0.16 + sp.userData.phase) % 1;
        sp.position.set(sp.userData.x, 0.3 + rise * 0.3 + u * 1.8, sp.userData.z);
        sp.scale.setScalar(0.5 + u * 1.1);
        sp.material.opacity = Math.sin(u * Math.PI) * 0.26 * open * (1 + rise * 0.4);
      });

      const lively = Math.abs(p - prev) > 0.0002 || Math.abs(f.vel) > 4;
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
  const entry = { container, cls: "box-3d", scene: self, ready: false };
  stage.add(entry);

  (async () => {
    const [mats, outsideMap, insideMap, printMap] = await Promise.all([
      pizzaMaterials({ photoUrl, tier }), cardboardTexture(512), cardboardTexture(512, true), lidTexture(tier.texSize, logoUrl), stage.envReady,
    ]);
    scene.environment = stage.env;
    const outside = new MeshStandardMaterial({ map: outsideMap, roughness: 0.9 });
    const inside = new MeshStandardMaterial({ map: insideMap, roughness: 0.92 });
    const print = new MeshStandardMaterial({ map: printMap, roughness: 0.8 });

    const panel = (w, h, d, mats) => { const m = new Mesh(new BoxGeometry(w, h, d), mats); m.castShadow = true; m.receiveShadow = true; return m; };
    // ordem das faces do BoxGeometry: +x, -x, +y, -y, +z, -z
    const sideMats = (inFace) => [0, 1, 2, 3, 4, 5].map((i) => (i === inFace ? inside : outside));

    box = new Group();
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
    lid = new Group();
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

    pizza = createPizza({ mats, slices: 8 });
    pizza.group.scale.setScalar(1.08);
    pizza.group.position.y = T + 0.004;
    box.add(pizza.group);

    const ground = new Mesh(new PlaneGeometry(14, 14), new ShadowMaterial({ opacity: 0.22 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.visible = tier.shadows;
    const blob = new Mesh(new CircleGeometry(2.4, 48), new MeshBasicMaterial({ map: blobShadow(), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.002;
    scene.add(ground, blob, box);

    const steamTex = softSprite(64);
    steam = Array.from({ length: tier.low ? 4 : 8 }, (_, i) => {
      const s = new Sprite(new SpriteMaterial({ map: steamTex, transparent: true, opacity: 0, depthWrite: false }));
      s.userData = { phase: i / 8, x: (Math.random() - 0.5) * 1.4, z: (Math.random() - 0.5) * 1.2 };
      box.add(s);
      return s;
    });

    await stage.renderer.compileAsync?.(scene, camera).catch(() => {});
    stage.markReady(entry);
    onReady?.();
    wake();
  })().catch((e) => console.warn("[3D] caixa desligada:", e));

  return self;
}
