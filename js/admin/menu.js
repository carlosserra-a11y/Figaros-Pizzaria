/* ============================================================
   Editor do cardápio: sabores, produtos (inclui bebidas e combos),
   categorias, bordas/adicionais e depoimentos.
   ============================================================ */
import { api, html, raw, $, setHTML, toast, brl, imgSrc, openModal, confirmDialog, input, textarea, select, check, imageField, bindImageFields, formData, dec } from "./core.js";

const TABS = [["sabores", "🍕 Sabores"], ["produtos", "📦 Produtos e bebidas"], ["categorias", "🗂 Categorias"], ["adicionais", "🧀 Bordas e adicionais"], ["depoimentos", "💬 Depoimentos"]];
const KIND_LABEL = { simple: "Simples (preço fixo)", pizza: "Pizza / com tamanhos e sabores", units: "Combo por unidades (ex.: esfihas)", combo: "Combo (preço fixo + escolhas)" };
let M = null;
let view = null;
const ui = { tab: "sabores", product: "pizza-salgada", q: "" };

const ENTITY = { sabores: "flavors", produtos: "products", categorias: "categories", adicionais: "addonGroups", depoimentos: "testimonials" };

export async function renderMenuEditor(v, [tab, action] = []) {
  view = v;
  if (tab && ENTITY[tab]) ui.tab = tab;
  M = await api("menu");
  draw();
  if (action === "novo") {
    history.replaceState(null, "", `#cardapio/${ui.tab}`);
    ({ sabores: () => editFlavor(), produtos: () => editProduct(), categorias: () => editCategory(), adicionais: () => editAddon(), depoimentos: () => editTestimonial() })[ui.tab]();
  }
}

async function reload() { M = await api("menu"); draw(); }

function draw() {
  setHTML(view, html`
    <div class="tabs" role="tablist">${TABS.map(([k, l]) => html`<button type="button" role="tab" data-tab="${k}" aria-selected="${ui.tab === k}">${l}</button>`)}</div>
    <div id="tabBody"></div>`);
  view.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { ui.tab = b.dataset.tab; ui.q = ""; history.replaceState(null, "", `#cardapio/${ui.tab}`); draw(); }));
  ({ sabores: drawFlavors, produtos: drawProducts, categorias: drawCategories, adicionais: drawAddons, depoimentos: drawTestimonials })[ui.tab]($("#tabBody"));
}

/* ---------- Ações comuns ---------- */
async function save(entity, obj, id) {
  const r = id
    ? await api(`menu/${entity}/${encodeURIComponent(id)}`, { method: "PUT", body: obj })
    : await api(`menu/${entity}`, { method: "POST", body: obj });
  toast(id ? "Alterações salvas ✓" : "Criado ✓ — já está no site", "ok");
  await reload();
  return r;
}
async function remove(entity, id, name) {
  if (!(await confirmDialog(`“${name}” será excluído do site. Se preferir só esconder, use o botão de ativo/inativo.`, { title: "Excluir?", confirmLabel: "Excluir" }))) return;
  try { await api(`menu/${entity}/${encodeURIComponent(id)}`, { method: "DELETE" }); toast("Excluído", "ok"); await reload(); }
  catch (e) { toast(e.message, "err", 6000); }
}
async function toggle(entity, obj, field) {
  try { await api(`menu/${entity}/${encodeURIComponent(obj.id)}`, { method: "PUT", body: { ...obj, [field]: !(obj[field] !== false && obj[field] !== undefined ? obj[field] : false) } }); await reload(); }
  catch (e) { toast(e.message, "err"); }
}
/** Move um item para cima/baixo dentro de um subconjunto, mantendo a ordem global. */
async function move(entity, list, subset, id, dir) {
  const ids = subset.map((x) => x.id);
  const i = ids.indexOf(id), j = i + dir;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  const all = [...list].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)).map((x) => x.id);
  const positions = all.map((x, k) => (ids.includes(x) ? k : -1)).filter((k) => k >= 0);
  positions.forEach((pos, k) => { all[pos] = ids[k]; });
  await api(`menu/${entity}/reorder`, { method: "POST", body: { ids: all } });
  await reload();
}
const isOn = (x) => x.active !== false;
const rowActs = (id, first, last) => html`<div class="row-acts">
  <button type="button" class="mini" data-up="${id}" aria-label="Subir" ${first ? "disabled" : ""}>↑</button>
  <button type="button" class="mini" data-down="${id}" aria-label="Descer" ${last ? "disabled" : ""}>↓</button>
  <button type="button" class="mini" data-edit="${id}" aria-label="Editar">✏️</button>
  <button type="button" class="mini danger" data-del="${id}" aria-label="Excluir">🗑</button></div>`;

