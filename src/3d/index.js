/* ============================================================
   Entrada do 3D do site (empacotado em js/site/3d.js com `npm run build:3d`).
   Liga cada cena só se o aparelho aguentar; qualquer erro mantém
   a versão 2D da página funcionando.
   ============================================================ */
import { detectTier, prefersReducedMotion } from "./core.js";
import { createHeroScene } from "./hero.js";
import { createBackgroundScene } from "./background.js";
import { createBoxScene } from "./box.js";

function makeCanvas(parent, cls) {
  const c = document.createElement("canvas");
  c.className = cls;
  c.setAttribute("aria-hidden", "true");
  parent.appendChild(c);
  return c;
}

export function init3D({ hero, box, background, photoUrl, logoUrl } = {}) {
  const tier = detectTier();
  if (!tier) return { enabled: false, reason: "sem WebGL" };
  const reduced = prefersReducedMotion();
  const started = [];
  const scenes = {};

  if (hero) {
    try {
      const canvas = makeCanvas(hero, "hero-3d");
      scenes.hero = createHeroScene({
        container: hero, canvas, photoUrl, tier,
        onReady: () => hero.classList.add("is-3d"),
        onFail: () => { hero.classList.remove("is-3d"); canvas.remove(); },
      });
      started.push("hero");
    } catch (e) { console.warn("[3D] topo desligado:", e); }
  }

  if (box) {
    try {
      const canvas = makeCanvas(box, "box-3d");
      scenes.box = createBoxScene({ container: box, canvas, photoUrl, logoUrl, tier, onFail: () => { box.classList.remove("is-3d"); canvas.remove(); } });
      box.classList.add("is-3d");
      started.push("box");
    } catch (e) { console.warn("[3D] caixa desligada:", e); }
  }

  if (background && !reduced) {
    try {
      scenes.background = createBackgroundScene({ canvas: background, tier, onFail: () => document.documentElement.classList.remove("bg-3d") });
      document.documentElement.classList.add("bg-3d");
      started.push("fundo");
    } catch (e) { console.warn("[3D] fundo desligado:", e); }
  }
  // ?debug3d na URL: permite desenhar quadros manualmente (testes com a aba em segundo plano)
  if (new URLSearchParams(location.search).has("debug3d")) window.__fig3d = scenes;
  return { enabled: started.length > 0, started, tier };
}
