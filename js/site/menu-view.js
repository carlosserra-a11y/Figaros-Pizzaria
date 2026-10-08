/* Renderização do cardápio: abas de categoria, filtros, busca e destaques. */
import { html, raw, esc, $, $$, setHTML, brl, norm, debounce } from "./util.js";
import { imgUrl, thumbUrl, photoSrcset } from "./api.js";
import { flavorsOf, minFlavorPrice } from "../shared/pricing.js";
import { attachTilt } from "./fx.js";
import { observeCards } from "./scrollfx.js";
import { motion, scrollToTarget, restoreScroll } from "./motion.js";

const TAG_LABELS = { tradicional: "Tradicionais", especial: "Especiais", frango: "Frango", carnes: "Carnes", "frutos-do-mar": "Frutos do mar", queijos: "Queijos", vegetariana: "Vegetarianas", picante: "Picantes" };
const view = { idx: null, query: "", filters: {}, onOpen: null, onQuickAdd: null };

/* ---------- Itens exibíveis: sabores de produtos "pizza" e produtos comuns ---------- */
function entriesForCategory(cat) {
  const out = [];
  const products = [...view.idx.products.values()].filter((p) => p.categoryId === cat.id).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  for (const p of products) {
    if (p.kind === "pizza") {
      const flavors = flavorsOf(view.idx, p.id);
      if (flavors.length) {
        if ((p.sizes || []).some((s) => (s.maxFlavors || 1) > 1)) out.push({ type: "build", product: p });
        flavors.forEach((f) => out.push({ type: "flavor", product: p, flavor: f }));
      }
    } else if (p.kind === "units") {
      (p.sizes || []).forEach((s) => out.push({ type: "unitsize", product: p, size: s }));
    } else {
      out.push({ type: "product", product: p });
    }
  }
  return out;
}

const entryText = (e) => norm([e.flavor?.name, e.flavor?.description, (e.flavor?.tags || []).join(" "), e.flavor?.tier, e.product.name, e.product.description, e.size?.name].filter(Boolean).join(" "));

function entryPrice(e) {
  if (e.type === "flavor") {
    const min = minFlavorPrice(e.flavor);
    const multi = Object.keys(e.flavor.prices || {}).length > 1;
    return { value: min, prefix: multi ? "a partir de" : "" };
  }
  if (e.type === "unitsize") return { value: e.size.price, prefix: "" };
  if (e.type === "build") {
    const mins = flavorsOf(view.idx, e.product.id).map(minFlavorPrice).filter(Boolean);
    return { value: mins.length ? Math.min(...mins) : null, prefix: "a partir de" };
  }
  return { value: e.product.price, prefix: "" };
}

/** Largura que o cartão ocupa na tela (para o navegador escolher a foto certa). */
const SIZES = { grid: "(max-width: 640px) 50vw, 300px", carousel: "(max-width: 640px) 72vw, 280px" };

function cardHtml(e, i = 0, ctx = "grid") {
  const pr = entryPrice(e);
  const priceHtml = pr.value != null ? html`<span class="price">${pr.prefix ? html`<small>${pr.prefix}</small>` : ""}${brl(pr.value)}</span>` : html`<span></span>`;
  if (e.type === "build") {
    const sample = flavorsOf(view.idx, e.product.id).filter((f) => f.image).slice(0, 3);
    const maxF = Math.max(...e.product.sizes.map((s) => s.maxFlavors || 1));
    return html`<article class="card build" style="--i:${i}">
      <div class="card-media"><div class="mini-pizza">${sample.map((f, k) => html`<img src="${thumbUrl(f.image)}" alt="" loading="lazy" style="clip-path:polygon(50% 50%, ${["50% 0, 100% 0, 100% 100%, 93% 75%", "93% 75%, 50% 100%, 0 100%, 7% 75%", "7% 75%, 0 0, 50% 0"][k] || "0 0"})">`)}</div></div>
      <div class="card-body">
        <h3>Monte sua pizza</h3>
        <p>Meio a meio ou até ${maxF} sabores — você escolhe tamanho, sabores e borda.</p>
        <div class="card-foot">${priceHtml}<span class="add-chip" aria-hidden="true">+</span></div>
      </div>
      <button class="card-link" type="button" data-open="${e.product.id}" aria-label="Montar ${e.product.name}"></button>
    </article>`;
  }
  const isFlavor = e.type === "flavor";
  const title = isFlavor ? e.flavor.name : e.type === "unitsize" ? `${e.size.name}` : e.product.name;
  const desc = isFlavor ? e.flavor.description : e.type === "unitsize" ? `${e.product.name}${e.size.includes ? " + " + e.size.includes.toLowerCase() : ""}. Escolha os sabores.` : e.product.description;
  const img = imgUrl((isFlavor ? e.flavor.image : "") || e.product.image);
  const badges = [];
  if (isFlavor && e.flavor.tier === "especial") badges.push(html`<span class="badge especial">Especial</span>`);
  if (view.idx.menu.bestSellers?.includes(isFlavor ? e.flavor.id : e.product.id)) badges.push(html`<span class="badge hot">🔥 Mais pedido</span>`);
  else if ((isFlavor ? e.flavor.popular : e.product.popular)) badges.push(html`<span class="badge green">Destaque</span>`);
  if (e.product.badge) badges.push(html`<span class="badge">${e.product.badge}</span>`);
  const quick = e.product.kind === "simple";
  const attrs = quick ? raw(`data-quick="${e.product.id}"`) : raw(`data-open="${e.product.id}"${isFlavor ? ` data-flavor="${e.flavor.id}"` : ""}${e.size ? ` data-size="${e.size.id}"` : ""}`);
  return html`<article class="card" style="--i:${Math.min(i, 20)}">
    <div class="card-media">
      ${img ? html`<img src="${img}"${photoSrcset(img) ? raw(` srcset="${esc(photoSrcset(img))}" sizes="${SIZES[ctx]}"`) : ""} alt="${title}" loading="lazy" decoding="async" width="400" height="300">` : html`<span class="ph">🍕</span>`}
      <div class="badges">${badges}</div>
    </div>
    <div class="card-body">
      <h3>${title}</h3>
      ${desc ? html`<p>${desc}</p>` : ""}
      <div class="card-foot">${priceHtml}<span class="add-chip" aria-hidden="true">+</span></div>
    </div>
    <button class="card-link" type="button" ${attrs} aria-label="${quick ? "Adicionar" : "Escolher"} ${title}"></button>
  </article>`;
}

