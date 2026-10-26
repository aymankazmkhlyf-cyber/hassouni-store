"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { clientIp } from "@/lib/server/request";
import { createCustomRequest } from "@/lib/services/custom-requests";
import { consumeRateLimit } from "@/lib/services/rate-limit";
import { customRequestSchema, fieldErrors } from "@/lib/validation/schemas";
import type { ActionState } from "./types";

export async function customRequestAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = customRequestSchema.safeParse({
    name: fd.get("name") ?? "",
    phone: fd.get("phone") ?? "",
    email: fd.get("email") ?? "",
    serviceType: fd.get("serviceType") ?? "",
    description: fd.get("description") ?? "",
    quantity: fd.get("quantity") ?? "",
    budget: fd.get("budget") ?? "",
    referenceUrl: fd.get("referenceUrl") ?? "",
    notes: fd.get("notes") ?? "",
  });
  if (!parsed.success) return { error: "validation", fieldErrors: fieldErrors(parsed.error) };
  if (!(await consumeRateLimit("customRequest", await clientIp()))) return { error: "rateLimited" };
  const user = await getCurrentUser();
  const reference = await createCustomRequest(parsed.data, user?.id ?? null);
  return { ok: true, data: { reference } };
}
