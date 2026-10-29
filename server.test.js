const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createServer, DEMO_ACCOUNT } = require("../server");

async function startTestServer(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mercadinho-"));
  const server = createServer({ dataFile: path.join(directory, "store.json") });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { base: `http://127.0.0.1:${server.address().port}`, dataFile: path.join(directory, "store.json") };
}

async function jsonRequest(base, route, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return {
    response,
    data: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0]
  };
}

test("serves catalog and product categories", async (t) => {
  const { base } = await startTestServer(t);
  const { response, data } = await jsonRequest(base, "/api/products");
  assert.equal(response.status, 200);
  assert.equal(data.products.length, 114);
  assert.equal(new Set(data.products.map((product) => product.id)).size, data.products.length);
  assert.ok(data.categories.includes("Hortifruti"));
  assert.ok(data.categories.includes("Peixaria"));
  assert.ok(data.categories.includes("Limpeza"));
  assert.ok(data.categories.includes("Temperos"));
  assert.ok(data.categories.includes("Bebê"));
  assert.ok(data.categories.includes("Orgânicos"));
  assert.ok(data.categories.includes("Açougue"));
  assert.ok(data.products.some((product) => product.id === "racao-gatos" && product.category === "Pets"));
  assert.ok(data.products.some((product) => product.id === "croissant" && product.category === "Padaria"));
  assert.ok(data.products.some((product) => product.id === "fralda" && product.category === "Bebê"));
  assert.ok(data.products.some((product) => product.id === "patinho" && product.category === "Açougue"));
  const compatibleEmojiFallbacks = {
    azeite: "🧴",
    feijao: "🥣",
    lentilha: "🍲",
    "pasta-dente": "🦷",
    "sabao-po": "🧼",
    oregano: "🌿",
    beterraba: "🥕"
  };
  for (const [id, emoji] of Object.entries(compatibleEmojiFallbacks)) {
    assert.equal(data.products.find((product) => product.id === id)?.emoji, emoji);
  }
  const { data: offersData } = await jsonRequest(base, "/api/offers");
  assert.equal(offersData.offers.length, 4);
  assert.ok(data.products.some((product) => product.deal === "Leve 2, pague 1"));
});

