# متجر حسوني لخدمات السوشل ميديا — Hassouni Digital Services

A bilingual (Arabic RTL by default, English LTR), mobile-first e-commerce store for digital services in Iraq.
It's a full-stack Next.js app backed by PostgreSQL. Features: catalog with packages, quantity pricing and per-product customer fields; a persistent cart; server-priced checkout; a manual payment-verification workflow (Zain Cash, AsiaCell, Mastercard via payment link, bank transfer); secure order lookup; customer accounts; and a role-based admin dashboard.

> **All seeded products are samples** (`isSample = true`). Their prices are placeholders, and the storefront labels them “منتج تجريبي / Sample product”. Edit or delete them from **Admin → Services** before launch.

---

## 1. Stack and why

| Concern | Choice (pinned version) | Reason |
|---|---|---|
| Framework | **Next.js 16.4.3** (App Router, Server Actions, `proxy.ts`) + **React 19.3** | Current stable release. Server Components keep DB access and secrets on the server. Runs on Vercel's free tier. |
| Language | **TypeScript 5.9.3**, `strict` + `noUncheckedIndexedAccess` | TS 7 (native compiler) is out, but Next's build-time type checking still relies on the TS 5 JS API. 5.9 is the newest line it supports. |
| Styling | **Tailwind CSS 4.3** with CSS-variable design tokens | Logical properties (`ms-`, `pe-`, `start-`) give correct RTL/LTR from one codebase. Light and dark themes come from swapping the tokens. |
| Database | **PostgreSQL** (tested on 16) via **Drizzle ORM 0.45.4** + `pg` 8.23 | Drizzle 0.45 is the stable line (1.0 is still RC). It gives typed SQL, real migrations and transactions with `SELECT … FOR UPDATE`. |
| Validation | **Zod 4.6** | One set of schemas for every server action. Error messages are translation keys. |
| Passwords | **Argon2id** (`@node-rs/argon2` 2.2, OWASP parameters) | Prebuilt native binaries, no build toolchain needed on the host. |
| Auth | Self-hosted DB sessions (random 256-bit token in an httpOnly cookie, SHA-256 stored) | No third-party auth dependency or extra free-tier account. Sessions can be revoked server-side (logout, suspension, password reset). |
| Tests | **Vitest 5** (unit + integration on real Postgres) and a Playwright browser smoke test | |
| Font | Cairo Variable, self-hosted via `@fontsource-variable/cairo` | Very readable Arabic and Latin. No external font CDN, so the CSP can stay strict. |

## 2. Project layout

```
src/
  proxy.ts                 locale routing, nonce-based CSP, Origin check, no-store on private pages
  app/[locale]/(store)/    storefront pages (home, services, category, product, search, cart,
                           checkout, orders/[reference], track, account, login, register,
                           contact, faq, terms, privacy, refund-policy, custom-request, 404)
  app/[locale]/admin/      (auth)/login and (panel)/… dashboard, orders, products, categories,
                           payment-methods, customers, requests, settings, audit
  app/actions/             server actions (validation → rate limit → auth → service)
  app/api/                 files/[id] (images, protected receipts), admin/orders/export (CSV), health
  lib/domain/              pure business logic: pricing, order-status machine, cart, phone,
                           fields, tokens, contact links, CSV, file signatures, admin parsers
  lib/services/            DB-backed services: catalog, quote, orders, admin-*, accounts,
                           settings, rate-limit, audit, files, custom-requests
  lib/auth/                password hashing, sessions, permissions, page/action guards
  lib/i18n/                ar/en dictionaries (EN is type-checked against AR), FAQ, policy templates
  lib/db/schema.ts         Drizzle schema (constraints, indexes, relations)
  components/ui|store|admin
drizzle/                   SQL migrations
scripts/                   migrate.ts, seed.ts, create-admin.ts, retention.ts
tests/unit|integration|e2e
```

## 3. Local development

Prerequisites: Node ≥ 20.9 (tested on 22) and PostgreSQL ≥ 14.

```bash
npm install
cp .env.example .env            # then fill in DATABASE_URL, APP_SECRET, …
npm run db:migrate              # apply migrations
npm run db:seed                 # categories, sample products, payment methods, settings (idempotent)
npm run admin:create            # first admin (interactive) — see §5
npm run dev                     # http://localhost:3000  → redirects to /ar
```

Commands:

| Command | What it does |
|---|---|
| `npm run build && npm start` | Production build/server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit + integration tests (needs `TEST_DATABASE_URL`; the test DB is **wiped** each run, and its name must contain `test`) |
| `npm run test:e2e` | Browser smoke test against a running server (`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` enable the admin steps) |
| `npm run db:generate` | Create a new migration after editing `schema.ts` |
| `npm run retention:run` | Data-retention scrub + purge of expired sessions and rate-limit rows |

## 4. Deploying on free tiers

A setup that costs nothing to start: **Vercel Hobby** (app) + **Neon Free** or **Supabase Free** (Postgres).
Free tiers have limits and terms that change. Vercel Hobby is officially for non-commercial use, so a real store should plan for Vercel Pro (or Render/Railway) once it sells. Check each provider's current terms before relying on them.

