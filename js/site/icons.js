/* ============================================================
   Ícones da casa, desenhados em traço (substituem os emojis, que
   mudam de cara em cada aparelho — e alguns nem aparecem no Windows).
   Todos em 24×24, traço arredondado, cor = currentColor.
   ============================================================ */
import { raw } from "./util.js";

const P = {
  // comida
  slice: '<path d="M4 6.7C9 3.6 15 3.6 20 6.7"/><path d="M5.1 8.6c4.4-2.3 9.4-2.3 13.8 0"/><path d="M4.6 7.4 12 20.7l7.4-13.3"/><circle cx="10.2" cy="11.4" r="1.3"/><circle cx="13.8" cy="13.6" r="1.1"/><circle cx="11.6" cy="16.4" r=".7"/>',
  sliceSweet: '<path d="M4 6.7C9 3.6 15 3.6 20 6.7"/><path d="M5.1 8.6c4.4-2.3 9.4-2.3 13.8 0"/><path d="M4.6 7.4 12 20.7l7.4-13.3"/><path d="M7.4 11.2c1.2.9 1.9-.8 3.1 0s1.8-.8 3 0 1.9-.8 3.1 0"/><path d="M10 14.6c.8.6 1.3-.5 2 0s1.2-.5 2 0"/>',
  cheese: '<path d="M3 17.6V15L15 6.4l6 3.7v7.5Z"/><path d="M3 15l18-4.9"/><circle cx="8.2" cy="15.9" r="1.1"/><circle cx="14.4" cy="14.6" r="1.4"/><circle cx="18.3" cy="12.4" r=".8"/>',
  soda: '<path d="M6.4 9h11.2l-1.4 11.1a1.6 1.6 0 0 1-1.6 1.4H9.4a1.6 1.6 0 0 1-1.6-1.4Z"/><path d="M5.4 9h13.2"/><path d="m12.4 9 1.5-5.6 3.2-.9"/><path d="M7.2 13.2h9.6"/>',
  choc: '<rect x="5.5" y="3.5" width="13" height="17" rx="1.6"/><path d="M12 3.5v17M5.5 9.2h13M5.5 14.8h13"/>',
  lasagna: '<path d="M3.5 9c2-1.2 3.4 1.2 5.6 0s3.4 1.2 5.6 0 3.4 1.2 5.8 0v9a1.6 1.6 0 0 1-1.6 1.6H5.1A1.6 1.6 0 0 1 3.5 18Z"/><path d="M3.5 13c2-1.2 3.4 1.2 5.6 0s3.4 1.2 5.6 0 3.4 1.2 5.8 0"/><path d="M3.5 16.4c2-1.2 3.4 1.2 5.6 0s3.4 1.2 5.6 0 3.4 1.2 5.8 0"/><path d="M9.2 6c-.7-.9.7-1.7 0-2.6M13.4 6c-.7-.9.7-1.7 0-2.6"/>',
  calzone: '<path d="M3.4 16a8.6 8.6 0 0 1 17.2 0Z"/><path d="M3.4 16c.9-.9 1.9.9 2.8 0s1.9.9 2.8 0 1.9.9 2.9 0 1.9.9 2.8 0 1.9.9 2.8 0 1.9.9 2.9 0"/><path d="M10.4 5.6c-.6-.8.6-1.5 0-2.3M14 5.6c-.6-.8.6-1.5 0-2.3"/>',
  esfiha: '<path d="M12 4.2c1 0 1.7.5 2.2 1.4l5.6 10c.9 1.6-.2 3.4-2 3.4H6.2c-1.8 0-2.9-1.8-2-3.4l5.6-10c.5-.9 1.2-1.4 2.2-1.4Z"/><path d="M12 4.6v6.6M12 11.2l-6.9 7.4M12 11.2l6.9 7.4"/>',
  bottle: '<path d="M10 2.8h4v3.5l1.8 2.6a3 3 0 0 1 .5 1.7v8.9a1.6 1.6 0 0 1-1.6 1.6H9.3a1.6 1.6 0 0 1-1.6-1.6v-8.9a3 3 0 0 1 .5-1.7L10 6.3Z"/><path d="M7.7 12.6h8.6M7.7 16.6h8.6"/>',
  box: '<path d="M3.5 10h17v8.4a1.6 1.6 0 0 1-1.6 1.6H5.1a1.6 1.6 0 0 1-1.6-1.6Z"/><path d="M3.5 10 6.2 5h11.6l2.7 5"/><circle cx="12" cy="15" r="2.4"/>',
  plate: '<circle cx="12" cy="12.5" r="5"/><circle cx="12" cy="12.5" r="2.6"/><path d="M3.2 4.5v4.4a1.5 1.5 0 0 0 3 0V4.5M4.7 4.5v15"/><path d="M20.6 19.5V4.5c-1.6 1-2.5 3.2-2.5 6v2.6h2.5"/>',
  chili: '<path d="M16.4 6.6c1.6.6 2.6 2.1 2.2 4.3-.9 4.8-7.3 9.2-14.2 9.2 4.8-2.2 7.6-6.4 8.5-10.3.5-2.3 2-3.5 3.5-3.2Z"/><path d="M16.4 6.6c.2-1.6 1.2-2.8 2.8-3"/>',
  leaf: '<path d="M5 19c0-8 5-13.4 14-14 .2 8.8-5.2 14-13 14Z"/><path d="M5 19c3-4 6-7 9.5-9"/>',
  flame: '<path d="M12 21.2c-3.8 0-6.5-2.6-6.5-6.2 0-3.4 2.6-5.3 3.6-8.3.9 1.9 2.3 2.8 2.3 2.8 0-2.9 1.3-5.3 3.3-6.8-.3 3.4 3.8 5.9 3.8 10.5 0 4.6-2.8 8-6.5 8Z"/><path d="M12 21.2c-1.6 0-2.8-1.2-2.8-2.9 0-1.8 1.6-2.7 2.3-4.3 1.2 1.2 3.3 2.4 3.3 4.4 0 1.6-1.2 2.8-2.8 2.8Z"/>',
  star: '<path d="m12 3.8 2.5 5.2 5.6.7-4.1 3.9 1 5.6L12 16.5l-5 2.7 1-5.6-4.1-3.9 5.6-.7Z"/>',
  // lugar e contato
  pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  phone: '<path d="M5 4.5h3.2l1.6 4-2 1.3a10.5 10.5 0 0 0 6.4 6.4l1.3-2 4 1.6V19a1.5 1.5 0 0 1-1.5 1.5A15.5 15.5 0 0 1 3.5 6 1.5 1.5 0 0 1 5 4.5Z"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.1 2.1"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h5.5a3 3 0 0 0 0-6h-3a3 3 0 0 1 0-6H16"/>',
  map: '<path d="M3.5 6.2 9 4l6 2.2 5.5-2.2v13.6L15 19.8l-6-2.2-5.5 2.2Z"/><path d="M9 4v13.6M15 6.2v13.6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  oven: '<path d="M4 18.5V10a8 8 0 0 1 16 0v8.5"/><path d="M2.5 18.5h19"/><path d="M8 18.5V15a4 4 0 0 1 8 0v3.5"/><path d="M10.6 18.5c0-1.2 1.4-1.6 1.4-3 .9.8 1.6 1.8 1.6 3"/>',
  // pedido
  scooter: '<circle cx="6" cy="17.5" r="2.4"/><circle cx="18.2" cy="17.5" r="2.4"/><path d="M8.4 17.5h6.2l2.2-6.2h-4.6"/><path d="M15.4 5.6h1.9l2 9.7"/><path d="M3.2 7.4h6.4v5.4H3.2Z"/><path d="M4 12.8 5.6 15"/>',
  bag: '<path d="M5.5 8h13l-1 12.5h-11Z"/><path d="M9 8V6.6a3 3 0 0 1 6 0V8"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.6 20a7.4 7.4 0 0 1 14.8 0"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="1.8"/><path d="M3 9.6h18M6.5 15h4"/>',
  note: '<path d="m4 20 1-4.2L15.6 5.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.2 19Z"/><path d="m14 6.8 3.2 3.2"/>',
  receipt: '<path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3Z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
  moon: '<path d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.5 6.5 0 0 0 10.1 10.1Z"/>',
  check: '<path d="m5 12.6 4.5 4.4L19 7.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="8.6"/><path d="m8 12.3 2.8 2.8L16.2 9.6"/>',
  xCircle: '<circle cx="12" cy="12" r="8.6"/><path d="m9 9 6 6M15 9l-6 6"/>',
  house: '<path d="M4 11 12 4.5 20 11"/><path d="M6 9.6v10h12v-10"/><path d="M10 19.6v-5h4v5"/>',
  pix: '<path d="m12 3 9 9-9 9-9-9Z"/><path d="m8.6 12 3.4-3.4 3.4 3.4-3.4 3.4Z"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="1.6"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.6v4.8M18 9.6v4.8"/>',
  swap: '<path d="M7 7.5h12l-3-3"/><path d="M17 16.5H5l3 3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  arrowRight: '<path d="M5 12h13M13 6.5 18.5 12 13 17.5"/>',
  arrowDown: '<path d="M12 5v13M6.5 13 12 18.5 17.5 13"/>',
  chevronDown: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
  sparkle: '<path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6.2 6.2l2.6 2.6M15.2 15.2l2.6 2.6M6.2 17.8l2.6-2.6M15.2 8.8l2.6-2.6"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.4M12 7.8v.1"/>',
};

/** SVG de um ícone (texto já seguro para os templates html``). */
export function icon(name, { size, cls = "", label = "" } = {}) {
  const body = P[name] || P.slice;
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  const dim = size ? ` width="${size}" height="${size}"` : "";
  return raw(`<svg class="ico${cls ? " " + cls : ""}" viewBox="0 0 24 24"${dim} ${a11y} fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`);
}

/** Ícone de cada categoria do cardápio (categorias novas do painel ganham o prato). */
const CATEGORY = {
  "pizzas-salgadas": "slice",
  combos: "box",
  "pizzas-doces": "sliceSweet",
  calzones: "calzone",
  lasanhas: "lasagna",
  esfihas: "esfiha",
  bebidas: "bottle",
};
export const categoryIcon = (cat) => icon(CATEGORY[cat?.id] || "plate");

export const ICON_NAMES = Object.keys(P);