function bindRows(root, entity, list, subset, editFn) {
  root.onclick = async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const find = (id) => list.find((x) => x.id === id);
    if (b.dataset.edit) editFn(find(b.dataset.edit));
    if (b.dataset.del) { const x = find(b.dataset.del); remove(entity, x.id, x.name); }
    if (b.dataset.up) move(entity, list, subset, b.dataset.up, -1);
    if (b.dataset.down) move(entity, list, subset, b.dataset.down, 1);
    if (b.dataset.active) toggle(entity, find(b.dataset.active), "active");
    if (b.dataset.pop) toggle(entity, find(b.dataset.pop), "popular");
    if (b.dataset.new !== undefined) editFn();
  };
}

/* ================= SABORES ================= */
function drawFlavors(box) {
  const flavorProducts = M.products.filter((p) => p.kind === "pizza" || p.kind === "units");
  if (!flavorProducts.some((p) => p.id === ui.product)) ui.product = flavorProducts[0]?.id || "";
  const prod = M.products.find((p) => p.id === ui.product);
  const q = ui.q.toLowerCase();
  const subset = M.flavors.filter((f) => f.productId === ui.product).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const shown = q ? subset.filter((f) => `${f.name} ${f.description}`.toLowerCase().includes(q)) : subset;
  const sizes = prod?.kind === "pizza" ? prod.sizes : [];
  setHTML(box, html`
    <div class="toolbar">
      <select class="select" id="fProd">${flavorProducts.map((p) => html`<option value="${p.id}" ${p.id === ui.product ? "selected" : ""}>${p.name}</option>`)}</select>
      <input class="input grow" id="fQ" placeholder="Buscar sabor…" value="${ui.q}">
      <button type="button" class="btn btn-green" data-new>+ Novo sabor</button>
    </div>
    <div class="panel" style="padding:8px">
      <div class="table-wrap"><table class="table">
        <thead><tr><th></th><th>Sabor</th>${sizes.map((s) => html`<th class="num hide-sm">${s.name}</th>`)}<th>Destaque</th><th>Ativo</th><th></th></tr></thead>
        <tbody id="fRows">${shown.map((f, i) => html`<tr class="${isOn(f) ? "" : "off"}">
          <td><img class="thumb" src="${imgSrc(f.image)}" alt="" loading="lazy"></td>
          <td><b>${f.name}</b>${f.tier === "especial" ? html` <span class="badge especial" style="font-size:10px">Especial</span>` : ""}<br><small>${f.description}</small></td>
          ${sizes.map((s) => html`<td class="num hide-sm">${f.prices?.[s.id] != null ? brl(f.prices[s.id]) : "—"}</td>`)}
          <td><button type="button" class="star-btn" data-pop="${f.id}" aria-pressed="${!!f.popular}" aria-label="Destaque">⭐</button></td>
          <td><button type="button" class="switch" role="switch" data-active="${f.id}" aria-checked="${isOn(f)}" aria-label="Ativo no site"></button></td>
          <td>${rowActs(f.id, i === 0 || !!q, i === shown.length - 1 || !!q)}</td>
        </tr>`)}</tbody>
      </table></div>
      ${!shown.length ? html`<p class="empty">Nenhum sabor ${q ? "encontrado" : "cadastrado neste produto"}.</p>` : ""}
    </div>
    <p class="help" style="margin-top:10px">${subset.length} sabores · ⭐ aparece em “Destaques” no site · desative para esconder sem apagar.</p>`);
  $("#fProd").onchange = (e) => { ui.product = e.target.value; draw(); };
  let t; $("#fQ").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { ui.q = e.target.value; drawFlavors(box); const el = $("#fQ"); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 250); };
  bindRows(box, "flavors", M.flavors, subset, editFlavor);
}

