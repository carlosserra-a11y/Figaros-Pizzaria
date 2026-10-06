/* ============================================================
   Validação/normalização de tudo que chega pela API.
   Cada função devolve um objeto limpo ou lança ValidationError.
   ============================================================ */

import { parseDecimal } from "../js/shared/pricing.js";

export class ValidationError extends Error {
  constructor(message, field) { super(message); this.status = 400; this.field = field; }
}

const fail = (msg, field) => { throw new ValidationError(msg, field); };

export const slugify = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

export function str(v, { field, max = 200, min = 0, required = false, multiline = false } = {}) {
  let s = v === undefined || v === null ? "" : String(v);
  s = multiline ? s.replace(/\r\n/g, "\n") : s.replace(/[\r\n\t]+/g, " ");
  // remove caracteres de controle
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (required && !s) fail(`Preencha o campo "${field}".`, field);
  if (s.length < min) fail(`"${field}" precisa ter pelo menos ${min} caracteres.`, field);
  if (s.length > max) fail(`"${field}" pode ter no máximo ${max} caracteres.`, field);
  return s;
}

export function money(v, { field, min = 0, max = 100000, required = true } = {}) {
  if ((v === "" || v === null || v === undefined) && !required) return null;
  const n = parseDecimal(v);
  if (!Number.isFinite(n)) fail(`Valor inválido em "${field}".`, field);
  if (n < min || n > max) fail(`"${field}" deve estar entre ${min} e ${max}.`, field);
  return Math.round(n * 100) / 100;
}

export function int(v, { field, min = 0, max = 1000, fallback = 0 } = {}) {
  if (v === "" || v === null || v === undefined) return fallback;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) fail(`"${field}" deve ser um número entre ${min} e ${max}.`, field);
  return n;
}

const bool = (v, fallback = true) => (v === undefined ? fallback : v === true || v === "true" || v === 1 || v === "1" || v === "on");

export function id(v, field = "id") {
  const s = slugify(v);
  if (!s) fail(`Identificador inválido (${field}).`, field);
  return s;
}

/** Caminho de imagem aceito: arquivo do próprio site, upload, ou URL https. */
export function imagePath(v, field = "imagem") {
  const s = str(v, { field, max: 500 });
  if (!s) return "";
  if (/^(assets\/img\/|uploads\/)[\w\-./]+\.(webp|jpe?g|png|avif|gif|svg)$/i.test(s) && !s.includes("..")) return s;
  if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
  fail("Imagem inválida: use um upload, um arquivo em assets/img/ ou uma URL https.", field);
}

const TIERS = ["tradicional", "especial"];
const KINDS = ["simple", "pizza", "units", "combo"];

export function category(input, { existingId } = {}) {
  const name = str(input.name, { field: "Nome", required: true, max: 60 });
  return {
    id: existingId || id(input.id || name),
    name,
    icon: str(input.icon, { field: "Ícone", max: 8 }),
    description: str(input.description, { field: "Descrição", max: 200 }),
    productId: input.productId ? id(input.productId, "Produto da categoria") : null,
    active: bool(input.active),
    sort: int(input.sort, { field: "Ordem", max: 10000 }),
  };
}

function sizes(list, kind) {
  if (!Array.isArray(list) || list.length === 0) fail("Cadastre pelo menos um tamanho/opção.", "sizes");
  if (list.length > 12) fail("No máximo 12 tamanhos.", "sizes");
  const seen = new Set();
  return list.map((s, i) => {
    const name = str(s.name, { field: `Nome do tamanho ${i + 1}`, required: true, max: 40 });
    const sid = id(s.id || name, "id do tamanho");
    if (seen.has(sid)) fail(`Tamanho repetido: ${name}.`, "sizes");
    seen.add(sid);
    const out = { id: sid, name, includes: str(s.includes, { field: "Inclui", max: 120 }) };
    if (s.slices !== undefined && s.slices !== "") out.slices = int(s.slices, { field: "Fatias", min: 1, max: 32 });
    if (s.cm !== undefined && s.cm !== "") out.cm = int(s.cm, { field: "Diâmetro", min: 10, max: 80 });
    if (kind === "pizza") out.maxFlavors = int(s.maxFlavors, { field: "Máx. de sabores", min: 1, max: 4, fallback: 1 });
    if (kind === "units") {
      out.units = int(s.units, { field: "Quantidade", min: 1, max: 100, fallback: 1 });
      out.price = money(s.price, { field: `Preço de ${name}` });
    }
    return out;
  });
}

