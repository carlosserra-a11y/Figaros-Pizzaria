/* Pedidos no painel: lista com filtros, detalhes, mudança de status e alerta de pedido novo. */
import { api, html, $, setHTML, toast, brlC, dt, imgSrc } from "./core.js";
import { ORDER_STATUS, PAYMENT_LABELS } from "../shared/pricing.js";

const st = { status: "", q: "", page: 1, selected: null };
let lastSeenId = null;
let view = null;
const NEXT = {
  delivery: [["confirmado", "👍 Confirmar"], ["preparo", "🔥 No forno"], ["saiu", "🛵 Saiu p/ entrega"], ["entregue", "🎉 Entregue"]],
  pickup: [["confirmado", "👍 Confirmar"], ["preparo", "🔥 No forno"], ["pronto", "🛍️ Pronto p/ retirar"], ["entregue", "🎉 Retirado"]],
};

export async function renderOrders(v, [id] = []) {
  view = v;
  if (id) st.selected = Number(id);
  await drawList();
  if (st.selected) drawDetail(st.selected);
}

async function drawList() {
  const r = await api(`orders?status=${st.status}&q=${encodeURIComponent(st.q)}&page=${st.page}&limit=25`);
  const pages = Math.max(1, Math.ceil(r.total / r.limit));
  const tabs = [["", "Todos"], ...Object.entries(ORDER_STATUS).map(([k, v]) => [k, v.label])];
  setHTML(view, html`
    <div class="toolbar">
      <div class="tabs" style="margin:0">${tabs.map(([k, label]) => html`<button type="button" data-st="${k}" aria-selected="${st.status === k}">${label}</button>`)}</div>
      <input class="input grow" id="oQ" placeholder="Buscar por código, nome ou telefone…" value="${st.q}">
    </div>
    <div class="orders-layout">
      <div class="panel" style="padding:8px 8px 14px">
        <div class="table-wrap"><table class="table"><thead><tr><th>Pedido</th><th>Cliente</th><th class="hide-sm">Entrega</th><th>Status</th><th class="num">Total</th></tr></thead><tbody>
          ${r.rows.map((o) => html`<tr class="clickable order-row ${o.id === st.selected ? "sel" : ""}" data-id="${o.id}" style="${o.id === st.selected ? "background:var(--paper)" : ""}">
            <td><span class="code">#${o.code}</span><br><small>${dt(o.createdAt)}</small></td>
            <td>${o.customer.name}<br><small>${o.customer.phone}</small></td>
            <td class="hide-sm">${o.mode === "delivery" ? html`🛵 <small>${o.address?.district || ""}</small>` : "🏃 Retirada"}</td>
            <td><span class="st ${o.status}">${ORDER_STATUS[o.status]?.label || o.status}</span></td>
            <td class="num">${brlC(o.totalCents)}</td>
          </tr>`)}
        </tbody></table></div>
        ${!r.rows.length ? html`<p class="empty">Nenhum pedido ${st.status ? "com esse status" : "ainda"}. Os pedidos feitos no site aparecem aqui na hora.</p>` : ""}
        <div class="pager"><button type="button" class="btn btn-sm btn-ghost" id="oPrev" ${st.page <= 1 ? "disabled" : ""}>←</button><span>${st.page} / ${pages} · ${r.total} pedidos</span><button type="button" class="btn btn-sm btn-ghost" id="oNext" ${st.page >= pages ? "disabled" : ""}>→</button></div>
      </div>
      <div class="panel order-detail" id="orderDetail"><p class="help">Selecione um pedido para ver os detalhes.</p></div>
    </div>`);
  view.querySelectorAll("[data-st]").forEach((b) => b.addEventListener("click", () => { st.status = b.dataset.st; st.page = 1; drawList(); }));
  let t;
  $("#oQ").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(async () => { st.q = e.target.value; st.page = 1; await drawList(); const q = $("#oQ"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 350); });
  $("#oPrev").onclick = () => { st.page--; drawList(); };
  $("#oNext").onclick = () => { st.page++; drawList(); };
  view.querySelector("tbody").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    st.selected = Number(tr.dataset.id);
    view.querySelectorAll("tr[data-id]").forEach((x) => (x.style.background = x === tr ? "var(--paper)" : ""));
    drawDetail(st.selected);
    if (window.innerWidth < 1100) $("#orderDetail").scrollIntoView({ behavior: "smooth" });
  });
  if (st.selected) drawDetail(st.selected);
}