1. Create a Postgres database on Neon or Supabase. Copy the **pooled** connection string with `?sslmode=require`.
2. On your machine, with `DATABASE_URL` pointing at the production DB:
   `npm run db:migrate && npm run db:seed && npm run admin:create`
3. Import the repository into Vercel and set these environment variables: `DATABASE_URL`, `APP_URL` (e.g. `https://your-domain`), `APP_SECRET` (`openssl rand -base64 48`), and `TRUST_PROXY=true`.
   Do **not** set `ADMIN_*` there.
4. Deploy. On every later deploy that changes the schema, run `npm run db:migrate` first (or add it to the build command).
5. Schedule `npm run retention:run` (daily) with a cron service, e.g. GitHub Actions on a schedule with `DATABASE_URL` as a secret.
6. Enable automatic backups / point-in-time restore at your DB provider. Free plans keep only a short history, so take periodic `pg_dump` backups yourself if the data matters.

### Alternative: Render (no phone verification)

Vercel's sign-up asks for SMS verification, which is not available for Iraqi numbers. Render works with just a GitHub login:

1. Create a free Postgres database on **neon.tech** (sign in with GitHub). Keep `region` in `render.yaml` the same as the database region. Copy its connection string.
2. On **render.com** sign in with GitHub → **New → Blueprint** → choose this repository. `render.yaml` configures everything.
3. When prompted, fill in `DATABASE_URL`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`. `APP_SECRET` is generated automatically.
4. The first deploy runs `npm run deploy:build` (migrate → seed → create first admin → build). Remove `ADMIN_PASSWORD` afterwards.

Render's free web services sleep after ~15 minutes without traffic, so the first visit after that takes up to a minute. Upgrade to a paid instance for a live store.

`GET /api/health` returns `{ ok: true }` when the database is reachable.

## 5. First-admin setup (secure bootstrap)

There is **no web endpoint** that creates staff accounts, no default password and no setup page.
Admins are created from a trusted terminal that has database access:

```bash
npm run admin:create                         # prompts for email, name, password (min 12 chars)
npm run admin:create -- --role=staff         # staff: orders, payment review, requests, customers (read)
ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_NAME=… npm run admin:create   # non-interactive
```

Re-running the command with an existing email resets that account's password and signs out its sessions.
Clear `ADMIN_PASSWORD` from your shell history and environment afterwards. Staff log in at `/ar/admin/login`.

| Role | Can do |
|---|---|
| `staff` | Dashboard, view and update orders, confirm or reject payments, manage custom requests, view customers (phones masked in lists) |
| `admin` | Everything staff can, plus services, categories, payment methods, settings and policies, customer suspension and erasure, CSV export, audit log |

Every admin page **and** every server action checks the permission on the server. Hiding links in the UI is only cosmetic.

## 6. Payments — what is and isn't implemented

**No payment gateway is integrated.** All methods are **manual verification**:

1. The customer places an order. The server computes the total from the database.
2. The order page shows the amount and the payee details and instructions configured in **Admin → Payment methods**. Until you enter the wallet number or IBAN there, customers see “payment details will be provided via support”.
3. The customer submits a transaction reference and/or a receipt. Receipts are JPG, PNG, WEBP or PDF up to 5 MB, and the type is checked from the file's magic bytes. The order moves to **payment under review**. This **never** marks it paid.
4. Staff confirm or reject the proof. Confirming moves the order to **paid**. Rejecting sends it back to **pending payment** with a note the customer can see.

- **Mastercard** is disabled in the seed. The intended flow is that staff send an official payment link from a licensed provider. The site never asks for card numbers, CVV, PINs or banking passwords, and has no field to store them.
- Zain Cash and some Iraqi PSPs offer merchant APIs. Integrating one requires a merchant agreement, credentials and a sandbox. Add it as a new service that confirms payments only from a **verified server-side callback**. Don't add it until those exist.
- Receipts are stored in Postgres (`files` table, `bytea`), never under `public/`. They are served only to staff with `payments:review`, with `no-store`, `nosniff` and a sandbox CSP. Unauthorized requests get a 404.

## 7. Orders, lookup and support

- Statuses: `pending_payment → payment_review → paid → processing → completed`, plus `cancelled`, `rejected` and `refunded`. Allowed transitions live in `lib/domain/order-status.ts`. Once money is confirmed, an order can only end as completed or refunded. Every change is written to `order_status_history`, and staff changes also go to `audit_logs`.
- The public reference is random (`HDS-XXXX-XXXX-XX`, 50 bits), never a sequential ID. **Viewing an order requires** either the 120-bit access key shown at checkout (only its SHA-256 is stored; it expires after a year) or being the logged-in owner. Knowing the reference alone reveals nothing. Lookups are rate-limited.
- Duplicate submissions are blocked in three ways. The browser sends a per-attempt idempotency key with a unique DB constraint plus `ON CONFLICT`, so retries and concurrent double-clicks return the same order. The submit button also disables while pending.
- “Contact support about this order” opens WhatsApp with a URL-encoded message that contains only the reference, status, total and item names. The Telegram and Instagram links open the chat or profile. Nothing is sent automatically, and the links work without the apps (they fall back to the website).
- Customers are **not notified automatically**. No SMS, WhatsApp or email provider is configured. The admin order page has a “Message customer on WhatsApp” button with a prepared status message that staff send themselves.

## 7b. Live support chat

- A chat button sits on every storefront page. The first message opens a conversation tied to a random token in an httpOnly cookie (only its SHA-256 is stored), so a visitor can only ever read their own chat.
- **Instant auto-replies**: a welcome with response hours, and one-time keyword answers (payment details, prices, order tracking, PUBG, and a warning never to share passwords). Bot links point only to this site's own pages.
- Staff answer from **Admin → Live support**. The header badge polls every 15 s and can play a sound and show a browser notification. Customers see replies within a few seconds (polling every 4 s while the chat is open, 30 s while closed). No websockets are needed, which keeps it compatible with serverless hosting.
- **Phone alerts via Telegram (optional, free)**: create a bot with @BotFather, set `TELEGRAM_BOT_TOKEN` in the host environment, redeploy, press Start on the bot, then press “Link Telegram” in Admin → Live support. At most one alert per conversation per minute. Without the token, alerts are silently disabled.
- Rate limits: 5 new chats per hour and 20 messages per 10 minutes per IP. Old chats are deleted by `retention:run` after the retention period.

## 8. Security summary

- Server-side validation (Zod) on every action. All SQL is parameterized through Drizzle, and LIKE wildcards in search are escaped.
- Prices and totals are recomputed from the DB in a transaction. Client-sent prices are never read; the schemas don't even accept them.
- Session cookie: `__Host-` prefix in production, plus `httpOnly`, `Secure` and `SameSite=Lax`. Staff sessions last 12 hours, customer sessions 30 days. Sessions are invalidated on logout, suspension and password reset.
- CSRF: Next's Server Action Origin check, plus `proxy.ts` rejecting non-GET requests whose `Origin` doesn't match the host (or is missing, in production), plus SameSite cookies.
- XSS: React escaping everywhere. Admin-editable text is rendered by a tiny Markdown-like renderer that never interprets HTML. The CSP is nonce-based (`script-src 'nonce-…' 'strict-dynamic'`, `frame-ancestors 'none'`, `object-src 'none'`). SVG uploads are refused.
- Rate limits are stored in Postgres, so they hold across serverless instances: login per IP and per account, registration, checkout, order lookup, payment proof and custom requests. Keys are HMACs, so raw IPs are never stored.
- Headers: HSTS (production), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` and COOP. Private pages get `Cache-Control: private, no-store` and `noindex`.
- Product field definitions can't collect passwords, OTPs or card data. Both the admin parser and checkout refuse credential-like keys.
- Logs record error messages only, never request bodies, passwords or tokens. The CSV export neutralizes spreadsheet formulas and is audited.
- Privacy: customers can delete their account, which erases personal data from their orders while keeping the financial records. Admins can do the same. `retention:run` scrubs finished orders after the configured period (default 365 days).