function editFlavor(f) {
  const productId = f?.productId || ui.product;
  const prods = M.products.filter((p) => p.kind === "pizza" || p.kind === "units");
  const priceInputs = (pid, prices = {}) => {
    const p = M.products.find((x) => x.id === pid);
    if (!p || p.kind !== "pizza") return html`<p class="help">Este produto não tem preço por sabor (o preço vem do tamanho/combo).</p>`;
    return html`<div class="price-grid">${p.sizes.map((s) => input(`price_${s.id}`, `${s.name} (R$)`, dec(prices[s.id]), { attrs: 'inputmode="decimal" placeholder="vazio = não vende"' }))}</div>`;
  };
  const form = openModal({
    title: f ? `Editar sabor: ${f.name}` : "Novo sabor",
    subtitle: "Aparece na hora no cardápio do site.",
    body: html`
      <div class="form-grid">
        ${select("productId", "Produto", prods.map((p) => [p.id, p.name]), productId, { cls: "c3" })}
        ${select("tier", "Tipo", [["tradicional", "Tradicional"], ["especial", "Especial ⭐"]], f?.tier || "tradicional", { cls: "c3" })}
        ${input("name", "Nome do sabor", f?.name, { attrs: 'required maxlength="80"' })}
        ${textarea("description", "Ingredientes / descrição", f?.description, { rows: 2, attrs: 'maxlength="300"' })}
      </div>
      <fieldset><legend>Preços por tamanho</legend><div id="priceBox">${priceInputs(productId, f?.prices)}</div></fieldset>
      ${imageField("image", f?.image || "")}
      ${input("tags", "Etiquetas (separadas por vírgula)", (f?.tags || []).join(", "), { help: "Usadas nos filtros do site: frango, carnes, frutos-do-mar, queijos, vegetariana, picante, doce." })}
      <div class="toolbar" style="margin:0">${check("active", "Ativo no site", f ? isOn(f) : true)}${check("popular", "⭐ Destaque", !!f?.popular)}</div>`,
    onSubmit: async (form) => {
      const d = formData(form);
      const prices = {};
      for (const [k, v] of Object.entries(d)) if (k.startsWith("price_")) prices[k.slice(6)] = v.trim();
      await save("flavors", { productId: d.productId, tier: d.tier, name: d.name, description: d.description, image: d.image, tags: d.tags, prices, active: d.active, popular: d.popular, sort: f?.sort }, f?.id);
    },
  });
  form.elements.productId.addEventListener("change", (e) => setHTML($("#priceBox"), priceInputs(e.target.value, {})));
  bindImageFields(form);
}

