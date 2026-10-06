/* ============================================================
   Painel do desenvolvedor — login, navegação e telas gerais.
   ============================================================ */
import { api, html, $, setHTML, toast, brlC, dt, openModal, input, formData, confirmDialog, ROOT } from "./core.js";
import { renderOrders, startOrderWatcher } from "./orders.js";
import { renderMenuEditor } from "./menu.js";
import { renderStore } from "./store.js";

let me = null;
const ROUTES = {
  painel: { title: "Painel", render: renderDashboard },
  pedidos: { title: "Pedidos", render: renderOrders },
  cardapio: { title: "Cardápio", render: renderMenuEditor },
  loja: { title: "Loja e horários", render: renderStore },
  historico: { title: "Histórico de alterações", render: renderHistory },
  conta: { title: "Conta e segurança", render: renderAccount },
};

/* ---------- Autenticação ---------- */
async function boot() {
  let s;
  try { s = await api("session"); } catch { return showFatal(); }
  if (s.user) { me = s.user; return showApp(); }
  showAuth(s.needsSetup);
}

function showFatal() {
  $("#auth").hidden = false;
  $("#authTitle").textContent = "Servidor não encontrado";
  $("#authSub").textContent = "O painel precisa do servidor Node rodando (npm start). No GitHub Pages ele não funciona — veja o README.";
  $("#authForm").hidden = true;
}

function showAuth(needsSetup) {
  $("#app").hidden = true;
  $("#auth").hidden = false;
  const form = $("#authForm");
  if (needsSetup) {
    $("#authTitle").textContent = "Criar conta de desenvolvedor";
    $("#authSub").textContent = "Primeiro acesso: crie seu usuário e senha. O código de configuração aparece no terminal onde você rodou npm start.";
    setHTML(form, html`
      ${input("setupCode", "Código de configuração", "", { attrs: 'autocomplete="off" placeholder="XXXX-XXXX" required' })}
      ${input("name", "Seu nome", "", { attrs: 'autocomplete="name"' })}
      ${input("username", "Usuário", "", { attrs: 'autocomplete="username" required minlength="3"' })}
      ${input("password", "Senha", "", { type: "password", attrs: 'autocomplete="new-password" required minlength="8"', help: "Mínimo de 8 caracteres, com letras e números." })}
      ${input("password2", "Repita a senha", "", { type: "password", attrs: 'autocomplete="new-password" required' })}
      <div class="err-box" id="authErr" hidden></div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">Criar conta e entrar</button>`);
  } else {
    $("#authTitle").textContent = "Área do desenvolvedor";
    $("#authSub").textContent = "Entre com sua conta para editar o site.";
    setHTML(form, html`
      ${input("username", "Usuário", "", { attrs: 'autocomplete="username" required' })}
      ${input("password", "Senha", "", { type: "password", attrs: 'autocomplete="current-password" required' })}
      <div class="err-box" id="authErr" hidden></div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">Entrar</button>`);
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const d = formData(form);
    const err = $("#authErr");
    err.hidden = true;
    if (needsSetup && d.password !== d.password2) { err.textContent = "As senhas não conferem."; err.hidden = false; return; }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const r = needsSetup
        ? await api("setup", { method: "POST", body: { setupCode: d.setupCode, name: d.name, username: d.username, password: d.password } })
        : await api("login", { method: "POST", body: { username: d.username, password: d.password } });
      me = r.user;
      form.reset();
      showApp();
      toast(`Bem-vindo, ${me.name || me.username}!`, "ok");
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    finally { btn.disabled = false; }
  };
  form.querySelector("input")?.focus();
}

function showApp() {
  $("#auth").hidden = true;
  $("#app").hidden = false;
  $("#whoName").textContent = me.name || me.username;
  route();
  startOrderWatcher();
  refreshStatus();
  setInterval(refreshStatus, 60_000);
}

async function refreshStatus() {
  try {
    const m = await api("menu");
    const pill = $("#storeStatus");
    pill.dataset.open = String(m.status.open);
    setHTML(pill, html`<i></i><span>${m.status.label}${m.status.detail ? " · " + m.status.detail : ""}</span>`);
  } catch { /* ignora */ }
}

window.addEventListener("store:changed", refreshStatus);
window.addEventListener("auth:expired", () => { me = null; toast("Sua sessão expirou. Entre de novo.", "err"); showAuth(false); });

$("#logoutBtn").addEventListener("click", async () => {
  try { await api("logout", { method: "POST" }); } catch { /* segue */ }
  me = null; location.hash = ""; showAuth(false);
});
$("#sideToggle").addEventListener("click", () => $("#side").classList.toggle("open"));
$("#side").addEventListener("click", (e) => { if (e.target.closest("a")) $("#side").classList.remove("open"); });

