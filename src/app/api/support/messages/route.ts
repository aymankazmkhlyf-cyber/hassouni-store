import { cookies } from "next/headers";
import { getThreadByToken, listMessages, markReadByCustomer, SUPPORT_COOKIE } from "@/lib/services/support";

export const dynamic = "force-dynamic";

/** Customer poll: only the conversation bound to the visitor's own httpOnly cookie is readable. */
export async function GET(req: Request) {
  const thread = await getThreadByToken((await cookies()).get(SUPPORT_COOKIE)?.value);
  const headers = { "Cache-Control": "private, no-store" };
  if (!thread) return Response.json({ thread: false }, { headers });
  const url = new URL(req.url);
  const after = Math.max(0, Number(url.searchParams.get("after")) || 0);
  const read = url.searchParams.get("read") === "1";
  const messages = read || after > 0 ? await listMessages(thread.id, after) : [];
  if (read) await markReadByCustomer(thread.id);
  return Response.json(
    { thread: true, name: thread.name, unread: read ? 0 : thread.unreadForCustomer, messages: read ? messages : [] },
    { headers },
  );
}
