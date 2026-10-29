const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const STORAGE_KEY = "mercadinho-guest";
const DEMO_CREDENTIALS = { email: "demo@mercadinhodavila.com", password: "VilaDemo2026" };
// Estado compartilhado por catálogo, sacolinha, conta e janelas laterais.
const state = {
  products: [],
  categories: [],
  offers: [],
  coupons: [],
  cart: [],
  wishlist: [],
  alerts: [],
  orders: [],
  couponCode: "",
  user: null,
  category: "Todos",
  search: "",
  sort: "popular",
  currentOffer: 0,
  pendingCheckout: false,
  detailProductId: null,
  detailQuantity: 1
};
const $ = (selector) => document.querySelector(selector);
const overlay = $("#overlay");
let toastTimer;

// Escapa valores dinâmicos antes de interpolá-los em elementos HTML.
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3000);
}

async function api(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers }
    });
  } catch {
    throw new Error("Não foi possível conectar à loja. Verifique se o servidor está aberto. No terminal da pasta mercado, execute: npm.cmd start");
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("O servidor respondeu em um formato inesperado. Reinicie a loja com npm.cmd start na pasta mercado.");
  }
  if (!response.ok) throw new Error(data.error || `A solicitação falhou (${response.status}).`);
  return data;
}

// Recupera preferências locais sem impedir a abertura da loja se o armazenamento estiver inválido.
function readGuestState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      cart: Array.isArray(saved.cart) ? saved.cart : [],
      wishlist: Array.isArray(saved.wishlist) ? saved.wishlist : [],
      alerts: Array.isArray(saved.alerts) ? saved.alerts : [],
      couponCode: typeof saved.couponCode === "string" ? saved.couponCode : ""
    };
  } catch (error) {
    console.warn("Não foi possível ler os dados locais da sacolinha.", error);
    return { cart: [], wishlist: [], alerts: [], couponCode: "" };
  }
}

let syncTimer;
// Persiste preferências de visitantes no navegador e sincroniza contas com a API.
function persistAccount() {
  if (!state.user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cart: state.cart, wishlist: state.wishlist, alerts: state.alerts, couponCode: state.couponCode
    }));
    return;
  }
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const data = await api("/api/account", {
        method: "PUT",
        body: JSON.stringify({ cart: state.cart, wishlist: state.wishlist, alerts: state.alerts })
      });
      state.cart = data.cart;
      state.wishlist = data.wishlist;
      state.alerts = data.alerts;
      renderCartCount();
    } catch (error) {
      showToast(error.message);
    }
  }, 180);
}

function productById(id) {
  return state.products.find((product) => product.id === id);
}

// Mantém a prévia do carrinho alinhada com os mesmos cupons e promoções do servidor.
function calculateCart() {
  const subtotal = state.cart.reduce((total, item) => {
    const product = productById(item.id);
    return total + (product ? product.price * item.quantity : 0);
  }, 0);
  const promotionDiscount = state.cart.reduce((total, item) => {
    const product = productById(item.id);
    return total + (product?.deal ? product.price * Math.floor(item.quantity / 2) : 0);
  }, 0);
  const coupon = state.coupons.find((entry) => entry.code === state.couponCode);
  const eligibleSubtotal = subtotal - promotionDiscount;
  const couponEligible = Boolean(coupon && subtotal >= coupon.minimum);
  const couponDiscount = couponEligible
    ? Math.round((coupon.type === "percentage"
      ? eligibleSubtotal * coupon.value / 100
      : Math.min(coupon.value, eligibleSubtotal)) * 100) / 100
    : 0;
  return {
    subtotal,
    promotionDiscount,
    couponDiscount,
    couponExists: Boolean(coupon),
    couponEligible,
    total: Math.max(0, Math.round((subtotal - promotionDiscount - couponDiscount) * 100) / 100)
  };
}

function renderCartCount() {
  const cartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  $("#cart-count").textContent = cartCount;
  $("#floating-cart-count").textContent = cartCount;
  $("#floating-wishlist-count").textContent = state.wishlist.length;
  $("#account-label").textContent = state.user ? state.user.name.split(" ")[0] : "Minha conta";
}

function renderCategories() {
  const categories = ["Todos", ...state.categories];
  $("#category-filters").innerHTML = categories.map((category) =>
    `<button class="filter-chip${category === state.category ? " active" : ""}" type="button" data-category="${category}">${category}</button>`
  ).join("");
}

// Desenha o destaque atual e os controles de navegação do carrossel.
function renderCarousel() {
  const offer = state.offers[state.currentOffer];
  if (!offer) return;
  $("#promo-track").innerHTML = `<article class="promo-slide ${offer.theme}">
    <span class="promo-emoji" aria-hidden="true">${offer.emoji}</span>
    <div class="promo-copy"><span class="promo-eyebrow">${escapeHTML(offer.eyebrow)}</span>
      <h2>${escapeHTML(offer.title)}</h2><p>${escapeHTML(offer.description)}</p>
    </div>
    <span class="promo-badge">${escapeHTML(offer.badge)}</span>
    <button class="promo-cta" type="button" data-offer="${state.currentOffer}">${offer.productId ? "Aproveitar oferta" : "Usar cupom"} <span aria-hidden="true">↗</span></button>
  </article>`;
  $("#promo-dots").innerHTML = state.offers.map((_, index) =>
    `<button class="promo-dot${index === state.currentOffer ? " active" : ""}" type="button" data-offer-index="${index}" aria-label="Mostrar oferta ${index + 1}" aria-current="${index === state.currentOffer ? "true" : "false"}"></button>`
  ).join("");
}

function showOffer(index) {
  state.currentOffer = (index + state.offers.length) % state.offers.length;
  renderCarousel();
}

