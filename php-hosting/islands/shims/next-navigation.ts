/* next/navigation for the PHP site: real page loads instead of client-side routing. */
export function useRouter() {
  return {
    push: (href: string) => window.location.assign(href),
    replace: (href: string) => window.location.replace(href),
    refresh: () => window.location.reload(),
    back: () => window.history.back(),
    prefetch: () => undefined,
  };
}
export function usePathname(): string {
  return window.location.pathname;
}
export function useSearchParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}
export function useParams<T extends Record<string, string>>(): T {
  const [, locale] = window.location.pathname.split("/");
  return { locale } as unknown as T;
}
export function redirect(href: string): never {
  window.location.assign(href);
  throw new Error("redirect");
}
export function notFound(): never {
  throw new Error("not found");
}