async function drawDetail(id) {
  const box = $("#orderDetail");
  if (!box) return;
  let o;
  try { o = await api(`orders/${id}`); } catch (e) { setHTML(box, html`<p class="err-box">${e.message}</p>`); return; }
  const a = o.address;
  const addr = a ? `${a.street}, ${a.number}${a.complement ? " – " + a.complement : ""} – ${a.district}${a.cep ? " – CEP " + a.cep : ""}` : "";
  const phoneDigits = o.customer.phone.replace(/\D/g, "");
  const flow = NEXT[o.mode] || NEXT.delivery;
  setHTML(box, html`
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
      <h2 style="margin:0">Pedido <span class="code" style="font-family:var(--f-display)">#${o.code}</span></h2>
      <span class="st ${o.status}">${ORDER_STATUS[o.status]?.label}</span>
    </div>
    <p class="help" style="margin:4px 0 12px">${dt(o.createdAt)}</p>
    <dl class="kv">
      <dt>Cliente</dt><dd>${o.customer.name}</dd>
      <dt>Telefone</dt><dd><a href="tel:+55${phoneDigits}">${o.customer.phone}</a> · <a href="https://wa.me/55${phoneDigits}" target="_blank" rel="noopener noreferrer">WhatsApp</a></dd>
      <dt>Entrega</dt><dd>${o.mode === "delivery" ? html`${addr}${a.reference ? html`<br><small>Ref.: ${a.reference}</small>` : ""}<br><a target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr + ", Palhoça - SC")}">abrir no mapa ↗</a>` : "Retirada no balcão"}</dd>
      <dt>Pagamento</dt><dd>${PAYMENT_LABELS[o.payment.method] || o.payment.method}${o.payment.changeFor ? html` — troco p/ ${brlC(Math.round(o.payment.changeFor * 100))}` : ""}</dd>
      ${o.notes ? html`<dt>Obs.</dt><dd>${o.notes}</dd>` : ""}
    </dl>
    <ul class="items-list">${o.items.map((it) => html`<li><div class="top"><span>${it.qty}× ${it.title}</span><span>${brlC(it.totalCents)}</span></div>${it.lines?.length ? html`<ul>${it.lines.map((l) => html`<li>${l}</li>`)}</ul>` : ""}</li>`)}</ul>
    <dl class="kv" style="margin-top:10px">
      <dt>Subtotal</dt><dd>${brlC(o.subtotalCents)}</dd>
      <dt>Entrega</dt><dd>${brlC(o.deliveryFeeCents)}</dd>
      <dt>Total</dt><dd style="font-size:18px;font-weight:900">${brlC(o.totalCents)}</dd>
    </dl>
    ${o.status !== "cancelado" && o.status !== "entregue" ? html`<div class="acts">
      ${flow.map(([s, label]) => html`<button type="button" class="btn btn-sm ${ORDER_STATUS[s].step === (ORDER_STATUS[o.status].step + 1) ? "btn-green" : "btn-ghost"}" data-set="${s}" ${ORDER_STATUS[s].step <= ORDER_STATUS[o.status].step ? "disabled" : ""}>${label}</button>`)}
      <button type="button" class="btn btn-sm btn-ghost" data-set="cancelado" style="grid-column:span 2;color:var(--red)">Cancelar pedido</button>
    </div>` : ""}
    <h2 style="margin-top:12px">Linha do tempo</h2>
    <ol class="timeline">${o.events.map((e) => html`<li class="tl done"><span class="b">✓</span><div><strong>${ORDER_STATUS[e.status]?.label || e.status}</strong><small>${dt(e.created_at)}${e.username ? ` · ${e.username}` : ""}${e.note ? ` · ${e.note}` : ""}</small></div></li>`)}</ol>
    <button type="button" class="btn btn-sm btn-ghost" id="printOrder">🖨 Imprimir comanda</button>`);
  box.querySelectorAll("[data-set]").forEach((b) => b.addEventListener("click", async () => {
    const status = b.dataset.set;
    let note = "";
    if (status === "cancelado") { note = prompt("Motivo do cancelamento (opcional):") ?? null; if (note === null) return; }
    try { await api(`orders/${id}`, { method: "PATCH", body: { status, note } }); toast(`Pedido #${o.code}: ${ORDER_STATUS[status].label}`, "ok"); await drawList(); }
    catch (e) { toast(e.message, "err"); }
  }));
  $("#printOrder").onclick = () => printTicket(o, addr);
}

