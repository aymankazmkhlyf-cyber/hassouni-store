import { count, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { categories, orders, priceTiers, productPackages, products, sessions, users } from "@/lib/db/schema";
import { getActiveCategoryBySlug, getProductDetail, listCategories, listProducts } from "@/lib/services/catalog";
import { deleteCategory, deleteProduct, moveCategory, saveCategory, saveProduct } from "@/lib/services/admin-catalog";
import { anonymizeCustomer, authenticate, registerCustomer, runRetention, setCustomerStatus } from "@/lib/services/accounts";
import { createSession, validateSessionToken } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/services/rate-limit";
import { createOrder, transitionOrder } from "@/lib/services/orders";
import { loadSettings, saveSettings } from "@/lib/services/settings";
import { productSchema } from "@/lib/validation/schemas";
import { seed } from "../../scripts/seed";
import { checkoutInput, hasDb, makeUser } from "./helpers";

describe.skipIf(!hasDb)("catalog", () => {
  it("lists the six seeded categories in order", async () => {
    const cats = await listCategories({ activeOnly: true });
    expect(cats.map((c) => c.slug)).toEqual(["social-media", "gaming", "subscriptions", "design", "accounts-numbers", "custom"]);
    expect(cats.find((c) => c.slug === "gaming")!.productCount).toBe(2);
  });

  it("filters by category and marks every seeded product as a sample", async () => {
    const gaming = (await getActiveCategoryBySlug("gaming"))!;
    const res = await listProducts({ categoryId: gaming.id });
    expect(res.items.map((p) => p.slug).sort()).toEqual(["free-fire-diamonds", "pubg-mobile-uc"]);
    expect(res.items.every((p) => p.isSample)).toBe(true);
  });

  it("computes correct 'from' prices (packages, tiers) in SQL", async () => {
    const all = await listProducts({ pageSize: 48 });
    const price = (slug: string) => all.items.find((p) => p.slug === slug)!.startingPrice;
    expect(price("pubg-mobile-uc")).toBe(1500);
    expect(price("instagram-likes")).toBe(100 * 10); // min qty 100 is below the first tier (1000)
    expect(price("tiktok-views")).toBe(1000 * 2);
    // A tier at exactly the minimum quantity applies.
    const likes = all.items.find((p) => p.slug === "instagram-likes")!;
    await db.insert(priceTiers).values({ productId: likes.id, minQuantity: 100, unitPrice: 9 });
    try {
      const again = await listProducts({ q: "instagram likes" });
      expect(again.items[0]!.startingPrice).toBe(900);
    } finally {
      await db.delete(priceTiers).where(eq(priceTiers.minQuantity, 100));
    }
  });

  it("only flags genuine configured discounts as offers", async () => {
    const offers = await listProducts({ offersOnly: true });
    expect(offers.items.map((p) => p.slug)).toEqual(["instagram-followers"]);
  });

  it("sorts by price and paginates", async () => {
    const asc = await listProducts({ sort: "price_asc", pageSize: 48 });
    const prices = asc.items.map((p) => p.startingPrice ?? Infinity);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    const page1 = await listProducts({ pageSize: 4, page: 1 });
    const page2 = await listProducts({ pageSize: 4, page: 2 });
    expect(page1.pages).toBe(Math.ceil(page1.total / 4));
    expect(page1.items.map((p) => p.id)).not.toEqual(page2.items.map((p) => p.id));
  });

  it("searches Arabic and English names", async () => {
    expect((await listProducts({ q: "شدات" })).items.map((p) => p.slug)).toEqual(["pubg-mobile-uc"]);
    expect((await listProducts({ q: "poster" })).items.map((p) => p.slug)).toEqual(["poster-design"]);
    expect((await listProducts({ q: "zzzz-none" })).total).toBe(0);
  });

  it("hides products of inactive categories from the storefront", async () => {
    const cat = (await getActiveCategoryBySlug("subscriptions"))!;
    await db.update(categories).set({ isActive: false }).where(eq(categories.id, cat.id));
    try {
      expect(await getActiveCategoryBySlug("subscriptions")).toBeUndefined();
      expect(await getProductDetail("music-app-subscription")).toBeNull();
      expect((await listProducts({ q: "music" })).total).toBe(0);
    } finally {
      await db.update(categories).set({ isActive: true }).where(eq(categories.id, cat.id));
    }
  });
});

const productForm = (over: Record<string, string> = {}) =>
  productSchema.parse({
    categoryId: "0",
    slug: "test-product",
    nameAr: "منتج اختبار",
    nameEn: "Test product",
    pricingMode: "package",
    unitPrice: "",
    compareAtPrice: "",
    minQuantity: "1",
    maxQuantity: "",
    isActive: "on",
    packages: "باقة 1 | Pack 1 | 1000\nباقة 2 | Pack 2 | 2500 | 3000",
    tiers: "",
    fields: "player_id | رقم اللاعب | Player ID | number | required",
    ...over,
  });

describe.skipIf(!hasDb)("admin catalog management", () => {
  it("creates and edits a product with packages and fields; edits keep package ids", async () => {
    const admin = await makeUser("admin");
    const gaming = (await getActiveCategoryBySlug("gaming"))!;
    const created = await saveProduct(null, productForm({ categoryId: String(gaming.id) }), { fileId: null, remove: false }, admin);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const p1 = await db.query.products.findFirst({ where: eq(products.id, created.id), with: { packages: true, fields: true } });
    expect(p1!.packages.map((p) => p.price).sort()).toEqual([1000, 2500]);
    expect(p1!.fields.map((f) => f.key)).toEqual(["player_id"]);
    const ids = p1!.packages.map((p) => p.id).sort();

    const edited = await saveProduct(created.id, productForm({ categoryId: String(gaming.id), nameEn: "Edited", packages: "باقة 1 | Pack 1 | 1200\nباقة 2 | Pack 2 | 2500" }), { fileId: null, remove: false }, admin);
    expect(edited.ok).toBe(true);
    const p2 = await db.query.products.findFirst({ where: eq(products.id, created.id), with: { packages: true } });
    expect(p2!.nameEn).toBe("Edited");
    expect(p2!.packages.map((p) => p.id).sort()).toEqual(ids);
    expect(p2!.packages.find((p) => p.labelEn === "Pack 1")!.price).toBe(1200);

    const clash = await saveProduct(null, productForm({ categoryId: String(gaming.id) }), { fileId: null, remove: false }, admin);
    expect(clash).toEqual({ ok: false, error: { field: "slug", reason: "taken" } });
    const forbidden = await saveProduct(created.id, productForm({ categoryId: String(gaming.id), fields: "pass | كلمة المرور | Password | text | required" }), { fileId: null, remove: false }, admin);
    expect(forbidden).toMatchObject({ ok: false, error: { field: "fields", reason: "forbidden" } });

    expect(await deleteProduct(created.id, admin)).toBe("deleted");
  });

  it("deactivates instead of deleting a product that has orders", async () => {
    const admin = await makeUser("admin");
    const res = await createOrder(await checkoutInput(), { userId: null });
    const [item] = await db.query.orderItems.findMany({ where: (t, { eq }) => eq(t.orderId, res.orderId) });
    expect(await deleteProduct(item!.productId!, admin)).toBe("deactivated");
    const p = await db.query.products.findFirst({ where: eq(products.id, item!.productId!) });
    expect(p!.isActive).toBe(false);
    await db.update(products).set({ isActive: true, isFeatured: true }).where(eq(products.id, p!.id));
  });

  it("manages categories: create, rename, reorder, refuse deleting non-empty", async () => {
    const admin = await makeUser("admin");
    const created = await saveCategory(null, { slug: "temp-cat", nameAr: "مؤقت", nameEn: "Temp", descriptionAr: "", descriptionEn: "", icon: "spark", sortOrder: 999, isActive: true }, admin);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await saveCategory(created.id, { slug: "temp-cat", nameAr: "مؤقت", nameEn: "Renamed", descriptionAr: "", descriptionEn: "", icon: "spark", sortOrder: 999, isActive: true }, admin);
    await moveCategory(created.id, "up", admin);
    const order = (await listCategories()).map((c) => c.slug);
    expect(order.indexOf("temp-cat")).toBe(order.length - 2);
    const gaming = (await getActiveCategoryBySlug("gaming"))!;
    expect(await deleteCategory(gaming.id, admin)).toBe("has_products");
    expect(await deleteCategory(created.id, admin)).toBe("deleted");
    // restore canonical order
    const all = await listCategories();
    const custom = all.find((c) => c.slug === "custom")!;
    if (all.at(-1)!.slug !== "custom") await moveCategory(custom.id, "down", admin);
  });
});

describe.skipIf(!hasDb)("authentication, sessions and permissions", () => {
  it("authenticates with a generic failure for unknown email and wrong password", async () => {
    const u = await makeUser("customer");
    expect(await authenticate(u.email, u.password)).toMatchObject({ ok: true });
    expect(await authenticate(u.email.toUpperCase(), u.password)).toMatchObject({ ok: true });
    expect(await authenticate(u.email, "wrong-password")).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticate("nobody@example.test", "whatever")).toEqual({ ok: false, reason: "invalid" });
  });

  it("stores only hashed passwords and hashed session tokens", async () => {
    const u = await makeUser("customer");
    const row = await db.query.users.findFirst({ where: eq(users.id, u.id) });
    expect(row!.passwordHash.startsWith("$argon2id$")).toBe(true);
    const { token } = await createSession({ id: u.id, role: "customer" }, "vitest");
    const s = await db.select().from(sessions).where(eq(sessions.userId, u.id));
    expect(s[0]!.id).not.toBe(token);
    expect((await validateSessionToken(token))?.id).toBe(u.id);
    expect(await validateSessionToken(token + "x")).toBeNull();
  });

  it("suspension blocks login and invalidates sessions", async () => {
    const admin = await makeUser("admin");
    const u = await makeUser("customer");
    const { token } = await createSession({ id: u.id, role: "customer" }, null);
    await setCustomerStatus(u.id, "suspended", admin);
    expect(await validateSessionToken(token)).toBeNull();
    expect(await authenticate(u.email, u.password)).toEqual({ ok: false, reason: "suspended" });
  });

  it("expired sessions are rejected", async () => {
    const u = await makeUser("admin");
    const { token } = await createSession({ id: u.id, role: "admin" }, null);
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, u.id));
    expect(await validateSessionToken(token)).toBeNull();
  });

  it("registration does not reveal or overwrite existing accounts", async () => {
    const u = await makeUser("admin");
    expect(await registerCustomer({ name: "x", email: u.email, phone: null, password: "another-password" })).toBeNull();
    const row = await db.query.users.findFirst({ where: eq(users.id, u.id) });
    expect(row!.role).toBe("admin");
  });

  it("role permissions: customers have none, staff cannot change settings/products", () => {
    expect(hasPermission("customer", "orders:read")).toBe(false);
    expect(hasPermission("staff", "payments:review")).toBe(true);
    expect(hasPermission("staff", "settings:write")).toBe(false);
    expect(hasPermission("staff", "products:write")).toBe(false);
    expect(hasPermission("staff", "orders:export")).toBe(false);
    expect(hasPermission("admin", "settings:write")).toBe(true);
  });

  it("rate limits after the configured number of attempts", async () => {
    const id = `ip-${Math.random()}`;
    const results = [];
    for (let i = 0; i < RATE_LIMITS.login.limit + 2; i++) results.push(await consumeRateLimit("login", id));
    expect(results.filter(Boolean)).toHaveLength(RATE_LIMITS.login.limit);
    expect(results.at(-1)).toBe(false);
  });
});