/* ---------- Rotas ---------- */
async function route() {
  if (!me) return;
  const [name, ...rest] = (location.hash.slice(1) || "painel").split("/");
  const r = ROUTES[name] || ROUTES.painel;
  document.querySelectorAll("[data-route]").forEach((a) => a.classList.toggle("active", a.dataset.route === (ROUTES[name] ? name : "painel")));
  $("#viewTitle").textContent = r.title;
  document.title = `${r.title} · Painel Figaro's`;
  const view = $("#view");
  setHTML(view, html`<div class="skeleton-grid" style="padding:0"><div class="sk" style="height:120px"></div><div class="sk" style="height:120px"></div><div class="sk" style="height:120px"></div></div>`);
  try { await r.render(view, rest); }
  catch (e) { if (e.status !== 401) setHTML(view, html`<div class="panel"><p class="err-box">${e.message}</p></div>`); }
}
window.addEventListener("hashchange", route);

/* ---------- Painel (dashboard) ---------- */
async function renderDashboard(view) {
  const days = Number(sessionStorage.getItem("fg_days") || 7);
  const s = await api(`stats?days=${days}`);
  const ticket = s.period.orders ? s.period.revenueCents / s.period.orders : 0;
  const byDay = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
    const hit = s.period.byDay.find((x) => x.day === key);
    byDay.push({ label: d.toLocaleDateString("pt-BR", days > 14 ? { day: "2-digit" } : { weekday: "short", day: "2-digit" }), orders: hit?.orders || 0, revenue: hit?.revenue || 0 });
  }
  const maxRev = Math.max(1, ...byDay.map((d) => d.revenue));
  const maxTop = Math.max(1, ...s.top.map((t) => t.n));
  setHTML(view, html`
    <div class="toolbar"><div class="tabs" style="margin:0">${[7, 30, 90].map((d) => html`<button type="button" data-days="${d}" aria-selected="${d === days}">${d} dias</button>`)}</div></div>
    <div class="kpis">
      <div class="kpi red"><small>Pedidos hoje</small><strong>${s.today.orders}</strong></div>
      <div class="kpi green"><small>Faturamento hoje</small><strong>${brlC(s.today.revenueCents)}</strong></div>
      <div class="kpi"><small>Aguardando confirmação</small><strong>${s.pending}</strong></div>
      <div class="kpi"><small>Ticket médio (${days}d)</small><strong>${brlC(ticket)}</strong></div>
    </div>
    <div class="two-col">
      <div class="panel"><h2>💰 Faturamento por dia</h2><p class="sub">${s.period.orders} pedidos · ${brlC(s.period.revenueCents)} nos últimos ${days} dias (sem cancelados)</p>
        <div class="bars">${byDay.map((d) => html`<div class="bar"><i style="height:${Math.round((d.revenue / maxRev) * 100)}%" data-tip="${d.orders} pedidos · ${brlC(d.revenue)}"></i><span>${d.label}</span></div>`)}</div>
      </div>
      <div class="panel"><h2>🔥 Mais pedidos</h2>
        ${s.top.length ? html`<ol class="rank">${s.top.map((t, i) => html`<li><b>${i + 1}</b><span>${t.name}</span><span>${t.n}×</span><div class="meter"><i style="width:${Math.round((t.n / maxTop) * 100)}%"></i></div></li>`)}</ol>`
          : html`<p class="help">Os sabores mais pedidos aparecem aqui assim que chegarem pedidos pelo site. Eles também passam a aparecer como “Mais pedidos” no site.</p>`}
      </div>
    </div>
    <div class="panel"><h2>⚡ Atalhos</h2>
      <div class="toolbar" style="margin:0">
        <a class="btn btn-green btn-sm" href="#cardapio/sabores/novo">+ Novo sabor de pizza</a>
        <a class="btn btn-green btn-sm" href="#cardapio/produtos/novo">+ Novo produto / bebida</a>
        <a class="btn btn-ghost btn-sm" href="#loja">Horários e taxa de entrega</a>
        <a class="btn btn-ghost btn-sm" href="#pedidos">Ver pedidos</a>
      </div>
    </div>`);
  view.querySelectorAll("[data-days]").forEach((b) => b.addEventListener("click", () => { sessionStorage.setItem("fg_days", b.dataset.days); renderDashboard(view); }));
}

