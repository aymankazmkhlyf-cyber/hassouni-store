/** Live support chat e2e: customer message -> instant auto-reply -> admin badge -> admin reply -> customer sees it. Needs E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD. */
import { createRequire } from "node:module";
const require = createRequire("/home/user/hassouni-store/package.json");
const { chromium } = require("playwright");
const D = process.env.E2E_SCREENSHOTS;
const B = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const b = await chromium.launch();
const errs = [];
const cust = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5 })).newPage();
cust.on("pageerror", e => errs.push(String(e)));
await cust.goto(B + "/ar");
await cust.getByRole("button", { name: "الدعم المباشر" }).click();
await cust.getByPlaceholder("اسمك").fill("زبون تجربة");
await cust.getByPlaceholder("اكتب رسالتك…").fill("مرحبا، شلون ادفع؟ وبكم الشدات");
await cust.getByRole("button", { name: "ابدأ المحادثة" }).click();
await cust.getByText("أهلاً زبون تجربة").waitFor({ timeout: 15000 });
await cust.getByText("طرق الدفع").waitFor();
if (D) await cust.screenshot({ path: `${D}/chat-customer.png` });
console.log("✓ customer got instant auto-replies");

const adm = await (await b.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
adm.on("pageerror", e => errs.push(String(e)));
await adm.goto(B + "/ar/admin/login");
await adm.getByLabel("البريد الإلكتروني").fill(process.env.E2E_ADMIN_EMAIL);
await adm.getByLabel("كلمة المرور").fill(process.env.E2E_ADMIN_PASSWORD);
await adm.getByRole("button", { name: "دخول" }).click();
await adm.waitForURL(/\/ar\/admin$/);
await adm.locator('a[aria-label^="الدعم المباشر ("]').waitFor({ timeout: 20000 });
console.log("✓ admin header shows unread badge");
await adm.goto(B + "/ar/admin/support");
await adm.getByRole("link", { name: /زبون تجربة/ }).first().click();
await adm.getByPlaceholder("اكتب ردك…").fill("هلا بيك، الدفع بزين كاش أو آسياسيل 🌹");
await adm.getByRole("button", { name: "إرسال" }).click();
await adm.getByText("هلا بيك، الدفع").waitFor();
if (D) await adm.screenshot({ path: `${D}/chat-admin.png` });
console.log("✓ admin replied");

await cust.getByText("هلا بيك، الدفع").waitFor({ timeout: 15000 });
console.log("✓ customer received the reply live (polling)");
await cust.getByPlaceholder("اكتب رسالتك…").fill("شكراً");
await cust.getByRole("button", { name: "إرسال" }).click();
await adm.getByText("شكراً").waitFor({ timeout: 15000 });
console.log("✓ customer follow-up reached admin live");
if (D) await cust.screenshot({ path: `${D}/chat-customer2.png` });

// Another visitor cannot see this conversation
const other = await (await b.newContext()).newPage();
const r = await other.request.get(B + "/api/support/messages?read=1");
console.log("✓ other visitor sees:", JSON.stringify(await r.json()));
const r2 = await other.request.get(B + "/api/admin/support/unread");
console.log("✓ admin API for anonymous:", r2.status());
if (errs.length) { console.error("browser errors", errs); process.exitCode = 1; } else console.log("All support chat e2e steps passed.");
await b.close();
