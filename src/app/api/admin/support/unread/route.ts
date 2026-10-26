import { assertPermission } from "@/lib/auth/current-user";
import { staffUnreadCount } from "@/lib/services/support";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await assertPermission("support:manage");
  } catch {
    return new Response("Not found", { status: 404 });
  }
  return Response.json({ unread: await staffUnreadCount() }, { headers: { "Cache-Control": "private, no-store" } });
}