describe.skipIf(!hasDb)("privacy", () => {
  it("account erasure scrubs personal data but keeps financial records", async () => {
    const u = await makeUser("customer");
    const res = await createOrder(await checkoutInput({ customerName: "Private Person" }), { userId: u.id });
    await anonymizeCustomer(u.id, null);
    expect(await db.query.users.findFirst({ where: eq(users.id, u.id) })).toBeUndefined();
    const o = await db.query.orders.findFirst({ where: eq(orders.id, res.orderId), with: { items: true } });
    expect(o).toMatchObject({ customerName: "[deleted]", customerPhone: "", userId: null, total: 14000 });
    expect(o!.items[0]!.inputs).toEqual([]);
  });

  it("retention scrubs old finished orders only", async () => {
    const staff = await makeUser("staff");
    const old = await createOrder(await checkoutInput({ customerName: "Old Finished" }), { userId: null });
    const active = await createOrder(await checkoutInput({ customerName: "Old Active" }), { userId: null });
    await transitionOrder(old.orderId, "cancelled", { type: "staff", user: staff });
    const past = new Date(Date.now() - 400 * 24 * 3600 * 1000);
    await db.update(orders).set({ updatedAt: past }).where(eq(orders.id, old.orderId));
    await db.execute(`UPDATE orders SET updated_at = now() - interval '400 days' WHERE id = '${active.orderId}'`);
    await runRetention(365);
    expect((await db.query.orders.findFirst({ where: eq(orders.id, old.orderId) }))!.customerName).toBe("[deleted]");
    expect((await db.query.orders.findFirst({ where: eq(orders.id, active.orderId) }))!.customerName).toBe("Old Active");
  });

  it("settings merge with defaults and include the store contacts", async () => {
    const s = await loadSettings();
    expect(s.whatsapp).toBe("+9647757382822");
    expect(s.telegram).toBe("h_gms");
    expect(s.instagram).toBe("https://www.instagram.com/1q3v_");
    const saved = await saveSettings({ noticeEn: "Hello" });
    expect(saved.noticeEn).toBe("Hello");
    await saveSettings({ noticeEn: "" });
  });
});