test("provides a ready-to-use demo account and initializes it in existing stores", async (t) => {
  const { base } = await startTestServer(t);
  const login = await jsonRequest(base, "/api/auth/login", {
    method: "POST",
    body: { email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password }
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.data.user.name, DEMO_ACCOUNT.name);
  assert.ok(login.cookie);
  assert.deepEqual(login.data.cart, []);
});

test("registers an account, stores preferences, and authenticates a session", async (t) => {
  const { base } = await startTestServer(t);
  const created = await jsonRequest(base, "/api/auth/register", {
    method: "POST",
    body: { name: "Ana da Vila", email: "ANA@example.com", password: "senha-segura-123" }
  });
  assert.equal(created.response.status, 201);
  assert.ok(created.cookie);
  assert.equal("passwordHash" in created.data.user, false);

  const saved = await jsonRequest(base, "/api/account", {
    method: "PUT",
    cookie: created.cookie,
    body: { cart: [{ id: "banana", quantity: 2 }], wishlist: ["cafe"], alerts: [{ id: "leite", target: 4.5 }] }
  });
  assert.equal(saved.data.cart[0].quantity, 2);
  assert.deepEqual(saved.data.wishlist, ["cafe"]);

  const login = await jsonRequest(base, "/api/auth/login", {
    method: "POST",
    body: { email: "ana@example.com", password: "senha-segura-123" }
  });
  assert.equal(login.response.status, 200);
  assert.deepEqual(login.data.alerts, [{ id: "leite", target: 4.5 }]);
  assert.deepEqual(login.data.orders, []);
});

test("rejects duplicate registrations and invalid credentials", async (t) => {
  const { base } = await startTestServer(t);
  await jsonRequest(base, "/api/auth/register", {
    method: "POST",
    body: { name: "Ana", email: "ana@example.com", password: "senha-segura" }
  });
  const duplicate = await jsonRequest(base, "/api/auth/register", {
    method: "POST",
    body: { name: "Ana", email: "ANA@example.com", password: "senha-segura" }
  });
  const login = await jsonRequest(base, "/api/auth/login", {
    method: "POST",
    body: { email: "ana@example.com", password: "errada" }
  });
  assert.equal(duplicate.response.status, 409);
  assert.equal(login.response.status, 401);
});

test("requires login, applies demo offers, saves a receipt, and lets the owner cancel it", async (t) => {
  const { base, dataFile } = await startTestServer(t);
  const anonymous = await jsonRequest(base, "/api/checkout-demo", {
    method: "POST",
    body: {
      name: "Ana",
      address: "Rua das Flores, 10",
      city: "São Paulo",
      cart: [{ id: "banana", quantity: 2 }]
    }
  });
  assert.equal(anonymous.response.status, 401);

  const account = await jsonRequest(base, "/api/auth/register", {
    method: "POST",
    body: { name: "Ana", email: "ana@example.com", password: "senha-segura-123" }
  });
  const { response, data } = await jsonRequest(base, "/api/checkout-demo", {
    method: "POST",
    cookie: account.cookie,
    body: {
      name: "Ana",
      address: "Rua das Flores, 10",
      city: "São Paulo",
      cart: [{ id: "iogurte", quantity: 2 }, { id: "papel", quantity: 2 }, { id: "cafe", quantity: 1 }],
      couponCode: "VILA10",
      card: "4111111111111111"
    }
  });
  assert.equal(response.status, 201);
  assert.equal(data.demo, true);
  assert.match(data.message, /Nenhuma cobrança/);
  assert.equal(data.order.subtotal, 65.28);
  assert.equal(data.order.promotionDiscount, 4.29);
  assert.equal(data.order.couponDiscount, 6.1);
  assert.equal(data.order.total, 54.89);
  assert.equal(data.order.items[0].freeQuantity, 1);
  assert.ok(data.order.estimatedMinutes >= 45 && data.order.estimatedMinutes <= 75);
  assert.equal(data.order.status, "confirmed");

  const history = await jsonRequest(base, "/api/orders", { cookie: account.cookie });
  assert.equal(history.data.orders.length, 1);
  assert.equal(history.data.orders[0].reference, data.order.reference);
  assert.equal(JSON.stringify(history.data.orders).includes("4111111111111111"), false);

  const login = await jsonRequest(base, "/api/auth/login", {
    method: "POST",
    body: { email: "ana@example.com", password: "senha-segura-123" }
  });
  assert.equal(login.data.orders[0].reference, data.order.reference);

  const canceled = await jsonRequest(base, `/api/orders/${data.order.reference}/cancel`, {
    method: "POST",
    cookie: account.cookie
  });
  assert.equal(canceled.response.status, 200);
  assert.equal(canceled.data.order.status, "cancelled");
  const cancelAgain = await jsonRequest(base, `/api/orders/${data.order.reference}/cancel`, {
    method: "POST",
    cookie: account.cookie
  });
  assert.equal(cancelAgain.response.status, 409);

  const savedData = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  assert.equal(savedData.users.find((user) => user.email === "ana@example.com").orders[0].status, "cancelled");
  assert.equal(JSON.stringify(savedData).includes("4111111111111111"), false);
});

test("rejects unknown coupons and discounts below their minimum purchase", async (t) => {
  const { base } = await startTestServer(t);
  const account = await jsonRequest(base, "/api/auth/register", {
    method: "POST",
    body: { name: "Ana", email: "ana@example.com", password: "senha-segura-123" }
  });
  const body = {
    name: "Ana",
    address: "Rua das Flores, 10",
    city: "São Paulo",
    cart: [{ id: "banana", quantity: 1 }]
  };
  const invalid = await jsonRequest(base, "/api/checkout-demo", {
    method: "POST", cookie: account.cookie, body: { ...body, couponCode: "INVENTADO" }
  });
  const belowMinimum = await jsonRequest(base, "/api/checkout-demo", {
    method: "POST", cookie: account.cookie, body: { ...body, couponCode: "VILA10" }
  });
  assert.equal(invalid.response.status, 400);
  assert.match(invalid.data.error, /Cupom não encontrado/);
  assert.equal(belowMinimum.response.status, 400);
  assert.match(belowMinimum.data.error, /a partir de/);
});

test("validates the newsletter and support forms", async (t) => {
  const { base } = await startTestServer(t);
  const badEmail = await jsonRequest(base, "/api/newsletter", { method: "POST", body: { email: "ruim" } });
  const ticket = await jsonRequest(base, "/api/support", {
    method: "POST",
    body: { name: "Ana", email: "ana@example.com", message: "Preciso de ajuda, por favor." }
  });
  assert.equal(badEmail.response.status, 400);
  assert.equal(ticket.response.status, 201);
});
