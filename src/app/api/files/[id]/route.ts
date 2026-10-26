import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission, isStaffRole } from "@/lib/auth/permissions";
import { readFile } from "@/lib/services/files";

/**
 * Serves DB-stored files.
 * - product images / logo: public, long-lived cache (ids are immutable).
 * - receipts: staff with payments:review only, never cached, sandboxed.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const file = await readFile(id);
  if (!file) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Content-Type": file.mimeType,
    "Content-Length": String(file.size),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  });

  if (file.kind === "receipt") {
    const user = await getCurrentUser();
    if (!user || !isStaffRole(user.role) || !hasPermission(user.role, "payments:review")) {
      // 404 rather than 403 so receipt ids cannot be probed.
      return new Response("Not found", { status: 404 });
    }
    headers.set("Cache-Control", "private, no-store");
    headers.set("Content-Disposition", `${file.mimeType === "application/pdf" ? "attachment" : "inline"}; filename="receipt-${file.id.slice(0, 8)}"`);
  } else {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }
  return new Response(new Uint8Array(file.data), { status: 200, headers });
}