describe.skipIf(!hasDb)("seed", () => {
  it("does not re-add products the admin deleted", async () => {
    const admin = await makeUser("admin");
    const p = await db.query.products.findFirst({ where: eq(products.slug, "design-tool-subscription") });
    expect(await deleteProduct(p!.id, admin)).toBe("deleted");
    await seed(process.env.TEST_DATABASE_URL!);
    expect(await db.query.products.findFirst({ where: eq(products.slug, "design-tool-subscription") })).toBeUndefined();
  });

  it("is idempotent and never overwrites admin edits", async () => {
    const before = await Promise.all([db.select({ n: count() }).from(products), db.select({ n: count() }).from(productPackages), db.select({ n: count() }).from(categories)]);
    await db.update(products).set({ nameEn: "Admin edited" }).where(eq(products.slug, "poster-design"));
    await seed(process.env.TEST_DATABASE_URL!);
    const after = await Promise.all([db.select({ n: count() }).from(products), db.select({ n: count() }).from(productPackages), db.select({ n: count() }).from(categories)]);
    expect(after.map((r) => r[0]!.n)).toEqual(before.map((r) => r[0]!.n));
    expect((await db.query.products.findFirst({ where: eq(products.slug, "poster-design") }))!.nameEn).toBe("Admin edited");
  });
});
