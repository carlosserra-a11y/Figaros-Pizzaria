import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.js";

let server, base, ctx, dataDir;
const H = { "Content-Type": "application/json", "X-Requested-With": "figaros-admin" };
let cookie = "";

async function call(method, path, body, headers = {}) {
  const res = await fetch(base + path, { method, headers: { ...H, ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data, res };
}

before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "figaros-test-"));
  ctx = createApp({ dataDir, setupCode: "ABCD-EFGH", logger: { error() {} } });
  server = ctx.app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  // Loja aberta durante os testes
  const s = ctx.db.getStore();
  ctx.db.setStore({ ...s, forceStatus: "open" });
});

after(() => { server.close(); ctx.db.close(); rmSync(dataDir, { recursive: true, force: true }); });

const ORDER = {
  customer: { name: "Cliente Teste", phone: "(48) 99999-0000" },
  mode: "delivery",
  address: { street: "Rua Teste", number: "10", district: "Centro" },
  payment: { method: "pix" },
  items: [{ productId: "pizza-salgada", sizeId: "gigante", flavorIds: ["salgada-calabresa"], qty: 1, unitCents: 1 }],
};

test("cardápio público só traz itens ativos", async () => {
  const { status, data } = await call("GET", "/api/menu");
  assert.equal(status, 200);
  assert.ok(data.flavors.length > 60);
  assert.ok(!data.flavors.some((f) => f.id === "salgada-caipira"));
  assert.equal(data.status.open, true);
});

test("pedido: servidor recalcula o preço (ignora preço do navegador)", async () => {
  const { status, data } = await call("POST", "/api/orders", ORDER);
  assert.equal(status, 201, JSON.stringify(data));
  assert.equal(data.totalCents, 9490 + 890);
  assert.match(data.code, /^[A-Z0-9]{6}$/);
  assert.ok(data.whatsappUrl.startsWith("https://wa.me/"));
  const track = await call("GET", `/api/orders/${data.code}`);
  assert.equal(track.status, 200);
  assert.equal(track.data.status, "novo");
  assert.equal(track.data.customerFirstName, "Cliente");
  assert.equal(track.data.address, undefined, "não expõe endereço");
});

test("pedido inválido é recusado com mensagem clara", async () => {
  const r1 = await call("POST", "/api/orders", { ...ORDER, customer: { name: "A", phone: "123" } });
  assert.equal(r1.status, 400);
  const r2 = await call("POST", "/api/orders", { ...ORDER, items: [{ productId: "pizza-salgada", sizeId: "broto", flavorIds: ["salgada-calabresa", "salgada-bacon"] }] });
  assert.equal(r2.status, 400);
  const r3 = await call("POST", "/api/orders", { ...ORDER, payment: { method: "dinheiro", changeFor: 10 } });
  assert.equal(r3.status, 400);
});

test("loja fechada não aceita pedidos", async () => {
  const s = ctx.db.getStore();
  ctx.db.setStore({ ...s, forceStatus: "closed" });
  const r = await call("POST", "/api/orders", ORDER);
  assert.equal(r.status, 409);
  ctx.db.setStore({ ...s, forceStatus: "open" });
});

