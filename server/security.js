/* ============================================================
   Segurança: senhas (scrypt), sessões por cookie, limites de
   tentativas e cabeçalhos HTTP.
   ============================================================ */
import { scrypt, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export const SESSION_COOKIE = "fg_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias, renovada a cada uso

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(String(password).normalize("NFKC"), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password, stored) {
  const [alg, N, r, p, saltB64, hashB64] = String(stored || "").split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(String(password).normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Hash usado para comparar senhas de usuários inexistentes (evita revelar quais usuários existem pelo tempo de resposta). */
export const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

export function passwordProblems(password, username = "") {
  const p = String(password || "");
  const problems = [];
  if (p.length < 8) problems.push("ter pelo menos 8 caracteres");
  if (p.length > 200) problems.push("ter no máximo 200 caracteres");
  if (!/[A-Za-zÀ-ÿ]/.test(p) || !/\d/.test(p)) problems.push("misturar letras e números");
  if (username && p.toLowerCase().includes(String(username).toLowerCase())) problems.push("não conter o nome de usuário");
  if (/^(12345678|senha123|password1|figaros123)$/i.test(p)) problems.push("não ser uma senha comum");
  return problems;
}

export const newToken = () => randomBytes(32).toString("base64url");
export const sha256 = (s) => createHash("sha256").update(s).digest("hex");

/** Código de pedido curto e difícil de adivinhar (sem caracteres ambíguos). */
export function newOrderCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

/** Código de configuração inicial (mostrado no terminal do servidor). */
export function newSetupCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const s = [...randomBytes(8)].map((b) => alphabet[b % alphabet.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export function parseCookies(header = "") {
  const out = {};
  for (const part of String(header).split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(token, { secure, maxAgeMs }) {
  const parts = [`${SESSION_COOKIE}=${token}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** Limitador simples em memória (janela fixa). */
export function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const t = Date.now();
    for (const [k, v] of hits) if (v.reset < t) hits.delete(k);
  }, Math.max(windowMs, 60_000)).unref();
  return {
    take(key) {
      const t = Date.now();
      let e = hits.get(key);
      if (!e || e.reset < t) { e = { count: 0, reset: t + windowMs }; hits.set(key, e); }
      e.count++;
      return { ok: e.count <= max, retryAfter: Math.ceil((e.reset - t) / 1000) };
    },
    reset(key) { hits.delete(key); },
  };
}

export function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://viacep.com.br",
    "frame-src https://www.google.com https://maps.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; "));
  next();
}
