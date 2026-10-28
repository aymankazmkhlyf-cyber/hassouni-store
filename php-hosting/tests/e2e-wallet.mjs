/**
 * End-to-end: wallet, Super Qi QR, wallet checkout, overlapping-order guard,
 * delivery message, "order again" and guides. Run against a database with the
 * real catalog (migrate + seed + content-updates) and an admin account:
 *
 *   E2E_ADMIN_EMAIL=.. E2E_ADMIN_PASSWORD=.. node tests/e2e/wallet.mjs
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
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error("E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required");
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};
const step = async (name, fn) => {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}\n  ${e instanceof Error ? e.message : e}`);
    throw e;
  }
};

const browser = await chromium.launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "ar-IQ" });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !/favicon|404|ERR_INTERNET_DISCONNECTED/.test(m.text()) && errors.push(m.text()));
const admin = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const ap = await admin.newPage();
ap.on("dialog", (d) => d.accept());

const username = `e2e_${Date.now().toString(36)}`;
const email = `${username}@example.test`;
const playerId = String(Date.now()).slice(-9);

try {
  await step("register with a wallet username", async () => {
    await page.goto(BASE + "/ar/register");
    await page.getByLabel("الاسم").fill("زبون المحفظة");
    await page.getByLabel("اسم المستخدم (معرّف المحفظة)").fill("9bad");
    await page.getByLabel("البريد الإلكتروني").fill(email);
    await page.getByLabel("كلمة المرور").fill("a-strong-e2e-password");
    await page.getByRole("button", { name: "إنشاء الحساب" }).click();
    // The browser blocks the invalid pattern first; the server rejects it too if submitted.
    await page.getByLabel("اسم المستخدم (معرّف المحفظة)").fill(username.toUpperCase());
    await page.getByRole("button", { name: "إنشاء الحساب" }).click();
    await page.waitForURL(/\/ar\/account$/);
    await page.getByTestId("account-wallet").getByText(`@${username}`).waitFor();
  });

  await step("log in with the username instead of the email", async () => {
    const other = await browser.newContext();
    const p2 = await other.newPage();
    await p2.goto(BASE + "/ar/login");
    await p2.getByLabel("البريد الإلكتروني أو اسم المستخدم").fill(username);
    await p2.getByLabel("كلمة المرور").fill("a-strong-e2e-password");
    await p2.getByRole("button", { name: "دخول" }).click();
    await p2.waitForURL(/\/ar\/account$/);
    await other.close();
  });

  await step("wallet top-up shows Super Qi with its QR and sends a request", async () => {
    await page.goto(BASE + "/ar/account/wallet");
    await page.getByTestId("wallet-balance").getByText("0").waitFor();
    const form = page.getByTestId("topup-form");
    await form.getByRole("radio", { name: "كي كارد (سوبر كي)" }).check();
    await form.getByRole("img", { name: "رمز QR للتحويل" }).waitFor();
    await form.getByText("2025988359").first().waitFor();
    await form.getByRole("button", { name: "25,000" }).click();
    await form.getByLabel("رقم العملية / المرجع").fill("SQ-778899");
    await shot(page, "w01-topup");
    await form.getByRole("button", { name: "أرسل طلب الشحن" }).click();
    await page.getByText("تم إرسال طلب الشحن").waitFor();
  });

  await step("admin approves the top-up and the balance appears", async () => {
    await ap.goto(BASE + "/ar/admin/login");
    await ap.getByLabel("البريد الإلكتروني").fill(ADMIN_EMAIL);
    await ap.getByLabel("كلمة المرور").fill(ADMIN_PASSWORD);
    await ap.getByRole("button", { name: "دخول" }).click();
    await ap.waitForURL(/\/ar\/admin$/);
    await ap.goto(BASE + "/ar/admin/wallet");
    const card = ap.locator('[data-testid^="topup-"]').filter({ hasText: "SQ-778899" });
    await card.getByRole("button", { name: "موافقة وإضافة الرصيد" }).click();
    // Approved requests leave the "awaiting review" list.
    await card.waitFor({ state: "detached" });
    await ap.goto(BASE + "/ar/admin/wallet?status=approved");
    await ap.locator('[data-testid^="topup-"]').filter({ hasText: "SQ-778899" }).getByText("تمت الإضافة").waitFor();
    await shot(ap, "w02-admin-wallet");
    await page.reload();
    await page.getByTestId("wallet-balance").getByText("25,000").waitFor();
    await page.getByTestId("wallet-history").getByText("شحن رصيد").waitFor();
  });

  await step("Mobile Legends needs ID + Zone ID and shows the illustrated help", async () => {
    await page.goto(BASE + "/ar/services/mobile-legends-diamonds");
    await page.getByTestId("guide-help").getByText("وين ألكى المعلومات المطلوبة؟").click();
    await page.getByTestId("guide-help").getByText("Zone ID").first().waitFor();
    await page.getByText("172 ألماسة", { exact: true }).click();
    await page.getByLabel("رقم اللاعب (ID)").fill(playerId);
    await page.getByLabel("رقم السيرفر (Zone ID)").fill("2345");
    await page.getByRole("button", { name: "أضف إلى السلة" }).click();
    await page.getByTestId("cart-added-popup").getByText("172 ألماسة").waitFor();
  });

  let orderUrl = "";
  await step("checkout pays instantly from the wallet", async () => {
    await page.goto(BASE + "/ar/checkout");
    await page.getByLabel("رقم الهاتف").fill("0770 555 1234");
    await page.getByRole("radio", { name: /رصيد المحفظة/ }).check();
    await page.getByText("الدفع من المحفظة فوري").waitFor();
    await page.getByRole("checkbox").check();
    await shot(page, "w03-checkout-wallet");
    await page.getByRole("button", { name: "تأكيد الطلب" }).click();
    await page.waitForURL(/\/ar\/orders\/HDS-/, { timeout: 20000 });
    orderUrl = page.url().replace("&new=1", "");
    await page.getByText("مدفوع").first().waitFor();
    assert.equal(await page.getByText("تعليمات الدفع").count(), 0, "no payment step for wallet orders");
    await page.goto(BASE + "/ar/account/wallet");
    await page.getByTestId("wallet-balance").getByText("20,000").waitFor();
  });

  await step("a second identical order is warned about and blocked while the first is in progress", async () => {
    await page.goto(BASE + "/ar/services/mobile-legends-diamonds");
    await page.getByText("172 ألماسة", { exact: true }).click();
    await page.getByLabel("رقم اللاعب (ID)").fill(playerId);
    await page.getByLabel("رقم السيرفر (Zone ID)").fill("2345");
    await page.getByRole("button", { name: "أضف إلى السلة" }).click();
    await page.goto(BASE + "/ar/checkout");
    await page.getByText("عندك طلب قيد التنفيذ").first().waitFor();
    await page.getByLabel("رقم الهاتف").fill("0770 555 1234");
    await page.getByRole("checkbox").check();
    await shot(page, "w04-checkout-warning");
    await page.getByRole("button", { name: "تأكيد الطلب" }).click();
    await page.getByText("انتظر حتى يكتمل ثم اطلب مرة ثانية").waitFor();
    // Keep the cart clean for the next step.
    await page.evaluate(() => localStorage.removeItem("hds_cart_v1"));
  });

  await step("admin writes a delivery message and completes the order", async () => {
    const ref = new URL(orderUrl).pathname.split("/").pop();
    await ap.goto(`${BASE}/ar/admin/orders?q=${ref}`);
    await ap.getByRole("link", { name: ref }).click();
    await ap.getByLabel("رسالة التسليم للزبون").fill("تم الشحن ✅ رقم العملية MLBB-55667");
    await ap.getByLabel("رسالة التسليم للزبون").locator("xpath=ancestor::form").getByRole("button", { name: "حفظ" }).click();
    await ap.getByText("تم الحفظ").first().waitFor();
    await ap.getByLabel("الحالة الجديدة").selectOption("completed");
    await ap.getByRole("button", { name: "تطبيق" }).click();
    await ap.waitForTimeout(800);
  });

  await step("customer sees the delivery message and can order again", async () => {
    await page.goto(orderUrl);
    await page.getByTestId("delivery-note").getByText("MLBB-55667").waitFor();
    await page.getByText("مكتمل").first().waitFor();
    await shot(page, "w05-order-completed");
    await page.getByTestId("reorder").click();
    await page.waitForURL(/\/ar\/cart/);
    await page.getByText("ألماس موبايل ليجندز").first().waitFor();
    await page.getByText("5,000 د.ع").first().waitFor();
  });

  await step("guides are listed, linked and indexable", async () => {
    await page.goto(BASE + "/ar/guides");
    await page.getByRole("heading", { level: 1, name: "الأدلة والشروحات" }).waitFor();
    await page.getByRole("link", { name: /شلون تدفع بسوبر كي/ }).click();
    await page.waitForURL(/\/ar\/guides\/pay-with-super-qi/);
    await page.getByText("2025988359").first().waitFor();
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    assert.equal(JSON.parse(ld)["@type"], "HowTo");
    const sitemap = await (await page.request.get(BASE + "/sitemap.xml")).text();
    assert.ok(sitemap.includes("/ar/guides/pay-with-super-qi"));
    await shot(page, "w06-guide");
  });

  await step("new catalog: gift cards, subscriptions, montage and management are live", async () => {
    for (const slug of ["playstation-gift-card", "shahid-vip", "spotify-premium", "reels-montage", "manage-instagram", "logo-design"]) {
      const r = await page.goto(`${BASE}/ar/services/${slug}`);
      assert.equal(r.status(), 200, slug);
    }
    await page.goto(BASE + "/ar/category/gift-cards");
    await page.getByText("بطاقة بلايستيشن (PSN)").first().waitFor();
  });

  await step("an account with a balance cannot be deleted", async () => {
    await page.goto(BASE + "/ar/account");
    await page.getByLabel("اكتب DELETE للتأكيد").fill("DELETE");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "حذف الحساب" }).click();
    await page.getByText("لا يمكن حذف الحساب وفيه رصيد").waitFor();
  });

  assert.deepEqual(errors, [], "browser console/page errors");
  console.log("All wallet e2e steps passed.");
} finally {
  await browser.close();
}