/* ================= PRODUTOS ================= */
function drawProducts(box) {
  const cats = [...M.categories].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  setHTML(box, html`
    <div class="toolbar"><span class="grow help">Bebidas, combos, pizzas (com tamanhos) e qualquer outro item. Para adicionar um novo SABOR a uma pizza existente, use a aba “Sabores”.</span>
      <button type="button" class="btn btn-green" data-new>+ Novo produto</button></div>
    ${cats.map((c) => {
      const subset = M.products.filter((p) => p.categoryId === c.id).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
      return html`<div class="panel"><h2>${c.icon} ${c.name} ${isOn(c) ? "" : html`<small class="help">(categoria inativa)</small>`}</h2>
        ${subset.length ? html`<div class="table-wrap"><table class="table"><tbody>${subset.map((p, i) => html`<tr class="${isOn(p) ? "" : "off"}">
          <td style="width:60px"><img class="thumb" src="${imgSrc(p.image)}" alt="" loading="lazy"></td>
          <td><b>${p.name}</b><br><small>${KIND_LABEL[p.kind]}${p.kind === "pizza" ? ` · ${M.flavors.filter((f) => f.productId === p.id).length} sabores` : ""}</small></td>
          <td class="num">${p.price != null ? brl(p.price) : p.kind === "units" ? (p.sizes || []).map((s) => brl(s.price)).join(" / ") : "por sabor"}</td>
          <td><button type="button" class="star-btn" data-pop="${p.id}" aria-pressed="${!!p.popular}" aria-label="Destaque">⭐</button></td>
          <td><button type="button" class="switch" role="switch" data-active="${p.id}" aria-checked="${isOn(p)}" aria-label="Ativo no site"></button></td>
          <td>${rowActs(p.id, i === 0, i === subset.length - 1)}</td></tr>`)}</tbody></table></div>` : html`<p class="help">Nenhum produto nesta categoria.</p>`}
      </div>`;
    })}`);
  box.onclick = async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const p = M.products.find((x) => x.id === (b.dataset.edit || b.dataset.del || b.dataset.up || b.dataset.down || b.dataset.active || b.dataset.pop));
    const subset = p ? M.products.filter((x) => x.categoryId === p.categoryId).sort((a, b2) => (a.sort ?? 0) - (b2.sort ?? 0)) : [];
    if (b.dataset.new !== undefined) editProduct();
    if (b.dataset.edit) editProduct(p);
    if (b.dataset.del) remove("products", p.id, p.name);
    if (b.dataset.up) move("products", M.products, subset, p.id, -1);
    if (b.dataset.down) move("products", M.products, subset, p.id, 1);
    if (b.dataset.active) toggle("products", p, "active");
    if (b.dataset.pop) toggle("products", p, "popular");
  };
}

