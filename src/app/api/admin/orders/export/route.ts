import { assertPermission, AuthError } from "@/lib/auth/current-user";
import { toCsv } from "@/lib/domain/csv";
import { exportOrders } from "@/lib/services/admin-orders";
import { audit } from "@/lib/services/audit";
import { parseOrderFilters } from "@/components/admin/order-filters";

/** CSV export of orders (admin only). Contains customer contact data, so it is audited and never cached. */
export async function GET(req: Request) {
  let user;
  try {
    user = await assertPermission("orders:export");
  } catch (e) {
    if (e instanceof AuthError) return new Response("Not found", { status: 404 });
    throw e;
  }
  const filters = parseOrderFilters(new URL(req.url).searchParams);
  const rows = await exportOrders(filters);
  await audit({ id: user.id, email: user.email, role: user.role }, "orders.export", "order", null, { count: rows.length, filters: { ...filters, q: filters.q ? "[redacted]" : undefined } });

  const csv = toCsv(
    ["reference", "created_at_utc", "status", "payment_status", "payment_method", "total_iqd", "items", "customer_name", "customer_phone", "customer_email"],
    rows.map((r) => [r.reference, r.createdAt, r.status, r.paymentStatus ?? "", r.paymentMethod, r.total, r.items, r.customerName, r.customerPhone, r.customerEmail ?? ""]),
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
