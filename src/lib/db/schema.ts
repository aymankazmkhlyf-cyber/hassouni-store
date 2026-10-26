import { relations, sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const userRole = pgEnum("user_role", ["customer", "staff", "admin"]);
export const userStatus = pgEnum("user_status", ["active", "suspended"]);

export const orderStatus = pgEnum("order_status", [
  "pending_payment",
  "payment_review",
  "paid",
  "processing",
  "completed",
  "cancelled",
  "rejected",
  "refunded",
]);

export const paymentStatus = pgEnum("payment_status", [
  "awaiting",
  "submitted",
  "confirmed",
  "rejected",
  "refunded",
]);

export const pricingMode = pgEnum("pricing_mode", ["unit", "package"]);

export const fieldType = pgEnum("field_type", ["text", "textarea", "url", "number", "select", "phone"]);

export const fileKind = pgEnum("file_kind", ["product_image", "receipt", "logo"]);

export const requestStatus = pgEnum("request_status", ["new", "in_review", "quoted", "closed"]);

export const historyActor = pgEnum("history_actor", ["customer", "staff", "system"]);

export const supportSender = pgEnum("support_sender", ["customer", "staff", "bot"]);
export const supportStatus = pgEnum("support_status", ["open", "closed"]);

/* ------------------------------------------------------------------ */
/* Users & sessions                                                    */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Always stored lower-cased; uniqueness enforced below.
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("customer"),
    status: userStatus("status").notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email), index("users_role_idx").on(t.role)],
);

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 of the random session token. The raw token only lives in the cookie.
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

/* ------------------------------------------------------------------ */
/* Files (product images, logo, private payment receipts)              */
/* ------------------------------------------------------------------ */

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: fileKind("kind").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    data: bytea("data").notNull(),
    uploadedById: uuid("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("files_kind_idx").on(t.kind), check("files_size_ck", sql`${t.size} > 0 AND ${t.size} <= 5242880`)],
);

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    descriptionAr: text("description_ar").notNull().default(""),
    descriptionEn: text("description_en").notNull().default(""),
    icon: text("icon").notNull().default("spark"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("categories_slug_uq").on(t.slug), index("categories_sort_idx").on(t.sortOrder)],
);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    summaryAr: text("summary_ar").notNull().default(""),
    summaryEn: text("summary_en").notNull().default(""),
    descriptionAr: text("description_ar").notNull().default(""),
    descriptionEn: text("description_en").notNull().default(""),
    icon: text("icon").notNull().default("spark"),
    imageFileId: uuid("image_file_id").references(() => files.id, { onDelete: "set null" }),
    pricingMode: pricingMode("pricing_mode").notNull().default("unit"),
    /** Price of one unit in whole IQD (unit mode). Package mode uses product_packages. */
    unitPrice: integer("unit_price"),
    /** Optional "was" price — only shown when strictly greater than unitPrice. */
    compareAtPrice: integer("compare_at_price"),
    minQuantity: integer("min_quantity").notNull().default(1),
    maxQuantity: integer("max_quantity"),
    deliveryTimeAr: text("delivery_time_ar").notNull().default(""),
    deliveryTimeEn: text("delivery_time_en").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    /** Seeded demo product — the storefront labels it so it is never mistaken for a confirmed offer. */
    isSample: boolean("is_sample").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("products_slug_uq").on(t.slug),
    index("products_category_idx").on(t.categoryId),
    index("products_active_featured_idx").on(t.isActive, t.isFeatured),
    check("products_unit_price_ck", sql`${t.unitPrice} IS NULL OR ${t.unitPrice} >= 0`),
    check("products_qty_ck", sql`${t.minQuantity} >= 1 AND (${t.maxQuantity} IS NULL OR ${t.maxQuantity} >= ${t.minQuantity})`),
    check("products_unit_mode_ck", sql`${t.pricingMode} <> 'unit' OR ${t.unitPrice} IS NOT NULL`),
  ],
);

export const productPackages = pgTable(
  "product_packages",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    labelAr: text("label_ar").notNull(),
    labelEn: text("label_en").notNull(),
    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("packages_product_idx").on(t.productId), check("packages_price_ck", sql`${t.price} >= 0`)],
);

