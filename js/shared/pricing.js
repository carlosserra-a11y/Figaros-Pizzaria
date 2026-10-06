/* ============================================================
   Regras de preço e validação de itens — usado pelo site E pelo
   servidor (o servidor sempre recalcula; nunca confia no navegador).
   Todos os cálculos são feitos em centavos (inteiros).
   ============================================================ */

export const toCents = (v) => Math.round(Number(v || 0) * 100);
export const fromCents = (c) => Math.round(c) / 100;

export const formatBRL = (value) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Converte "1.234,56", "1234,56", "8,9", "8.9" ou 8.9 em número. */
export function parseDecimal(v) {
  if (typeof v === "number") return v;
  let s = String(v ?? "").trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  return Number(s);
}

export const MAX_QTY = 50;
export const MAX_NOTES = 140;

/** Índice do cardápio para buscas rápidas. */
export function indexMenu(menu) {
  const byId = (list) => new Map((list || []).map((x) => [x.id, x]));
  return {
    menu,
    store: menu.store || {},
    products: byId(menu.products),
    flavors: byId(menu.flavors),
    addonGroups: byId(menu.addonGroups),
    categories: byId(menu.categories),
  };
}

const isActive = (x) => x && x.active !== false;

export function flavorsOf(idx, productId, { includeInactive = false } = {}) {
  return [...idx.flavors.values()]
    .filter((f) => f.productId === productId && (includeInactive || isActive(f)))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

/** Preço de um sabor num tamanho (em centavos) ou null se não vendido nesse tamanho. */
export function flavorPriceCents(flavor, sizeId) {
  const v = flavor?.prices?.[sizeId];
  return v === undefined || v === null || v === "" ? null : toCents(v);
}

/** Combina os preços dos sabores conforme a regra da loja. */
export function combineFlavorPrices(centsList, rule = "average") {
  if (!centsList.length) return 0;
  if (rule === "highest") return Math.max(...centsList);
  return Math.round(centsList.reduce((s, c) => s + c, 0) / centsList.length);
}

/** Menor preço (centavos) entre os sabores ativos de um produto num tamanho. */
export function cheapestFlavorCents(idx, productId, sizeId, allowedIds) {
  const prices = flavorsOf(idx, productId)
    .filter((f) => !allowedIds || allowedIds.includes(f.id))
    .map((f) => flavorPriceCents(f, sizeId))
    .filter((c) => c !== null);
  return prices.length ? Math.min(...prices) : 0;
}

/** Menor preço "a partir de" de um sabor (em reais). */
export function minFlavorPrice(flavor) {
  const vals = Object.values(flavor?.prices || {}).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  return vals.length ? Math.min(...vals) : null;
}

function addonCents(idx, groupId, optionId, errors, label = "") {
  if (!groupId) return { cents: 0, line: null };
  const group = idx.addonGroups.get(groupId);
  if (!group) return { cents: 0, line: null };
  const chosen = optionId || group.defaultOptionId;
  if (!chosen) return { cents: 0, line: null };
  const opt = (group.options || []).find((o) => o.id === chosen && isActive(o));
  if (!opt) {
    errors.push(`Opção de ${group.name.toLowerCase()} indisponível${label ? " (" + label + ")" : ""}.`);
    return { cents: 0, line: null };
  }
  return { cents: toCents(opt.price), line: `${group.name}: ${opt.name}`, option: opt };
}

function checkFlavors(idx, { productId, sizeId, flavorIds, maxFlavors, allowedFlavorIds }, errors, label) {
  const where = label ? ` em "${label}"` : "";
  if (!Array.isArray(flavorIds) || flavorIds.length === 0) {
    errors.push(`Escolha pelo menos 1 sabor${where}.`);
    return [];
  }
  if (flavorIds.length > maxFlavors) errors.push(`Máximo de ${maxFlavors} sabor(es)${where}.`);
  const flavors = [];
  for (const id of flavorIds) {
    const f = idx.flavors.get(id);
    if (!f || f.productId !== productId || !isActive(f)) { errors.push(`Sabor indisponível${where}.`); continue; }
    if (allowedFlavorIds && allowedFlavorIds.length && !allowedFlavorIds.includes(id)) { errors.push(`O sabor ${f.name} não faz parte deste combo.`); continue; }
    if (flavorPriceCents(f, sizeId) === null) { errors.push(`O sabor ${f.name} não está disponível neste tamanho.`); continue; }
    flavors.push(f);
  }
  return flavors;
}

const clampQty = (q) => Math.min(MAX_QTY, Math.max(1, Math.floor(Number(q) || 1)));

/**
 * Calcula preço e descrição de UM item do carrinho.
 * Retorna { ok, errors, unitCents, totalCents, qty, title, lines[], image }
 */
export function priceItem(idx, item) {
  const errors = [];
  const product = idx.products.get(item?.productId);
  const qty = clampQty(item?.qty);
  const notes = String(item?.notes || "").slice(0, MAX_NOTES).trim();
  if (!product || !isActive(product)) {
    return { ok: false, errors: ["Produto indisponível."], unitCents: 0, totalCents: 0, qty, title: "Produto indisponível", lines: [], notes };
  }
  const rule = idx.store.pricingRule || "average";
  const lines = [];
  let unit = 0;
  let title = product.name;
  let image = product.image;

  if (product.kind === "simple") {
    unit = toCents(product.price);
  } else if (product.kind === "pizza") {
    const size = (product.sizes || []).find((s) => s.id === item.sizeId);
    if (!size) {
      errors.push("Escolha um tamanho.");
    } else {
      const flavors = checkFlavors(idx, { productId: product.id, sizeId: size.id, flavorIds: item.flavorIds, maxFlavors: size.maxFlavors || 1 }, errors);
      unit = combineFlavorPrices(flavors.map((f) => flavorPriceCents(f, size.id)), rule);
      const n = flavors.length;
      title = `${product.name} ${size.name}`;
      if (n === 1) { title = `${flavors[0].name} · ${size.name}`; image = flavors[0].image || image; }
      if (n > 1) { lines.push(`${n} sabores: ${flavors.map((f) => `1/${n} ${f.name}`).join(", ")}`); image = flavors[0].image || image; }
      if (size.includes) lines.push(`Inclui: ${size.includes}`);
      const add = addonCents(idx, product.addonGroupId, item.addons?.[product.addonGroupId], errors);
      unit += add.cents;
      if (add.line && add.option && (add.option.price > 0 || add.option.id !== idx.addonGroups.get(product.addonGroupId)?.defaultOptionId)) lines.push(add.line);
    }
  } else if (product.kind === "units") {
    const size = (product.sizes || []).find((s) => s.id === item.sizeId);
    if (!size) {
      errors.push("Escolha uma opção.");
    } else {
      unit = toCents(size.price);
      title = `${product.name} · ${size.name}`;
      const units = item.units && typeof item.units === "object" ? item.units : {};
      let total = 0; const parts = [];
      for (const [fid, raw] of Object.entries(units)) {
        const count = Math.floor(Number(raw) || 0);
        if (count <= 0) continue;
        const f = idx.flavors.get(fid);
        if (!f || f.productId !== product.id || !isActive(f)) { errors.push("Sabor indisponível."); continue; }
        total += count; parts.push(`${count}× ${f.name}`);
      }
      if (total !== size.units) errors.push(`Distribua exatamente ${size.units} unidades entre os sabores (faltam ${size.units - total}).`);
      if (parts.length) lines.push(parts.join(", "));
      if (size.includes) lines.push(`Inclui: ${size.includes}`);
    }
  } else if (product.kind === "combo") {
    unit = toCents(product.price);
    for (const part of product.parts || []) {
      const sel = item.parts?.[part.id] || {};
      const flavors = checkFlavors(idx, { productId: part.productId, sizeId: part.sizeId, flavorIds: sel.flavorIds, maxFlavors: part.maxFlavors || 1, allowedFlavorIds: part.allowedFlavorIds }, errors, part.label);
      if (flavors.length) {
        const base = cheapestFlavorCents(idx, part.productId, part.sizeId, part.allowedFlavorIds);
        const combined = combineFlavorPrices(flavors.map((f) => flavorPriceCents(f, part.sizeId)), rule);
        const surcharge = Math.max(0, combined - base);
        unit += surcharge;
        lines.push(`${part.label}: ${flavors.map((f) => (flavors.length > 1 ? `1/${flavors.length} ` : "") + f.name).join(", ")}${surcharge ? ` (+ ${formatBRL(fromCents(surcharge))} sabor especial)` : ""}`);
      }
      if (part.addonGroupId) {
        const add = addonCents(idx, part.addonGroupId, sel.addons?.[part.addonGroupId], errors, part.label);
        unit += add.cents;
        if (add.line && add.option && (add.option.price > 0 || add.option.id !== idx.addonGroups.get(part.addonGroupId)?.defaultOptionId)) lines.push(`${part.label} — ${add.line}`);
      }
    }
    if (product.drinks && product.drinks.qty > 0) {
      const chosen = Array.isArray(item.drinks) ? item.drinks : [];
      if (chosen.length !== product.drinks.qty) errors.push(`Escolha ${product.drinks.qty} ${product.drinks.qty > 1 ? "bebidas" : "bebida"}.`);
      const names = [];
      for (const id of chosen.slice(0, product.drinks.qty)) {
        const opt = (product.drinks.options || []).find((o) => o.id === id);
        if (!opt) { errors.push("Bebida indisponível."); continue; }
        unit += toCents(opt.extra);
        names.push(opt.name + (opt.extra > 0 ? ` (+ ${formatBRL(opt.extra)})` : ""));
      }
      if (names.length) lines.push(`${product.drinks.label}: ${names.join(", ")}`);
    }
  } else {
    errors.push("Tipo de produto desconhecido.");
  }

  if (notes) lines.push(`Obs.: ${notes}`);
  return { ok: errors.length === 0, errors, unitCents: unit, totalCents: unit * qty, qty, title, lines, notes, image, productId: product.id };
}

/** Taxa de entrega em centavos. */
export function deliveryFeeCents(store, mode, district) {
  if (mode !== "delivery") return 0;
  const areas = Array.isArray(store.deliveryAreas) ? store.deliveryAreas : [];
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  const hit = areas.find((a) => norm(a.name) === norm(district));
  return toCents(hit ? hit.fee : store.deliveryFee);
}

/** Calcula o carrinho inteiro. */
export function priceCart(idx, items, { mode = "delivery", district = "" } = {}) {
  const priced = (items || []).map((it) => priceItem(idx, it));
  const subtotal = priced.reduce((s, p) => s + p.totalCents, 0);
  const fee = deliveryFeeCents(idx.store, mode, district);
  const errors = priced.flatMap((p, i) => p.errors.map((e) => `Item ${i + 1}: ${e}`));
  const min = toCents(idx.store.minOrder);
  if (min && subtotal < min) errors.push(`O pedido mínimo é ${formatBRL(fromCents(min))}.`);
  return { items: priced, subtotalCents: subtotal, deliveryFeeCents: fee, totalCents: subtotal + fee, errors, ok: errors.length === 0 };
}

/* ---------------- Horário de funcionamento ---------------- */

const DAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function nowInSaoPaulo(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}
const toMin = (hhmm) => { const [h, m] = String(hhmm || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };

/** { open, label, detail } — considera horários que passam da meia-noite. */
export function storeStatus(store, date = new Date()) {
  if (store.forceStatus === "open") return { open: true, label: "Aberto agora", detail: "" };
  if (store.forceStatus === "closed") return { open: false, label: "Fechado no momento", detail: store.closedMessage || "" };
  const hours = Array.isArray(store.hours) ? store.hours : [];
  const { day, minutes } = nowInSaoPaulo(date);
  const byDay = (d) => hours.find((h) => h.day === d && !h.closed);
  const today = byDay(day);
  const yesterday = byDay((day + 6) % 7);
  // Turno de ontem que atravessa a meia-noite
  if (yesterday && toMin(yesterday.close) < toMin(yesterday.open) && minutes < toMin(yesterday.close)) {
    return { open: true, label: "Aberto agora", detail: `até ${yesterday.close}` };
  }
  if (today) {
    const o = toMin(today.open), c = toMin(today.close);
    const overnight = c < o;
    if (minutes >= o && (overnight || minutes < c)) return { open: true, label: "Aberto agora", detail: `até ${today.close}` };
    if (minutes < o) return { open: false, label: "Fechado agora", detail: `abrimos hoje às ${today.open}` };
  }
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7; const h = byDay(d);
    if (h) return { open: false, label: "Fechado agora", detail: `abrimos ${i === 1 ? "amanhã" : DAY_NAMES[d]} às ${h.open}` };
  }
  return { open: false, label: "Fechado", detail: "" };
}

/* ---------------- Mensagem de WhatsApp ---------------- */

export const PAYMENT_LABELS = { pix: "PIX", credito: "Cartão de crédito (na entrega)", debito: "Cartão de débito (na entrega)", dinheiro: "Dinheiro" };

export function buildWhatsAppText({ store, code, customer, mode, address, payment, notes, cart }) {
  const L = [];
  L.push(`*Novo pedido${code ? " #" + code : ""} — ${store.name || "Figaro's Pizzaria"}*`);
  L.push("");
  L.push(`👤 ${customer.name}`);
  L.push(`📱 ${customer.phone}`);
  L.push("");
  L.push("*Itens*");
  cart.items.forEach((p) => {
    L.push(`• ${p.qty}× ${p.title} — ${formatBRL(fromCents(p.totalCents))}`);
    p.lines.forEach((l) => L.push(`   ${l}`));
  });
  L.push("");
  if (mode === "delivery") {
    const a = address || {};
    L.push(`🛵 *Entrega:* ${a.street}, ${a.number}${a.complement ? " – " + a.complement : ""} – ${a.district}${a.cep ? " – CEP " + a.cep : ""}`);
    if (a.reference) L.push(`   Referência: ${a.reference}`);
  } else {
    L.push("🏃 *Retirada no balcão*");
  }
  let pay = PAYMENT_LABELS[payment?.method] || payment?.method || "";
  if (payment?.method === "dinheiro" && payment.changeFor) pay += ` — troco para ${formatBRL(payment.changeFor)}`;
  L.push(`💳 *Pagamento:* ${pay}`);
  if (notes) L.push(`📝 ${notes}`);
  L.push("");
  L.push(`Subtotal: ${formatBRL(fromCents(cart.subtotalCents))}`);
  if (mode === "delivery") L.push(`Entrega: ${formatBRL(fromCents(cart.deliveryFeeCents))}`);
  L.push(`*Total: ${formatBRL(fromCents(cart.totalCents))}*`);
  return L.join("\n");
}

export const ORDER_STATUS = {
  novo: { label: "Recebido", step: 0 },
  confirmado: { label: "Confirmado", step: 1 },
  preparo: { label: "No forno", step: 2 },
  saiu: { label: "Saiu para entrega", step: 3 },
  pronto: { label: "Pronto para retirada", step: 3 },
  entregue: { label: "Entregue", step: 4 },
  cancelado: { label: "Cancelado", step: -1 },
};