**Limitations that depend on the host:** client IPs for rate limiting are trusted from `x-forwarded-for` only when `TRUST_PROXY=true`, which is correct on Vercel, Render and Cloudflare but must stay `false` if the app is exposed directly. DDoS protection, TLS and DB encryption at rest come from the providers. Postgres-backed rate limits are adequate for a small store; under heavy abuse, put a WAF or edge rate limiter in front.

## 9. Testing

```
tests/unit/          pricing, tiers, status machine, cart, phone, field validation, schemas, i18n parity,
                     RTL/LTR + locale switch paths, contact links, tokens, CSV, file signatures, admin parsers
tests/integration/   real Postgres: order creation + snapshots, server-side repricing, invalid carts,
                     idempotency + concurrent double submit, access-key / owner access control, expiry,
                     payment proof → review → confirm/reject, transition rules + history, revenue stats,
                     admin filters, product/category CRUD, auth + sessions + suspension, permissions,
                     rate limiting, erasure + retention, settings, seed idempotency
tests/e2e/smoke.mjs  browser: Arabic RTL default, language switch, category nav, required fields, cart
                     persistence, checkout, order access control, tracking, payment proof, support link,
                     admin auth + payment confirmation + completion, CSV, admin pages, dark mode
```

At the time of writing: **121 unit/integration tests pass**, the **19-step e2e smoke test passes** with zero browser console errors, and `npm run build` succeeds.

## 10. Before going live — checklist

- [ ] Replace or delete the sample services and set real prices.
- [ ] Enter the real Zain Cash / AsiaCell payee details (or disable those methods). Enable Mastercard or bank transfer only once you have a real process for them.
- [ ] Review the policy templates (terms, privacy, refunds) — ideally with legal advice — in **Admin → Settings**.
- [ ] Check that the contact details (WhatsApp +9647757382822, Telegram @h_gms, Instagram 1q3v_) are correct.
- [ ] Set `APP_URL` and a strong `APP_SECRET`, enable DB backups, and schedule `retention:run`.
- [ ] Offer only lawful, authorized services. Make sure social-media growth services comply with the platforms' terms.