function filteredProducts() {
  const query = state.search.toLocaleLowerCase("pt-BR");
  const visible = state.products.filter((product) =>
    (state.category === "Todos" || product.category === state.category) &&
    `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase("pt-BR").includes(query)
  );
  if (state.sort === "price-low") visible.sort((a, b) => a.price - b.price);
  if (state.sort === "price-high") visible.sort((a, b) => b.price - a.price);
  if (state.sort === "name") visible.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return visible;
}

// Atualiza os cartões do catálogo com filtros, preços e indicação de itens na sacolinha.
function renderProducts() {
  const visible = filteredProducts();
  $("#empty-products").hidden = visible.length > 0;
  $("#product-grid").innerHTML = visible.map((product) => {
    const cartItem = state.cart.find((item) => item.id === product.id);
    const cartPresence = cartItem
        ? `<span class="cart-presence" aria-label="${cartItem.quantity} ${cartItem.quantity === 1 ? "unidade" : "unidades"} na sacolinha"><span aria-hidden="true">✓</span> Na sacolinha · ${cartItem.quantity} un.</span>` : "";
    const discount = product.previousPrice > product.price
      ? `<span class="product-badge">-${Math.round((1 - product.price / product.previousPrice) * 100)}%</span>` : "";
    const dealBadge = product.deal ? `<span class="product-badge deal-badge">${escapeHTML(product.deal)}</span>` : "";
    const oldPrice = product.previousPrice > product.price
      ? `<span class="old-price">${money.format(product.previousPrice)}</span>` : "";
    return `<article class="product-card">
      <div class="product-art ${product.color}">
        ${discount}${dealBadge}<button class="product-art-trigger" type="button" data-open-product="${product.id}" aria-label="Ver detalhes de ${escapeHTML(product.name)}"><span class="product-emoji" aria-hidden="true">${product.emoji}</span></button>
        <button class="wishlist-button${state.wishlist.includes(product.id) ? " active" : ""}" data-wishlist="${product.id}" type="button" aria-label="${state.wishlist.includes(product.id) ? "Remover dos" : "Adicionar aos"} favoritos">${state.wishlist.includes(product.id) ? "♥" : "♡"}</button>
      </div>
      <div class="product-info">
        <span class="product-category">${escapeHTML(product.category)}</span><h3><button class="product-name-button" type="button" data-open-product="${product.id}">${escapeHTML(product.name)}</button></h3><p>${escapeHTML(product.description)}</p>
        ${cartPresence}
        <div class="product-bottom"><div><div class="price-line"><span class="price"><sup>R$</sup>${product.price.toFixed(2).replace(".", ",")}</span>${oldPrice}</div><div class="unit">por ${product.unit}</div></div>
        <button class="add-button${cartItem ? " add-button-in-cart" : ""}" data-add="${product.id}" type="button" aria-label="${cartItem ? `Adicionar mais uma unidade de ${escapeHTML(product.name)}` : `Adicionar ${escapeHTML(product.name)} à sacolinha`}">${cartItem ? `+${cartItem.quantity}` : "+"}</button></div>
        <button class="product-open-link" type="button" data-open-product="${product.id}">Ver detalhes, similares e recomendações ↗</button>
        <button class="compare-button" data-compare="${product.id}" type="button">Comparar e acompanhar preço</button>
      </div></article>`;
  }).join("");
}

function renderAll() {
  renderCategories();
  renderProducts();
  renderCartCount();
}

function openDrawer(title, eyebrow, html) {
  $("#drawer-title").textContent = title;
  $("#drawer-eyebrow").textContent = eyebrow;
  $("#drawer-body").innerHTML = html;
  overlay.hidden = false;
  $("#drawer-close").focus();
  document.body.style.overflow = "hidden";
}

function closeDrawer() {
  state.pendingCheckout = false;
  overlay.hidden = true;
  document.body.style.overflow = "";
}

function addToCart(id, quantity = 1) {
  const item = state.cart.find((entry) => entry.id === id);
  if (item) item.quantity = Math.min(99, item.quantity + quantity);
  else state.cart.push({ id, quantity });
  persistAccount();
  renderAll();
  if (state.detailProductId === id && !overlay.hidden && $("#drawer-title").textContent === "Detalhes do produto") {
    const addedItem = state.cart.find((entry) => entry.id === id);
    const presence = $("#detail-cart-presence");
    if (presence && addedItem) {
      presence.hidden = false;
      presence.innerHTML = `<span aria-hidden="true">✓</span> Este produto já está na sacolinha: <strong>${addedItem.quantity}</strong> ${addedItem.quantity === 1 ? "unidade" : "unidades"}.`;
    }
  }
  showToast(`${productById(id).name} foi pra sua sacolinha ♡`);
}

function makeRelatedProductCard(product) {
  return `<article class="related-product">
    <button class="related-product-main" type="button" data-open-product="${product.id}">
      <span class="related-emoji">${product.emoji}</span><span class="related-copy"><b>${escapeHTML(product.name)}</b><small>${escapeHTML(product.category)} · ${money.format(product.price)} / ${escapeHTML(product.unit)}</small></span>
    </button>
    <button class="related-add" type="button" data-related-add="${product.id}" aria-label="Adicionar ${escapeHTML(product.name)}">+</button>
  </article>`;
}

function renderProductDetail(id) {
  const product = productById(id);
  if (!product) return;
  state.detailProductId = id;
  const cartItem = state.cart.find((item) => item.id === id);
  state.detailQuantity = 1;
  const similar = state.products.filter((entry) => entry.category === product.category && entry.id !== id).slice(0, 3);
  const recommendationCategories = {
    Hortifruti: ["Mercearia", "Laticínios", "Açougue"],
    Laticínios: ["Padaria", "Mercearia", "Hortifruti"],
    Padaria: ["Laticínios", "Mercearia", "Bebidas"],
    Mercearia: ["Hortifruti", "Laticínios", "Padaria"],
    Bebidas: ["Padaria", "Doces", "Mercearia"],
    Açougue: ["Hortifruti", "Mercearia", "Congelados"],
    Congelados: ["Bebidas", "Laticínios", "Mercearia"],
    Casa: ["Cuidados", "Mercearia", "Pets"],
    Cuidados: ["Casa", "Mercearia", "Bebidas"],
    Doces: ["Bebidas", "Padaria", "Laticínios"],
    Pets: ["Hortifruti", "Casa", "Cuidados"]
  };
  const recommendedCategories = recommendationCategories[product.category] || ["Mercearia", "Hortifruti", "Bebidas"];
  const recommended = recommendedCategories.flatMap((category) =>
    state.products.filter((entry) => entry.category === category)
  ).filter((entry) => entry.id !== id && !similar.some((candidate) => candidate.id === entry.id)).slice(0, 3);
  const saving = product.previousPrice > product.price
    ? `<span class="detail-old-price">${money.format(product.previousPrice)} / ${escapeHTML(product.unit)}</span>` : "";
  const promo = product.deal
    ? `<div class="notice-box detail-promo">🎁 ${escapeHTML(product.deal)} — o desconto é aplicado automaticamente ao adicionar pares.</div>` : "";

  openDrawer("Detalhes do produto", "ESCOLHIDO COM CARINHO", `<section class="product-detail">
    <div class="detail-art ${product.color}"><span aria-hidden="true">${product.emoji}</span></div>
    <span class="product-category">${escapeHTML(product.category)}</span>
    <h3>${escapeHTML(product.name)}</h3>
    <p class="detail-description">${escapeHTML(product.description)}</p>
    <div class="detail-price-row"><div><strong>${money.format(product.price)}</strong><span> / ${escapeHTML(product.unit)}</span>${saving}</div>
      <button class="wishlist-button${state.wishlist.includes(product.id) ? " active" : ""}" data-detail-wishlist="${product.id}" type="button" aria-label="${state.wishlist.includes(product.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}">${state.wishlist.includes(product.id) ? "♥" : "♡"}</button>
    </div><div class="detail-cart-presence"${cartItem ? "" : " hidden"} id="detail-cart-presence"><span aria-hidden="true">✓</span> Este produto já está na sacolinha: <strong>${cartItem?.quantity || 0}</strong> ${cartItem?.quantity === 1 ? "unidade" : "unidades"}.</div>${promo}
    <div class="detail-buy-row"><div class="detail-quantity"><button type="button" data-detail-quantity="-1" aria-label="Diminuir quantidade">−</button><input id="detail-quantity-input" type="number" min="1" max="99" value="${state.detailQuantity}" aria-label="Quantidade a adicionar"><button type="button" data-detail-quantity="1" aria-label="Aumentar quantidade">+</button></div>
      <button class="button button-green detail-add" type="button" data-detail-add="${product.id}">Adicionar à sacolinha <span aria-hidden="true">↗</span></button>
    </div>
    <button class="compare-button detail-compare" type="button" data-detail-compare="${product.id}">Comparar preço e criar alerta</button>
    ${similar.length ? `<section class="related-section"><div class="related-heading"><h4>Produtos similares</h4><span>Da mesma categoria</span></div><div class="related-list">${similar.map(makeRelatedProductCard).join("")}</div></section>` : ""}
    ${recommended.length ? `<section class="related-section"><div class="related-heading"><h4>Você também pode gostar</h4><span>Boas combinações</span></div><div class="related-list">${recommended.map(makeRelatedProductCard).join("")}</div></section>` : ""}
  </section>`);
  $("#detail-quantity-input").addEventListener("input", (event) => {
    state.detailQuantity = Math.min(99, Math.max(1, Number(event.currentTarget.value) || 1));
  });
}

// Renderiza quantidades, promoções, cupons e total estimado da sacolinha.
function renderCart() {
  if (!state.cart.length) {
    $("#drawer-body").innerHTML = '<div class="empty-drawer"><span>🧺</span>Sua sacolinha está esperando por coisas gostosas!<br><br><button class="button button-green" type="button" data-close>Ver produtos</button></div>';
    return;
  }
  const items = state.cart.map((item) => {
    const product = productById(item.id);
    if (!product) return "";
    const freeQuantity = product.deal ? Math.floor(item.quantity / 2) : 0;
    const lineTotal = product.price * (item.quantity - freeQuantity);
    return `<article class="drawer-item"><div class="drawer-item-art">${product.emoji}</div><div class="drawer-item-info"><b>${escapeHTML(product.name)}</b><small>${money.format(product.price)} / ${escapeHTML(product.unit)}${freeQuantity ? ` · ${freeQuantity} grátis!` : ""}</small><div class="quantity-control"><button type="button" data-quantity="-1" data-id="${product.id}" aria-label="Diminuir quantidade">−</button><span>${item.quantity}</span><button type="button" data-quantity="1" data-id="${product.id}" aria-label="Aumentar quantidade">+</button></div></div><div class="drawer-item-side"><strong>${money.format(lineTotal)}</strong><button class="remove-button" type="button" data-remove="${product.id}" aria-label="Remover ${escapeHTML(product.name)}">×</button></div></article>`;
  }).join("");
  const pricing = calculateCart();
  const couponStatus = state.couponCode
    ? !pricing.couponExists
      ? `<span class="coupon-feedback">Cupom não encontrado. Confira o código e tente novamente.</span>`
      : pricing.couponEligible
        ? `<span class="coupon-success">Cupom ${escapeHTML(state.couponCode)} aplicado: −${money.format(pricing.couponDiscount)}</span>`
        : `<span class="coupon-feedback">Adicione mais produtos para atingir o valor mínimo deste cupom.</span>`
    : "";
  const couponRows = state.coupons.map((coupon) =>
    `<button class="coupon-chip" type="button" data-set-coupon="${coupon.code}"><b>${coupon.code}</b><span>${escapeHTML(coupon.label)}</span></button>`
  ).join("");
  $("#drawer-body").innerHTML = `<div class="drawer-list">${items}</div>
    <div class="coupon-box"><label for="coupon-input">Tem um cupom? <span>Descontos demonstrativos aplicados no pedido.</span></label>
      <div class="coupon-entry"><input id="coupon-input" value="${escapeHTML(state.couponCode)}" placeholder="Ex.: VILA10" maxlength="20"><button type="button" data-apply-coupon>Aplicar</button></div>
      <div class="coupon-suggestions">${couponRows}</div>${couponStatus}
    </div>
    <div class="price-summary"><div><span>Subtotal</span><span>${money.format(pricing.subtotal)}</span></div>
      ${pricing.promotionDiscount ? `<div class="discount-row"><span>Ofertas leve 2, pague 1</span><span>−${money.format(pricing.promotionDiscount)}</span></div>` : ""}
      ${pricing.couponDiscount ? `<div class="discount-row"><span>Cupom ${escapeHTML(state.couponCode)}</span><span>−${money.format(pricing.couponDiscount)}</span></div>` : ""}
    </div><div class="drawer-total"><span>Total estimado</span><strong>${money.format(pricing.total)}</strong></div>
    <div class="notice-box">Compra demonstrativa: nenhum pagamento real será efetuado.</div><button class="button button-green" style="width:100%;margin-top:14px" type="button" data-checkout>Continuar com a simulação <span aria-hidden="true">↗</span></button><p style="margin:12px 0 0;color:#85877f;font-size:9px">A entrega e os valores são apenas ilustrativos.</p>`;
}

function openCart() {
  openDrawer("Sua sacolinha", "ESCOLHIDOS COM CARINHO", "");
  renderCart();
}

function authForm(mode, errorMessage = "") {
  const registering = mode === "register";
  $("#drawer-body").innerHTML = `<form class="drawer-form" id="auth-form">
    ${registering ? '<label>Seu nome<input name="name" autocomplete="name" required minlength="2" maxlength="80" placeholder="Como podemos te chamar?"></label>' : ""}
    <label>Seu e-mail<input name="email" type="email" autocomplete="email" value="${registering ? "" : DEMO_CREDENTIALS.email}" required placeholder="voce@email.com"></label>
    <label>Sua senha<input name="password" type="password" autocomplete="${registering ? "new-password" : "current-password"}" value="${registering ? "" : DEMO_CREDENTIALS.password}" minlength="${registering ? 8 : 1}" maxlength="128" required placeholder="${registering ? "Pelo menos 8 caracteres" : "Sua senha"}"></label>
    <span class="form-message auth-error">${escapeHTML(errorMessage)}</span>
    <button class="button button-green" type="submit">${registering ? "Criar minha conta" : "Entrar"}</button>
    <button class="text-button" type="button" data-auth-mode="${registering ? "login" : "register"}">${registering ? "Já tenho uma conta — entrar" : "Sou novo por aqui — criar conta"}</button>
    ${registering ? "" : `<div class="demo-login-tip"><span>✓</span><div><b>Conta de demonstração preenchida</b><small>E-mail: <strong>${DEMO_CREDENTIALS.email}</strong></small><small>Senha: <strong>${DEMO_CREDENTIALS.password}</strong></small><button class="text-button" type="button" data-demo-login>Preencher novamente</button></div></div>`}
    </form>`;
  const fillDemoButton = $("#drawer-body [data-demo-login]");
  if (fillDemoButton) fillDemoButton.addEventListener("click", () => {
    $("#auth-form [name=email]").value = DEMO_CREDENTIALS.email;
    $("#auth-form [name=password]").value = DEMO_CREDENTIALS.password;
    showToast("Dados de demonstração preenchidos.");
  });
  $("#auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const data = await api(`/api/auth/${registering ? "register" : "login"}`, { method: "POST", body: JSON.stringify(form) });
      const hadAccount = Boolean(state.user);
      const guestCart = hadAccount ? [] : state.cart;
      const guestWishlist = hadAccount ? [] : state.wishlist;
      const mergeCart = (saved, additional) => {
        const merged = new Map(saved.map((item) => [item.id, { ...item }]));
        for (const item of additional) {
          const current = merged.get(item.id);
          merged.set(item.id, { id: item.id, quantity: Math.min(99, (current?.quantity || 0) + item.quantity) });
        }
        return [...merged.values()];
      };
      state.user = data.user;
      state.cart = mergeCart(data.cart, guestCart);
      state.wishlist = [...new Set([...data.wishlist, ...guestWishlist])];
      state.alerts = data.alerts;
      state.orders = data.orders || [];
      if (hadAccount) state.couponCode = "";
      localStorage.removeItem(STORAGE_KEY);
      persistAccount();
      renderAll();
      if (state.pendingCheckout) {
        state.pendingCheckout = false;
        renderCheckout();
      } else {
        renderAccount();
      }
      showToast(registering ? "Sua conta foi criada. Que bom ter você por aqui! ♡" : "Que bom te ver de novo! ♡");
    } catch (error) {
      authForm(mode, error.message);
    }
  });
}

function renderAccount() {
  if (!state.user) {
    openDrawer("Entre na sua conta", "QUE BOM TE VER!", "");
    authForm("login");
    return;
  }
  openDrawer(`Oi, ${escapeHTML(state.user.name.split(" ")[0])}!`, "SUA CONTA NA VILA", `<p class="account-meta">${escapeHTML(state.user.email)}</p>
    <div class="notice-box">Seus favoritos, sua sacolinha e seus alertas ficam salvos na sua conta.</div>
    <div class="account-links"><button type="button" data-account-section="orders">Meus pedidos (${state.orders.length})</button><button type="button" data-account-section="wishlist">Meus favoritos (${state.wishlist.length})</button><button type="button" data-account-section="alerts">Meus alertas de preço (${state.alerts.length})</button><button type="button" data-logout>Sair da conta</button></div>`);
}

function formatOrderDate(value) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

// Mostra comprovantes persistidos e ações disponíveis para cada pedido demonstrativo.
function renderOrderHistory() {
  const cards = state.orders.map((order) => {
    const status = order.status === "cancelled" ? "Pedido cancelado" : "Compra simulada finalizada";
    const items = order.items.map((item) =>
      `<li>${escapeHTML(item.emoji)} ${escapeHTML(item.name)} × ${item.quantity}${item.freeQuantity ? ` <span class="order-free">(${item.freeQuantity} grátis)</span>` : ""}</li>`
    ).join("");
    const deliveryTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(order.estimatedAt));
    const cancellationButton = order.status === "confirmed"
      ? `<button class="text-button cancel-order-button" type="button" data-cancel-order="${escapeHTML(order.reference)}">Cancelar pedido</button>`
      : '<span class="order-cancelled-note">Cancelamento registrado na simulação.</span>';
    return `<article class="order-card">
      <div class="order-card-heading"><div><span class="eyebrow">${status}</span><h3>Comprovante ${escapeHTML(order.reference)}</h3></div><span class="order-status ${order.status}">${order.status === "cancelled" ? "Cancelado" : "Finalizado"}</span></div>
      <p class="order-meta">Realizado em ${formatOrderDate(order.createdAt)} · Entrega estimada: ${order.estimatedMinutes} min (até ${deliveryTime})</p>
      <ul class="order-items">${items}</ul>
      ${order.promotionDiscount || order.couponDiscount ? `<p class="order-discount">Você economizou ${money.format(order.promotionDiscount + order.couponDiscount)} neste pedido.</p>` : ""}
      <div class="order-receipt-total"><span>Total da simulação</span><strong>${money.format(order.total)}</strong></div>
      <div class="order-delivery">📍 ${escapeHTML(order.delivery.address)}, ${escapeHTML(order.delivery.city)}</div>
      <div class="order-actions">${cancellationButton}<button class="button button-green reorder-button" type="button" data-reorder="${escapeHTML(order.reference)}">Comprar novamente</button></div>
    </article>`;
  }).join("");
  openDrawer("Histórico de pedidos", "SEUS COMPROVANTES DA VILA", cards
    ? `<div class="order-history">${cards}</div>`
    : '<div class="empty-drawer"><span>🧾</span>Suas compras simuladas e comprovantes aparecerão aqui.</div>');
}

function renderWishlist() {
  const favorites = state.products.filter((product) => state.wishlist.includes(product.id));
  openDrawer("Meus favoritos", "SUA LISTINHA ESPECIAL", favorites.length
    ? `<div class="drawer-list">${favorites.map((product) => `<article class="drawer-item"><div class="drawer-item-art">${product.emoji}</div><div class="drawer-item-info"><b>${product.name}</b><small>${money.format(product.price)} / ${product.unit}</small></div><div class="drawer-item-side"><button class="add-button" data-add="${product.id}" type="button" aria-label="Adicionar à sacolinha">+</button><button class="remove-button" data-wishlist="${product.id}" type="button" aria-label="Remover dos favoritos">×</button></div></article>`).join("")}</div>`
    : '<div class="empty-drawer"><span>♡</span>Nenhum favorito por enquanto. Toque no coração do que você gostar!</div>');
}

function renderAlerts() {
  const entries = state.alerts.map((alert) => {
    const product = productById(alert.id);
    return product ? `<div class="alert-row">${product.emoji} <b>${product.name}</b> — avisar quando ficar abaixo de <span>${money.format(alert.target)}</span> <button class="remove-button" data-remove-alert="${product.id}" type="button" aria-label="Remover alerta">×</button></div>` : "";
  }).join("");
  openDrawer("Acompanhar preços", "UM OLHO NAS ECONOMIAS", `<p style="color:#85877f;font-size:10px">Acompanhe seus produtos favoritos e defina um preço-alvo.</p>${entries || '<div class="empty-drawer">Você ainda não criou alertas de preço.</div>'}`);
}

function renderCompare(productId) {
  const selected = productById(productId);
  if (!selected) return;
  const similar = state.products.filter((product) => product.category === selected.category).sort((a, b) => a.price - b.price);
  openDrawer("Compare os produtos", "ESCOLHA COM CALMA", `<p style="color:#85877f;font-size:10px">Veja os preços dos produtos da categoria ${selected.category.toLocaleLowerCase("pt-BR")}.</p>
    <table class="compare-table"><thead><tr><th>Produto</th><th>Unidade</th><th>Preço</th></tr></thead><tbody>${similar.map((product) => `<tr><td>${product.emoji} ${product.name}</td><td>${product.unit}</td><td class="${product.id === selected.id ? "compare-price" : ""}">${money.format(product.price)}</td></tr>`).join("")}</tbody></table>
    <form class="drawer-form" id="alert-form" style="margin-top:22px"><label>Me avise quando ${selected.name} chegar a<input name="target" type="number" min="0.01" step="0.01" value="${(selected.price * 0.9).toFixed(2)}" required></label>
    <button class="button button-green" type="submit">Acompanhar esse preço ♡</button></form>
    <p class="form-message" id="alert-message"></p>`);
  $("#alert-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const target = Number(new FormData(event.currentTarget).get("target"));
    if (!state.user) {
      showToast("Entre na sua conta para salvar e acompanhar seus alertas.");
      authForm("login");
      return;
    }
    state.alerts = [...state.alerts.filter((alert) => alert.id !== selected.id), { id: selected.id, target }];
    persistAccount();
    renderAll();
    showToast(`Alerta de preço criado para ${selected.name}.`);
    renderAlerts();
  });
}

// Valida os campos de exemplo localmente e envia somente dados de entrega à API.
function renderCheckout(errorMessage = "") {
  if (!state.user) {
    state.pendingCheckout = true;
    openDrawer("Entre para continuar", "SUA SACOLINHA ESTÁ GUARDADA", "");
    authForm("login", "Faça login ou crie sua conta para finalizar a simulação e guardar o comprovante no histórico.");
    return;
  }
  const items = state.cart.map((item) => `${productById(item.id).name} × ${item.quantity}`).join(", ");
  const pricing = calculateCart();
  $("#drawer-body").innerHTML = `<div class="notice-box">🧪 <b>Modo demonstração:</b> use somente dados inventados. Nenhuma compra ou cobrança real acontece. Os dados do cartão são validados apenas nesta tela e nunca são enviados ou salvos.</div>
    <p style="margin:18px 0;color:#74776e;font-size:10px"><b>Itens:</b> ${escapeHTML(items)}<br><b>Total ilustrativo:</b> ${money.format(pricing.total)}</p>
    <form class="drawer-form" id="checkout-form">
      <label>Nome para a entrega<input name="name" autocomplete="name" value="${escapeHTML(state.user.name)}" required minlength="2" placeholder="Nome fictício"></label>
      <label>Endereço de entrega<input name="address" autocomplete="street-address" required minlength="5" placeholder="Rua e número fictícios"></label>
      <label>Cidade<input name="city" autocomplete="address-level2" required minlength="2" placeholder="Sua cidade"></label>
      <label>Número do cartão (fictício)<input name="card" inputmode="numeric" autocomplete="off" maxlength="23" required placeholder="0000 0000 0000 0000"></label>
      <label>Nome impresso no cartão<input name="cardName" autocomplete="off" required placeholder="NOME FICTÍCIO"></label>
      <div class="support-fields"><label>Validade<input name="expiry" autocomplete="off" required placeholder="MM/AA" maxlength="5"></label><label>CVV fictício<input name="cvv" inputmode="numeric" autocomplete="off" required placeholder="000" maxlength="4"></label></div>
      <div class="demo-login-tip checkout-demo-tip"><span>✓</span><div><b>Use os dados fictícios pré-preenchidos</b><small>Rua das Flores, 123 · São Paulo</small><small>Cartão de teste: 4242 4242 4242 4242 · 12/30 · CVV 123</small><button class="text-button" type="button" data-fill-checkout>Preencher os dados de exemplo</button></div></div>
      <span class="form-message">${errorMessage}</span>
      <button class="button button-green" type="submit">Simular minha compra <span aria-hidden="true">↗</span></button>
    </form>`;
  $("#drawer-body [data-fill-checkout]").addEventListener("click", () => {
    const form = $("#checkout-form");
    form.elements.address.value = "Rua das Flores, 123";
    form.elements.city.value = "São Paulo";
    form.elements.card.value = "4242424242424242";
    form.elements.cardName.value = state.user.name.toLocaleUpperCase("pt-BR");
    form.elements.expiry.value = "12/30";
    form.elements.cvv.value = "123";
    showToast("Dados de entrega e pagamento fictícios preenchidos.");
  });
  $("#checkout-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const card = String(form.get("card")).replace(/\D/g, "");
    const cvv = String(form.get("cvv")).replace(/\D/g, "");
    const expiry = String(form.get("expiry"));
    const expiryParts = expiry.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
    if (card.length < 12 || card.length > 19 || !/^\d+$/.test(card) ||
        cvv.length < 3 || cvv.length > 4 || !expiryParts ||
        !/^[A-Za-zÀ-ÿ ]{2,}$/.test(String(form.get("cardName")).trim())) {
      renderCheckout("Confira os campos do cartão. Use somente dados inventados para esta demonstração.");
      return;
    }
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      // Somente dados de entrega e itens seguem para a API; campos de cartão ficam no navegador.
      const result = await api("/api/checkout-demo", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          address: form.get("address"),
          city: form.get("city"),
          cart: state.cart,
          couponCode: state.couponCode
        })
      });
      state.orders.unshift(result.order);
      state.cart = [];
      state.couponCode = "";
      persistAccount();
      renderAll();
      renderReceipt(result.order, result.message);
      showToast("Simulação concluída. Nenhuma cobrança foi feita.");
    } catch (error) {
      renderCheckout(error.message);
    }
  });
}

function renderReceipt(order, message) {
  const items = order.items.map((item) =>
    `<li>${escapeHTML(item.emoji)} ${escapeHTML(item.name)} × ${item.quantity} <span>${money.format(item.lineTotal)}</span>${item.freeQuantity ? `<small>${item.freeQuantity} unidade(s) grátis na oferta</small>` : ""}</li>`
  ).join("");
  const estimatedTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(order.estimatedAt));
  $("#drawer-title").textContent = "Pedido finalizado!";
  $("#drawer-eyebrow").textContent = "COMPROVANTE DA SIMULAÇÃO";
  $("#drawer-body").innerHTML = `<div class="receipt-success"><span class="receipt-flower">🌼</span><h3>Oba, deu tudo certo!</h3><p>${escapeHTML(message)}</p></div>
    <article class="receipt-card"><div class="receipt-heading"><div><span class="eyebrow">COMPROVANTE DE TESTE</span><h3>${escapeHTML(order.reference)}</h3></div><span class="order-status confirmed">Finalizado</span></div>
      <p class="order-meta">Registrado em ${formatOrderDate(order.createdAt)}</p>
      <ul class="receipt-items">${items}</ul>
      ${order.promotionDiscount || order.couponDiscount ? `<p class="order-discount">Descontos: −${money.format(order.promotionDiscount + order.couponDiscount)}</p>` : ""}
      <div class="order-receipt-total"><span>Total demonstrativo</span><strong>${money.format(order.total)}</strong></div>
      <div class="receipt-eta">🛵 <div><b>Entrega estimada</b><span>Em aproximadamente ${order.estimatedMinutes} minutos, até ${estimatedTime}</span></div></div>
      <div class="order-delivery">📍 ${escapeHTML(order.delivery.address)}, ${escapeHTML(order.delivery.city)}</div>
      <div class="notice-box" style="margin-top:14px">Comprovante ilustrativo. Nenhum pedido real foi enviado e nenhuma cobrança aconteceu.</div>
    </article>
    <div class="order-actions receipt-actions"><button class="text-button" type="button" data-account-section="orders">Ver histórico e gerenciar pedido</button><button class="button button-green" type="button" data-close>Voltar às compras</button></div>`;
}

// Usa delegação de eventos para que botões recriados ao renderizar continuem funcionando.
$("#product-grid").addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add]");
  const wishButton = event.target.closest("[data-wishlist]");
  const compareButton = event.target.closest("[data-compare]");
  const productButton = event.target.closest("[data-open-product]");
  if (addButton) addToCart(addButton.dataset.add);
  if (wishButton) {
    const id = wishButton.dataset.wishlist;
    state.wishlist = state.wishlist.includes(id) ? state.wishlist.filter((item) => item !== id) : [...state.wishlist, id];
    persistAccount();
    renderAll();
    if ($("#drawer-title").textContent === "Meus favoritos" && !overlay.hidden) renderWishlist();
  }
  if (productButton) renderProductDetail(productButton.dataset.openProduct);
  if (compareButton) renderCompare(compareButton.dataset.compare);
});

$("#product-grid").addEventListener("keydown", (event) => {
  const productButton = event.target.closest("[data-open-product]");
  if (productButton && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    renderProductDetail(productButton.dataset.openProduct);
  }
});

$("#category-filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (button) { state.category = button.dataset.category; renderAll(); }
});

document.querySelectorAll("[data-category-link]").forEach((link) => {
  link.addEventListener("click", () => {
    state.category = link.dataset.categoryLink;
    renderAll();
  });
});

$("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.search = $("#search-input").value.trim();
  renderProducts();
  $("#produtos").scrollIntoView({ behavior: "smooth" });
});

$("#search-input").addEventListener("input", () => {
  state.search = $("#search-input").value.trim();
  renderProducts();
});

$("#sort-select").addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderProducts();
});

$("#promo-track").addEventListener("click", (event) => {
  const button = event.target.closest("[data-offer]");
  if (!button) return;
  const offer = state.offers[Number(button.dataset.offer)];
  if (!offer) return;
  if (offer.productId) {
    addToCart(offer.productId, 2);
    openCart();
  } else {
    state.couponCode = offer.couponCode;
    persistAccount();
    openCart();
  }
});

$("#promo-dots").addEventListener("click", (event) => {
  const dot = event.target.closest("[data-offer-index]");
  if (dot) showOffer(Number(dot.dataset.offerIndex));
});

$("#promo-prev").addEventListener("click", () => showOffer(state.currentOffer - 1));
$("#promo-next").addEventListener("click", () => showOffer(state.currentOffer + 1));
const carouselTimer = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ? null
  : window.setInterval(() => {
    if (!document.hidden && state.offers.length && overlay.hidden) showOffer(state.currentOffer + 1);
  }, 6500);

$("#cart-button").addEventListener("click", openCart);
$("#account-button").addEventListener("click", renderAccount);
$("#floating-cart-button").addEventListener("click", openCart);
$("#floating-wishlist-button").addEventListener("click", renderWishlist);

// Exibe os atalhos flutuantes quando os controles originais do cabeçalho saem da tela.
const floatingQuickActions = $("#floating-quick-actions");
const updateFloatingActions = () => {
  floatingQuickActions.classList.toggle("is-visible", $(".site-header").getBoundingClientRect().bottom < 0);
};
window.addEventListener("scroll", updateFloatingActions, { passive: true });
updateFloatingActions();

$("#drawer-close").addEventListener("click", closeDrawer);
overlay.addEventListener("click", (event) => { if (event.target === overlay) closeDrawer(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !overlay.hidden) closeDrawer(); });

// Centraliza ações dinâmicas da sacolinha, conta, detalhes e histórico de pedidos.
$("#drawer-body").addEventListener("click", async (event) => {
  if (event.target.closest("[data-close]")) closeDrawer();
  const detailQuantityButton = event.target.closest("[data-detail-quantity]");
  if (detailQuantityButton) {
    state.detailQuantity = Math.min(99, Math.max(1, state.detailQuantity + Number(detailQuantityButton.dataset.detailQuantity)));
    $("#detail-quantity-input").value = state.detailQuantity;
  }
  const detailAddButton = event.target.closest("[data-detail-add]");
  if (detailAddButton) {
    const quantity = Math.min(99, Math.max(1, Number($("#detail-quantity-input").value) || 1));
    addToCart(detailAddButton.dataset.detailAdd, quantity);
    state.detailQuantity = 1;
    renderProductDetail(detailAddButton.dataset.detailAdd);
  }
  const relatedAddButton = event.target.closest("[data-related-add]");
  if (relatedAddButton) addToCart(relatedAddButton.dataset.relatedAdd);
  const openRelatedProduct = event.target.closest("[data-open-product]");
  if (openRelatedProduct) renderProductDetail(openRelatedProduct.dataset.openProduct);
  const detailWishlistButton = event.target.closest("[data-detail-wishlist]");
  if (detailWishlistButton) {
    const id = detailWishlistButton.dataset.detailWishlist;
    state.wishlist = state.wishlist.includes(id)
      ? state.wishlist.filter((item) => item !== id)
      : [...state.wishlist, id];
    persistAccount();
    renderAll();
    renderProductDetail(id);
  }
  const detailCompareButton = event.target.closest("[data-detail-compare]");
  if (detailCompareButton) renderCompare(detailCompareButton.dataset.detailCompare);
  if (event.target.closest("[data-checkout]")) {
    if (!state.cart.length) return;
    openDrawer("Simulação de compra", "É SÓ DE BRINCADEIRINHA!", "");
    renderCheckout();
  }
  if (event.target.closest("[data-apply-coupon]")) {
    state.couponCode = $("#coupon-input").value.trim().toUpperCase();
    persistAccount();
    renderCart();
    if (calculateCart().couponEligible) showToast(`Cupom ${state.couponCode} aplicado à sacolinha.`);
  }
  const couponButton = event.target.closest("[data-set-coupon]");
  if (couponButton) {
    state.couponCode = couponButton.dataset.setCoupon;
    persistAccount();
    renderCart();
    if (calculateCart().couponEligible) showToast(`Cupom ${state.couponCode} aplicado à sacolinha.`);
  }
  const quantityButton = event.target.closest("[data-quantity]");
  const removeButton = event.target.closest("[data-remove]");
  if (quantityButton) {
    const item = state.cart.find((entry) => entry.id === quantityButton.dataset.id);
    if (item) {
      item.quantity += Number(quantityButton.dataset.quantity);
      if (item.quantity < 1) state.cart = state.cart.filter((entry) => entry.id !== item.id);
      persistAccount();
      renderAll();
      renderCart();
    }
  }
  if (removeButton) {
    state.cart = state.cart.filter((item) => item.id !== removeButton.dataset.remove);
    persistAccount();
    renderAll();
    renderCart();
  }
  const wishButton = event.target.closest("[data-wishlist]");
  if (wishButton) {
    state.wishlist = state.wishlist.filter((id) => id !== wishButton.dataset.wishlist);
    persistAccount();
    renderAll();
    renderWishlist();
  }
  const authMode = event.target.closest("[data-auth-mode]");
  if (authMode) authForm(authMode.dataset.authMode);
  const accountSection = event.target.closest("[data-account-section]");
  if (accountSection) {
    if (accountSection.dataset.accountSection === "wishlist") renderWishlist();
    if (accountSection.dataset.accountSection === "alerts") renderAlerts();
    if (accountSection.dataset.accountSection === "orders") {
      try {
        const result = await api("/api/orders");
        state.orders = result.orders;
        renderOrderHistory();
      } catch (error) {
        showToast(error.message);
      }
    }
  }
  const cancelButton = event.target.closest("[data-cancel-order]");
  if (cancelButton) {
    if (!window.confirm("Cancelar este pedido demonstrativo? O comprovante continuará no seu histórico.")) return;
    cancelButton.disabled = true;
    try {
      const result = await api(`/api/orders/${encodeURIComponent(cancelButton.dataset.cancelOrder)}/cancel`, { method: "POST" });
      state.orders = state.orders.map((order) => order.reference === result.order.reference ? result.order : order);
      renderOrderHistory();
      showToast(result.message);
    } catch (error) {
      showToast(error.message);
      cancelButton.disabled = false;
    }
  }
  const reorderButton = event.target.closest("[data-reorder]");
  if (reorderButton) {
    const order = state.orders.find((entry) => entry.reference === reorderButton.dataset.reorder);
    if (order) {
      for (const purchased of order.items) {
        const existing = state.cart.find((item) => item.id === purchased.id);
        if (existing) existing.quantity = Math.min(99, existing.quantity + purchased.quantity);
        else state.cart.push({ id: purchased.id, quantity: purchased.quantity });
      }
      state.couponCode = order.couponCode || "";
      persistAccount();
      renderAll();
      openCart();
      showToast("Os produtos do comprovante estão na sua sacolinha.");
    }
  }
  if (event.target.closest("[data-logout]")) {
    try {
      await api("/api/auth/logout", { method: "POST" });
      state.user = null;
      state.cart = [];
      state.wishlist = [];
      state.alerts = [];
      state.orders = [];
      state.couponCode = "";
      state.pendingCheckout = false;
      renderAll();
      renderAccount();
      showToast("Você saiu da sua conta. Até a próxima! ♡");
    } catch (error) { showToast(error.message); }
  }
  const alertButton = event.target.closest("[data-remove-alert]");
  if (alertButton) {
    state.alerts = state.alerts.filter((alert) => alert.id !== alertButton.dataset.removeAlert);
    persistAccount();
    renderAlerts();
  }
});

$("#newsletter-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const message = $("#newsletter-message");
  try {
    const result = await api("/api/newsletter", { method: "POST", body: JSON.stringify({ email: form.get("email") }) });
    message.textContent = result.message;
    event.currentTarget.reset();
  } catch (error) { message.textContent = error.message; }
});

$("#support-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const message = $("#support-message");
  try {
    const result = await api("/api/support", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(form))
    });
    message.textContent = result.message;
    event.currentTarget.reset();
  } catch (error) { message.textContent = error.message; }
});

async function init() {
  const guest = readGuestState();
  Object.assign(state, guest);
  try {
    const [catalog, account, offersData] = await Promise.all([
      api("/api/products"),
      api("/api/me"),
      api("/api/offers")
    ]);
    state.products = catalog.products;
    state.categories = catalog.categories;
    state.offers = offersData.offers;
    state.coupons = offersData.coupons;
    if (account.user) {
      state.user = account.user;
      state.cart = account.cart;
      state.wishlist = account.wishlist;
      state.alerts = account.alerts;
      state.orders = account.orders || [];
    }
    renderAll();
    renderCarousel();
  } catch (error) {
    $("#product-grid").innerHTML = `<p class="empty-message">Não foi possível carregar os produtos: ${error.message}</p>`;
  }
}

init();
