/* Núcleo do painel: chamadas à API (com proteção CSRF), modal, avisos e upload de imagem. */
import { html, raw, $, setHTML, esc } from "../site/util.js";
import { openLayer, closeLayer } from "../site/dialog.js";

export { html, raw, $, setHTML, esc };
export const ROOT = new URL("../", location.href);

export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data; }
}

export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(new URL(`api/admin/${path}`, ROOT), {
    method,
    credentials: "same-origin",
    headers: { "X-Requested-With": "figaros-admin", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  if (res.headers.get("content-type")?.includes("application/json")) data = await res.json();
  if (res.status === 401 && !path.startsWith("session") && !path.startsWith("login")) {
    window.dispatchEvent(new CustomEvent("auth:expired"));
  }
  if (!res.ok) throw new ApiError(data?.error || `Erro ${res.status}`, res.status, data);
  return data;
}

export function toast(message, type = "", ms = 3000) {
  const box = $("#toasts");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.setAttribute("role", type === "err" ? "alert" : "status");
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 260); }, ms);
}

export const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const brlC = (c) => brl((c || 0) / 100);
/** Valor numérico para campos de formulário no formato brasileiro (vírgula). */
export const dec = (v, d = 2) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "" : Number(v).toFixed(d).replace(".", ","));
export const dt = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
export const imgSrc = (p) => (!p ? new URL("assets/img/placeholder.webp", ROOT).href : /^https?:/.test(p) ? p : new URL(p, ROOT).href);

/* ---------- Modal ---------- */
const layer = () => $("#modalLayer");
export function openModal({ title, subtitle = "", body, submitLabel = "Salvar", danger = false, onSubmit, wide = false }) {
  const m = $("#modal");
  m.style.width = wide ? "min(100%, 900px)" : "";
  setHTML(m, html`
    <button type="button" class="dialog-close" data-close aria-label="Fechar">×</button>
    <form class="dialog-scroll" id="modalForm" novalidate>
      <div class="dialog-head"><h2 id="modalTitle">${title}</h2>${subtitle ? html`<p>${subtitle}</p>` : ""}</div>
      <div class="admin-form">${body}</div>
      <div class="err-box" id="modalErr" role="alert" hidden style="margin:0 24px 12px"></div>
      <div class="form-foot">
        <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
        ${onSubmit ? html`<button type="submit" class="btn ${danger ? "btn-primary" : "btn-green"}" id="modalSubmit">${submitLabel}</button>` : ""}
      </div>
    </form>`);
  const form = $("#modalForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#modalSubmit");
    const err = $("#modalErr");
    err.hidden = true;
    form.querySelectorAll(".invalid").forEach((x) => x.classList.remove("invalid"));
    btn.disabled = true;
    try {
      await onSubmit(form);
      closeModal();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      const field = ex.data?.field && form.elements[ex.data.field];
      if (field?.classList) { field.classList.add("invalid"); field.focus(); }
      else err.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } finally { btn.disabled = false; }
  });
  openLayer(layer(), { initialFocus: "input, select, textarea" });
  return form;
}
export const closeModal = () => closeLayer(layer());

export function confirmDialog(message, { title = "Tem certeza?", confirmLabel = "Confirmar", danger = true } = {}) {
  return new Promise((resolve) => {
    let ok = false;
    openModal({ title, body: html`<p style="font-weight:700">${message}</p>`, submitLabel: confirmLabel, danger, onSubmit: async () => { ok = true; } });
    const l = layer();
    const obs = new MutationObserver(() => { if (l.hidden) { obs.disconnect(); resolve(ok); } });
    obs.observe(l, { attributes: true, attributeFilter: ["hidden"] });
  });
}

/* ---------- Campos ---------- */
export function input(name, label, value = "", { type = "text", cls = "", attrs = "", help = "" } = {}) {
  return html`<div class="field ${cls}"><label for="f_${name}">${label}</label>
    <input class="input" id="f_${name}" name="${name}" type="${type}" value="${value ?? ""}" ${raw(attrs)}>
    ${help ? html`<p class="help">${help}</p>` : ""}</div>`;
}
export function textarea(name, label, value = "", { cls = "", rows = 3, attrs = "", help = "" } = {}) {
  return html`<div class="field ${cls}"><label for="f_${name}">${label}</label>
    <textarea class="textarea" id="f_${name}" name="${name}" rows="${rows}" ${raw(attrs)}>${value ?? ""}</textarea>
    ${help ? html`<p class="help">${help}</p>` : ""}</div>`;
}
export function select(name, label, options, value = "", { cls = "", help = "" } = {}) {
  return html`<div class="field ${cls}"><label for="f_${name}">${label}</label>
    <select class="select" id="f_${name}" name="${name}">${options.map(([v, t]) => html`<option value="${v}" ${String(v) === String(value) ? "selected" : ""}>${t}</option>`)}</select>
    ${help ? html`<p class="help">${help}</p>` : ""}</div>`;
}
export const check = (name, label, checked) => html`<label class="inline-check"><input type="checkbox" name="${name}" ${checked ? "checked" : ""}> ${label}</label>`;

/** Campo de imagem: upload (redimensiona no navegador para WEBP) ou URL. */
export function imageField(name, value = "") {
  return html`<div class="field"><label>Foto</label>
    <div class="img-field" data-img-field>
      <img class="preview" src="${imgSrc(value)}" alt="Prévia da foto">
      <div class="ctrls">
        <span class="btn btn-sm btn-ghost file-btn">📷 Enviar foto<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Enviar foto"></span>
        <input class="input" name="${name}" value="${value}" placeholder="ou cole o link https:// de uma foto">
        <p class="help">A foto é reduzida automaticamente (máx. 1200 px) antes do envio.</p>
      </div>
    </div></div>`;
}

export function bindImageFields(root) {
  root.querySelectorAll("[data-img-field]").forEach((box) => {
    const file = box.querySelector("input[type=file]");
    const urlInput = box.querySelector("input[name]");
    const preview = box.querySelector(".preview");
    urlInput.addEventListener("change", () => { preview.src = imgSrc(urlInput.value.trim()); });
    file.addEventListener("change", async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        preview.style.opacity = ".4";
        const dataUrl = await resizeImage(f, 1200);
        const res = await api("upload", { method: "POST", body: { dataUrl } });
        urlInput.value = res.path;
        preview.src = imgSrc(res.path);
        toast("Foto enviada ✓", "ok");
      } catch (e) { toast(e.message || "Não foi possível enviar a foto.", "err"); }
      finally { preview.style.opacity = ""; file.value = ""; }
    });
  });
}

async function resizeImage(file, max) {
  if (file.size > 20 * 1024 * 1024) throw new Error("Arquivo muito grande (máx. 20 MB).");
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/webp", 0.82));
  const out = blob && blob.type === "image/webp" ? blob : await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  return new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = reject; fr.readAsDataURL(out); });
}

/** Lê um <form> como objeto simples (checkbox -> boolean). */
export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.closest("[data-skip]")) continue;
    if (el.type === "checkbox") out[el.name] = el.checked;
    else if (el.type !== "file") out[el.name] = el.value;
  }
  return out;
}
