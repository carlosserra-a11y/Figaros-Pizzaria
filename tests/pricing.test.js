import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { indexMenu, priceItem, priceCart, storeStatus, combineFlavorPrices, deliveryFeeCents, parseDecimal } from "../js/shared/pricing.js";

const menu = JSON.parse(readFileSync(new URL("../data/menu.json", import.meta.url), "utf8"));
const idx = indexMenu(menu);

test("pizza de 1 sabor tradicional custa o preço do tamanho", () => {
  const r = priceItem(idx, { productId: "pizza-salgada", sizeId: "gigante", flavorIds: ["salgada-calabresa"], qty: 1 });
  assert.equal(r.ok, true, r.errors.join());
  assert.equal(r.unitCents, 9490);
});

test("meio a meio usa a média dos sabores (regra da loja)", () => {
  const r = priceItem(idx, { productId: "pizza-salgada", sizeId: "media", flavorIds: ["salgada-calabresa", "salgada-camarao"], qty: 2 });
  assert.equal(r.ok, true, r.errors.join());
  assert.equal(r.unitCents, Math.round((8290 + 9890) / 2));
  assert.equal(r.totalCents, r.unitCents * 2);
});

test("regra 'maior preço' cobra o sabor mais caro", () => {
  assert.equal(combineFlavorPrices([8290, 9890], "highest"), 9890);
});

test("respeita o máximo de sabores por tamanho", () => {
  const r = priceItem(idx, { productId: "pizza-salgada", sizeId: "broto", flavorIds: ["salgada-calabresa", "salgada-bacon"], qty: 1 });
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /Máximo de 1/);
});

test("borda paga soma ao preço", () => {
  const r = priceItem(idx, { productId: "pizza-salgada", sizeId: "grande", flavorIds: ["salgada-bacon"], addons: { bordas: "catupiry" }, qty: 1 });
  assert.equal(r.unitCents, 8790 + 1600);
  assert.ok(r.lines.some((l) => l.includes("Catupiry")));
});

test("sabor inativo ou de outro produto é recusado", () => {
  assert.equal(priceItem(idx, { productId: "pizza-salgada", sizeId: "media", flavorIds: ["salgada-caipira"] }).ok, false);
  assert.equal(priceItem(idx, { productId: "pizza-salgada", sizeId: "media", flavorIds: ["doce-prestigio"] }).ok, false);
});

test("combo cobra acréscimo proporcional de sabor especial", () => {
  const base = { productId: "combo-medio", parts: { doce: { flavorIds: ["doce-chocolate-ao-leite"] } }, drinks: ["pureza-15"], qty: 1 };
  const trad = priceItem(idx, { ...base, parts: { ...base.parts, pizza: { flavorIds: ["salgada-calabresa"] } } });
  assert.equal(trad.ok, true, trad.errors.join());
  assert.equal(trad.unitCents, 10590);
  const half = priceItem(idx, { ...base, parts: { ...base.parts, pizza: { flavorIds: ["salgada-calabresa", "salgada-camarao"] } } });
  assert.equal(half.unitCents, 10590 + 800);
  const coca = priceItem(idx, { ...base, drinks: ["coca-600"], parts: { ...base.parts, pizza: { flavorIds: ["salgada-calabresa"] } } });
  assert.equal(coca.unitCents, 10590 + 500);
});

test("combo só aceita sabores doces permitidos", () => {
  const r = priceItem(idx, { productId: "combo-grande", parts: { pizza: { flavorIds: ["salgada-calabresa"] }, doce: { flavorIds: ["doce-prestigio"] } }, drinks: ["pureza-15"] });
  assert.equal(r.ok, false);
});

test("esfihas exigem a quantidade exata de unidades", () => {
  const ok = priceItem(idx, { productId: "esfihas", sizeId: "c10", units: { "esfiha-carne": 6, "esfiha-calabresa": 4 } });
  assert.equal(ok.ok, true, ok.errors.join());
  assert.equal(ok.unitCents, 6199);
  const bad = priceItem(idx, { productId: "esfihas", sizeId: "c10", units: { "esfiha-carne": 3 } });
  assert.equal(bad.ok, false);
});

test("quantidade é limitada e nunca negativa", () => {
  assert.equal(priceItem(idx, { productId: "bebida-coca-cola-350-ml", qty: -5 }).qty, 1);
  assert.equal(priceItem(idx, { productId: "bebida-coca-cola-350-ml", qty: 9999 }).qty, 50);
});

test("carrinho aplica pedido mínimo e taxa de entrega", () => {
  const small = priceCart(idx, [{ productId: "bebida-agua-sem-gas-500-ml", qty: 1 }], { mode: "delivery" });
  assert.equal(small.ok, false);
  const big = priceCart(idx, [{ productId: "pizza-salgada", sizeId: "gigante", flavorIds: ["salgada-calabresa"], qty: 1 }], { mode: "delivery" });
  assert.equal(big.ok, true);
  assert.equal(big.deliveryFeeCents, 890);
  assert.equal(big.totalCents, 9490 + 890);
  assert.equal(priceCart(idx, [{ productId: "pizza-salgada", sizeId: "gigante", flavorIds: ["salgada-calabresa"] }], { mode: "pickup" }).deliveryFeeCents, 0);
});

test("taxa por bairro tem prioridade sobre a taxa padrão", () => {
  const store = { deliveryFee: 8.9, deliveryAreas: [{ name: "Pagani", fee: 5 }] };
  assert.equal(deliveryFeeCents(store, "delivery", "pagani"), 500);
  assert.equal(deliveryFeeCents(store, "delivery", "Centro"), 890);
});

test("horário de funcionamento (inclui virada da meia-noite)", () => {
  const hours = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: "18:30", close: "00:30", closed: false }));
  // 06/10/2026 é terça. 22:00 em São Paulo = 01:00 UTC do dia seguinte.
  assert.equal(storeStatus({ hours }, new Date("2026-10-07T01:00:00Z")).open, true);
  assert.equal(storeStatus({ hours }, new Date("2026-10-07T03:15:00Z")).open, true); // 00:15
  assert.equal(storeStatus({ hours }, new Date("2026-10-07T04:00:00Z")).open, false); // 01:00
  assert.equal(storeStatus({ hours }, new Date("2026-10-06T15:00:00Z")).open, false); // 12:00
  assert.equal(storeStatus({ hours, forceStatus: "open" }, new Date("2026-10-06T15:00:00Z")).open, true);
});

test("valores digitados no formato brasileiro ou com ponto são lidos certo", () => {
  assert.equal(parseDecimal("8,90"), 8.9);
  assert.equal(parseDecimal("8.9"), 8.9);
  assert.equal(parseDecimal("4.5"), 4.5);
  assert.equal(parseDecimal("1.234,56"), 1234.56);
  assert.equal(parseDecimal("R$ 100"), 100);
  assert.ok(Number.isNaN(parseDecimal("abc")));
});