function sizeRow(kind, s = {}) {
  return html`<div class="r form-grid" data-row="size">
    ${input("s_name", "Nome", s.name || "", { cls: "c2", attrs: 'required placeholder="Ex.: Grande"' })}
    ${kind === "pizza" ? html`${input("s_slices", "Fatias", s.slices ?? "", { cls: "c2 keep", attrs: 'inputmode="numeric"' })}${input("s_cm", "cm", s.cm ?? "", { cls: "c2 keep", attrs: 'inputmode="numeric"' })}${input("s_max", "Máx. sabores", s.maxFlavors ?? 1, { cls: "c2 keep", attrs: 'inputmode="numeric"' })}` : ""}
    ${kind === "units" ? html`${input("s_units", "Unidades", s.units ?? "", { cls: "c2 keep", attrs: 'inputmode="numeric"' })}${input("s_price", "Preço (R$)", dec(s.price), { cls: "c2 keep", attrs: 'inputmode="decimal"' })}` : ""}
    ${input("s_includes", "Inclui (opcional)", s.includes || "", { cls: kind === "pizza" ? "c4" : "c2", attrs: 'placeholder="Ex.: Refrigerante 1,5 L"' })}
    <input type="hidden" name="s_id" value="${s.id || ""}">
    <div class="c2" style="display:flex;justify-content:flex-end"><button type="button" class="btn btn-sm btn-ghost" data-rm-row>Remover</button></div>
  </div>`;
}
function partRow(p = {}) {
  const pizzas = M.products.filter((x) => x.kind === "pizza");
  const prod = pizzas.find((x) => x.id === p.productId) || pizzas[0];
  return html`<div class="r form-grid" data-row="part">
    ${input("p_label", "Nome da parte", p.label || "", { cls: "c6", attrs: 'required placeholder="Ex.: Pizza Grande salgada"' })}
    ${select("p_product", "Produto", pizzas.map((x) => [x.id, x.name]), prod?.id, { cls: "c2" })}
    ${select("p_size", "Tamanho", (prod?.sizes || []).map((s) => [s.id, s.name]), p.sizeId, { cls: "c2" })}
    ${input("p_max", "Máx. sabores", p.maxFlavors ?? 1, { cls: "c2", attrs: 'inputmode="numeric"' })}
    ${select("p_addon", "Adicionais (borda)", [["", "Nenhum"], ...M.addonGroups.map((g) => [g.id, g.name])], p.addonGroupId || "", { cls: "c3" })}
    ${input("p_allowed", "Só estes sabores (ids, opcional)", (p.allowedFlavorIds || []).join(", "), { cls: "c3", help: "Vazio = todos os sabores. Sabores mais caros pagam a diferença." })}
    <input type="hidden" name="p_id" value="${p.id || ""}">
    <div class="c6" style="display:flex;justify-content:flex-end"><button type="button" class="btn btn-sm btn-ghost" data-rm-row>Remover parte</button></div>
  </div>`;
}
function drinkRow(o = {}) {
  return html`<div class="r form-grid" data-row="drink">
    ${input("d_name", "Bebida", o.name || "", { cls: "c4", attrs: 'required' })}
    ${input("d_extra", "Acréscimo (R$)", dec(o.extra ?? 0), { cls: "c2 keep", attrs: 'inputmode="decimal"' })}
    <input type="hidden" name="d_id" value="${o.id || ""}">
    <div class="c6" style="display:flex;justify-content:flex-end"><button type="button" class="btn btn-sm btn-ghost" data-rm-row>Remover</button></div>
  </div>`;
}