/** Quantity-based pricing: when quantity >= minQuantity, unitPrice applies (highest matching tier wins). */
export const priceTiers = pgTable(
  "price_tiers",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    minQuantity: integer("min_quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
  },
  (t) => [
    uniqueIndex("tiers_product_min_uq").on(t.productId, t.minQuantity),
    check("tiers_ck", sql`${t.minQuantity} >= 1 AND ${t.unitPrice} >= 0`),
  ],
);

export type SelectOption = { value: string; labelAr: string; labelEn: string };

/** Per-product customer inputs (player ID, profile link, design brief, ...). */
export const productFields = pgTable(
  "product_fields",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    labelAr: text("label_ar").notNull(),
    labelEn: text("label_en").notNull(),
    helpAr: text("help_ar").notNull().default(""),
    helpEn: text("help_en").notNull().default(""),
    type: fieldType("type").notNull().default("text"),
    required: boolean("required").notNull().default(true),
    maxLength: integer("max_length").notNull().default(200),
    options: jsonb("options").$type<SelectOption[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("fields_product_key_uq").on(t.productId, t.key)],
);

/* ------------------------------------------------------------------ */
/* Payments configuration                                              */
/* ------------------------------------------------------------------ */

export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    instructionsAr: text("instructions_ar").notNull().default(""),
    instructionsEn: text("instructions_en").notNull().default(""),
    /** Wallet number / IBAN / payee shown to the customer. Empty = "contact support for details". */
    accountDetails: text("account_details").notNull().default(""),
    requiresReference: boolean("requires_reference").notNull().default(true),
    allowsReceipt: boolean("allows_receipt").notNull().default(true),
    isEnabled: boolean("is_enabled").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("payment_methods_code_uq").on(t.code)],
);

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Public, random, non-sequential reference (e.g. HDS-7K2M-Q9XD-4T). */
    reference: text("reference").notNull(),
    /** SHA-256 of the customer access key. */
    accessKeyHash: text("access_key_hash").notNull(),
    accessKeyExpiresAt: timestamp("access_key_expires_at", { withTimezone: true }).notNull(),
    /** Client-generated per checkout attempt; makes double submissions idempotent. */
    idempotencyKey: text("idempotency_key").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    customerNotes: text("customer_notes").notNull().default(""),
    adminNotes: text("admin_notes").notNull().default(""),
    status: orderStatus("status").notNull().default("pending_payment"),
    paymentMethodId: integer("payment_method_id").references(() => paymentMethods.id, { onDelete: "set null" }),
    paymentMethodCode: text("payment_method_code").notNull(),
    paymentMethodNameAr: text("payment_method_name_ar").notNull(),
    paymentMethodNameEn: text("payment_method_name_en").notNull(),
    subtotal: integer("subtotal").notNull(),
    total: integer("total").notNull(),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }).notNull(),
    locale: text("locale").notNull().default("ar"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("orders_reference_uq").on(t.reference),
    uniqueIndex("orders_idempotency_uq").on(t.idempotencyKey),
    index("orders_status_idx").on(t.status),
    index("orders_created_idx").on(t.createdAt),
    index("orders_user_idx").on(t.userId),
    index("orders_phone_idx").on(t.customerPhone),
    check("orders_total_ck", sql`${t.total} >= 0 AND ${t.subtotal} >= 0`),
  ],
);