function printTicket(o, addr) {
  const w = window.open("", "_blank", "width=380,height=600");
  if (!w) return toast("Permita pop-ups para imprimir.", "err");
  const e = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  w.document.write(`<!doctype html><meta charset="utf-8"><title>#${e(o.code)}</title><style>body{font:14px monospace;margin:12px;width:300px}h1{font-size:18px;text-align:center}hr{border:0;border-top:1px dashed #000}.r{display:flex;justify-content:space-between}</style>
  <h1>FIGARO'S PIZZARIA<br>#${e(o.code)}</h1><p>${e(dt(o.createdAt))}</p><hr>
  <p><b>${e(o.customer.name)}</b><br>${e(o.customer.phone)}<br>${o.mode === "delivery" ? e(addr) + (o.address?.reference ? "<br>Ref.: " + e(o.address.reference) : "") : "RETIRADA"}</p><hr>
  ${o.items.map((it) => `<div class="r"><b>${it.qty}x ${e(it.title)}</b><span>${e(brlC(it.totalCents))}</span></div>${(it.lines || []).map((l) => `<div>&nbsp;&nbsp;${e(l)}</div>`).join("")}`).join("")}<hr>
  <div class="r"><span>Subtotal</span><span>${e(brlC(o.subtotalCents))}</span></div><div class="r"><span>Entrega</span><span>${e(brlC(o.deliveryFeeCents))}</span></div>
  <div class="r"><b>TOTAL</b><b>${e(brlC(o.totalCents))}</b></div><p>Pagamento: ${e(PAYMENT_LABELS[o.payment.method] || o.payment.method)}${o.payment.changeFor ? " — troco p/ " + e(brlC(Math.round(o.payment.changeFor * 100))) : ""}</p>
  ${o.notes ? `<p>Obs.: ${e(o.notes)}</p>` : ""}`);
  w.document.close();
  w.focus();
  w.print();
}

/* ---------- Alerta de pedido novo (som + contador) ---------- */
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.18, 0.36].forEach((t, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = [880, 1175, 1568][i]; o.type = "sine";
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.16);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
  } catch { /* sem áudio */ }
}

export function startOrderWatcher() {
  const check = async () => {
    try {
      const [{ id }, stats] = await Promise.all([api("orders/latest"), api("stats?days=1")]);
      const badge = $("#pendingCount");
      badge.textContent = stats.pending;
      badge.hidden = !stats.pending;
      if (lastSeenId !== null && id > lastSeenId) {
        beep();
        toast("🍕 Pedido novo chegou!", "ok", 5000);
        document.title = "🔔 Pedido novo · Painel Figaro's";
        if (location.hash.startsWith("#pedidos") && view?.isConnected) drawList();
      }
      lastSeenId = id;
    } catch { /* offline ou sessão expirada */ }
  };
  check();
  setInterval(check, 15000);
}