export function product(input, { existingId, categoryIds, productIds, addonGroupIds, flavorIds } = {}) {
  const name = str(input.name, { field: "Nome", required: true, max: 80 });
  const kind = KINDS.includes(input.kind) ? input.kind : fail("Tipo de produto inválido.", "kind");
  const categoryId = id(input.categoryId, "Categoria");
  if (categoryIds && !categoryIds.has(categoryId)) fail("Categoria não existe.", "categoryId");
  const out = {
    id: existingId || id(input.id || name),
    categoryId,
    kind,
    name,
    description: str(input.description, { field: "Descrição", max: 300, multiline: true }),
    image: imagePath(input.image),
    badge: str(input.badge, { field: "Selo", max: 24 }),
    popular: bool(input.popular, false),
    active: bool(input.active),
    sort: int(input.sort, { field: "Ordem", max: 10000 }),
  };
  if (kind === "simple" || kind === "combo") out.price = money(input.price, { field: "Preço" });
  if (kind === "pizza" || kind === "units") out.sizes = sizes(input.sizes, kind);
  if (kind === "pizza") {
    out.addonGroupId = input.addonGroupId ? id(input.addonGroupId, "Adicionais") : null;
    if (out.addonGroupId && addonGroupIds && !addonGroupIds.has(out.addonGroupId)) fail("Grupo de adicionais não existe.", "addonGroupId");
  }
  if (kind === "combo") {
    const parts = Array.isArray(input.parts) ? input.parts : [];
    if (parts.length > 6) fail("No máximo 6 partes no combo.", "parts");
    out.parts = parts.map((p, i) => {
      const pid = id(p.productId, "Produto da parte");
      if (productIds && !productIds.has(pid)) fail(`A parte ${i + 1} usa um produto que não existe.`, "parts");
      const allowed = Array.isArray(p.allowedFlavorIds) ? p.allowedFlavorIds.map((f) => id(f, "sabor")) : [];
      if (flavorIds) for (const f of allowed) if (!flavorIds.has(f)) fail(`Sabor "${f}" não existe.`, "parts");
      return {
        id: id(p.id || `parte-${i + 1}`, "id da parte"),
        label: str(p.label, { field: `Nome da parte ${i + 1}`, required: true, max: 80 }),
        productId: pid,
        sizeId: id(p.sizeId, "Tamanho da parte"),
        maxFlavors: int(p.maxFlavors, { field: "Máx. de sabores", min: 1, max: 4, fallback: 1 }),
        allowedFlavorIds: allowed.length ? allowed : undefined,
        addonGroupId: p.addonGroupId ? id(p.addonGroupId, "Adicionais") : undefined,
      };
    });
    if (input.drinks && Number(input.drinks.qty) > 0) {
      const opts = Array.isArray(input.drinks.options) ? input.drinks.options : [];
      if (!opts.length) fail("Cadastre as opções de bebida do combo.", "drinks");
      out.drinks = {
        label: str(input.drinks.label || "Bebida", { field: "Nome do grupo de bebidas", max: 40 }),
        qty: int(input.drinks.qty, { field: "Qtd. de bebidas", min: 1, max: 6 }),
        options: opts.slice(0, 20).map((o, i) => {
          const oname = str(o.name, { field: `Bebida ${i + 1}`, required: true, max: 60 });
          return { id: id(o.id || oname), name: oname, extra: money(o.extra ?? 0, { field: `Acréscimo de ${oname}` }) };
        }),
      };
    }
  }
  return out;
}

export function flavor(input, { existingId, product: prod } = {}) {
  const name = str(input.name, { field: "Nome", required: true, max: 80 });
  if (!prod) fail("Escolha a qual produto o sabor pertence.", "productId");
  const prices = {};
  if (prod.kind === "pizza") {
    for (const s of prod.sizes || []) {
      const v = input.prices?.[s.id];
      if (v === "" || v === null || v === undefined) continue; // tamanho não disponível para este sabor
      prices[s.id] = money(v, { field: `Preço ${s.name}` });
    }
    if (!Object.keys(prices).length) fail("Informe o preço em pelo menos um tamanho.", "prices");
  }
  const tags = Array.isArray(input.tags) ? input.tags : String(input.tags || "").split(",");
  return {
    id: existingId || id(input.id || `${prod.id.replace(/^pizza-/, "")}-${name}`),
    productId: prod.id,
    name,
    description: str(input.description, { field: "Ingredientes/descrição", max: 300, multiline: true }),
    image: imagePath(input.image),
    tier: TIERS.includes(input.tier) ? input.tier : "tradicional",
    tags: tags.map((t) => slugify(t)).filter(Boolean).slice(0, 8),
    prices,
    popular: bool(input.popular, false),
    active: bool(input.active),
    sort: int(input.sort, { field: "Ordem", max: 10000 }),
  };
}

