/**
 * End-to-end smoke test (copy of tests/e2e/smoke.mjs adapted to the current catalog) for the PHP site.
 *
 *   npm run build && npm start &          # with a migrated + seeded DATABASE_URL
 *   E2E_ADMIN_EMAIL=.. E2E_ADMIN_PASSWORD=.. npm run test:e2e
 *
 * Optional: E2E_BASE_URL, E2E_SCREENSHOTS=<dir> to save screenshots.
 * Uses the Playwright package available in the environment (require('playwright')).
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const require = createRequire("/home/user/hassouni-store/package.json");
const { chromium } = require("playwright");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.E2E_SCREENSHOTS;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};

const steps = [];
const step = async (name, fn) => {
  try {
    await fn();
    steps.push(`✓ ${name}`);
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}\n  ${e instanceof Error ? e.message : e}`);
    throw e;
  }
};

const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "ar-IQ", permissions: ["notifications"] });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/favicon|404|ERR_INTERNET_DISCONNECTED/.test(m.text()) && errors.push(m.text()));

  await step("root redirects to Arabic RTL home", async () => {
    await page.goto(BASE + "/");
    assert.match(page.url(), /\/ar$/);
    assert.equal(await page.getAttribute("html", "dir"), "rtl");
    assert.equal(await page.getAttribute("html", "lang"), "ar");
    await shot(page, "01-home-ar-mobile");
  });

  await step("language switch keeps the page and flips to LTR", async () => {
    await page.goto(BASE + "/ar/services?sort=price_asc");
    await page.getByRole("link", { name: "تغيير اللغة إلى الإنجليزية" }).click();
    await page.waitForURL(/\/en\/services\?sort=price_asc/);
    assert.equal(await page.getAttribute("html", "dir"), "ltr");
    await page.getByRole("heading", { level: 1, name: "All services" }).waitFor();
    await shot(page, "02-services-en");
    await page.getByRole("link", { name: "Switch language to Arabic" }).click();
    await page.waitForURL(/\/ar\/services/);
  });

  await step("category navigation lists gaming products", async () => {
    await page.goto(BASE + "/ar/category/gaming");
    await page.getByRole("link", { name: "شدات ببجي موبايل (UC)" }).click();
    await page.waitForURL(/\/ar\/services\/pubg-mobile-uc/);
  });

  await step("required player ID is enforced before adding to cart", async () => {
    await page.getByText("24 شدة", { exact: true }).click();
    await page.getByRole("button", { name: "أضف إلى السلة" }).click();
    await page.getByText("الحقل «رقم اللاعب (Player ID)» مطلوب.").waitFor();
    await page.getByLabel("رقم اللاعب (Player ID)").fill("5123456789");
    await page.getByRole("button", { name: "أضف إلى السلة" }).click();
    const popup = page.getByTestId("cart-added-popup");
    await popup.getByText("تمت الإضافة إلى السلة").waitFor();
    await popup.getByText("5123456789").waitFor();
    await page.getByRole("link", { name: "السلة (1)" }).waitFor();
    await shot(page, "03-product-added");
  });

  await step("added-to-cart popup can undo a mistaken add", async () => {
    const popup = page.getByTestId("cart-added-popup");
    await popup.getByRole("button", { name: "تراجع عن الإضافة" }).click();
    await popup.getByText("تم التراجع وأُزيلت الإضافة من السلة.").waitFor();
    await page.getByRole("link", { name: "السلة", exact: true }).waitFor();
    await page.getByRole("button", { name: "أضف إلى السلة" }).click();
    await popup.getByText("تمت الإضافة إلى السلة").waitFor();
    await popup.getByRole("button", { name: "متابعة التسوق" }).click();
    await popup.waitFor({ state: "detached" });
    await page.getByRole("link", { name: "السلة (1)" }).waitFor();
  });

  await step("cart shows server-calculated total and survives reload", async () => {
    await page.goto(BASE + "/ar/cart");
    await page.getByText("1,000 د.ع").first().waitFor();
    await page.reload();
    await page.getByText("1,000 د.ع").first().waitFor();
    await shot(page, "04-cart");
  });

  let orderUrl = "";
  await step("checkout validates and creates an order", async () => {
    await page.getByRole("link", { name: "إتمام الطلب" }).click();
    await page.waitForURL(/\/ar\/checkout/);
    await page.getByLabel("الاسم الكامل").fill("زبون تجريبي");
    await page.getByLabel("رقم الهاتف").fill("0770 123 4567");
    await page.getByText("المجموع الكلي").waitFor();
    // Submit without accepting terms -> error, input preserved
    await page.getByRole("button", { name: "تأكيد الطلب" }).click();
    await page.getByText("يجب الموافقة على الشروط.").first().waitFor();
    assert.equal(await page.getByLabel("الاسم الكامل").inputValue(), "زبون تجريبي");
    await page.getByRole("checkbox").check();
    await shot(page, "05-checkout");
    await page.getByRole("button", { name: "تأكيد الطلب" }).click();
    await page.waitForURL(/\/ar\/orders\/HDS-[0-9A-Z-]+\?key=[0-9A-Z]+&new=1/, { timeout: 20000 });
    orderUrl = page.url();
    await page.getByText("تم استلام طلبك").waitFor();
    await page.getByText("بانتظار الدفع").first().waitFor();
    // Pending orders offer status notifications on this device.
    // (Headless Chromium always reports notification permission as denied, so either state is accepted.)
    const notify = page.getByTestId("order-notify");
    await notify.getByRole("button", { name: "فعّل إشعارات هذا الطلب" }).or(notify.getByText("المتصفح يمنع الإشعارات")).waitFor();
    await shot(page, "06-order-confirmation");
  });

  await step("cart is emptied after the order", async () => {
    await page.goto(BASE + "/ar/cart");
    await page.getByText("سلتك فارغة.").waitFor();
  });

  const reference = new URL(orderUrl).pathname.split("/").pop();
  const key = new URL(orderUrl).searchParams.get("key");

  await step("order is not visible with the reference alone or a wrong key", async () => {
    const anon = await browser.newContext();
    const p2 = await anon.newPage();
    await p2.goto(`${BASE}/ar/orders/${reference}`);
    await p2.getByText("لم يتم العثور على الطلب").waitFor();
    await p2.goto(`${BASE}/ar/orders/${reference}?key=AAAAAAAAAAAAAAAAAAAAAAAA`);
    await p2.getByText("لم يتم العثور على الطلب").waitFor();
    await anon.close();
  });

  await step("track form opens the order with reference + key", async () => {
    await page.goto(BASE + "/ar/track");
    await page.getByLabel("رقم الطلب").fill(reference);
    await page.getByLabel("رمز الوصول").fill(key);
    await page.getByRole("button", { name: "عرض الطلب" }).click();
    await page.waitForURL(new RegExp(`/ar/orders/${reference}`));
  });

  await step("customer submits a payment reference (order goes to review, not paid)", async () => {
    await page.goto(orderUrl.replace("&new=1", ""));
    await page.getByLabel("رقم العملية / المرجع").fill("ZC-998877");
    await page.getByRole("button", { name: "إرسال للمراجعة" }).click();
    await page.getByText("تم استلام إثبات الدفع").first().waitFor();
    await page.reload();
    await page.getByText("الدفع قيد المراجعة").first().waitFor();
    await shot(page, "07-order-under-review");
  });

  await step("support link carries only the reference, URL-encoded", async () => {
    const href = await page.locator('a[href^="https://wa.me/9647757382822?text="]').first().getAttribute("href");
    assert.ok(href.includes(encodeURIComponent(reference)));
    assert.ok(!href.includes(key), "access key must not leak into the message");
  });

  await step("admin area requires login", async () => {
    const anon = await browser.newContext();
    const p2 = await anon.newPage();
    await p2.goto(BASE + "/ar/admin/orders");
    await p2.waitForURL(/\/ar\/admin\/login/);
    const res = await p2.request.get(BASE + "/api/admin/orders/export");
    assert.equal(res.status(), 404);
    await anon.close();
  });

  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const admin = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const ap = await admin.newPage();
    ap.on("pageerror", (e) => errors.push(String(e)));
    await step("admin rejects wrong password with a generic message", async () => {
      await ap.goto(BASE + "/ar/admin/login");
      await ap.getByLabel("البريد الإلكتروني").fill(ADMIN_EMAIL);
      await ap.getByLabel("كلمة المرور").fill("wrong-password-123");
      await ap.getByRole("button", { name: "دخول" }).click();
      await ap.getByText("البريد الإلكتروني أو كلمة المرور غير صحيحة.").waitFor();
    });
    await step("admin logs in and sees the order awaiting verification", async () => {
      await ap.getByLabel("كلمة المرور").fill(ADMIN_PASSWORD);
      await ap.getByRole("button", { name: "دخول" }).click();
      await ap.waitForURL(/\/ar\/admin$/);
      await shot(ap, "08-admin-dashboard");
      await ap.goto(`${BASE}/ar/admin/orders?q=${reference}`);
      await ap.getByRole("link", { name: reference }).click();
      await ap.getByText("ZC-998877").waitFor();
    });
    await step("admin confirms payment -> order becomes paid, then completed", async () => {
      ap.on("dialog", (d) => d.accept());
      await ap.getByRole("button", { name: "تأكيد الدفع" }).click();
      await ap.getByText("مدفوع").first().waitFor();
      await ap.reload();
      await ap.getByLabel("الحالة الجديدة").selectOption("completed");
      await ap.getByRole("button", { name: "تطبيق" }).click();
      await ap.waitForTimeout(800);
      await ap.reload();
      await ap.getByText("هذه الحالة").or(ap.getByLabel("الحالة الجديدة")).first().waitFor();
      await shot(ap, "09-admin-order");
    });
    await step("customer now sees the order as completed", async () => {
      await page.goto(orderUrl.replace("&new=1", ""));
      await page.getByText("مكتمل").first().waitFor();
      assert.equal(await page.getByTestId("order-notify").count(), 0, "no notification offer once delivered");
    });
    await step("customer posts a verified review from the completed order", async () => {
      const form = page.locator('[data-testid^="review-form-"]').first();
      await form.getByRole("button", { name: "انشر التقييم" }).click();
      await form.getByText("اختر عدد النجوم.").waitFor();
      await form.getByLabel("4 من 5 نجوم").check({ force: true });
      await form.getByLabel("تعليقك (اختياري)").fill("وصلت الشدات خلال دقائق، شكراً");
      assert.equal(await form.getByLabel("الاسم الظاهر").inputValue(), "زبون");
      await form.getByRole("button", { name: "انشر التقييم" }).click();
      await form.getByText("شكراً! تم نشر تقييمك.").waitFor();
      await shot(page, "09b-order-review");
    });
    await step("review shows on the product page and home page with the verified badge", async () => {
      await page.goto(BASE + "/ar/services/pubg-mobile-uc");
      const section = page.locator("#reviews");
      await section.getByText("وصلت الشدات خلال دقائق، شكراً").waitFor();
      await section.getByText("مشتري موثّق").first().waitFor();
      await page.getByRole("link", { name: /4\.0/ }).first().waitFor();
      await page.goto(BASE + "/ar");
      await page.getByText("آراء زبائننا").waitFor();
      await page.getByText("وصلت الشدات خلال دقائق، شكراً").waitFor();
    });
    await step("admin can reply to and hide a review", async () => {
      await ap.goto(BASE + "/ar/admin/reviews");
      const card = ap.locator('[data-testid^="admin-review-"]').filter({ hasText: "وصلت الشدات خلال دقائق" });
      await card.getByLabel("رد المتجر (يظهر للعامة)").fill("شكراً لثقتك 🌷");
      await card.getByRole("button", { name: "حفظ الرد" }).click();
      await card.getByText("تم الحفظ").first().waitFor();
      await shot(ap, "09c-admin-reviews");
      await page.goto(BASE + "/ar/services/pubg-mobile-uc");
      await page.locator("#reviews").getByText("شكراً لثقتك 🌷").waitFor();
      await card.getByLabel("سبب الإخفاء (يظهر لكم فقط)").fill("اختبار");
      await card.getByRole("button", { name: "إخفاء" }).click();
      await card.getByText("مخفي").first().waitFor();
      await page.reload();
      assert.equal(await page.locator("#reviews").getByText("وصلت الشدات خلال دقائق، شكراً").count(), 0);
    });
    await step("CSV export works for admin", async () => {
      const res = await ap.request.get(`${BASE}/api/admin/orders/export?q=${reference}`);
      assert.equal(res.status(), 200);
      const body = await res.text();
      assert.ok(body.includes(reference));
    });
    await step("admin pages render (EN, desktop)", async () => {
      for (const p of ["products", "products/new", "categories", "payment-methods", "customers", "requests", "settings", "audit", "reviews", "wallet"]) {
        const r = await ap.goto(`${BASE}/en/admin/${p}`);
        assert.equal(r.status(), 200, p);
      }
      await shot(ap, "10-admin-audit-en");
    });
    await admin.close();
  } else {
    console.log("(admin steps skipped: set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD)");
  }

  await step("app files: manifest, service worker and offline page", async () => {
    const manifest = await page.request.get(BASE + "/manifest.webmanifest");
    assert.equal(manifest.status(), 200);
    const m = await manifest.json();
    assert.equal(m.display, "standalone");
    assert.ok(m.shortcuts.length >= 3);
    const sw = await page.request.get(BASE + "/sw.js");
    assert.equal(sw.status(), 200);
    assert.match(sw.headers()["content-type"], /javascript/);
    assert.match(sw.headers()["cache-control"], /no-cache/);
    const offline = await page.request.get(BASE + "/offline.html");
    assert.equal(offline.status(), 200);
    // The store page registers the worker.
    await page.goto(BASE + "/ar");
    await page.waitForFunction(() => navigator.serviceWorker.getRegistration().then((r) => !!r), null, { timeout: 15000 });
  });

  await step("offline navigation shows the offline page", async () => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // now controlled by the worker
    await page.context().setOffline(true);
    try {
      await page.goto(BASE + "/ar/services").catch(() => undefined);
      await page.getByText("لا يوجد اتصال بالإنترنت").waitFor();
      await shot(page, "12-offline");
    } finally {
      await page.context().setOffline(false);
    }
  });

  await step("install button opens install steps", async () => {
    await page.goto(BASE + "/ar");
    await page.getByRole("button", { name: "حمّل التطبيق" }).click();
    await page.getByRole("dialog", { name: "التثبيت على هذا الجهاز" }).waitFor();
    await page.keyboard.press("Escape");
  });

  await step("dark mode toggle applies the dark class", async () => {
    await page.goto(BASE + "/ar");
    await page.getByRole("button", { name: "تبديل الوضع الليلي/النهاري" }).click();
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains("dark")));
    await shot(page, "11-home-dark");
  });

  assert.deepEqual(errors, [], "browser console/page errors");
  console.log(`\nAll ${steps.length} e2e steps passed.`);
} finally {
  await browser.close();
}
