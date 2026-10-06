/* ============================================================
   Banco de dados SQLite (módulo nativo node:sqlite — sem dependências).
   Guarda: cardápio, configurações da loja, contas de desenvolvedor,
   sessões, pedidos (+ linha do tempo) e o histórico de alterações.
   ============================================================ */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SEED_MENU_PATH = join(ROOT, "data", "menu.json");

const now = () => new Date().toISOString();
const parse = (s, fallback = null) => { try { return JSON.parse(s); } catch { return fallback; } };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,               -- sha256 do token (o token em si nunca é salvo)
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip TEXT, user_agent TEXT
);

CREATE TABLE IF NOT EXISTS store (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, updated_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, data TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, category_id TEXT, data TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS flavors (id TEXT PRIMARY KEY, product_id TEXT, data TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS addon_groups (id TEXT PRIMARY KEY, data TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS testimonials (id TEXT PRIMARY KEY, data TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'novo',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  mode TEXT NOT NULL,
  address TEXT,
  payment TEXT NOT NULL,
  notes TEXT,
  items TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  delivery_fee_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  ip TEXT, user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone);

CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  user_id INTEGER,
  username TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  before TEXT,
  after TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
`;

/** Tabelas do cardápio: nome da entidade -> { table, foreign key opcional } */
export const MENU_TABLES = {
  categories: { table: "categories" },
  products: { table: "products", fk: ["category_id", "categoryId"] },
  flavors: { table: "flavors", fk: ["product_id", "productId"] },
  addonGroups: { table: "addon_groups" },
  testimonials: { table: "testimonials" },
};

export function openDatabase(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(join(dataDir, "figaros.db"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  const api = createApi(db);
  if (!api.getMeta("seeded_at")) api.importMenu(JSON.parse(readFileSync(SEED_MENU_PATH, "utf8")), { seed: true });
  return api;
}

function createApi(db) {
  const tx = (fn) => {
    db.exec("BEGIN");
    try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; }
  };

  const getMeta = (key) => db.prepare("SELECT value FROM meta WHERE key = ?").get(key)?.value ?? null;
  const setMeta = (key, value) => db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(value));
  const bumpMenuVersion = () => setMeta("menu_version", Number(getMeta("menu_version") || 0) + 1);

  /* ---------- Cardápio ---------- */
  function listEntity(entity) {
    const { table } = MENU_TABLES[entity];
    return db.prepare(`SELECT data FROM ${table} ORDER BY sort, id`).all().map((r) => parse(r.data));
  }
  function getEntity(entity, id) {
    const { table } = MENU_TABLES[entity];
    const row = db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id);
    return row ? parse(row.data) : null;
  }
  function putEntity(entity, obj) {
    const { table, fk } = MENU_TABLES[entity];
    const cols = ["id", "data", "sort", "updated_at"];
    const vals = [obj.id, JSON.stringify(obj), Number(obj.sort) || 0, now()];
    if (fk) { cols.push(fk[0]); vals.push(obj[fk[1]] ?? null); }
    db.prepare(`INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})
      ON CONFLICT(id) DO UPDATE SET ${cols.slice(1).map((c) => `${c} = excluded.${c}`).join(", ")}`).run(...vals);
    bumpMenuVersion();
    return obj;
  }
  function deleteEntity(entity, id) {
    const { table } = MENU_TABLES[entity];
    const r = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    bumpMenuVersion();
    return r.changes > 0;
  }
  function reorder(entity, ids) {
    const { table } = MENU_TABLES[entity];
    tx(() => ids.forEach((id, i) => {
      const row = db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id);
      if (!row) return;
      const obj = { ...parse(row.data), sort: i };
      db.prepare(`UPDATE ${table} SET data = ?, sort = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(obj), i, now(), id);
    }));
    bumpMenuVersion();
  }

  const getStore = () => parse(db.prepare("SELECT data FROM store WHERE id = 1").get()?.data, {});
  function setStore(data) {
    db.prepare("INSERT INTO store (id, data, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at").run(JSON.stringify(data), now());
    bumpMenuVersion();
    return data;
  }

  function getMenu() {
    return {
      version: Number(getMeta("menu_version") || 0),
      store: getStore(),
      categories: listEntity("categories"),
      products: listEntity("products"),
      flavors: listEntity("flavors"),
      addonGroups: listEntity("addonGroups"),
      testimonials: listEntity("testimonials"),
    };
  }

  /** Substitui o cardápio inteiro (seed inicial ou importação pelo painel). */
  function importMenu(menu, { seed = false } = {}) {
    tx(() => {
      for (const { table } of Object.values(MENU_TABLES)) db.exec(`DELETE FROM ${table}`);
      setStore(menu.store || {});
      for (const entity of Object.keys(MENU_TABLES)) for (const obj of menu[entity] || []) putEntity(entity, obj);
      if (seed) setMeta("seeded_at", now());
    });
  }

  /* ---------- Usuários e sessões ---------- */
  const countUsers = () => db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  const findUserByName = (username) => db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  const findUser = (id) => db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  const listUsers = () => db.prepare("SELECT id, username, name, active, created_at, last_login_at FROM users ORDER BY id").all();
  const createUser = ({ username, name, passwordHash }) =>
    Number(db.prepare("INSERT INTO users (username, name, password_hash, created_at) VALUES (?, ?, ?, ?)").run(username, name || "", passwordHash, now()).lastInsertRowid);
  const setPassword = (id, hash) => db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);
  const setUserActive = (id, active) => db.prepare("UPDATE users SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
  const touchLogin = (id) => db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(now(), id);

  const createSession = ({ id, userId, expiresAt, ip, userAgent }) =>
    db.prepare("INSERT INTO sessions (id, user_id, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)").run(id, userId, now(), expiresAt, ip || "", (userAgent || "").slice(0, 200));
  const getSession = (id) => db.prepare(`SELECT s.id, s.expires_at, u.id AS user_id, u.username, u.name, u.active
      FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`).get(id);
  const extendSession = (id, expiresAt) => db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(expiresAt, id);
  const deleteSession = (id) => db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  const deleteUserSessions = (userId, exceptId = "") => db.prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?").run(userId, exceptId);
  const purgeSessions = () => db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now());

  /* ---------- Histórico (auditoria) ---------- */
  function audit({ user, action, entity, entityId = null, before = null, after = null, ip = "" }) {
    db.prepare("INSERT INTO audit_log (user_id, username, action, entity, entity_id, before, after, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(user?.id ?? null, user?.username ?? null, action, entity, entityId === null ? null : String(entityId),
        before === null ? null : JSON.stringify(before), after === null ? null : JSON.stringify(after), ip, now());
  }
  function listAudit({ entity = "", q = "", limit = 50, offset = 0 } = {}) {
    const where = []; const args = [];
    if (entity) { where.push("entity = ?"); args.push(entity); }
    if (q) { where.push("(entity_id LIKE ? OR username LIKE ? OR action LIKE ? OR after LIKE ?)"); args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
    const w = where.length ? "WHERE " + where.join(" AND ") : "";
    const total = db.prepare(`SELECT COUNT(*) AS n FROM audit_log ${w}`).get(...args).n;
    const rows = db.prepare(`SELECT * FROM audit_log ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset)
      .map((r) => ({ ...r, before: parse(r.before), after: parse(r.after) }));
    return { total, rows };
  }

  /* ---------- Pedidos ---------- */
  const orderFromRow = (r) => r && ({
    id: r.id, code: r.code, status: r.status,
    customer: { name: r.customer_name, phone: r.customer_phone },
    mode: r.mode, address: parse(r.address), payment: parse(r.payment, {}), notes: r.notes || "",
    items: parse(r.items, []), subtotalCents: r.subtotal_cents, deliveryFeeCents: r.delivery_fee_cents, totalCents: r.total_cents,
    createdAt: r.created_at, updatedAt: r.updated_at,
  });

  function createOrder(o) {
    return tx(() => {
      const t = now();
      const r = db.prepare(`INSERT INTO orders (code, status, customer_name, customer_phone, mode, address, payment, notes, items,
        subtotal_cents, delivery_fee_cents, total_cents, created_at, updated_at, ip, user_agent)
        VALUES (?, 'novo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        o.code, o.customer.name, o.customer.phone, o.mode, JSON.stringify(o.address || null), JSON.stringify(o.payment), o.notes || "",
        JSON.stringify(o.items), o.subtotalCents, o.deliveryFeeCents, o.totalCents, t, t, o.ip || "", (o.userAgent || "").slice(0, 200));
      const id = Number(r.lastInsertRowid);
      db.prepare("INSERT INTO order_events (order_id, status, note, created_at) VALUES (?, 'novo', 'Pedido feito pelo site', ?)").run(id, t);
      return getOrder(id);
    });
  }
  const getOrder = (id) => orderFromRow(db.prepare("SELECT * FROM orders WHERE id = ?").get(id));
  const getOrderByCode = (code) => orderFromRow(db.prepare("SELECT * FROM orders WHERE code = ?").get(code));
  const orderEvents = (orderId) => db.prepare("SELECT status, note, username, created_at FROM order_events WHERE order_id = ? ORDER BY id").all(orderId);
  function setOrderStatus(id, status, { note = "", user = null } = {}) {
    return tx(() => {
      const t = now();
      db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(status, t, id);
      db.prepare("INSERT INTO order_events (order_id, status, note, user_id, username, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, status, note, user?.id ?? null, user?.username ?? null, t);
      return getOrder(id);
    });
  }
  function listOrders({ status = "", q = "", from = "", to = "", limit = 30, offset = 0 } = {}) {
    const where = []; const args = [];
    if (status) { where.push("status = ?"); args.push(status); }
    if (q) { where.push("(code LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)"); args.push(`%${q}%`, `%${q}%`, `%${q.replace(/\D/g, "") || q}%`); }
    if (from) { where.push("created_at >= ?"); args.push(from); }
    if (to) { where.push("created_at < ?"); args.push(to); }
    const w = where.length ? "WHERE " + where.join(" AND ") : "";
    const total = db.prepare(`SELECT COUNT(*) AS n FROM orders ${w}`).get(...args).n;
    const rows = db.prepare(`SELECT * FROM orders ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset).map(orderFromRow);
    return { total, rows };
  }
  const codeExists = (code) => !!db.prepare("SELECT 1 FROM orders WHERE code = ?").get(code);
  const latestOrderId = () => db.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM orders").get().id;

  /** Estatísticas para o painel. `sinceIso` = início do período. */
  function stats(sinceIso) {
    const valid = "status <> 'cancelado'";
    const totals = db.prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(total_cents),0) AS revenue FROM orders WHERE created_at >= ? AND ${valid}`).get(sinceIso);
    const byDay = db.prepare(`SELECT date(created_at, '-3 hours') AS day, COUNT(*) AS orders, SUM(total_cents) AS revenue
      FROM orders WHERE created_at >= ? AND ${valid} GROUP BY day ORDER BY day`).all(sinceIso);
    const byStatus = db.prepare("SELECT status, COUNT(*) AS n FROM orders WHERE created_at >= ? GROUP BY status").all(sinceIso);
    const rows = db.prepare(`SELECT items FROM orders WHERE created_at >= ? AND ${valid}`).all(sinceIso);
    const counter = new Map();
    for (const r of rows) for (const it of parse(r.items, [])) {
      for (const f of it.flavorRefs || []) counter.set(f, (counter.get(f) || 0) + (it.qty || 1));
      if (!it.flavorRefs?.length && it.productId) counter.set(it.productId, (counter.get(it.productId) || 0) + (it.qty || 1));
    }
    const top = [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, n]) => ({ id, n }));
    return { ...totals, byDay, byStatus, top };
  }

  /** Itens mais pedidos (para a vitrine "Mais pedidos" do site). */
  function bestSellers(days = 30, limit = 8) {
    const since = new Date(Date.now() - days * 864e5).toISOString();
    return stats(since).top.slice(0, limit);
  }

  return {
    db, tx, getMeta, setMeta,
    listEntity, getEntity, putEntity, deleteEntity, reorder, getStore, setStore, getMenu, importMenu,
    countUsers, findUserByName, findUser, listUsers, createUser, setPassword, setUserActive, touchLogin,
    createSession, getSession, extendSession, deleteSession, deleteUserSessions, purgeSessions,
    audit, listAudit,
    createOrder, getOrder, getOrderByCode, orderEvents, setOrderStatus, listOrders, codeExists, latestOrderId, stats, bestSellers,
    close: () => db.close(),
  };
}