/* ---------- Abas e blocos ---------- */
function categories() {
  return [...view.idx.categories.values()].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)).filter((c) => entriesForCategory(c).length);
}

function renderTabs(cats, counts) {
  setHTML($("#catTabs"), html`<span class="cat-ink" aria-hidden="true"></span>${cats.map((c, i) => html`<button class="cat-tab" role="tab" type="button" data-cat="${c.id}" aria-selected="${i === 0}" aria-controls="cat-${c.id}">
    <span aria-hidden="true">${c.icon || "🍽️"}</span>${c.name}${counts ? html` <span class="n">${counts[c.id] || 0}</span>` : ""}</button>`)}`);
  moveInk(true);
}

/** Pílula verde que desliza até a aba ativa. */
function moveInk(instant = false) {
  const bar = $("#catTabs");
  const ink = bar?.querySelector(".cat-ink");
  const active = bar?.querySelector('.cat-tab[aria-selected="true"]');
  if (!ink) return;
  if (!active) { ink.style.opacity = "0"; return; }
  if (instant) ink.classList.add("no-anim");
  ink.style.width = `${active.offsetWidth}px`;
  ink.style.height = `${active.offsetHeight}px`;
  ink.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
  ink.style.opacity = "1";
  if (instant) { void ink.offsetWidth; ink.classList.remove("no-anim"); }
}

function chipsFor(cat, entries) {
  const flavorEntries = entries.filter((e) => e.type === "flavor");
  if (flavorEntries.length < 12) return "";
  const tags = new Set();
  flavorEntries.forEach((e) => { tags.add(e.flavor.tier); (e.flavor.tags || []).forEach((t) => tags.add(t)); });
  const keys = Object.keys(TAG_LABELS).filter((k) => tags.has(k));
  const active = view.filters[cat.id] || "";
  return html`<div class="chips" role="group" aria-label="Filtrar ${cat.name}">
    <button class="chip" type="button" data-filter="" data-for="${cat.id}" aria-pressed="${!active}">Todas</button>
    ${keys.map((k) => html`<button class="chip" type="button" data-filter="${k}" data-for="${cat.id}" aria-pressed="${active === k}">${TAG_LABELS[k]}</button>`)}
  </div>`;
}

function applyFilter(cat, entries) {
  const f = view.filters[cat.id];
  if (!f) return entries;
  return entries.filter((e) => e.type !== "flavor" ? e.type === "build" : (e.flavor.tier === f || (e.flavor.tags || []).includes(f)));
}

export function renderMenu() {
  const body = $("#menuBody");
  const cats = categories();
  const q = norm(view.query);
  if (q) {
    const terms = q.split(/\s+/).filter(Boolean);
    const groups = cats.map((c) => ({ c, list: entriesForCategory(c).filter((e) => e.type !== "build" && terms.every((t) => entryText(e).includes(t))) })).filter((g) => g.list.length);
    const total = groups.reduce((s, g) => s + g.list.length, 0);
    renderTabs(cats, Object.fromEntries(groups.map((g) => [g.c.id, g.list.length])));
    if (!total) {
      setHTML(body, html`<div class="empty"><span class="big">🔎</span>Nada encontrado para “${view.query}”.<br>Tente outro sabor ou ingrediente — ou <a class="link-btn" href="#contato">fale com a gente</a>.</div>`);
      return;
    }
    setHTML(body, groups.map((g) => html`<section class="cat-block" id="cat-${g.c.id}" data-cat-block="${g.c.id}">
      <div class="cat-head"><h3><span aria-hidden="true">${g.c.icon}</span>${g.c.name}</h3><p>${g.list.length} resultado${g.list.length > 1 ? "s" : ""}</p></div>
      <div class="grid">${g.list.map((e, i) => cardHtml(e, i))}</div></section>`));
    observeCards(body);
    return;
  }
  renderTabs(cats);
  setHTML(body, cats.map((c) => {
    const all = entriesForCategory(c);
    const list = applyFilter(c, all);
    const includes = c.id === "pizzas-salgadas" ? html`<p class="included-note">🧀 + 🥤 Borda de requeijão e refrigerante inclusos em toda pizza salgada</p>` : "";
    return html`<section class="cat-block" id="cat-${c.id}" data-cat-block="${c.id}" aria-labelledby="h-${c.id}">
      <div class="cat-head"><h3 id="h-${c.id}"><span aria-hidden="true">${c.icon}</span>${c.name}</h3>${c.description ? html`<p>${c.description}</p>` : ""}</div>
      ${includes}${chipsFor(c, all)}
      <div class="grid${c.id === "bebidas" ? " compact" : ""}">${list.map((e, i) => cardHtml(e, i))}</div>
    </section>`;
  }));
  observeCards(body);
  spy();
}

