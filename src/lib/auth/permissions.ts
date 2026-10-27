import type { UserRole } from "@/lib/db/schema";

export type Permission =
  | "dashboard:view"
  | "orders:read"
  | "orders:update"
  | "orders:export"
  | "payments:review"
  | "products:write"
  | "categories:write"
  | "payment_methods:write"
  | "settings:write"
  | "customers:read"
  | "customers:write"
  | "requests:manage"
  | "audit:read"
  | "support:manage"
  | "reviews:manage";

const STAFF: readonly Permission[] = [
  "dashboard:view",
  "orders:read",
  "orders:update",
  "payments:review",
  "customers:read",
  "requests:manage",
  "support:manage",
  "reviews:manage",
];

const ADMIN: readonly Permission[] = [
  ...STAFF,
  "orders:export",
  "products:write",
  "categories:write",
  "payment_methods:write",
  "settings:write",
  "customers:write",
  "audit:read",
];

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = { customer: [], staff: STAFF, admin: ADMIN };

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function isStaffRole(role: UserRole): boolean {
  return role === "staff" || role === "admin";
}
