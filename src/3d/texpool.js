/* ============================================================
   Fila de texturas: pede os pixels ao worker e, se ele não existir
   ou falhar, gera na thread principal em fatias de ~6 ms
   (a rolagem nunca trava esperando uma textura).
   ============================================================ */
import { makeGenerator } from "./texgen.js";

let worker = null; // null = ainda não criado; false = indisponível
let seq = 0;
const pending = new Map();

function getWorker() {
  if (worker !== null) return worker;
  try {
    worker = new Worker(new URL("./3d-worker.js", import.meta.url));
    worker.onmessage = (e) => {
      const { id, data, w, h, error } = e.data;
      const job = pending.get(id);
      if (!job) return;
      pending.delete(id);
      if (error) runLocal(job).then(job.resolve, job.reject);
      else job.resolve({ data, w, h });
    };
    worker.onerror = () => {
      // worker quebrou (ex.: bloqueado pela política do servidor): refaz tudo aqui mesmo
      worker.terminate?.();
      worker = false;
      const jobs = [...pending.values()];
      pending.clear();
      jobs.forEach((job) => runLocal(job).then(job.resolve, job.reject));
    };
  } catch {
    worker = false;
  }
  return worker;
}

const yieldToMain = () => new Promise((r) => (globalThis.scheduler?.yield ? globalThis.scheduler.yield().then(r) : setTimeout(r, 0)));

async function runLocal({ name, w, h, args }) {
  const out = new Uint8ClampedArray(w * h * 4);
  const g = makeGenerator(name, w, h, args);
  let start = performance.now();
  for (let y = 0; y < h; y++) {
    g.row(out, y);
    if (performance.now() - start > 6) { await yieldToMain(); start = performance.now(); }
  }
  g.post?.(out);
  return { data: out, w, h };
}

/** Gera os pixels RGBA de uma textura (Promise<{ data, w, h }>). */
export function pixels(name, w, h, args = {}) {
  const job = { name, w, h, args };
  const wk = getWorker();
  if (!wk) return runLocal(job);
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { ...job, resolve, reject });
    wk.postMessage({ id, name, w, h, args });
  });
}
