import type { Dictionary } from "@/lib/i18n";

/** Flat message map for <ActionForm>: error codes + success messages. */
export function adminMessages(t: Dictionary): Record<string, string> {
  return {
    ...t.errors,
    saved: t.common.saved,
    deactivated: t.admin.productsPage.deactivated,
    hasProducts: t.admin.categoriesPage.hasProducts,
    invalidCredentials: t.auth.invalidCredentials,
  };
}

export function AdminTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-fg-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