export function addonGroup(input, { existingId } = {}) {
  const name = str(input.name, { field: "Nome do grupo", required: true, max: 40 });
  const options = (Array.isArray(input.options) ? input.options : []).slice(0, 30).map((o, i) => {
    const oname = str(o.name, { field: `Opção ${i + 1}`, required: true, max: 60 });
    return { id: id(o.id || oname), name: oname, price: money(o.price ?? 0, { field: `Preço de ${oname}` }), active: bool(o.active), sort: i };
  });
  if (!options.length) fail("Cadastre pelo menos uma opção.", "options");
  const defaultOptionId = input.defaultOptionId && options.some((o) => o.id === input.defaultOptionId) ? input.defaultOptionId : null;
  return { id: existingId || id(input.id || name), name, min: 0, max: 1, defaultOptionId, options, sort: int(input.sort, { field: "Ordem", max: 10000 }) };
}

export function testimonial(input, { existingId } = {}) {
  const name = str(input.name, { field: "Nome", required: true, max: 60 });
  return {
    id: existingId || id(input.id || `${name}-${Date.now().toString(36)}`),
    name,
    text: str(input.text, { field: "Depoimento", required: true, max: 400, multiline: true }),
    rating: int(input.rating, { field: "Nota", min: 1, max: 5, fallback: 5 }),
    source: str(input.source, { field: "Origem", max: 40 }),
    active: bool(input.active),
    sort: int(input.sort, { field: "Ordem", max: 10000 }),
  };
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function store(input, current = {}) {
  const hours = Array.isArray(input.hours) ? input.hours : current.hours || [];
  const digits = (s) => String(s || "").replace(/\D/g, "");
  const whatsapp = digits(input.whatsapp);
  if (whatsapp && (whatsapp.length < 12 || whatsapp.length > 13)) fail("WhatsApp deve ter DDI + DDD + número, ex.: 5548999999999.", "whatsapp");
  const urlOrEmpty = (v, field) => {
    const s = str(v, { field, max: 200 });
    if (s && !/^https:\/\/[^\s"'<>]+$/i.test(s)) fail(`"${field}" precisa ser um link https://`, field);
    return s;
  };
  return {
    ...current,
    name: str(input.name, { field: "Nome da loja", required: true, max: 60 }),
    tagline: str(input.tagline, { field: "Slogan", max: 120 }),
    whatsapp,
    phone: str(input.phone, { field: "Telefone", max: 30 }),
    email: str(input.email, { field: "E-mail", max: 80 }),
    address: str(input.address, { field: "Endereço", max: 160 }),
    mapsQuery: str(input.mapsQuery, { field: "Busca no mapa", max: 160 }),
    instagram: urlOrEmpty(input.instagram, "Instagram"),
    facebook: urlOrEmpty(input.facebook, "Facebook"),
    hours: [0, 1, 2, 3, 4, 5, 6].map((day) => {
      const h = hours.find((x) => Number(x.day) === day) || {};
      const closed = bool(h.closed, false);
      const open = closed ? (HHMM.test(h.open) ? h.open : "18:30") : (HHMM.test(h.open) ? h.open : fail("Horário de abertura inválido (use HH:MM).", "hours"));
      const close = closed ? (HHMM.test(h.close) ? h.close : "23:00") : (HHMM.test(h.close) ? h.close : fail("Horário de fechamento inválido (use HH:MM).", "hours"));
      return { day, open, close, closed };
    }),
    lunchInfo: str(input.lunchInfo, { field: "Informação do almoço", max: 160 }),
    forceStatus: ["auto", "open", "closed"].includes(input.forceStatus) ? input.forceStatus : "auto",
    closedMessage: str(input.closedMessage, { field: "Mensagem de fechado", max: 160 }),
    deliveryEnabled: bool(input.deliveryEnabled),
    pickupEnabled: bool(input.pickupEnabled),
    deliveryFee: money(input.deliveryFee, { field: "Taxa de entrega", max: 500 }),
    deliveryAreas: (Array.isArray(input.deliveryAreas) ? input.deliveryAreas : []).slice(0, 100).map((a, i) => ({
      name: str(a.name, { field: `Bairro ${i + 1}`, required: true, max: 60 }),
      fee: money(a.fee, { field: `Taxa do bairro ${i + 1}`, max: 500 }),
    })),
    minOrder: money(input.minOrder, { field: "Pedido mínimo", max: 5000 }),
    pricingRule: input.pricingRule === "highest" ? "highest" : "average",
    etaDelivery: str(input.etaDelivery, { field: "Tempo de entrega", max: 30 }),
    etaPickup: str(input.etaPickup, { field: "Tempo de retirada", max: 30 }),
    announcement: str(input.announcement, { field: "Aviso no topo", max: 160 }),
    rating: input.rating === "" || input.rating === null || input.rating === undefined ? null : money(input.rating, { field: "Nota", min: 0, max: 5 }),
    ratingCount: str(input.ratingCount, { field: "Nº de avaliações", max: 20 }),
    payments: (Array.isArray(input.payments) ? input.payments : current.payments || []).map((p) => str(p, { field: "Pagamento", max: 40 })).filter(Boolean).slice(0, 10),
  };
}

/* ---------------- Pedido vindo do site ---------------- */

const PAYMENTS = ["pix", "credito", "debito", "dinheiro"];

export function orderInput(body, store) {
  const b = body && typeof body === "object" ? body : fail("Pedido inválido.");
  const name = str(b.customer?.name, { field: "Nome", required: true, min: 2, max: 80 });
  const phoneDigits = String(b.customer?.phone || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (phoneDigits.length < 10 || phoneDigits.length > 11) fail("Informe um telefone com DDD, ex.: (48) 99999-9999.", "phone");
  const phone = phoneDigits.length === 11
    ? `(${phoneDigits.slice(0, 2)}) ${phoneDigits.slice(2, 7)}-${phoneDigits.slice(7)}`
    : `(${phoneDigits.slice(0, 2)}) ${phoneDigits.slice(2, 6)}-${phoneDigits.slice(6)}`;
  const mode = b.mode === "pickup" ? "pickup" : "delivery";
  if (mode === "delivery" && store.deliveryEnabled === false) fail("No momento não estamos fazendo entregas.", "mode");
  if (mode === "pickup" && store.pickupEnabled === false) fail("No momento não estamos aceitando retirada.", "mode");
  let address = null;
  if (mode === "delivery") {
    const a = b.address || {};
    address = {
      cep: str(a.cep, { field: "CEP", max: 9 }).replace(/[^\d-]/g, ""),
      street: str(a.street, { field: "Rua", required: true, max: 120 }),
      number: str(a.number, { field: "Número", required: true, max: 12 }),
      complement: str(a.complement, { field: "Complemento", max: 60 }),
      district: str(a.district, { field: "Bairro", required: true, max: 60 }),
      reference: str(a.reference, { field: "Ponto de referência", max: 100 }),
    };
  }
  const method = PAYMENTS.includes(b.payment?.method) ? b.payment.method : fail("Escolha a forma de pagamento.", "payment");
  const payment = { method };
  if (method === "dinheiro" && b.payment.changeFor !== undefined && b.payment.changeFor !== "" && b.payment.changeFor !== null) {
    payment.changeFor = money(b.payment.changeFor, { field: "Troco para", max: 5000 });
  }
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) fail("Seu carrinho está vazio.", "items");
  if (items.length > 40) fail("Pedido com itens demais. Fale com a gente pelo WhatsApp.", "items");
  const cleanItems = items.map((it) => ({
    productId: String(it?.productId || "").slice(0, 80),
    sizeId: it?.sizeId ? String(it.sizeId).slice(0, 40) : undefined,
    flavorIds: Array.isArray(it?.flavorIds) ? it.flavorIds.slice(0, 4).map((x) => String(x).slice(0, 80)) : undefined,
    units: it?.units && typeof it.units === "object" ? Object.fromEntries(Object.entries(it.units).slice(0, 20).map(([k, v]) => [String(k).slice(0, 80), Number(v) || 0])) : undefined,
    addons: it?.addons && typeof it.addons === "object" ? Object.fromEntries(Object.entries(it.addons).slice(0, 5).map(([k, v]) => [String(k).slice(0, 40), String(v).slice(0, 40)])) : undefined,
    parts: it?.parts && typeof it.parts === "object" ? Object.fromEntries(Object.entries(it.parts).slice(0, 6).map(([k, v]) => [String(k).slice(0, 40), {
      flavorIds: Array.isArray(v?.flavorIds) ? v.flavorIds.slice(0, 4).map((x) => String(x).slice(0, 80)) : [],
      addons: v?.addons && typeof v.addons === "object" ? Object.fromEntries(Object.entries(v.addons).slice(0, 5).map(([a, o]) => [String(a).slice(0, 40), String(o).slice(0, 40)])) : undefined,
    }])) : undefined,
    drinks: Array.isArray(it?.drinks) ? it.drinks.slice(0, 6).map((x) => String(x).slice(0, 40)) : undefined,
    qty: it?.qty,
    notes: str(it?.notes, { field: "Observação do item", max: 140 }),
  }));
  return {
    customer: { name, phone },
    mode,
    address,
    payment,
    notes: str(b.notes, { field: "Observações", max: 300, multiline: true }),
    items: cleanItems,
  };
}
