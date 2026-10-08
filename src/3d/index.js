/* ============================================================
   Entrada do 3D do site (empacotado em js/site/3d.js com `npm run build:3d`).
   - topo e caixa dividem UM renderer (o "palco"); o fundo tem o seu
   - no máximo 2 contextos WebGL (antes eram 4)
   - tudo roda no laço único do site e pausa com modal aberto
   Qualquer erro mantém a versão 2D da página funcionando.
   ============================================================ */
import { detectTier, prefersReducedMotion, createStage, useTicker, setPaused, yieldToMain } from "./core.js";
import { createHeroScene } from "./hero.js";
import { createBackgroundScene } from "./background.js";
import { createBoxScene } from "./box.js";

export function init3D({ hero, box, background, photoUrl, logoUrl, ticker, storyProgress, covers, quality, onBackground } = {}) {
  const tier = detectTier(quality);
  if (!tier) return { enabled: false, reason: "sem WebGL" };
  useTicker(ticker);
  const reduced = prefersReducedMotion();
  const started = [];
  const scenes = {};

  if (hero || box) {
    try {
      const stage = createStage(tier);
      scenes.stage = stage;
      if (hero) { scenes.hero = createHeroScene({ stage, container: hero, photoUrl, tier }); started.push("hero"); }
      if (box) { scenes.box = createBoxScene({ stage, container: box, photoUrl, logoUrl, tier, storyProgress }); started.push("box"); }
    } catch (e) { console.warn("[3D] topo/caixa desligados:", e); }
  }

  if (background && !reduced) {
    started.push("fundo");
    // o fundo nasce num pedaço separado (cada renderer novo custa alguns milissegundos)
    yieldToMain().then(() => {
      try {
        scenes.background = createBackgroundScene({
          canvas: background, tier, covers,
          onReady: () => { document.documentElement.classList.add("bg-3d"); onBackground?.(); },
          onFail: () => document.documentElement.classList.remove("bg-3d"),
        });
      } catch (e) { console.warn("[3D] fundo desligado:", e); }
    });
  }

  // Carrinho, produto ou checkout aberto por cima: o 3D para de desenhar
  document.addEventListener("figaros:layers", (e) => setPaused(!!e.detail?.open));

  // ?debug3d na URL: expõe as cenas para inspeção
  if (new URLSearchParams(location.search).has("debug3d")) window.__fig3d = { scenes, tier };
  return { enabled: started.length > 0, started, tier };
}