function editProduct(p) {
  let kind = p?.kind || "simple";
  const cats = [...M.categories].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const kindBody = (k, src = {}) => {
    if (k === "simple") return input("price", "Preço (R$)", dec(src.price), { attrs: 'inputmode="decimal" required' });
    if (k === "pizza") return html`
      <fieldset><legend>Tamanhos</legend><div class="rows" id="sizeRows">${(src.sizes?.length ? src.sizes : [{}]).map((s) => sizeRow("pizza", s))}</div>
        <div><button type="button" class="btn btn-sm btn-ghost" data-add-row="size">+ Tamanho</button></div>
        <p class="help">Os preços de cada tamanho ficam em cada SABOR (aba “Sabores”). Deixe o preço de um sabor vazio para não vender naquele tamanho.</p></fieldset>
      ${select("addonGroupId", "Bordas / adicionais", [["", "Nenhum"], ...M.addonGroups.map((g) => [g.id, g.name])], src.addonGroupId || "")}`;
    if (k === "units") return html`<fieldset><legend>Opções de quantidade</legend><div class="rows" id="sizeRows">${(src.sizes?.length ? src.sizes : [{}]).map((s) => sizeRow("units", s))}</div>
      <div><button type="button" class="btn btn-sm btn-ghost" data-add-row="size">+ Opção</button></div><p class="help">Os sabores (sem preço) são cadastrados na aba “Sabores”.</p></fieldset>`;
    if (k === "combo") return html`
      ${input("price", "Preço do combo (R$)", dec(src.price), { attrs: 'inputmode="decimal" required' })}
      <fieldset><legend>Partes do combo (pizzas que o cliente escolhe)</legend><div class="rows" id="partRows">${(src.parts || []).map((x) => partRow(x))}</div>
        <div><button type="button" class="btn btn-sm btn-ghost" data-add-row="part">+ Parte</button></div></fieldset>
      <fieldset><legend>Bebidas do combo</legend>
        <div class="form-grid">${input("drinks_label", "Nome do grupo", src.drinks?.label || "Refrigerante", { cls: "c3" })}${input("drinks_qty", "Quantas o cliente escolhe (0 = nenhuma)", src.drinks?.qty ?? 1, { cls: "c3", attrs: 'inputmode="numeric"' })}</div>
        <div class="rows" id="drinkRows">${(src.drinks?.options || []).map((o) => drinkRow(o))}</div>
        <div><button type="button" class="btn btn-sm btn-ghost" data-add-row="drink">+ Bebida</button></div></fieldset>`;
    return "";
  };
  const form = openModal({
    title: p ? `Editar: ${p.name}` : "Novo produto",
    subtitle: "Ex.: uma bebida nova, uma sobremesa, um combo ou uma nova linha de pizzas.",
    wide: true,
    body: html`
      <div class="form-grid">
        ${select("categoryId", "Categoria", cats.map((c) => [c.id, `${c.icon || ""} ${c.name}`]), p?.categoryId || cats.find((c) => c.id === "bebidas")?.id, { cls: "c3" })}
        ${select("kind", "Tipo", Object.entries(KIND_LABEL), kind, { cls: "c3" })}
        ${input("name", "Nome", p?.name, { attrs: 'required maxlength="80"' })}
        ${textarea("description", "Descrição", p?.description, { rows: 2, attrs: 'maxlength="300"' })}
        ${input("badge", "Selo (opcional)", p?.badge, { cls: "c3", attrs: 'maxlength="24" placeholder="Ex.: Novidade"' })}
      </div>
      <div id="kindBox">${kindBody(kind, p || {})}</div>
      ${imageField("image", p?.image || "")}
      <div class="toolbar" style="margin:0">${check("active", "Ativo no site", p ? isOn(p) : true)}${check("popular", "⭐ Destaque", !!p?.popular)}</div>`,
    onSubmit: async (form) => {
      const d = formData(form);
      const rows = (type) => [...form.querySelectorAll(`[data-row="${type}"]`)].map((r) => Object.fromEntries([...r.querySelectorAll("[name]")].map((el) => [el.name, el.value])));
      const body = { categoryId: d.categoryId, kind: d.kind, name: d.name, description: d.description, badge: d.badge, image: d.image, active: d.active, popular: d.popular, sort: p?.sort };
      if (d.kind === "simple" || d.kind === "combo") body.price = d.price;
      if (d.kind === "pizza" || d.kind === "units") body.sizes = rows("size").map((r) => ({ id: r.s_id || undefined, name: r.s_name, slices: r.s_slices, cm: r.s_cm, maxFlavors: r.s_max, units: r.s_units, price: r.s_price, includes: r.s_includes }));
      if (d.kind === "pizza") body.addonGroupId = d.addonGroupId || null;
      if (d.kind === "combo") {
        body.parts = rows("part").map((r) => ({ id: r.p_id || undefined, label: r.p_label, productId: r.p_product, sizeId: r.p_size, maxFlavors: r.p_max, addonGroupId: r.p_addon || undefined, allowedFlavorIds: r.p_allowed.split(",").map((x) => x.trim()).filter(Boolean) }));
        body.drinks = { label: d.drinks_label, qty: d.drinks_qty, options: rows("drink").map((r) => ({ id: r.d_id || undefined, name: r.d_name, extra: r.d_extra })) };
      }
      await save("products", body, p?.id);
    },
  });
  form.elements.kind.addEventListener("change", (e) => { kind = e.target.value; setHTML($("#kindBox"), kindBody(kind, {})); });
  form.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add-row]");
    if (add) {
      const type = add.dataset.addRow;
      const target = { size: "#sizeRows", part: "#partRows", drink: "#drinkRows" }[type];
      const tpl = document.createElement("template");
      tpl.innerHTML = String(type === "size" ? sizeRow(kind) : type === "part" ? partRow() : drinkRow());
      $(target).appendChild(tpl.content);
    }
    const rm = e.target.closest("[data-rm-row]");
    if (rm) rm.closest("[data-row]").remove();
  });
  form.addEventListener("change", (e) => {
    if (e.target.name !== "p_product") return;
    const prod = M.products.find((x) => x.id === e.target.value);
    const sizeSel = e.target.closest("[data-row]").querySelector('[name="p_size"]');
    setHTML(sizeSel, html`${(prod?.sizes || []).map((s) => html`<option value="${s.id}">${s.name}</option>`)}`);
  });
  bindImageFields(form);
}