/* ---------- Destaques ---------- */
export function renderHighlights() {
  const el = $("#highlights");
  const best = view.idx.menu.bestSellers || [];
  let entries = [];
  const all = categories().flatMap(entriesForCategory).filter((e) => e.type !== "build");
  const keyOf = (e) => (e.type === "flavor" ? e.flavor.id : e.product.id);
  if (best.length >= 4) {
    entries = best.map((id) => all.find((e) => keyOf(e) === id)).filter(Boolean);
    $("#highlightsEyebrow").textContent = "Os mais pedidos do mês";
    $("#destaquesTitle").textContent = "Mais pedidos";
  } else {
    entries = all.filter((e) => (e.type === "flavor" ? e.flavor.popular : e.product.popular));
  }
  const seen = new Set();
  entries = entries.filter((e) => { const k = keyOf(e); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 12);
  if (!entries.length) { $("#destaques").hidden = true; return; }
  setHTML(el, entries.map((e, i) => cardHtml(e, i, "carousel")));
  observeCards(el);
}

/* ---------- Scrollspy das abas ---------- */
let spyObserver;
function spy() {
  spyObserver?.disconnect();
  const tabs = $$("#catTabs .cat-tab");
  const select = (id) => {
    const active = tabs.find((t) => t.dataset.cat === id);
    if (!active || active.getAttribute("aria-selected") === "true") return;
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t === active)));
    moveInk();
    const bar = $("#catTabs");
    const left = active.offsetLeft - bar.clientWidth / 2 + active.clientWidth / 2;
    bar.scrollTo({ left, behavior: motion.reduced ? "auto" : "smooth" });
  };
  spyObserver = new IntersectionObserver((entries) => {
    const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (vis) select(vis.target.dataset.catBlock);
  }, { rootMargin: "-140px 0px -60% 0px" });
  $$("[data-cat-block]").forEach((b) => spyObserver.observe(b));
}

export function initMenu(idx, { onOpen, onQuickAdd }) {
  view.idx = idx; view.onOpen = onOpen; view.onQuickAdd = onQuickAdd;
  renderMenu();
  renderHighlights();
  attachTilt($("#menuBody"));
  attachTilt($("#highlights"));

  const input = $("#searchInput"), clear = $("#searchClear");
  const run = debounce(() => { view.query = input.value; clear.hidden = !input.value; renderMenu(); }, 160);
  input.addEventListener("input", run);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); scrollToTarget($("#menuBody"), { offset: 150 }); } });
  clear.addEventListener("click", () => { input.value = ""; view.query = ""; clear.hidden = true; renderMenu(); input.focus(); });

  $("#catTabs").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-cat]");
    if (!tab) return;
    scrollToTarget(document.getElementById(`cat-${tab.dataset.cat}`));
  });
  if ("ResizeObserver" in window) new ResizeObserver(() => moveInk(true)).observe($("#catTabs"));

  const onClick = (e) => {
    const chip = e.target.closest("[data-filter]");
    if (chip) {
      view.filters[chip.dataset.for] = chip.dataset.filter;
      const y = window.scrollY;
      const apply = () => { renderMenu(); restoreScroll(y); };
      // troca suave dos cartões (View Transitions), quando o navegador suporta
      if (document.startViewTransition && !motion.reduced) document.startViewTransition(apply);
      else apply();
      return;
    }
    const quick = e.target.closest("[data-quick]");
    if (quick) { view.onQuickAdd(quick.dataset.quick, quick.closest(".card")); return; }
    const open = e.target.closest("[data-open]");
    if (open) view.onOpen({ productId: open.dataset.open, flavorId: open.dataset.flavor, sizeId: open.dataset.size });
  };
  $("#menuBody").addEventListener("click", onClick);
  $("#highlights").addEventListener("click", onClick);

  document.querySelectorAll("[data-scroll]").forEach((b) => b.addEventListener("click", () => {
    const c = $("#highlights");
    c.scrollBy({ left: Number(b.dataset.scroll) * c.clientWidth * 0.8, behavior: "smooth" });
  }));
}

export function updateMenuIndex(idx) { view.idx = idx; renderMenu(); renderHighlights(); }