/* ---------- Histórico ---------- */
const ENTITY_LABEL = { "": "Tudo", sabores: "Sabores", produtos: "Produtos", categorias: "Categorias", adicionais: "Adicionais", depoimentos: "Depoimentos", loja: "Loja", pedidos: "Pedidos", seguranca: "Segurança", usuarios: "Usuários", cardapio: "Cardápio", imagens: "Imagens", banco: "Banco" };
const ACTION_LABEL = { criou: "criou", editou: "editou", excluiu: "excluiu", reordenou: "reordenou", status_pedido: "mudou status de", login: "entrou", logout: "saiu", login_falhou: "tentativa de login falhou", alterou_senha: "alterou a senha", criou_conta: "criou a conta", desativou_conta: "desativou a conta", ativou_conta: "ativou a conta", importou: "importou", exportou: "exportou", baixou_backup: "baixou backup do", enviou_imagem: "enviou imagem" };

function diffText(before, after) {
  if (!before && !after) return "";
  if (!before) return Object.entries(after).filter(([k]) => !["sort"].includes(k)).map(([k, v]) => `+ ${k}: ${JSON.stringify(v)}`).join("\n");
  if (!after) return Object.entries(before).map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`).join("\n");
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const lines = [];
  for (const k of keys) {
    const a = JSON.stringify(before[k]), b = JSON.stringify(after[k]);
    if (a !== b) { if (a !== undefined) lines.push(`- ${k}: ${a}`); if (b !== undefined) lines.push(`+ ${k}: ${b}`); }
  }
  return lines.join("\n") || "(sem mudanças)";
}

async function renderHistory(view) {
  const st = { entity: "", q: "", page: 1 };
  const draw = async () => {
    const r = await api(`audit?entity=${encodeURIComponent(st.entity)}&q=${encodeURIComponent(st.q)}&page=${st.page}`);
    const pages = Math.max(1, Math.ceil(r.total / r.limit));
    setHTML(view, html`
      <div class="toolbar">
        <select class="select" id="hEntity">${Object.entries(ENTITY_LABEL).map(([k, v]) => html`<option value="${k}" ${k === st.entity ? "selected" : ""}>${v}</option>`)}</select>
        <input class="input grow" id="hQ" placeholder="Buscar por item, usuário…" value="${st.q}">
      </div>
      <div class="panel"><p class="sub" style="margin:0 0 10px">Tudo que é criado, editado ou excluído fica registrado aqui — com quem fez, quando e o que mudou.</p>
        <div class="table-wrap"><table class="table"><thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th class="hide-sm">Detalhes</th></tr></thead><tbody>
        ${r.rows.map((x) => html`<tr>
          <td><small>${dt(x.created_at)}</small></td>
          <td>${x.username || html`<small>${x.action === "login_falhou" ? "—" : "sistema"}</small>`}</td>
          <td>${ACTION_LABEL[x.action] || x.action} <b>${ENTITY_LABEL[x.entity] || x.entity}</b>${x.entity_id ? html` <small>${x.entity_id}</small>` : ""}</td>
          <td class="hide-sm">${x.before || x.after ? html`<details><summary class="link-btn" style="cursor:pointer">ver</summary><div class="diff">${diffText(x.before, x.after)}</div></details>` : ""}</td>
        </tr>`)}
        </tbody></table></div>
        ${!r.rows.length ? html`<p class="empty">Nada registrado ainda.</p>` : ""}
        <div class="pager"><button type="button" class="btn btn-sm btn-ghost" id="hPrev" ${st.page <= 1 ? "disabled" : ""}>← Anterior</button><span>${st.page} / ${pages}</span><button type="button" class="btn btn-sm btn-ghost" id="hNext" ${st.page >= pages ? "disabled" : ""}>Próxima →</button></div>
      </div>`);
    $("#hEntity").onchange = (e) => { st.entity = e.target.value; st.page = 1; draw(); };
    let t; $("#hQ").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { st.q = e.target.value; st.page = 1; draw().then(() => { const q = $("#hQ"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }); }, 350); };
    $("#hPrev").onclick = () => { st.page--; draw(); };
    $("#hNext").onclick = () => { st.page++; draw(); };
  };
  await draw();
}

/* ---------- Conta ---------- */
async function renderAccount(view) {
  const users = await api("users");
  setHTML(view, html`
    <div class="two-col">
      <div class="panel"><h2>🔑 Alterar minha senha</h2>
        <form id="pwForm" class="admin-form" style="padding:0">
          ${input("current", "Senha atual", "", { type: "password", attrs: 'autocomplete="current-password" required' })}
          ${input("next", "Nova senha", "", { type: "password", attrs: 'autocomplete="new-password" required minlength="8"', help: "Mínimo de 8 caracteres, com letras e números. Outras sessões abertas serão encerradas." })}
          ${input("next2", "Repita a nova senha", "", { type: "password", attrs: 'autocomplete="new-password" required' })}
          <div class="err-box" id="pwErr" hidden></div>
          <div><button class="btn btn-green" type="submit">Salvar nova senha</button></div>
        </form>
      </div>
      <div class="panel"><h2>💾 Cardápio e backup</h2>
        <p class="sub">O site no GitHub Pages (sem servidor) usa o arquivo <code>data/menu.json</code>. Depois de editar o cardápio aqui, baixe o arquivo e substitua no repositório para atualizar também essa versão.</p>
        <div class="toolbar" style="margin:0">
          <a class="btn btn-sm btn-green" href="${new URL("api/admin/export", ROOT).href}">⬇ Baixar menu.json</a>
          <span class="btn btn-sm btn-ghost file-btn">⬆ Importar menu.json<input type="file" id="importFile" accept="application/json,.json"></span>
          <a class="btn btn-sm btn-ghost" href="${new URL("api/admin/backup", ROOT).href}">🗄 Backup do banco (.db)</a>
        </div>
      </div>
    </div>
    <div class="panel"><h2>👥 Contas de desenvolvedor</h2>
      <div class="table-wrap"><table class="table"><thead><tr><th>Usuário</th><th>Nome</th><th class="hide-sm">Criada em</th><th class="hide-sm">Último acesso</th><th>Ativa</th></tr></thead><tbody>
        ${users.map((u) => html`<tr class="${u.active ? "" : "off"}"><td><b>${u.username}</b>${u.id === me.id ? html` <small>(você)</small>` : ""}</td><td>${u.name}</td><td class="hide-sm"><small>${dt(u.created_at)}</small></td><td class="hide-sm"><small>${dt(u.last_login_at)}</small></td>
          <td><button type="button" class="switch" role="switch" aria-checked="${!!u.active}" data-user="${u.id}" aria-label="Conta ativa" ${u.id === me.id ? "disabled" : ""}></button></td></tr>`)}
      </tbody></table></div>
      <div style="margin-top:12px"><button type="button" class="btn btn-sm btn-green" id="newUser">+ Nova conta</button></div>
    </div>`);

  $("#pwForm").onsubmit = async (e) => {
    e.preventDefault();
    const d = formData(e.target), err = $("#pwErr");
    err.hidden = true;
    if (d.next !== d.next2) { err.textContent = "As senhas novas não conferem."; err.hidden = false; return; }
    try { await api("password", { method: "POST", body: { current: d.current, next: d.next } }); e.target.reset(); toast("Senha alterada ✓", "ok"); }
    catch (ex) { err.textContent = ex.message; err.hidden = false; }
  };
  view.querySelectorAll("[data-user]").forEach((b) => b.addEventListener("click", async () => {
    const active = b.getAttribute("aria-checked") !== "true";
    if (!active && !(await confirmDialog("Essa pessoa não vai mais conseguir entrar no painel.", { title: "Desativar conta?", confirmLabel: "Desativar" }))) return;
    try { await api(`users/${b.dataset.user}`, { method: "PATCH", body: { active } }); renderAccount(view); toast("Conta atualizada", "ok"); } catch (ex) { toast(ex.message, "err"); }
  }));
  $("#newUser").onclick = () => openModal({
    title: "Nova conta de desenvolvedor",
    body: html`${input("name", "Nome")}${input("username", "Usuário", "", { attrs: 'autocomplete="off" required' })}${input("password", "Senha", "", { type: "password", attrs: 'autocomplete="new-password" required', help: "Mínimo de 8 caracteres, com letras e números." })}`,
    submitLabel: "Criar conta",
    onSubmit: async (form) => { await api("users", { method: "POST", body: formData(form) }); toast("Conta criada ✓", "ok"); renderAccount(view); },
  });
  $("#importFile").onchange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const menu = JSON.parse(await f.text());
      if (!(await confirmDialog("Isso substitui TODO o cardápio atual (sabores, produtos, categorias e configurações) pelo conteúdo do arquivo. A mudança fica registrada no histórico.", { title: "Importar cardápio?", confirmLabel: "Importar" }))) return;
      const r = await api("import", { method: "POST", body: { menu } });
      toast(`Cardápio importado: ${r.products} produtos, ${r.flavors} sabores ✓`, "ok", 4000);
    } catch (ex) { toast(ex.message || "Arquivo inválido.", "err"); }
    finally { e.target.value = ""; }
  };
}

boot();