/* ================= CATEGORIAS ================= */
function drawCategories(box) {
  const list = [...M.categories].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  setHTML(box, html`
    <div class="toolbar"><span class="grow help">A ordem aqui é a ordem das abas no cardápio do site.</span><button type="button" class="btn btn-green" data-new>+ Nova categoria</button></div>
    <div class="panel" style="padding:8px"><div class="table-wrap"><table class="table"><tbody>${list.map((c, i) => html`<tr class="${isOn(c) ? "" : "off"}">
      <td style="width:48px;font-size:26px">${c.icon}</td><td><b>${c.name}</b><br><small>${c.description}</small></td>
      <td><small>${M.products.filter((p) => p.categoryId === c.id).length} produtos</small></td>
      <td><button type="button" class="switch" role="switch" data-active="${c.id}" aria-checked="${isOn(c)}" aria-label="Ativa"></button></td>
      <td>${rowActs(c.id, i === 0, i === list.length - 1)}</td></tr>`)}</tbody></table></div></div>`);
  bindRows(box, "categories", M.categories, list, editCategory);
}
function editCategory(c) {
  openModal({
    title: c ? `Editar categoria: ${c.name}` : "Nova categoria",
    body: html`<div class="form-grid">${input("icon", "Ícone (emoji)", c?.icon || "🍽️", { cls: "c2", attrs: 'maxlength="8"' })}${input("name", "Nome", c?.name, { cls: "c4", attrs: 'required maxlength="60"' })}${textarea("description", "Descrição curta", c?.description, { rows: 2, attrs: 'maxlength="200"' })}</div>${check("active", "Ativa no site", c ? isOn(c) : true)}`,
    onSubmit: async (form) => { const d = formData(form); await save("categories", { ...d, productId: c?.productId || null, sort: c?.sort }, c?.id); },
  });
}

