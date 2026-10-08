/* ============================================================
   Aplicação Express: site estático + API pública + API do painel.
   ============================================================ */
import express from "express";
import compression from "compression";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { randomBytes, timingSafeEqual } from "node:crypto";

import { openDatabase, MENU_TABLES } from "./db.js";
import * as V from "./validate.js";
import {
  hashPassword, verifyPassword, DUMMY_HASH, passwordProblems, newToken, sha256, newOrderCode,
  parseCookies, sessionCookie, SESSION_COOKIE, SESSION_TTL_MS, rateLimiter, securityHeaders,
} from "./security.js";
import { indexMenu, priceCart, storeStatus, buildWhatsAppText, ORDER_STATUS, toCents, fromCents, formatBRL } from "../js/shared/pricing.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Meia-noite (horário de São Paulo, UTC−3, sem horário de verão desde 2019) do dia de `d`. */
export function spMidnight(d) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
  return new Date(`${day}T00:00:00-03:00`);
}

export function createApp({ dataDir, setupCode = null, corsOrigins = [], trustProxy = false, secureCookies = false, logger = console } = {}) {
  const store = openDatabase(dataDir);
  const uploadsDir = join(dataDir, "uploads");
  mkdirSync(uploadsDir, { recursive: true });
  const state = { setupCode };

  const app = express();
  app.disable("x-powered-by");
  if (trustProxy) app.set("trust proxy", trustProxy === true ? 1 : trustProxy);
  app.use(securityHeaders);
  app.use(compression());

  /* ---------------- Arquivos estáticos (lista branca) ---------------- */
  const staticOpts = (maxAge) => ({ maxAge, fallthrough: true, index: false, dotfiles: "deny" });
  // CSS/JS sempre revalidados (ETag) para que mudanças apareçam na hora; imagens ficam em cache por 1 dia.
  app.use("/assets", express.static(join(ROOT, "assets"), staticOpts("1d")));
  for (const dir of ["css", "js"]) app.use(`/${dir}`, express.static(join(ROOT, dir), staticOpts(0)));
  app.use("/data", express.static(join(ROOT, "data"), staticOpts(0)));
  app.use("/uploads", express.static(uploadsDir, { ...staticOpts("30d"), immutable: true }));
  // Express 5 trata "/admin" e "/admin/" como a mesma rota: só redireciona quando falta a barra.
  app.get("/admin", (req, res, next) => (req.originalUrl.split("?")[0].endsWith("/") ? next() : res.redirect(302, "/admin/")));
  app.use("/admin", express.static(join(ROOT, "admin"), { ...staticOpts(0), index: "index.html" }));
  for (const f of ["robots.txt", "manifest.webmanifest", "creditos.html"]) app.get(`/${f}`, (req, res) => res.sendFile(join(ROOT, f)));
  // Service worker: sempre revalidado, para atualizações chegarem na hora
  app.get("/sw.js", (req, res) => res.set("Cache-Control", "no-cache").sendFile(join(ROOT, "sw.js")));
  app.get("/favicon.ico", (req, res) => res.sendFile(join(ROOT, "assets", "img", "favicon.png")));
  app.get(["/", "/index.html"], (req, res) => res.sendFile(join(ROOT, "index.html")));

  /* ---------------- Utilitários ---------------- */
  const ip = (req) => req.ip || req.socket.remoteAddress || "";
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const tooMany = (res, retryAfter) => res.status(429).set("Retry-After", String(retryAfter)).json({ error: "Muitas tentativas. Aguarde um pouco e tente de novo." });

  const limits = {
    login: rateLimiter({ windowMs: 15 * 60_000, max: 20 }),
    loginUser: rateLimiter({ windowMs: 15 * 60_000, max: 8 }),
    orders: rateLimiter({ windowMs: 10 * 60_000, max: 40 }),
    tracking: rateLimiter({ windowMs: 60_000, max: 400 }),
  };

  // CORS apenas para a API pública e apenas para origens configuradas (ex.: GitHub Pages).
  const allowed = new Set(corsOrigins.filter(Boolean));
  const publicCors = (req, res, next) => {
    const origin = req.get("origin");
    if (origin && allowed.has(origin)) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.set("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  };

  /* ================================================================
     API PÚBLICA
     ================================================================ */
  const pub = express.Router();
  pub.use(publicCors);
  pub.use(express.json({ limit: "100kb" }));

  pub.get("/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  function publicMenu() {
    const m = store.getMenu();
    const active = (x) => x.active !== false;
    const categories = m.categories.filter(active);
    const catIds = new Set(categories.map((c) => c.id));
    const products = m.products.filter((p) => active(p) && catIds.has(p.categoryId));
    const prodIds = new Set(products.map((p) => p.id));
    const flavors = m.flavors.filter((f) => active(f) && prodIds.has(f.productId));
    const addonGroups = m.addonGroups.map((g) => ({ ...g, options: (g.options || []).filter(active) }));
    const visible = new Set([...prodIds, ...flavors.map((f) => f.id)]);
    const bestSellers = store.bestSellers(30, 8).filter((b) => visible.has(b.id)).map((b) => b.id);
    return {
      version: m.version,
      store: m.store,
      status: storeStatus(m.store),
      categories, products, flavors, addonGroups,
      testimonials: m.testimonials.filter(active),
      bestSellers,
    };
  }

  pub.get("/menu", (req, res) => {
    const menu = publicMenu();
    const etag = `W/"m${menu.version}-${menu.status.open ? 1 : 0}-${store.latestOrderId()}"`;
    res.set("Cache-Control", "no-cache");
    res.set("ETag", etag);
    if (req.get("if-none-match") === etag) return res.status(304).end();
    res.json(menu);
  });

  pub.post("/orders", wrap(async (req, res) => {
    const lim = limits.orders.take(ip(req));
    if (!lim.ok) return tooMany(res, lim.retryAfter);
    const menu = store.getMenu();
    const idx = indexMenu(menu);
    const input = V.orderInput(req.body, menu.store);
    const status = storeStatus(menu.store);
    if (!status.open) return res.status(409).json({ error: `Estamos fechados agora${status.detail ? " — " + status.detail : ""}. Seu carrinho fica salvo!` });
    const cart = priceCart(idx, input.items, { mode: input.mode, district: input.address?.district });
    if (!cart.ok) return res.status(400).json({ error: cart.errors[0], errors: cart.errors });
    if (input.payment.changeFor && toCents(input.payment.changeFor) < cart.totalCents) {
      return res.status(400).json({ error: `O troco precisa ser para um valor maior que o total (${formatBRL(fromCents(cart.totalCents))}).`, field: "changeFor" });
    }
    let code = newOrderCode();
    while (store.codeExists(code)) code = newOrderCode();
    const items = cart.items.map((p, i) => {
      const src = input.items[i];
      const flavorRefs = [...(src.flavorIds || []), ...Object.values(src.parts || {}).flatMap((x) => x.flavorIds || []), ...Object.keys(src.units || {}).filter((k) => src.units[k] > 0)];
      return { productId: p.productId, title: p.title, lines: p.lines, qty: p.qty, unitCents: p.unitCents, totalCents: p.totalCents, image: p.image || "", flavorRefs, selection: src };
    });
    const order = store.createOrder({
      code, customer: input.customer, mode: input.mode, address: input.address, payment: input.payment, notes: input.notes,
      items, subtotalCents: cart.subtotalCents, deliveryFeeCents: cart.deliveryFeeCents, totalCents: cart.totalCents,
      ip: ip(req), userAgent: req.get("user-agent"),
    });
    const text = buildWhatsAppText({ store: menu.store, code, customer: input.customer, mode: input.mode, address: input.address, payment: input.payment, notes: input.notes, cart });
    res.status(201).json({
      code: order.code, status: order.status, createdAt: order.createdAt,
      subtotalCents: order.subtotalCents, deliveryFeeCents: order.deliveryFeeCents, totalCents: order.totalCents,
      whatsappText: text,
      whatsappUrl: menu.store.whatsapp ? `https://wa.me/${menu.store.whatsapp}?text=${encodeURIComponent(text)}` : null,
    });
  }));

  const publicOrder = (o) => ({
    code: o.code, status: o.status, statusLabel: ORDER_STATUS[o.status]?.label || o.status, mode: o.mode,
    customerFirstName: o.customer.name.split(" ")[0],
    createdAt: o.createdAt, updatedAt: o.updatedAt,
    items: o.items.map((it) => ({ title: it.title, lines: it.lines, qty: it.qty, totalCents: it.totalCents, image: it.image, selection: it.selection })),
    subtotalCents: o.subtotalCents, deliveryFeeCents: o.deliveryFeeCents, totalCents: o.totalCents,
    events: store.orderEvents(o.id).map((e) => ({ status: e.status, label: ORDER_STATUS[e.status]?.label || e.status, at: e.created_at })),
  });

  pub.get("/orders/status", (req, res) => {
    const lim = limits.tracking.take(ip(req));
    if (!lim.ok) return tooMany(res, lim.retryAfter);
    const codes = String(req.query.codes || "").toUpperCase().split(",").map((c) => c.trim()).filter((c) => /^[A-Z0-9]{6}$/.test(c)).slice(0, 30);
    const out = codes.map((c) => store.getOrderByCode(c)).filter(Boolean)
      .map((o) => ({ code: o.code, status: o.status, statusLabel: ORDER_STATUS[o.status]?.label || o.status, updatedAt: o.updatedAt, totalCents: o.totalCents }));
    res.set("Cache-Control", "no-store").json(out);
  });

  pub.get("/orders/:code", (req, res) => {
    const lim = limits.tracking.take(ip(req));
    if (!lim.ok) return tooMany(res, lim.retryAfter);
    const code = String(req.params.code || "").toUpperCase();
    const o = /^[A-Z0-9]{6}$/.test(code) ? store.getOrderByCode(code) : null;
    if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
    res.set("Cache-Control", "no-store").json(publicOrder(o));
  });

  app.use("/api", pub);

  /* ================================================================
     API DO PAINEL DO DESENVOLVEDOR (/api/admin)
     ================================================================ */
  const adm = express.Router();
  adm.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

  // Proteção CSRF: toda alteração precisa do cabeçalho customizado (navegadores não o enviam de outros sites sem CORS, que não liberamos aqui).
  adm.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD") return next();
    if (req.get("x-requested-with") !== "figaros-admin") return res.status(403).json({ error: "Requisição bloqueada." });
    next();
  });

  // JSON de até 512 KB; o upload de imagem (data URL) tem limite maior, mas só é lido depois do login.
  const smallJson = express.json({ limit: "512kb" });
  adm.use((req, res, next) => (req.path === "/upload" ? next() : smallJson(req, res, next)));

  // Sessão
  adm.use((req, res, next) => {
    const token = parseCookies(req.get("cookie"))[SESSION_COOKIE];
    if (!token) return next();
    const sid = sha256(token);
    const s = store.getSession(sid);
    if (!s || !s.active || new Date(s.expires_at) < new Date()) {
      if (s) store.deleteSession(sid);
      return next();
    }
    req.sessionId = sid;
    req.user = { id: s.user_id, username: s.username, name: s.name };
    // Renova a sessão no máximo 1x por hora
    const newExp = new Date(Date.now() + SESSION_TTL_MS);
    if (newExp - new Date(s.expires_at) > 3600_000) {
      store.extendSession(sid, newExp.toISOString());
      res.append("Set-Cookie", sessionCookie(token, { secure: secureCookies, maxAgeMs: SESSION_TTL_MS }));
    }
    next();
  });

  const requireAuth = (req, res, next) => (req.user ? next() : res.status(401).json({ error: "Faça login para continuar." }));
  const audit = (req, data) => store.audit({ user: req.user, ip: ip(req), ...data });

  async function startSession(req, res, user) {
    const token = newToken();
    store.createSession({ id: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(), ip: ip(req), userAgent: req.get("user-agent") });
    store.touchLogin(user.id);
    res.append("Set-Cookie", sessionCookie(token, { secure: secureCookies, maxAgeMs: SESSION_TTL_MS }));
  }

  adm.get("/session", (req, res) => {
    res.json({ user: req.user || null, needsSetup: store.countUsers() === 0 });
  });

  adm.post("/setup", wrap(async (req, res) => {
    const lim = limits.login.take(ip(req));
    if (!lim.ok) return tooMany(res, lim.retryAfter);
    if (store.countUsers() > 0) return res.status(409).json({ error: "A conta de desenvolvedor já foi criada. Faça login." });
    const code = String(req.body?.setupCode || "").trim().toUpperCase();
    const expected = state.setupCode || "";
    const ok = expected && code.length === expected.length && timingSafeEqual(Buffer.from(code), Buffer.from(expected));
    if (!ok) return res.status(403).json({ error: "Código de configuração incorreto. Ele aparece no terminal onde o servidor foi iniciado.", field: "setupCode" });
    const username = V.str(req.body.username, { field: "Usuário", required: true, min: 3, max: 40 });
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) throw new V.ValidationError("Usuário: use só letras, números, ponto, hífen ou _.", "username");
    const problems = passwordProblems(req.body.password, username);
    if (problems.length) throw new V.ValidationError(`A senha precisa ${problems.join(", ")}.`, "password");
    const userId = store.createUser({ username, name: V.str(req.body.name, { field: "Nome", max: 60 }), passwordHash: await hashPassword(req.body.password) });
    state.setupCode = null;
    const user = store.findUser(userId);
    req.user = { id: user.id, username: user.username };
    audit(req, { action: "criou_conta", entity: "usuarios", entityId: user.id, after: { username } });
    await startSession(req, res, user);
    res.status(201).json({ user: { id: user.id, username: user.username, name: user.name } });
  }));

  adm.post("/login", wrap(async (req, res) => {
    const username = String(req.body?.username || "").trim().slice(0, 40);
    const password = String(req.body?.password || "");
    const a = limits.login.take(ip(req));
    const b = limits.loginUser.take(username.toLowerCase());
    if (!a.ok || !b.ok) return tooMany(res, Math.max(a.retryAfter, b.retryAfter));
    const user = username ? store.findUserByName(username) : null;
    const valid = await verifyPassword(password, user?.password_hash || DUMMY_HASH);
    if (!user || !valid || !user.active) {
      store.audit({ user: null, ip: ip(req), action: "login_falhou", entity: "seguranca", entityId: username || null });
      return res.status(401).json({ error: "Usuário ou senha incorretos." });
    }
    limits.loginUser.reset(username.toLowerCase());
    req.user = { id: user.id, username: user.username };
    audit(req, { action: "login", entity: "seguranca", entityId: user.id });
    await startSession(req, res, user);
    res.json({ user: { id: user.id, username: user.username, name: user.name } });
  }));

  adm.post("/logout", (req, res) => {
    if (req.sessionId) { store.deleteSession(req.sessionId); audit(req, { action: "logout", entity: "seguranca", entityId: req.user?.id }); }
    res.append("Set-Cookie", sessionCookie("", { secure: secureCookies, maxAgeMs: 0 }));
    res.json({ ok: true });
  });

  adm.use(requireAuth);

  /* ---------- Conta / usuários ---------- */
  adm.post("/password", wrap(async (req, res) => {
    const user = store.findUser(req.user.id);
    if (!(await verifyPassword(req.body?.current || "", user.password_hash))) return res.status(400).json({ error: "Senha atual incorreta.", field: "current" });
    const problems = passwordProblems(req.body?.next, user.username);
    if (problems.length) throw new V.ValidationError(`A nova senha precisa ${problems.join(", ")}.`, "next");
    store.setPassword(user.id, await hashPassword(req.body.next));
    store.deleteUserSessions(user.id, req.sessionId);
    audit(req, { action: "alterou_senha", entity: "seguranca", entityId: user.id });
    res.json({ ok: true });
  }));

  adm.get("/users", (req, res) => res.json(store.listUsers()));

  adm.post("/users", wrap(async (req, res) => {
    const username = V.str(req.body?.username, { field: "Usuário", required: true, min: 3, max: 40 });
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) throw new V.ValidationError("Usuário: use só letras, números, ponto, hífen ou _.", "username");
    if (store.findUserByName(username)) return res.status(409).json({ error: "Esse usuário já existe.", field: "username" });
    const problems = passwordProblems(req.body?.password, username);
    if (problems.length) throw new V.ValidationError(`A senha precisa ${problems.join(", ")}.`, "password");
    const id = store.createUser({ username, name: V.str(req.body.name, { field: "Nome", max: 60 }), passwordHash: await hashPassword(req.body.password) });
    audit(req, { action: "criou_conta", entity: "usuarios", entityId: id, after: { username } });
    res.status(201).json({ id });
  }));

  adm.patch("/users/:id", (req, res) => {
    const id = Number(req.params.id);
    const target = store.findUser(id);
    if (!target) return res.status(404).json({ error: "Usuário não encontrado." });
    if (id === req.user.id) return res.status(400).json({ error: "Você não pode desativar a própria conta." });
    const active = !!req.body?.active;
    store.setUserActive(id, active);
    if (!active) store.deleteUserSessions(id);
    audit(req, { action: active ? "ativou_conta" : "desativou_conta", entity: "usuarios", entityId: id });
    res.json({ ok: true });
  });

  /* ---------- Cardápio ---------- */
  adm.get("/menu", (req, res) => res.json({ ...store.getMenu(), status: storeStatus(store.getStore()) }));

  adm.put("/store", (req, res) => {
    const before = store.getStore();
    const after = V.store(req.body || {}, before);
    store.setStore(after);
    audit(req, { action: "editou", entity: "loja", entityId: "configuracoes", before, after });
    res.json(after);
  });

  const ENTITIES = { categories: "categorias", products: "produtos", flavors: "sabores", addonGroups: "adicionais", testimonials: "depoimentos" };
  const checkEntity = (req, res, next) => (ENTITIES[req.params.entity] ? next() : res.status(404).json({ error: "Recurso inexistente." }));

  function validateEntity(entity, body, existingId) {
    const m = store.getMenu();
    const ids = (list) => new Set(list.map((x) => x.id));
    switch (entity) {
      case "categories": return V.category(body, { existingId });
      case "products": return V.product(body, { existingId, categoryIds: ids(m.categories), productIds: ids(m.products), addonGroupIds: ids(m.addonGroups), flavorIds: ids(m.flavors) });
      case "flavors": return V.flavor(body, { existingId, product: m.products.find((p) => p.id === (body.productId || store.getEntity("flavors", existingId)?.productId)) });
      case "addonGroups": return V.addonGroup(body, { existingId });
      case "testimonials": return V.testimonial(body, { existingId });
    }
  }

  adm.post("/menu/:entity/reorder", checkEntity, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).slice(0, 1000) : [];
    store.reorder(req.params.entity, ids);
    audit(req, { action: "reordenou", entity: ENTITIES[req.params.entity], after: { ids } });
    res.json({ ok: true });
  });

  adm.post("/menu/:entity", checkEntity, (req, res) => {
    const { entity } = req.params;
    const obj = validateEntity(entity, req.body || {});
    if (store.getEntity(entity, obj.id)) return res.status(409).json({ error: "Já existe um item com esse nome. Use outro nome.", field: "name" });
    if (req.body?.sort === undefined) obj.sort = store.listEntity(entity).length;
    store.putEntity(entity, obj);
    audit(req, { action: "criou", entity: ENTITIES[entity], entityId: obj.id, after: obj });
    res.status(201).json(obj);
  });

  adm.put("/menu/:entity/:id", checkEntity, (req, res) => {
    const { entity, id } = req.params;
    const before = store.getEntity(entity, id);
    if (!before) return res.status(404).json({ error: "Item não encontrado." });
    const obj = validateEntity(entity, { ...req.body, sort: req.body?.sort ?? before.sort }, id);
    store.putEntity(entity, obj);
    audit(req, { action: "editou", entity: ENTITIES[entity], entityId: id, before, after: obj });
    res.json(obj);
  });

  adm.delete("/menu/:entity/:id", checkEntity, (req, res) => {
    const { entity, id } = req.params;
    const before = store.getEntity(entity, id);
    if (!before) return res.status(404).json({ error: "Item não encontrado." });
    const m = store.getMenu();
    const blockers = [];
    if (entity === "categories") blockers.push(...m.products.filter((p) => p.categoryId === id).map((p) => `produto "${p.name}"`));
    if (entity === "products") {
      blockers.push(...m.flavors.filter((f) => f.productId === id).slice(0, 3).map((f) => `sabor "${f.name}"`));
      blockers.push(...m.products.filter((p) => (p.parts || []).some((x) => x.productId === id)).map((p) => `combo "${p.name}"`));
    }
    if (entity === "addonGroups") blockers.push(...m.products.filter((p) => p.addonGroupId === id || (p.parts || []).some((x) => x.addonGroupId === id)).map((p) => `produto "${p.name}"`));
    if (entity === "flavors") blockers.push(...m.products.filter((p) => (p.parts || []).some((x) => (x.allowedFlavorIds || []).includes(id))).map((p) => `combo "${p.name}"`));
    if (blockers.length) return res.status(409).json({ error: `Não dá para excluir: ainda é usado por ${blockers.join(", ")}. Você pode desativar em vez de excluir.` });
    store.deleteEntity(entity, id);
    audit(req, { action: "excluiu", entity: ENTITIES[entity], entityId: id, before });
    res.json({ ok: true });
  });

  /* ---------- Upload de imagens ---------- */
  adm.post("/upload", express.json({ limit: "8mb" }), (req, res) => {
    const m = /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.dataUrl || ""));
    if (!m) return res.status(400).json({ error: "Envie uma imagem JPG, PNG ou WEBP." });
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > 5 * 1024 * 1024) return res.status(413).json({ error: "Imagem muito grande (máx. 5 MB)." });
    const sig = buf.subarray(0, 12);
    const isJpeg = sig[0] === 0xff && sig[1] === 0xd8 && sig[2] === 0xff;
    const isPng = sig.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isWebp = sig.subarray(0, 4).toString("ascii") === "RIFF" && sig.subarray(8, 12).toString("ascii") === "WEBP";
    const ext = isWebp ? "webp" : isPng ? "png" : isJpeg ? "jpg" : null;
    if (!ext) return res.status(400).json({ error: "Arquivo não é uma imagem válida." });
    const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${ext}`;
    writeFileSync(join(uploadsDir, name), buf);
    audit(req, { action: "enviou_imagem", entity: "imagens", entityId: name });
    res.status(201).json({ path: `uploads/${name}` });
  });

  /* ---------- Pedidos ---------- */
  adm.get("/orders", (req, res) => {
    const limit = Math.min(100, Number(req.query.limit) || 30);
    const page = Math.max(1, Number(req.query.page) || 1);
    const status = ORDER_STATUS[req.query.status] ? req.query.status : "";
    const r = store.listOrders({ status, q: String(req.query.q || "").slice(0, 60), from: String(req.query.from || ""), to: String(req.query.to || ""), limit, offset: (page - 1) * limit });
    res.json({ ...r, page, limit });
  });

  adm.get("/orders/latest", (req, res) => res.json({ id: store.latestOrderId() }));

  adm.get("/orders/:id", (req, res) => {
    const o = store.getOrder(Number(req.params.id));
    if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
    res.json({ ...o, events: store.orderEvents(o.id) });
  });

  adm.patch("/orders/:id", (req, res) => {
    const o = store.getOrder(Number(req.params.id));
    if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
    const status = String(req.body?.status || "");
    if (!ORDER_STATUS[status]) return res.status(400).json({ error: "Status inválido." });
    const note = V.str(req.body?.note, { field: "Observação", max: 200 });
    const updated = store.setOrderStatus(o.id, status, { note, user: req.user });
    audit(req, { action: "status_pedido", entity: "pedidos", entityId: o.code, before: { status: o.status }, after: { status, note } });
    res.json({ ...updated, events: store.orderEvents(o.id) });
  });

  adm.get("/stats", (req, res) => {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 7));
    // "hoje" e os dias do gráfico seguem o horário de Brasília, não o do servidor
    const today = spMidnight(new Date());
    const since = new Date(today.getTime() - (days - 1) * 864e5);
    const m = store.getMenu();
    const names = new Map([...m.products, ...m.flavors].map((x) => [x.id, x.name]));
    const s = store.stats(since.toISOString());
    const t = store.stats(today.toISOString());
    res.json({
      days, period: { orders: s.orders, revenueCents: s.revenue, byDay: s.byDay, byStatus: s.byStatus },
      today: { orders: t.orders, revenueCents: t.revenue },
      top: s.top.map((x) => ({ ...x, name: names.get(x.id) || x.id })),
      pending: store.listOrders({ status: "novo", limit: 1 }).total,
    });
  });

  /* ---------- Histórico ---------- */
  adm.get("/audit", (req, res) => {
    const limit = Math.min(100, Number(req.query.limit) || 40);
    const page = Math.max(1, Number(req.query.page) || 1);
    res.json({ ...store.listAudit({ entity: String(req.query.entity || ""), q: String(req.query.q || "").slice(0, 60), limit, offset: (page - 1) * limit }), page, limit });
  });

  /* ---------- Exportar / importar / backup ---------- */
  adm.get("/export", (req, res) => {
    const { version, ...menu } = store.getMenu();
    audit(req, { action: "exportou", entity: "cardapio" });
    res.set("Content-Disposition", 'attachment; filename="menu.json"').type("application/json").send(JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), ...menu }, null, 2) + "\n");
  });

  adm.post("/import", (req, res) => {
    const input = req.body?.menu;
    if (!input || typeof input !== "object") return res.status(400).json({ error: "Arquivo de cardápio inválido." });
    const before = store.getMenu();
    // Valida tudo antes de gravar qualquer coisa
    const categories = (input.categories || []).map((c) => V.category(c, { existingId: V.id(c.id) }));
    const addonGroups = (input.addonGroups || []).map((g) => V.addonGroup(g, { existingId: V.id(g.id) }));
    const catIds = new Set(categories.map((c) => c.id));
    const groupIds = new Set(addonGroups.map((g) => g.id));
    const rawProducts = input.products || [];
    const prodIds = new Set(rawProducts.map((p) => V.id(p.id)));
    const flavorIds = new Set((input.flavors || []).map((f) => V.id(f.id)));
    const products = rawProducts.map((p) => V.product(p, { existingId: V.id(p.id), categoryIds: catIds, productIds: prodIds, addonGroupIds: groupIds, flavorIds }));
    const flavors = (input.flavors || []).map((f) => V.flavor(f, { existingId: V.id(f.id), product: products.find((p) => p.id === f.productId) }));
    const testimonials = (input.testimonials || []).map((t) => V.testimonial(t, { existingId: V.id(t.id) }));
    const storeData = V.store(input.store || {}, before.store);
    store.importMenu({ store: storeData, categories, products, flavors, addonGroups, testimonials });
    audit(req, { action: "importou", entity: "cardapio", before: { products: before.products.length, flavors: before.flavors.length }, after: { products: products.length, flavors: flavors.length } });
    res.json({ ok: true, products: products.length, flavors: flavors.length });
  });

  adm.get("/backup", (req, res) => {
    const file = join(dataDir, `backup-${Date.now()}.db`);
    store.db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    audit(req, { action: "baixou_backup", entity: "banco" });
    res.download(file, `figaros-backup-${new Date().toISOString().slice(0, 10)}.db`, () => { try { rmSync(file); } catch {} });
  });

  app.use("/api/admin", adm);
  app.use("/api", (req, res) => res.status(404).json({ error: "Rota não encontrada." }));

  /* ---------------- Erros ---------------- */
  app.use((req, res) => res.status(404).type("html").send(notFoundPage()));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof V.ValidationError) return res.status(400).json({ error: err.message, field: err.field });
    if (err.type === "entity.too.large") return res.status(413).json({ error: "Conteúdo grande demais." });
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "JSON inválido." });
    logger.error?.(err);
    res.status(500).json({ error: "Erro interno. Tente novamente." });
  });

  return { app, db: store, state };
}

function notFoundPage() {
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Página não encontrada · Figaro's Pizzaria</title><link rel="stylesheet" href="/css/site.css">
<body class="page-404"><main class="nf"><img class="mascot" src="/assets/img/chef.webp" alt="" width="160" height="160" style="width:160px;height:160px">
<h1>Ops! Essa fatia sumiu.</h1><p>A página que você procurou não existe.</p><a class="btn btn-primary" href="/">Voltar ao cardápio</a></main></body></html>`;
}
