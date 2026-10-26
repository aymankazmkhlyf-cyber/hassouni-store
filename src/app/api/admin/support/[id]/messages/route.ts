import { assertPermission } from "@/lib/auth/current-user";
import { getThread, listMessages, markReadByStaff } from "@/lib/services/support";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await assertPermission("support:manage");
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const { id } = await ctx.params;
  const thread = await getThread(id);
  if (!thread) return new Response("Not found", { status: 404 });
  const after = Math.max(0, Number(new URL(req.url).searchParams.get("after")) || 0);
  const messages = await listMessages(thread.id, after);
  if (messages.length) await markReadByStaff(thread.id);
  return Response.json({ messages }, { headers: { "Cache-Control": "private, no-store" } });
}