export type OrderItemInput = { key: string; labelAr: string; labelEn: string; value: string };

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    packageId: integer("package_id").references(() => productPackages.id, { onDelete: "set null" }),
    // Snapshots: history stays accurate when the catalog changes.
    productNameAr: text("product_name_ar").notNull(),
    productNameEn: text("product_name_en").notNull(),
    packageLabelAr: text("package_label_ar"),
    packageLabelEn: text("package_label_en"),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotal: integer("line_total").notNull(),
    inputs: jsonb("inputs").$type<OrderItemInput[]>().notNull().default([]),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    index("order_items_product_idx").on(t.productId),
    check("order_items_ck", sql`${t.quantity} >= 1 AND ${t.unitPrice} >= 0 AND ${t.lineTotal} = ${t.unitPrice} * ${t.quantity}`),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    methodCode: text("method_code").notNull(),
    amount: integer("amount").notNull(),
    status: paymentStatus("status").notNull().default("awaiting"),
    customerReference: text("customer_reference"),
    receiptFileId: uuid("receipt_file_id").references(() => files.id, { onDelete: "set null" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedById: uuid("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    ...timestamps,
  },
  (t) => [index("payments_order_idx").on(t.orderId), index("payments_status_idx").on(t.status)],
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: serial("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatus("from_status"),
    toStatus: orderStatus("to_status").notNull(),
    actorType: historyActor("actor_type").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("status_history_order_idx").on(t.orderId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Custom service requests                                             */
/* ------------------------------------------------------------------ */

export const customRequests = pgTable(
  "custom_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    serviceType: text("service_type").notNull(),
    description: text("description").notNull(),
    quantity: integer("quantity"),
    budget: integer("budget"),
    referenceUrl: text("reference_url"),
    notes: text("notes").notNull().default(""),
    status: requestStatus("status").notNull().default("new"),
    adminNotes: text("admin_notes").notNull().default(""),
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("custom_requests_reference_uq").on(t.reference), index("custom_requests_status_idx").on(t.status)],
);

/* ------------------------------------------------------------------ */
/* Settings, audit, rate limits                                        */
/* ------------------------------------------------------------------ */

export const storeSettings = pgTable("store_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt), index("audit_entity_idx").on(t.entityType, t.entityId)],
);

/** Fixed-window rate-limit counters. Keys are HMACs, never raw IPs/phones. */
export const rateLimits = pgTable(
  "rate_limits",
  {
    bucket: text("bucket").notNull(),
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bucket, t.key] }), index("rate_limits_window_idx").on(t.windowStart)],
);

/* ------------------------------------------------------------------ */
/* Live support chat                                                   */
/* ------------------------------------------------------------------ */

export const supportThreads = pgTable(
  "support_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** SHA-256 of the random token kept in the visitor's httpOnly cookie. */
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    phone: text("phone"),
    locale: text("locale").notNull().default("ar"),
    status: supportStatus("status").notNull().default("open"),
    unreadForStaff: integer("unread_for_staff").notNull().default(0),
    unreadForCustomer: integer("unread_for_customer").notNull().default(0),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("support_threads_token_uq").on(t.tokenHash),
    index("support_threads_last_idx").on(t.lastMessageAt),
    index("support_threads_unread_idx").on(t.unreadForStaff),
  ],
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => supportThreads.id, { onDelete: "cascade" }),
    sender: supportSender("sender").notNull(),
    staffId: uuid("staff_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("support_messages_thread_idx").on(t.threadId, t.id), check("support_messages_len_ck", sql`char_length(${t.body}) BETWEEN 1 AND 2000`)],
);

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const categoriesRelations = relations(categories, ({ many }) => ({ products: many(products) }));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  packages: many(productPackages),
  tiers: many(priceTiers),
  fields: many(productFields),
}));

export const productPackagesRelations = relations(productPackages, ({ one }) => ({
  product: one(products, { fields: [productPackages.productId], references: [products.id] }),
}));
export const priceTiersRelations = relations(priceTiers, ({ one }) => ({
  product: one(products, { fields: [priceTiers.productId], references: [products.id] }),
}));
export const productFieldsRelations = relations(productFields, ({ one }) => ({
  product: one(products, { fields: [productFields.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  payments: many(payments),
  history: many(orderStatusHistory),
}));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));
export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
  reviewer: one(users, { fields: [payments.reviewedById], references: [users.id] }),
}));
export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  order: one(orders, { fields: [orderStatusHistory.orderId], references: [orders.id] }),
  actor: one(users, { fields: [orderStatusHistory.actorId], references: [users.id] }),
}));
export const usersRelations = relations(users, ({ many }) => ({ orders: many(orders) }));

export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductPackage = typeof productPackages.$inferSelect;
export type PriceTier = typeof priceTiers.$inferSelect;
export type ProductField = typeof productFields.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
export type UserRole = (typeof userRole.enumValues)[number];
export type FieldType = (typeof fieldType.enumValues)[number];
export type CustomRequest = typeof customRequests.$inferSelect;
export type RequestStatus = (typeof requestStatus.enumValues)[number];
export type SupportThread = typeof supportThreads.$inferSelect;
export type SupportMessage = typeof supportMessages.$inferSelect;