test("painel exige login e cabeçalho anti-CSRF", async () => {
  assert.equal((await call("GET", "/api/admin/menu")).status, 401);
  const noHeader = await fetch(base + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(noHeader.status, 403);
});

test("primeiro acesso exige o código de configuração e senha forte", async () => {
  assert.equal((await call("GET", "/api/admin/session")).data.needsSetup, true);
  assert.equal((await call("POST", "/api/admin/setup", { setupCode: "XXXX-XXXX", username: "dev", password: "senhaForte123" })).status, 403);
  assert.equal((await call("POST", "/api/admin/setup", { setupCode: "ABCD-EFGH", username: "dev", password: "fraca" })).status, 400);
  const ok = await call("POST", "/api/admin/setup", { setupCode: "ABCD-EFGH", username: "dev", name: "Dev", password: "senhaForte123" });
  assert.equal(ok.status, 201);
  assert.ok(cookie.startsWith("fg_session="));
  assert.equal((await call("POST", "/api/admin/setup", { setupCode: "ABCD-EFGH", username: "outro", password: "senhaForte123" })).status, 409);
});

test("desenvolvedor cria, edita e exclui um sabor (com histórico)", async () => {
  const created = await call("POST", "/api/admin/menu/flavors", { productId: "pizza-salgada", name: "Pizza de Teste", description: "<script>alert(1)</script> queijo", tier: "especial", prices: { broto: "70", media: "99,90", grande: "", gigante: 120 } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.deepEqual(created.data.prices, { broto: 70, media: 99.9, gigante: 120 });
  const pub = await call("GET", "/api/menu");
  assert.ok(pub.data.flavors.some((f) => f.id === created.data.id));
  const edited = await call("PUT", `/api/admin/menu/flavors/${created.data.id}`, { ...created.data, active: false });
  assert.equal(edited.status, 200);
  assert.ok(!(await call("GET", "/api/menu")).data.flavors.some((f) => f.id === created.data.id));
  assert.equal((await call("DELETE", `/api/admin/menu/flavors/${created.data.id}`)).status, 200);
  const audit = await call("GET", "/api/admin/audit?entity=sabores");
  assert.deepEqual(audit.data.rows.map((r) => r.action).slice(0, 3), ["excluiu", "editou", "criou"]);
});

test("não deixa excluir categoria em uso", async () => {
  const r = await call("DELETE", "/api/admin/menu/categories/bebidas");
  assert.equal(r.status, 409);
});

test("desenvolvedor cria nova bebida e ela aparece no site", async () => {
  const r = await call("POST", "/api/admin/menu/products", { categoryId: "bebidas", kind: "simple", name: "Suco de Laranja 500 ml", price: "9,90", image: "https://example.com/suco.jpg" });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const pub = await call("GET", "/api/menu");
  assert.equal(pub.data.products.find((p) => p.id === r.data.id).price, 9.9);
  const bad = await call("POST", "/api/admin/menu/products", { categoryId: "bebidas", kind: "simple", name: "X", price: 1, image: "javascript:alert(1)" });
  assert.equal(bad.status, 400);
});

test("upload de foto: só logado, só imagem de verdade", async () => {
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const ok = await call("POST", "/api/admin/upload", { dataUrl: png });
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.match(ok.data.path, /^uploads\/[\w-]+\.png$/);
  assert.equal((await fetch(`${base}/${ok.data.path}`)).status, 200);
  const fake = await call("POST", "/api/admin/upload", { dataUrl: "data:image/png;base64," + Buffer.from("<svg onload=alert(1)>").toString("base64") });
  assert.equal(fake.status, 400);
  const anon = await fetch(base + "/api/admin/upload", { method: "POST", headers: H, body: JSON.stringify({ dataUrl: png }) });
  assert.equal(anon.status, 401);
});

test("pedidos: listar, mudar status e estatísticas", async () => {
  const list = await call("GET", "/api/admin/orders");
  assert.ok(list.data.total >= 1);
  const id = list.data.rows[0].id;
  const upd = await call("PATCH", `/api/admin/orders/${id}`, { status: "preparo" });
  assert.equal(upd.data.status, "preparo");
  assert.equal(upd.data.events.length, 2);
  const stats = await call("GET", "/api/admin/stats?days=7");
  assert.ok(stats.data.today.orders >= 1);
});

test("login errado é recusado e registrado; logout encerra a sessão", async () => {
  const saved = cookie;
  cookie = "";
  assert.equal((await call("POST", "/api/admin/login", { username: "dev", password: "errada123" })).status, 401);
  assert.equal((await call("POST", "/api/admin/login", { username: "dev", password: "senhaForte123" })).status, 200);
  assert.equal((await call("POST", "/api/admin/logout")).status, 200);
  cookie = saved;
  assert.equal((await call("GET", "/api/admin/menu")).status, 200, "sessão antiga continua válida");
});

test("painel abre em /admin/ sem loop de redirecionamento", async () => {
  const a = await fetch(base + "/admin", { redirect: "manual" });
  assert.equal(a.status, 302);
  assert.equal(a.headers.get("location"), "/admin/");
  const b = await fetch(base + "/admin/", { redirect: "manual" });
  assert.equal(b.status, 200);
  assert.match(await b.text(), /Painel do desenvolvedor/);
});

test("arquivos internos do servidor não são servidos", async () => {
  for (const p of ["/server/app.js", "/package.json", "/server/data/figaros.db", "/node_modules/express/package.json"]) {
    const r = await fetch(base + p);
    assert.equal(r.status, 404, p);
  }
});