/* ================= ADICIONAIS ================= */
function drawAddons(box) {
  setHTML(box, html`
    <div class="toolbar"><span class="grow help">Grupos como “Borda”. Cada produto do tipo pizza pode usar um grupo.</span><button type="button" class="btn btn-green" data-new>+ Novo grupo</button></div>
    ${M.addonGroups.map((g) => html`<div class="panel"><h2>${g.name} <span style="margin-left:auto"></span><button type="button" class="mini" data-edit="${g.id}" aria-label="Editar">✏️</button><button type="button" class="mini danger" data-del="${g.id}" aria-label="Excluir">🗑</button></h2>
      <table class="table"><tbody>${g.options.map((o) => html`<tr class="${isOn(o) ? "" : "off"}"><td>${o.name}${g.defaultOptionId === o.id ? html` <small>(padrão)</small>` : ""}</td><td class="num">${o.price > 0 ? "+ " + brl(o.price) : "grátis"}</td></tr>`)}</tbody></table></div>`)}`);
  bindRows(box, "addonGroups", M.addonGroups, M.addonGroups, editAddon);
}
function optionRow(o = {}, isDefault = false) {
  return html`<div class="r form-grid" data-row="opt">
    ${input("o_name", "Opção", o.name || "", { cls: "c3", attrs: "required" })}${input("o_price", "Preço (R$)", dec(o.price ?? 0), { cls: "c2 keep", attrs: 'inputmode="decimal"' })}
    <input type="hidden" name="o_id" value="${o.id || ""}">
    <div class="c4 keep" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <label class="inline-check"><input type="checkbox" name="o_active" ${o.active === false ? "" : "checked"}> Ativa</label>
      <label class="inline-check"><input type="radio" name="o_default" ${isDefault ? "checked" : ""}> Padrão</label>
      <button type="button" class="btn btn-sm btn-ghost" data-rm-row>Remover</button></div>
  </div>`;
}
function editAddon(g) {
  const form = openModal({
    title: g ? `Editar: ${g.name}` : "Novo grupo de adicionais",
    body: html`${input("name", "Nome do grupo", g?.name || "Borda", { attrs: "required" })}
      <fieldset><legend>Opções</legend><div class="rows" id="optRows">${(g?.options || [{}]).map((o) => optionRow(o, g?.defaultOptionId === o.id))}</div>
      <div><button type="button" class="btn btn-sm btn-ghost" id="addOpt">+ Opção</button></div></fieldset>`,
    onSubmit: async (form) => {
      const rows = [...form.querySelectorAll('[data-row="opt"]')];
      const options = rows.map((r) => ({ id: r.querySelector('[name="o_id"]').value || undefined, name: r.querySelector('[name="o_name"]').value, price: r.querySelector('[name="o_price"]').value, active: r.querySelector('[name="o_active"]').checked }));
      const di = rows.findIndex((r) => r.querySelector('[name="o_default"]').checked);
      const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const defaultOptionId = di >= 0 ? options[di].id || slug(options[di].name) : null;
      await save("addonGroups", { name: form.elements.name.value, options, defaultOptionId, sort: g?.sort }, g?.id);
    },
  });
  form.addEventListener("click", (e) => {
    if (e.target.id === "addOpt") { const t = document.createElement("template"); t.innerHTML = String(optionRow()); $("#optRows").appendChild(t.content); }
    const rm = e.target.closest("[data-rm-row]"); if (rm) rm.closest("[data-row]").remove();
  });
}

/* ================= DEPOIMENTOS ================= */
function drawTestimonials(box) {
  const list = [...M.testimonials].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  setHTML(box, html`
    <div class="toolbar"><span class="grow help">Publique só avaliações reais de clientes (ex.: copiadas do Google, com permissão). A seção só aparece no site quando houver pelo menos uma ativa.</span><button type="button" class="btn btn-green" data-new>+ Novo depoimento</button></div>
    <div class="panel" style="padding:8px">${list.length ? html`<table class="table"><tbody>${list.map((t, i) => html`<tr class="${isOn(t) ? "" : "off"}"><td><b>${t.name}</b> ${"★".repeat(t.rating || 5)}<br><small>${t.text}</small></td>
      <td><button type="button" class="switch" role="switch" data-active="${t.id}" aria-checked="${isOn(t)}" aria-label="Ativo"></button></td><td>${rowActs(t.id, i === 0, i === list.length - 1)}</td></tr>`)}</tbody></table>` : html`<p class="empty">Nenhum depoimento ainda.</p>`}</div>`);
  bindRows(box, "testimonials", M.testimonials, list, editTestimonial);
}
function editTestimonial(t) {
  openModal({
    title: t ? "Editar depoimento" : "Novo depoimento",
    body: html`<div class="form-grid">${input("name", "Nome do cliente", t?.name, { cls: "c3", attrs: "required" })}${select("rating", "Nota", [[5, "★★★★★"], [4, "★★★★"], [3, "★★★"], [2, "★★"], [1, "★"]], t?.rating || 5, { cls: "c3" })}
      ${textarea("text", "Depoimento", t?.text, { rows: 3, attrs: 'required maxlength="400"' })}${input("source", "Origem", t?.source || "Google", { cls: "c3" })}</div>${check("active", "Ativo no site", t ? isOn(t) : true)}`,
    onSubmit: async (form) => { await save("testimonials", { ...formData(form), sort: t?.sort }, t?.id); },
  });
}
