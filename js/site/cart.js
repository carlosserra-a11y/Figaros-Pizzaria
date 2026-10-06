/* Carrinho: salvo no navegador (sobrevive a recarregar a página) e sempre recalculado com o cardápio atual. */
import { storage } from "./util.js";
import { priceItem, priceCart } from "../shared/pricing.js";

const KEY = "fg_cart_v2";
const listeners = new Set();
let items = sanitize(storage.get(KEY, []));
let idx = null;

function sanitize(list) {
  return Array.isArray(list) ? list.filter((i) => i && typeof i === "object" && typeof i.productId === "string").slice(0, 40) : [];
}

/** Assinatura da escolha (para juntar itens iguais numa linha só). */
const signature = (it) => JSON.stringify({ p: it.productId, s: it.sizeId, f: it.flavorIds, a: it.addons, u: it.units, pa: it.parts, d: it.drinks, n: (it.notes || "").trim() });

function emit(change) {
  storage.set(KEY, items);
  listeners.forEach((fn) => fn(change));
}

export const cart = {
  setMenuIndex(i) { idx = i; emit({ type: "menu" }); },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  get items() { return items; },

  add(selection) {
    const sig = signature(selection);
    const same = items.find((it) => signature(it) === sig);
    if (same) same.qty = Math.min(50, (same.qty || 1) + (selection.qty || 1));
    else items.push({ ...selection, key: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, qty: selection.qty || 1 });
    emit({ type: "add" });
  },
  replace(key, selection) {
    const i = items.findIndex((it) => it.key === key);
    if (i >= 0) items[i] = { ...selection, key };
    emit({ type: "update" });
  },
  setQty(key, qty) {
    const it = items.find((x) => x.key === key);
    if (!it) return;
    if (qty <= 0) items = items.filter((x) => x.key !== key);
    else it.qty = Math.min(50, qty);
    emit({ type: "qty" });
  },
  remove(key) { items = items.filter((x) => x.key !== key); emit({ type: "remove" }); },
  clear() { items = []; emit({ type: "clear" }); },

  count() { return items.reduce((s, it) => s + (it.qty || 1), 0); },
  priced(it) { return idx ? priceItem(idx, it) : null; },
  totals(opts) { return idx ? priceCart(idx, items, opts) : null; },
};

// Mantém abas abertas sincronizadas
window.addEventListener("storage", (e) => {
  if (e.key === KEY) { items = sanitize(storage.get(KEY, [])); listeners.forEach((fn) => fn({ type: "sync" })); }
});
