/* ============================================================
   FIGARO'S PIZZARIA — vanilla JS
   Troque as imagens: coloque arquivos reais em /images/ com o
   mesmo nome do campo "img" de cada produto (ex: images/margherita.jpg).
   Se o arquivo não existir, o emoji da pizza aparece no lugar.
   ============================================================ */

   const WHATSAPP_NUMBER = "5548933410102"; // (48) 93341-0102

   const fmt = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
   
   /* ---------------- DATA ---------------- */
   const stdSizes = (b, m, g, f) => [
     { label: "Broto", slices: "4 fatias", price: b },
     { label: "Média", slices: "6 fatias", price: m },
     { label: "Grande", slices: "8 fatias", price: g },
     { label: "Família", slices: "12 fatias", price: f },
   ];
   const docesSizes = (m, g, f) => [
     { label: "Média", slices: "6 fatias", price: m },
     { label: "Grande", slices: "8 fatias", price: g },
     { label: "Família", slices: "12 fatias", price: f },
   ];
   const single = (label, price) => [{ label, price }];
   
   const CATEGORIES = [
     { id: "salgadas", label: "Pizzas Salgadas" },
     { id: "doces", label: "Pizzas Doces" },
     { id: "calzones", label: "Calzones" },
     { id: "sobremesas", label: "Sobremesas" },
     { id: "bebidas", label: "Bebidas" },
     { id: "combos", label: "Combos" },
     { id: "buffet", label: "Buffet" },
   ];
   
   const PRODUCTS = [
     { id: "p1", name: "Margherita", category: "salgadas", type: "salgada", desc: "Molho de tomate italiano, muçarela de búfala, manjericão fresco e fio de azeite.", ingredients: "Molho de tomate, muçarela, manjericão, azeite extra virgem", popular: true, emoji: "🍕", img: "https://images.pexels.com/photos/14590497/pexels-photo-14590497.jpeg?auto=compress&cs=tinysrgb&w=800", sizes: stdSizes(34.9, 49.9, 64.9, 84.9) },
     { id: "p2", name: "Calabresa Especial", category: "salgadas", type: "salgada", desc: "Calabresa fatiada na brasa, cebola roxa caramelizada e azeitonas pretas.", ingredients: "Calabresa, cebola roxa, azeitona preta, orégano", popular: true, emoji: "🍕", img: "https://images.pexels.com/photos/10893995/pexels-photo-10893995.jpeg?auto=compress&cs=tinysrgb&w=800", sizes: stdSizes(34.9, 49.9, 64.9, 84.9) },
     { id: "p3", name: "Portuguesa", category: "salgadas", type: "salgada", desc: "Presunto, ovos, ervilha, cebola, pimentão e azeitonas sobre muçarela generosa.", ingredients: "Presunto, ovos, ervilha, pimentão, cebola, azeitona", popular: false, emoji: "🍕", img: "https://images.pexels.com/photos/19786200/pexels-photo-19786200.jpeg?auto=compress&cs=tinysrgb&w=800", sizes: stdSizes(34.9, 49.9, 64.9, 84.9) },
     { id: "p4", name: "Frango com Catupiry", category: "salgadas", type: "salgada", desc: "Frango desfiado temperado na casa, coberto com catupiry cremoso.", ingredients: "Frango desfiado, catupiry, muçarela, milho", popular: true, emoji: "🍕", img: "images/frango-catupiry.jpg", sizes: stdSizes(38.9, 54.9, 69.9, 89.9) },
     { id: "p5", name: "Quatro Queijos", category: "salgadas", type: "salgada", desc: "Muçarela, provolone, parmesão e gorgonzola em camadas derretidas.", ingredients: "Muçarela, provolone, parmesão, gorgonzola", popular: true, emoji: "🍕", img: "https://images.pexels.com/photos/29173092/pexels-photo-29173092.jpeg?auto=compress&cs=tinysrgb&w=800", sizes: stdSizes(38.9, 54.9, 69.9, 89.9) },
     { id: "p6", name: "Pepperoni", category: "salgadas", type: "salgada", desc: "Fatias generosas de pepperoni picante sobre muçarela e molho encorpado.", ingredients: "Pepperoni, muçarela, molho de tomate temperado", popular: false, emoji: "🍕", img: "https://images.pexels.com/photos/5903311/pexels-photo-5903311.jpeg?auto=compress&cs=tinysrgb&w=800", sizes: stdSizes(38.9, 54.9, 69.9, 89.9) },
     { id: "p7", name: "Bacon com Cheddar", category: "salgadas", type: "salgada", desc: "Bacon crocante, cobertura farta de cheddar e toque de cebola caramelizada.", ingredients: "Bacon, cheddar, cebola caramelizada, muçarela", popular: false, emoji: "🍕", img: "https://images.pexels.com/photos/2762942/pexels-photo-2762942.jpeg?auto=compress&cs=tinysrgb&w=800", sizes: stdSizes(38.9, 54.9, 69.9, 89.9) },
     { id: "p8", name: "Napolitana", category: "salgadas", type: "salgada", desc: "Tomate fatiado, muçarela de búfala, parmesão e manjericão ao estilo napolitano.", ingredients: "Tomate fatiado, muçarela de búfala, parmesão, manjericão", popular: false, emoji: "🍕", img: "https://images.pexels.com/photos/27600445/pexels-photo-27600445.jpeg?auto=compress&cs=tinysrgb&w=800", sizes: stdSizes(34.9, 49.9, 64.9, 84.9) },
     { id: "d1", name: "Chocolate com Morango", category: "doces", type: "doce", desc: "Chocolate ao leite derretido coberto com morangos frescos fatiados.", ingredients: "Chocolate ao leite, morango fresco", popular: true, emoji: "🍫", img: "https://images.pexels.com/photos/37226601/pexels-photo-37226601.jpeg?auto=compress&cs=tinysrgb&w=800", sizes: docesSizes(44.9, 56.9, 74.9) },
     { id: "d2", name: "Romeu e Julieta", category: "doces", type: "doce", desc: "Muçarela e goiabada cremosa derretida, o clássico doce brasileiro em pizza.", ingredients: "Muçarela, goiabada cremosa", popular: false, emoji: "🍫", img: "images/romeu-julieta.jpg", sizes: docesSizes(42.9, 54.9, 71.9) },
     { id: "d3", name: "Banana com Canela", category: "doces", type: "doce", desc: "Banana caramelizada, canela e um fio de leite condensado.", ingredients: "Banana, canela, leite condensado, açúcar cristal", popular: false, emoji: "🍫", img: "images/banana-canela.jpg", sizes: docesSizes(42.9, 54.9, 71.9) },
     { id: "d4", name: "Prestígio", category: "doces", type: "doce", desc: "Chocolate meio amargo com coco ralado tostado, inspirada no bombom clássico.", ingredients: "Chocolate meio amargo, coco ralado", popular: true, emoji: "🍫", img: "images/prestigio.jpg", sizes: docesSizes(44.9, 56.9, 74.9) },
     { id: "c1", name: "Calzone de Calabresa", category: "calzones", type: null, desc: "Massa dourada recheada com calabresa, muçarela e cebola, assada no forno a lenha.", ingredients: "Calabresa, muçarela, cebola, orégano", popular: true, emoji: "🥟", img: "https://images.pexels.com/photos/17549580/pexels-photo-17549580.jpeg?auto=compress&cs=tinysrgb&w=800", sizes: single("Único", 42.9) },
     { id: "c2", name: "Calzone de Frango com Catupiry", category: "calzones", type: null, desc: "Recheio farto de frango desfiado e catupiry envolto em massa crocante.", ingredients: "Frango desfiado, catupiry, muçarela", popular: false, emoji: "🥟", img: "https://images.pexels.com/photos/11654222/pexels-photo-11654222.jpeg?auto=compress&cs=tinysrgb&w=800", sizes: single("Único", 44.9) },
     { id: "c3", name: "Calzone Quatro Queijos", category: "calzones", type: null, desc: "Muçarela, provolone, parmesão e gorgonzola derretidos dentro da massa artesanal.", ingredients: "Muçarela, provolone, parmesão, gorgonzola", popular: false, emoji: "🥟", img: "https://images.pexels.com/photos/36642833/pexels-photo-36642833.jpeg?auto=compress&cs=tinysrgb&w=800", sizes: single("Único", 44.9) },
     { id: "s1", name: "Petit Gateau", category: "sobremesas", type: null, desc: "Bolinho de chocolate quente com recheio cremoso e bola de sorvete de creme.", ingredients: "Chocolate, manteiga, sorvete de creme", popular: true, emoji: "🍨", img: "https://images.pexels.com/photos/5638516/pexels-photo-5638516.jpeg?auto=compress&cs=tinysrgb&w=800", sizes: single("Porção", 24.9) },
     { id: "s2", name: "Mousse de Maracujá", category: "sobremesas", type: null, desc: "Mousse aerado de maracujá com calda da fruta, leve e refrescante.", ingredients: "Maracujá, leite condensado, creme de leite", popular: false, emoji: "🍨", img: "images/mousse-maracuja.jpg", sizes: single("Porção", 18.9) },
     { id: "b1", name: "Refrigerante Lata 350ml", category: "bebidas", type: null, desc: "Opções: Cola, Guaraná ou Limão, geladinha.", ingredients: "—", popular: false, emoji: "🥤", img: "images/refri-lata.jpg", sizes: single("Lata", 7.9) },
     { id: "b2", name: "Refrigerante 2L", category: "bebidas", type: null, desc: "Ideal para dividir. Opções: Cola, Guaraná ou Limão.", ingredients: "—", popular: false, emoji: "🥤", img: "images/refri-2l.jpg", sizes: single("2 litros", 14.9) },
     { id: "b3", name: "Suco Natural 500ml", category: "bebidas", type: null, desc: "Feito na hora. Opções: Laranja, Maracujá ou Abacaxi com hortelã.", ingredients: "—", popular: false, emoji: "🧃", img: "images/suco-natural.jpg", sizes: single("500ml", 11.9) },
     { id: "b4", name: "Água com Gás 500ml", category: "bebidas", type: null, desc: "Bem gelada.", ingredients: "—", popular: false, emoji: "💧", img: "images/agua-gas.jpg", sizes: single("500ml", 6.5) },
     { id: "b5", name: "Cerveja Long Neck", category: "bebidas", type: null, desc: "Cervejas nacionais geladas.", ingredients: "—", popular: false, emoji: "🍺", img: "images/cerveja.jpg", sizes: single("310ml", 12.9) },
     { id: "cb1", name: "Combo Casal", category: "combos", type: null, desc: "1 pizza salgada Média + 1 refrigerante 2L. Perfeito para dois.", ingredients: "Pizza média (sabor à escolha) + refrigerante 2L", popular: true, emoji: "🍽️", img: "https://images.pexels.com/photos/19786214/pexels-photo-19786214.jpeg?auto=compress&cs=tinysrgb&w=800", sizes: single("Combo", 79.9) },
     { id: "cb2", name: "Combo Família", category: "combos", type: null, desc: "1 pizza salgada Família + 2 refrigerantes lata. Serve até 5 pessoas.", ingredients: "Pizza família (sabor à escolha) + 2 refrigerantes lata", popular: true, emoji: "🍽️", img: "https://images.pexels.com/photos/5903237/pexels-photo-5903237.jpeg?auto=compress&cs=tinysrgb&w=800", sizes: single("Combo", 119.9) },
     { id: "bf1", name: "Buffet Livre & Rodízio de Pizza", category: "buffet", type: null, desc: "Buffet de massas, saladas e pratos quentes à vontade, com rodízio de pizzas salgadas e doces direto na mesa.", ingredients: "Massas, saladas, pratos quentes, rodízio de pizzas", popular: false, emoji: "🍝", img: "https://images.pexels.com/photos/19786235/pexels-photo-19786235.jpeg?auto=compress&cs=tinysrgb&w=800", sizes: single("Por pessoa", 54.9) },
   ];
   const POPULAR = PRODUCTS.filter((p) => p.popular);
   const PIZZA_TYPES = { salgada: PRODUCTS.filter((p) => p.type === "salgada"), doce: PRODUCTS.filter((p) => p.type === "doce") };
   
   const TESTIMONIALS = [
     { name: "Camila R.", text: "Pizza chegou quentinha e o rodízio é generoso de verdade. Virou programa de sexta-feira aqui em casa." },
     { name: "Eduardo T.", text: "Massa fininha e crocante, recheio farto. O calzone de catupiry é surreal." },
     { name: "Marina S.", text: "Buffet completo, ambiente super agradável e atendimento sempre atencioso." },
     { name: "Lucas F.", text: "Peço delivery quase toda semana, a entrega é rápida e o sabor nunca muda." },
   ];
   
   /* ---------------- STATE ---------------- */
   const state = {
     cart: [],
     activeCategory: "salgadas",
     searchTerm: "",
     typeFilter: "todas",
     modalProduct: null,
     modalSizeIdx: 0,
     modalFlavor2: "",
     modalQty: 1,
     isMobile: window.innerWidth < 768,
     reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
   };
   
   /* ---------------- HELPERS ---------------- */
   function starsHtml(value, size) {
     size = size || 14;
     let out = "";
     for (let i = 0; i < 5; i++) {
       const filled = value - i >= 0.75;
       const half = !filled && value - i >= 0.25;
       out += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled || half ? "#D4AF37" : "none"}" stroke="#D4AF37" stroke-width="1.5" style="${half ? "opacity:.55" : ""}"><polygon points="12 2 15 9 22 9 16.5 13.5 18.5 21 12 17 5.5 21 7.5 13.5 2 9 9 9"/></svg>`;
     }
     return `<span style="display:inline-flex;gap:2px;align-items:center;">${out}</span>`;
   }
   
   function mediaHtml(product, height) {
     return `<div class="card-media arch" style="height:${height}px;background:linear-gradient(160deg,#6E0F1C,#120D0C);">
       <img src="${product.img}" alt="${product.name}" loading="lazy" onerror="this.remove()" style="width:100%;height:100%;object-fit:cover;position:relative;z-index:1;" />
       <span class="icon-fallback" style="position:absolute;font-size:${Math.round(height * 0.4)}px;">${product.emoji}</span>
       <div class="shine"></div>
     </div>`;
   }
   
   function findProduct(id) { return PRODUCTS.find((p) => p.id === id); }
   
   /* ---------------- RENDER: POPULAR ---------------- */
   function renderPopular() {
     const el = document.getElementById("popularScroll");
     el.innerHTML = POPULAR.map((p) => `
       <button class="product-card tilt-3d" data-open="${p.id}">
         ${mediaHtml(p, 148)}
         <div class="card-body">
           <h3>${p.name}</h3>
           <p>${p.desc}</p>
           <div class="card-price-row">
             <span class="price">a partir de ${fmt(p.sizes[0].price)}</span>
             <span class="plus-circle">+</span>
           </div>
         </div>
       </button>`).join("");
     attachTilt(el.querySelectorAll(".product-card"), 10);
   }
   
   /* ---------------- RENDER: MENU ---------------- */
   function renderCategoryPills() {
     const el = document.getElementById("categoryPills");
     el.innerHTML = CATEGORIES.map((c) => `<button class="pill ${state.activeCategory === c.id ? "active" : ""}" data-cat="${c.id}">${c.label}</button>`).join("");
   }
   
   function renderMenu() {
     const typeFilterEl = document.getElementById("typeFilter");
     typeFilterEl.style.display = state.activeCategory === "salgadas" || state.activeCategory === "doces" ? "flex" : "none";
   
     let items = PRODUCTS.filter((p) => p.category === state.activeCategory);
     if (typeFilterEl.style.display === "flex" && state.typeFilter !== "todas") {
       items = items.filter((p) => p.type === state.typeFilter);
     }
     if (state.searchTerm.trim()) {
       const t = state.searchTerm.toLowerCase();
       items = items.filter((p) => p.name.toLowerCase().includes(t) || p.desc.toLowerCase().includes(t));
     }
   
     const grid = document.getElementById("menuGrid");
     if (items.length === 0) {
       grid.innerHTML = `<p class="empty-note">Nenhum produto encontrado para essa busca.</p>`;
       return;
     }
     grid.innerHTML = items.map((p) => `
       <button class="menu-item tilt-3d" data-open="${p.id}">
         ${mediaHtml(p, 92).replace('class="card-media arch"', 'class="card-media arch media"')}
         <div class="info">
           <h3>${p.name}</h3>
           <p>${p.desc}</p>
           <div class="row">
             <span class="price">${p.sizes.length > 1 ? "a partir de " : ""}${fmt(p.sizes[0].price)}</span>
             <span>+</span>
           </div>
         </div>
       </button>`).join("");
     attachTilt(grid.querySelectorAll(".menu-item"), 6);
   }
   
   /* ---------------- PRODUCT MODAL ---------------- */
   function openProductModal(id) {
     const product = findProduct(id);
     if (!product) return;
     state.modalProduct = product;
     state.modalSizeIdx = 0;
     state.modalFlavor2 = "";
     state.modalQty = 1;
     renderProductModal();
     document.getElementById("productOverlay").classList.add("open");
   }
   function closeProductModal() {
     document.getElementById("productOverlay").classList.remove("open");
     state.modalProduct = null;
   }
   
   function renderProductModal() {
     const p = state.modalProduct;
     if (!p) return;
     const isPizza = p.type === "salgada" || p.type === "doce";
     const flavorOptions = isPizza ? PIZZA_TYPES[p.type].filter((f) => f.id !== p.id) : [];
     const size = p.sizes[state.modalSizeIdx];
     const total = size.price * state.modalQty;
   
     const sheet = document.getElementById("productSheet");
     sheet.innerHTML = `
       <div class="modal-media">
         ${mediaHtml(p, 190)}
         <button class="modal-close" data-close="product" aria-label="Fechar">✕</button>
       </div>
       <div class="modal-body">
         <h2>${p.name}</h2>
         <p class="desc">${p.desc}</p>
         ${p.ingredients !== "—" ? `<p class="ingredients">Ingredientes: ${p.ingredients}</p>` : ""}
   
         <div class="field-block">
           <span class="field-label">Tamanho</span>
           <div class="size-grid" id="sizeGrid">
             ${p.sizes.map((s, i) => `
               <button class="size-opt ${i === state.modalSizeIdx ? "active" : ""}" data-size="${i}">
                 <span class="name">${s.label}</span>
                 ${s.slices ? `<span class="slices">${s.slices}</span>` : ""}
                 <span class="price">${fmt(s.price)}</span>
               </button>`).join("")}
           </div>
         </div>
   
         ${flavorOptions.length > 0 ? `
         <div class="field-block">
           <span class="field-label">Meio a meio (opcional)</span>
           <select class="fig-select" id="flavorSelect">
             <option value="">Sabor único — ${p.name}</option>
             ${flavorOptions.map((f) => `<option value="${f.name}" ${state.modalFlavor2 === f.name ? "selected" : ""}>Metade ${f.name}</option>`).join("")}
           </select>
           <p class="flavor-note" id="flavorNote" style="display:${state.modalFlavor2 ? "block" : "none"};">Considerado o valor do tamanho selecionado.</p>
         </div>` : ""}
   
         <div class="field-block">
           <span class="field-label">Observações</span>
           <textarea class="fig-textarea" id="notesInput" rows="2" placeholder="Ex: sem cebola, borda recheada, ponto da massa…"></textarea>
         </div>
   
         <div class="modal-footer">
           <div class="stepper">
             <button id="qtyMinus" aria-label="Diminuir">−</button>
             <span class="val" id="qtyVal">${state.modalQty}</span>
             <button id="qtyPlus" aria-label="Aumentar">+</button>
           </div>
           <button class="add-btn" id="addToCartBtn">Adicionar · ${fmt(total)}</button>
         </div>
       </div>`;
   
     sheet.querySelectorAll("[data-size]").forEach((btn) => {
       btn.addEventListener("click", () => { state.modalSizeIdx = parseInt(btn.dataset.size, 10); renderProductModal(); });
     });
     const flavorSelect = document.getElementById("flavorSelect");
     if (flavorSelect) flavorSelect.addEventListener("change", (e) => { state.modalFlavor2 = e.target.value; renderProductModal(); });
     document.getElementById("qtyMinus").addEventListener("click", () => { state.modalQty = Math.max(1, state.modalQty - 1); renderProductModal(); });
     document.getElementById("qtyPlus").addEventListener("click", () => { state.modalQty += 1; renderProductModal(); });
     document.getElementById("addToCartBtn").addEventListener("click", () => {
       const notes = document.getElementById("notesInput").value;
       addToCart({ product: p, size, flavor2: state.modalFlavor2, qty: state.modalQty, notes });
       closeProductModal();
     });
   }
   
   /* ---------------- CART ---------------- */
   function addToCart({ product, size, flavor2, qty, notes }) {
     state.cart.push({ cartId: `${Date.now()}-${Math.random()}`, product, size, flavor2, qty, notes });
     renderCart();
     openCart();
   }
   function changeQty(cartId, delta) {
     const item = state.cart.find((it) => it.cartId === cartId);
     if (item) item.qty = Math.max(1, item.qty + delta);
     renderCart();
   }
   function removeItem(cartId) {
     state.cart = state.cart.filter((it) => it.cartId !== cartId);
     renderCart();
   }
   function cartCount() { return state.cart.reduce((s, it) => s + it.qty, 0); }
   function cartSubtotal() { return state.cart.reduce((s, it) => s + it.size.price * it.qty, 0); }
   
   function renderCart() {
     const badge = document.getElementById("cartBadge");
     const count = cartCount();
     badge.style.display = count > 0 ? "flex" : "none";
     badge.textContent = count;
   
     const floatBtn = document.getElementById("floatingCartBtn");
     floatBtn.classList.toggle("show", count > 0 && !document.getElementById("cartOverlay").classList.contains("open"));
     document.getElementById("floatingCartCount").textContent = `${count} ${count === 1 ? "item" : "itens"}`;
   
     const itemsEl = document.getElementById("cartItems");
     const summaryEl = document.getElementById("cartSummary");
     if (state.cart.length === 0) {
       itemsEl.innerHTML = `<div class="cart-empty"><span style="font-size:40px;">🍕</span><p>Seu carrinho está vazio.<br/>Bora escolher uma pizza?</p></div>`;
       summaryEl.style.display = "none";
       return;
     }
     itemsEl.innerHTML = state.cart.map((it) => `
       <div class="cart-row">
         ${mediaHtml(it.product, 60).replace('class="card-media arch"', 'class="card-media arch media"')}
         <div class="info">
           <div class="top">
             <div>
               <h4>${it.product.name}</h4>
               <p class="meta">${it.size.label}${it.flavor2 ? ` · meio a meio: ${it.flavor2}` : ""}</p>
               ${it.notes ? `<p class="notes">"${it.notes}"</p>` : ""}
             </div>
             <button data-remove="${it.cartId}" aria-label="Remover item">🗑</button>
           </div>
           <div class="bottom">
             <div class="mini-stepper">
               <button data-qty="-1" data-id="${it.cartId}">−</button>
               <span class="val">${it.qty}</span>
               <button data-qty="1" data-id="${it.cartId}">+</button>
             </div>
             <span class="price">${fmt(it.size.price * it.qty)}</span>
           </div>
         </div>
       </div>`).join("");
     summaryEl.style.display = "block";
     document.getElementById("cartSubtotal").textContent = fmt(cartSubtotal());
   
     itemsEl.querySelectorAll("[data-remove]").forEach((btn) => btn.addEventListener("click", () => removeItem(btn.dataset.remove)));
     itemsEl.querySelectorAll("[data-qty]").forEach((btn) => btn.addEventListener("click", () => changeQty(btn.dataset.id, parseInt(btn.dataset.qty, 10))));
   }
   
   function openCart() { document.getElementById("cartOverlay").classList.add("open"); renderCart(); }
   function closeCart() { document.getElementById("cartOverlay").classList.remove("open"); renderCart(); }
   
   /* ---------------- CHECKOUT ---------------- */
   const checkoutState = { name: "", phone: "", address: "", number: "", complement: "", delivery: "delivery", payment: "pix", errors: {}, sent: false };
   
   function openCheckout() {
     closeCart();
     checkoutState.sent = false;
     document.getElementById("checkoutOverlay").classList.add("open");
     renderCheckout();
   }
   function closeCheckout() { document.getElementById("checkoutOverlay").classList.remove("open"); }
   
   function buildWhatsAppMessage() {
     const lines = [];
     lines.push("*Novo pedido — Figaro's Pizzaria*");
     lines.push(`Cliente: ${checkoutState.name}`);
     lines.push(`Telefone: ${checkoutState.phone}`);
     lines.push("");
     lines.push("*Itens:*");
     state.cart.forEach((it) => {
       lines.push(`• ${it.qty}x ${it.product.name} (${it.size.label}${it.flavor2 ? ` / meio a meio: ${it.flavor2}` : ""}) — ${fmt(it.size.price * it.qty)}${it.notes ? `\n   Obs: ${it.notes}` : ""}`);
     });
     lines.push("");
     lines.push(`Entrega: ${checkoutState.delivery === "delivery" ? `Delivery — ${checkoutState.address}, ${checkoutState.number}${checkoutState.complement ? " (" + checkoutState.complement + ")" : ""}` : "Retirada no local"}`);
     lines.push(`Pagamento: ${checkoutState.payment === "pix" ? "PIX" : checkoutState.payment === "cartao" ? "Cartão" : "Dinheiro"}`);
     lines.push("");
     const subtotal = cartSubtotal();
     const fee = checkoutState.delivery === "delivery" ? 8.9 : 0;
     lines.push(`Subtotal: ${fmt(subtotal)}`);
     lines.push(`Taxa de entrega: ${fmt(fee)}`);
     lines.push(`*Total: ${fmt(subtotal + fee)}*`);
     return lines.join("\n");
   }
   
   function renderCheckout() {
     const sheet = document.getElementById("checkoutSheet");
     if (state.cart.length === 0) {
       sheet.innerHTML = `
         <div class="modal-body">
           <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
             <h2 style="font-family:var(--f-display);font-weight:600;font-size:21px;">Finalizar pedido</h2>
             <button data-close="checkout" aria-label="Fechar">✕</button>
           </div>
           <p style="color:var(--cream-faint);">Seu carrinho está vazio.</p>
         </div>`;
       return;
     }
     const subtotal = cartSubtotal();
     const fee = checkoutState.delivery === "delivery" ? 8.9 : 0;
     const total = subtotal + fee;
     const e = checkoutState.errors;
   
     sheet.innerHTML = `
       <div class="modal-body">
         <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
           <h2 style="font-family:var(--f-display);font-weight:600;font-size:21px;">Finalizar pedido</h2>
           <button data-close="checkout" aria-label="Fechar">✕</button>
         </div>
         <div class="checkout-form-grid">
           <div>
             <label class="field-label">Nome completo</label>
             <input class="fig-input ${e.name ? "field-invalid" : ""}" id="ckName" value="${checkoutState.name}" />
             ${e.name ? `<span class="error-msg">Campo obrigatório</span>` : ""}
           </div>
           <div>
             <label class="field-label">Telefone / WhatsApp</label>
             <input class="fig-input ${e.phone ? "field-invalid" : ""}" id="ckPhone" placeholder="(48) 9 9999-9999" value="${checkoutState.phone}" />
             ${e.phone ? `<span class="error-msg">Campo obrigatório</span>` : ""}
           </div>
           <div>
             <label class="field-label">Como deseja receber?</label>
             <div class="two-opt-grid">
               <button class="two-opt ${checkoutState.delivery === "delivery" ? "active" : ""}" data-delivery="delivery"><span>🚚</span><span>Delivery</span></button>
               <button class="two-opt ${checkoutState.delivery === "retirada" ? "active" : ""}" data-delivery="retirada"><span>🏬</span><span>Retirar no local</span></button>
             </div>
           </div>
           ${checkoutState.delivery === "delivery" ? `
           <div class="addr-grid">
             <div>
               <label class="field-label">Endereço</label>
               <input class="fig-input ${e.address ? "field-invalid" : ""}" id="ckAddress" value="${checkoutState.address}" />
               ${e.address ? `<span class="error-msg">Campo obrigatório</span>` : ""}
             </div>
             <div>
               <label class="field-label">Nº</label>
               <input class="fig-input" id="ckNumber" value="${checkoutState.number}" />
             </div>
             <div class="full">
               <label class="field-label">Complemento (opcional)</label>
               <input class="fig-input" id="ckComplement" value="${checkoutState.complement}" />
             </div>
           </div>` : ""}
           <div>
             <label class="field-label">Forma de pagamento</label>
             <div class="pay-grid">
               <button class="pay-opt ${checkoutState.payment === "pix" ? "active" : ""}" data-payment="pix"><span>💠</span><span>PIX</span></button>
               <button class="pay-opt ${checkoutState.payment === "cartao" ? "active" : ""}" data-payment="cartao"><span>💳</span><span>Cartão</span></button>
               <button class="pay-opt ${checkoutState.payment === "dinheiro" ? "active" : ""}" data-payment="dinheiro"><span>💵</span><span>Dinheiro</span></button>
             </div>
           </div>
         </div>
   
         <div class="checkout-totals">
           <div class="line"><span>Subtotal</span><span class="val">${fmt(subtotal)}</span></div>
           <div class="line"><span>Taxa de entrega</span><span class="val">${fmt(fee)}</span></div>
           <div class="total"><span>Total</span><span class="val">${fmt(total)}</span></div>
         </div>
   
         <button class="send-btn" id="sendWhatsAppBtn">💬 Enviar pedido pelo WhatsApp</button>
         ${checkoutState.sent ? `<p class="send-note">✓ Se o WhatsApp não abriu automaticamente, <a href="${"https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(buildWhatsAppMessage())}" target="_blank" rel="noopener noreferrer">toque aqui</a>.</p>` : ""}
       </div>`;
   
     document.getElementById("ckName").addEventListener("input", (ev) => (checkoutState.name = ev.target.value));
     document.getElementById("ckPhone").addEventListener("input", (ev) => (checkoutState.phone = ev.target.value));
     const addressEl = document.getElementById("ckAddress");
     if (addressEl) addressEl.addEventListener("input", (ev) => (checkoutState.address = ev.target.value));
     const numberEl = document.getElementById("ckNumber");
     if (numberEl) numberEl.addEventListener("input", (ev) => (checkoutState.number = ev.target.value));
     const complementEl = document.getElementById("ckComplement");
     if (complementEl) complementEl.addEventListener("input", (ev) => (checkoutState.complement = ev.target.value));
   
     sheet.querySelectorAll("[data-delivery]").forEach((btn) => btn.addEventListener("click", () => { checkoutState.delivery = btn.dataset.delivery; renderCheckout(); }));
     sheet.querySelectorAll("[data-payment]").forEach((btn) => btn.addEventListener("click", () => { checkoutState.payment = btn.dataset.payment; renderCheckout(); }));
   
     document.getElementById("sendWhatsAppBtn").addEventListener("click", () => {
       const errs = {};
       if (!checkoutState.name.trim()) errs.name = true;
       if (!checkoutState.phone.trim()) errs.phone = true;
       if (checkoutState.delivery === "delivery" && !checkoutState.address.trim()) errs.address = true;
       checkoutState.errors = errs;
       if (Object.keys(errs).length > 0) { renderCheckout(); return; }
       checkoutState.sent = true;
       const link = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsAppMessage())}`;
       window.open(link, "_blank", "noopener,noreferrer");
       renderCheckout();
     });
   }
   
   /* ---------------- STATIC SECTIONS ---------------- */
   function renderReviews() {
     document.getElementById("reviewsGrid").innerHTML = TESTIMONIALS.map((t) => `
       <div class="review-card">
         ${starsHtml(5, 12)}
         <p>"${t.text}"</p>
         <p class="who">${t.name}</p>
       </div>`).join("");
     document.getElementById("reviewStars").innerHTML = starsHtml(4.5, 16);
     document.getElementById("heroStars").innerHTML = starsHtml(4.5, 14);
   }
   
   /* ---------------- 3D TILT INTERACTIONS ---------------- */
   function attachTilt(elements, maxDeg) {
     if (state.isMobile || state.reduced) return;
     elements.forEach((card) => {
       const shine = card.querySelector(".shine");
       card.addEventListener("mousemove", (e) => {
         const rect = card.getBoundingClientRect();
         const x = e.clientX - rect.left;
         const y = e.clientY - rect.top;
         const px = x / rect.width;
         const py = y / rect.height;
         const rotY = (px - 0.5) * maxDeg * 2;
         const rotX = -(py - 0.5) * maxDeg * 2;
         card.style.transform = `perspective(700px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px) scale3d(1.02,1.02,1.02)`;
         if (shine) shine.style.background = `radial-gradient(circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.32), transparent 55%)`;
       });
       card.addEventListener("mouseleave", () => {
         card.style.transform = "";
         if (shine) shine.style.background = "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 60%)";
       });
     });
   }
   
   /* ---------------- HERO 3D IDLE ROTATION + TILT ---------------- */
   function initHero3D() {
     const arch = document.getElementById("heroArch");
     if (!arch) return;
     let mx = 0, my = 0; // -0.5..0.5 relative to arch
     let start = performance.now();
   
     if (!state.isMobile) {
       arch.addEventListener("mousemove", (e) => {
         const rect = arch.getBoundingClientRect();
         mx = (e.clientX - rect.left) / rect.width - 0.5;
         my = (e.clientY - rect.top) / rect.height - 0.5;
       });
       arch.addEventListener("mouseleave", () => { mx = 0; my = 0; });
     }
   
     function frame(t) {
       if (!state.reduced) {
         const drift = Math.sin((t - start) / 2200) * 5;
         const rotY = drift + mx * 22;
         const rotX = -my * 14;
         arch.style.transform = `perspective(1200px) rotateY(${rotY}deg) rotateX(${rotX}deg)`;
         requestAnimationFrame(frame);
       }
     }
     if (!state.reduced) requestAnimationFrame(frame);
   
     const aboutArch = document.querySelector(".about-arch");
     if (aboutArch && !state.isMobile) {
       aboutArch.addEventListener("mousemove", (e) => {
         const rect = aboutArch.getBoundingClientRect();
         const px = (e.clientX - rect.left) / rect.width - 0.5;
         const py = (e.clientY - rect.top) / rect.height - 0.5;
         aboutArch.style.transform = `perspective(1000px) rotateY(${px * 16}deg) rotateX(${-py * 16}deg)`;
       });
       aboutArch.addEventListener("mouseleave", () => { aboutArch.style.transform = ""; });
     }
   }
   
   /* ---------------- FLOATING BACKGROUND / PARALLAX ---------------- */
   function buildFloatingBackground() {
     const container = document.getElementById("floatingBg");
     const blobs = [
       { bg: "radial-gradient(circle at 35% 30%, #FF8A3D, #6E0F1C 70%)", top: "8%", left: "6%", size: 220, depth: 1.6 },
       { bg: "radial-gradient(circle at 40% 35%, #E8452B, #7A1210 75%)", top: "58%", left: "2%", size: 140, depth: 2.2 },
       { bg: "radial-gradient(circle at 35% 30%, #D4AF37, #9c7a1c 75%)", top: "14%", right: "5%", size: 170, depth: 1.2 },
       { bg: "radial-gradient(circle at 40% 35%, #F6F1E7, #C9BFA6 75%)", top: "68%", right: "10%", size: 110, depth: 2.6 },
       { bg: "radial-gradient(circle at 35% 30%, #8BAF4F, #405B22 75%)", top: "38%", right: "22%", size: 60, depth: 3 },
     ];
     const visible = state.isMobile ? blobs.slice(0, 3) : blobs;
     container.innerHTML = visible.map((b, i) => `
       <div class="blob" data-depth="${b.depth}" style="
         top:${b.top}; ${b.left ? `left:${b.left};` : ""} ${b.right ? `right:${b.right};` : ""}
         width:${b.size}px; height:${b.size}px; background:${b.bg};
         opacity:${state.isMobile ? 0.16 : 0.22}; filter:blur(${state.isMobile ? 2 : 1}px);
         animation:${state.reduced ? "none" : `figFloat ${9 + i}s ease-in-out infinite`}; animation-delay:${i * 0.6}s;">
       </div>`).join("");
   
     if (!state.reduced) {
       const dotCount = state.isMobile ? 8 : 22;
       let dotsHtml = "";
       for (let i = 0; i < dotCount; i++) {
         const top = Math.random() * 100, left = Math.random() * 100, size = 2 + Math.random() * 3, dur = 6 + Math.random() * 8, delay = Math.random() * 6;
         dotsHtml += `<div class="dot" style="top:${top}%;left:${left}%;width:${size}px;height:${size}px;animation:figDrift ${dur}s ease-in-out infinite;animation-delay:${delay}s;"></div>`;
       }
       container.innerHTML += dotsHtml;
     }
   }
   
   function initParallax() {
     if (state.isMobile || state.reduced) return;
     window.addEventListener("mousemove", (e) => {
       const x = e.clientX / window.innerWidth - 0.5;
       const y = e.clientY / window.innerHeight - 0.5;
       document.querySelectorAll(".blob").forEach((el) => {
         const depth = parseFloat(el.dataset.depth) || 1;
         el.style.transform = `translate3d(${x * depth * 26}px, ${y * depth * 26}px, 0)`;
       });
     });
   }
   
   /* ---------------- NAV / HEADER ---------------- */
   function scrollToSection(id) {
     const el = document.getElementById(id);
     if (el) el.scrollIntoView({ behavior: state.reduced ? "auto" : "smooth", block: "start" });
     document.getElementById("mobileMenu").classList.remove("open");
   }
   
   /* ---------------- EVENT WIRING ---------------- */
   function wireEvents() {
     document.querySelectorAll("[data-nav]").forEach((btn) => btn.addEventListener("click", () => scrollToSection(btn.dataset.nav)));
   
     document.getElementById("hamburgerBtn").addEventListener("click", () => document.getElementById("mobileMenu").classList.toggle("open"));
   
     window.addEventListener("scroll", () => {
       document.getElementById("siteHeader").classList.toggle("scrolled", window.scrollY > 12);
     });
   
     document.getElementById("cartBtn").addEventListener("click", openCart);
     document.getElementById("floatingCartBtn").addEventListener("click", openCart);
     document.getElementById("goCheckoutBtn").addEventListener("click", openCheckout);
   
     document.querySelectorAll("[data-close]").forEach((el) => {
       el.addEventListener("click", () => {
         const target = el.dataset.close;
         if (target === "product") closeProductModal();
         if (target === "cart") closeCart();
         if (target === "checkout") closeCheckout();
       });
     });
   
     document.addEventListener("click", (e) => {
       const openBtn = e.target.closest("[data-open]");
       if (openBtn) openProductModal(openBtn.dataset.open);
       const catBtn = e.target.closest("[data-cat]");
       if (catBtn) { state.activeCategory = catBtn.dataset.cat; state.typeFilter = "todas"; renderCategoryPills(); renderMenu(); }
       const filterBtn = e.target.closest("[data-filter]");
       if (filterBtn) {
         state.typeFilter = filterBtn.dataset.filter;
         document.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("active", b === filterBtn));
         renderMenu();
       }
     });
   
     document.getElementById("searchInput").addEventListener("input", (e) => { state.searchTerm = e.target.value; renderMenu(); });
   
     window.addEventListener("keydown", (e) => {
       if (e.key !== "Escape") return;
       if (document.getElementById("productOverlay").classList.contains("open")) closeProductModal();
       else if (document.getElementById("checkoutOverlay").classList.contains("open")) closeCheckout();
       else if (document.getElementById("cartOverlay").classList.contains("open")) closeCart();
     });
   
     window.addEventListener("resize", () => {
       const wasMobile = state.isMobile;
       state.isMobile = window.innerWidth < 768;
       if (wasMobile !== state.isMobile) buildFloatingBackground();
     });
   }
   
   
   /* ============================================================
      FUNDO 3D GLOBAL
      ============================================================ */
   function initGlobal3DBackground(){
     const container=document.getElementById('site3dBg');
     if(!container||state.reduced)return;
     container.innerHTML='';
     const colors=['#E8590C','#6E0F1C','#D4AF37','#FF8A3D','#450912','#E8CB77'];
     for(let i=0;i<6;i++){
       const orb=document.createElement('div');orb.className='orb';
       const size=90+Math.random()*180;orb.style.width=`${size}px`;orb.style.height=`${size}px`;
       orb.style.left=`${Math.random()*100}%`;orb.style.top=`${Math.random()*100}%`;
       orb.style.background=`radial-gradient(circle at 30% 30%,${colors[i]},transparent 72%)`;
       orb.style.animationDelay=`${Math.random()*-8}s`;container.appendChild(orb);
     }
     for(let i=0;i<4;i++){
       const ring=document.createElement('div');ring.className='ring';const size=120+i*70;
       ring.style.width=`${size}px`;ring.style.height=`${size}px`;ring.style.left=`${8+i*25}%`;ring.style.top=`${15+i*18}%`;ring.style.animationDelay=`${i*-2}s`;container.appendChild(ring);
     }
     const grid=document.createElement('div');grid.className='grid-floor';container.appendChild(grid);
     const orbs=[...container.querySelectorAll('.orb')],rings=[...container.querySelectorAll('.ring')];
     let ticking=false;
     function update(){const y=window.scrollY||0;orbs.forEach((o,i)=>{const x=Math.sin(y*.001+i)*30;o.style.transform=`translate3d(${x}px,${y*(.025+i*.01)}px,0) rotateX(${y*(.02+i*.006)}deg) rotateY(${y*(.03+i*.008)}deg)`});rings.forEach((r,i)=>{r.style.transform=`translate3d(0,${y*(.035+i*.015)}px,0) rotateX(65deg) rotateZ(${y*(.025+i*.01)}deg)`});ticking=false}
     window.addEventListener('scroll',()=>{if(!ticking){requestAnimationFrame(update);ticking=true}},{passive:true});update();
   }
   
   /* ============================================================
      REVEAL AO ROLAR
      ============================================================ */
   function initScrollReveal(){
     const selectors=['.popular-section .eyebrow','.popular-section .section-title','.popular-scroll','.menu-section .eyebrow','.menu-header-row','.pill-row','.menu-grid','.about-section .eyebrow','.about-section .section-title','.about-section .lead','.about-points','.about-visual','.reviews-section .eyebrow','.reviews-head','.reviews-grid','.location-section .eyebrow','.location-grid','footer'];
     selectors.forEach((selector,i)=>document.querySelectorAll(selector).forEach(el=>{el.classList.add('reveal');if(i%3===1)el.classList.add('reveal-left');if(i%3===2)el.classList.add('reveal-right')}));
     ['.about-points','.reviews-grid','.menu-grid'].forEach(s=>document.querySelectorAll(s).forEach(el=>el.classList.add('reveal-stagger')));
     if(state.reduced){document.querySelectorAll('.reveal').forEach(el=>el.classList.add('revealed'));return}
     const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('revealed');observer.unobserve(entry.target)}}),{threshold:.12,rootMargin:'0px 0px -50px 0px'});
     document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
   }
   
   /* ============================================================
      BARRA DE PROGRESSO
      ============================================================ */
   function initScrollProgress(){
     const progress=document.getElementById('scrollProgress');if(!progress)return;let ticking=false;
     function update(){const total=document.documentElement.scrollHeight-window.innerHeight;progress.style.width=`${total>0?(window.scrollY/total)*100:0}%`;const header=document.getElementById('siteHeader');if(header)header.classList.toggle('scrolled',window.scrollY>30);ticking=false}
     window.addEventListener('scroll',()=>{if(!ticking){requestAnimationFrame(update);ticking=true}},{passive:true});update();
   }
   
   /* ---------------- INIT ---------------- */
   function init() {
     document.getElementById("footerYear").textContent = `©️ ${new Date().getFullYear()} Figaro's Pizzaria. Todos os direitos reservados.`;
     renderCategoryPills();
     renderPopular();
     renderMenu();
     renderReviews();
     buildFloatingBackground();
     initGlobal3DBackground();
     initScrollReveal();
     initScrollProgress();
     initParallax();
     initHero3D();
     wireEvents();
   }
   
   document.addEventListener("DOMContentLoaded", init);