/* Configurações da loja: contato, horários, entrega, regras de preço e avisos. */
import { api, html, $, setHTML, toast, input, textarea, select, check, formData, dec } from "./core.js";

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export async function renderStore(view) {
  const m = await api("menu");
  const s = m.store;
  const areaRow = (a = {}) => html`<div class="r form-grid" data-area>${input("a_name", "Bairro", a.name || "", { cls: "c4 keep" })}${input("a_fee", "Taxa (R$)", dec(a.fee), { cls: "c2 keep", attrs: 'inputmode="decimal"' })}<div class="c6" style="display:flex;justify-content:flex-end"><button type="button" class="btn btn-sm btn-ghost" data-rm-area>Remover</button></div></div>`;
  setHTML(view, html`
    <form id="storeForm" novalidate>
      <div class="two-col">
        <div>
          <div class="panel"><h2>🏪 Funcionamento agora</h2>
            ${select("forceStatus", "Status da loja", [["auto", "Automático (pelos horários abaixo)"], ["open", "Forçar ABERTO"], ["closed", "Forçar FECHADO"]], s.forceStatus || "auto", { help: "Use “Forçar fechado” em feriados ou imprevistos. O site para de aceitar pedidos." })}
            ${input("closedMessage", "Mensagem quando fechado (opcional)", s.closedMessage, { attrs: 'maxlength="160" placeholder="Ex.: Voltamos amanhã às 18h30!"' })}
            ${input("announcement", "Aviso no topo do site (opcional)", s.announcement, { attrs: 'maxlength="160" placeholder="Ex.: Terça tem promoção de Gigante!"' })}
          </div>
          <div class="panel"><h2>🕒 Horários da pizzaria (pedidos)</h2>
            <p class="sub">Se fechar depois da meia-noite, é só colocar o horário (ex.: 18:30 às 00:30).</p>
            <table class="table"><tbody>${[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const h = (s.hours || []).find((x) => x.day === d) || { open: "18:30", close: "23:00" };
              return html`<tr data-day="${d}"><td><b>${DAYS[d]}</b></td>
                <td><input class="input" type="time" name="open_${d}" value="${h.open}" aria-label="Abre ${DAYS[d]}" style="padding:8px"></td>
                <td><input class="input" type="time" name="close_${d}" value="${h.close}" aria-label="Fecha ${DAYS[d]}" style="padding:8px"></td>
                <td><label class="inline-check"><input type="checkbox" name="closed_${d}" ${h.closed ? "checked" : ""}> Fechado</label></td></tr>`;
            })}</tbody></table>
            ${input("lunchInfo", "Informação do almoço / buffet", s.lunchInfo)}
          </div>
          <div class="panel"><h2>🛵 Entrega e pedidos</h2>
            <div class="toolbar">${check("deliveryEnabled", "Aceitar entregas", s.deliveryEnabled !== false)}${check("pickupEnabled", "Aceitar retirada", s.pickupEnabled !== false)}</div>
            <div class="form-grid">
              ${input("deliveryFee", "Taxa de entrega padrão (R$)", dec(s.deliveryFee), { cls: "c3", attrs: 'inputmode="decimal"' })}
              ${input("minOrder", "Pedido mínimo (R$)", dec(s.minOrder), { cls: "c3", attrs: 'inputmode="decimal"' })}
              ${input("etaDelivery", "Tempo de entrega (texto)", s.etaDelivery, { cls: "c3", attrs: 'placeholder="Ex.: 40–60 min"' })}
              ${input("etaPickup", "Tempo de retirada (texto)", s.etaPickup, { cls: "c3", attrs: 'placeholder="Ex.: 20–30 min"' })}
              ${select("pricingRule", "Pizza com 2 ou 3 sabores cobra…", [["average", "A média dos sabores (como na CityFoods)"], ["highest", "O sabor mais caro"]], s.pricingRule || "average")}
            </div>
            <fieldset style="margin-top:12px"><legend>Taxa por bairro (opcional)</legend>
              <p class="help">Se cadastrar bairros, o cliente escolhe o bairro numa lista e a taxa é calculada sozinha. Bairros fora da lista pagam a taxa padrão.</p>
              <div class="rows" id="areaRows">${(s.deliveryAreas || []).map((a) => areaRow(a))}</div>
              <div><button type="button" class="btn btn-sm btn-ghost" id="addArea">+ Bairro</button></div>
            </fieldset>
          </div>
        </div>
        <div>
          <div class="panel"><h2>📞 Contato e endereço</h2>
            ${input("name", "Nome da loja", s.name, { attrs: "required" })}
            ${input("tagline", "Slogan", s.tagline)}
            <div class="form-grid">
              ${input("phone", "Telefone (como aparece no site)", s.phone, { cls: "c3" })}
              ${input("whatsapp", "WhatsApp que recebe os pedidos", s.whatsapp, { cls: "c3", attrs: 'inputmode="numeric" placeholder="5548999999999"', help: "Com 55 + DDD + número, só dígitos." })}
            </div>
            ${input("email", "E-mail", s.email, { type: "email" })}
            ${textarea("address", "Endereço", s.address, { rows: 2 })}
            ${input("mapsQuery", "Busca no Google Maps", s.mapsQuery, { help: "Texto usado no mapa e no botão “Como chegar”." })}
            ${input("instagram", "Instagram (link)", s.instagram, { attrs: 'placeholder="https://instagram.com/…"' })}
            ${input("facebook", "Facebook (link)", s.facebook, { attrs: 'placeholder="https://facebook.com/…"' })}
          </div>
          <div class="panel"><h2>⭐ Avaliação e pagamento</h2>
            <div class="form-grid">
              ${input("rating", "Nota média (ex.: 4,5)", dec(s.rating, 1), { cls: "c3", attrs: 'inputmode="decimal"', help: "Deixe vazio para esconder." })}
              ${input("ratingCount", "Nº de avaliações", s.ratingCount, { cls: "c3", attrs: 'placeholder="Ex.: 3.000"' })}
            </div>
            ${input("payments", "Formas de pagamento (separadas por vírgula)", (s.payments || []).join(", "))}
          </div>
        </div>
      </div>
      <div class="err-box" id="storeErr" hidden style="margin-top:14px"></div>
      <div style="position:sticky;bottom:12px;margin-top:16px;display:flex;justify-content:flex-end"><button class="btn btn-green btn-lg" type="submit">Salvar configurações</button></div>
    </form>`);

  const form = $("#storeForm");
  $("#addArea").onclick = () => { const t = document.createElement("template"); t.innerHTML = String(areaRow()); $("#areaRows").appendChild(t.content); };
  form.addEventListener("click", (e) => { const b = e.target.closest("[data-rm-area]"); if (b) b.closest("[data-area]").remove(); });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const d = formData(form);
    const err = $("#storeErr"); err.hidden = true;
    const body = {
      ...d,
      hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: d[`open_${day}`], close: d[`close_${day}`], closed: d[`closed_${day}`] })),
      deliveryAreas: [...form.querySelectorAll("[data-area]")].map((r) => ({ name: r.querySelector('[name="a_name"]').value, fee: r.querySelector('[name="a_fee"]').value })).filter((a) => a.name.trim()),
      payments: d.payments.split(",").map((x) => x.trim()).filter(Boolean),
    };
    try {
      await api("store", { method: "PUT", body });
      toast("Configurações salvas ✓", "ok");
      window.dispatchEvent(new Event("store:changed"));
      renderStore(view);
    } catch (ex) { err.textContent = ex.message; err.hidden = false; err.scrollIntoView({ behavior: "smooth", block: "center" }); }
  };
}
