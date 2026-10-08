/* ============================================================
   Comunicação com o servidor.
   - Com o servidor Node rodando: cardápio do banco, pedidos salvos e acompanhamento.
   - Sem servidor (ex.: GitHub Pages): usa data/menu.json e envia o pedido só pelo WhatsApp.
   Para apontar o site do GitHub Pages para um servidor publicado, edite
   <meta name="figaros-api" content="https://seu-servidor.com/"> no index.html.
   ============================================================ */
import { storeStatus } from "../shared/pricing.js";

export const SITE_ROOT = new URL("./", document.baseURI);
const metaApi = document.querySelector('meta[name="figaros-api"]')?.content?.trim();
export const API_ROOT = metaApi ? new URL(metaApi.endsWith("/") ? metaApi : metaApi + "/") : SITE_ROOT;

export const state = { online: false };

/** Resolve o caminho de uma imagem do cardápio (arquivo do site, upload no servidor ou URL externa). */
export function imgUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  if (path.startsWith("uploads/")) return new URL(path, API_ROOT).href;
  return new URL(path, SITE_ROOT).href;
}

// Fotos do cardápio (assets/img/menu/*.webp) existem em 320, 480 e 640 px.
const MENU_PHOTO = /^(.*\/assets\/img\/menu\/[^/?#]+)\.webp$/;
/** Versão pequena (miniaturas): baixa ~17 KB em vez de ~37 KB. */
export function thumbUrl(path, w = 320) {
  const url = imgUrl(path);
  const m = MENU_PHOTO.exec(url);
  return m ? `${m[1]}-${w}.webp` : url;
}
/** srcset para o navegador escolher o tamanho certo da foto ("" se não houver versões). */
export function photoSrcset(url) {
  const m = MENU_PHOTO.exec(url);
  return m ? `${m[1]}-320.webp 320w, ${m[1]}-480.webp 480w, ${url} 640w` : "";
}

async function request(path, { method = "GET", body, timeout = 8000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(new URL(path, API_ROOT), {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      credentials: "omit",
    });
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await res.json() : null;
    if (!res.ok) {
      const err = new Error(data?.error || `Erro ${res.status}`);
      err.status = res.status; err.data = data;
      throw err;
    }
    if (!isJson) { const err = new Error("Resposta inesperada do servidor."); err.status = res.status; throw err; }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function filterActive(menu) {
  const active = (x) => x && x.active !== false;
  const categories = (menu.categories || []).filter(active);
  const catIds = new Set(categories.map((c) => c.id));
  const products = (menu.products || []).filter((p) => active(p) && catIds.has(p.categoryId));
  const prodIds = new Set(products.map((p) => p.id));
  return {
    ...menu,
    categories,
    products,
    flavors: (menu.flavors || []).filter((f) => active(f) && prodIds.has(f.productId)),
    addonGroups: (menu.addonGroups || []).map((g) => ({ ...g, options: (g.options || []).filter(active) })),
    testimonials: (menu.testimonials || []).filter(active),
    bestSellers: menu.bestSellers || [],
  };
}

/** Só existe servidor se ele foi configurado ou se o site não está num host estático (GitHub Pages). */
const STATIC_HOST = !metaApi && /\.github\.io$/i.test(location.hostname);

export async function loadMenu() {
  try {
    // No GitHub Pages não há API: pedir api/menu só gerava um erro 404 e atrasava o cardápio
    if (STATIC_HOST) throw new Error("site estático");
    const menu = await request("api/menu", { timeout: 6000 });
    state.online = true;
    return menu;
  } catch {
    state.online = false;
    const res = await fetch(new URL("data/menu.json", SITE_ROOT), { cache: "no-cache" });
    if (!res.ok) throw new Error("Não foi possível carregar o cardápio.");
    const menu = filterActive(await res.json());
    menu.status = storeStatus(menu.store || {});
    return menu;
  }
}

export const createOrder = (payload) => request("api/orders", { method: "POST", body: payload, timeout: 15000 });
export const getOrder = (code) => request(`api/orders/${encodeURIComponent(code)}`);
export const getStatuses = (codes) => request(`api/orders/status?codes=${encodeURIComponent(codes.join(","))}`);
