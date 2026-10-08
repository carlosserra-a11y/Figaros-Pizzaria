/* Worker das texturas procedurais (empacotado em js/site/3d-worker.js).
   Gera os pixels fora da thread principal: a página continua fluida. */
import { generate } from "./texgen.js";

self.onmessage = (e) => {
  const { id, name, w, h, args } = e.data;
  try {
    const data = generate(name, w, h, args);
    self.postMessage({ id, w, h, data }, [data.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
