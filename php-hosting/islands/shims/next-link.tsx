/* next/link for the PHP site: a plain anchor (full page loads). */
import { forwardRef, type AnchorHTMLAttributes } from "react";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string | { pathname: string }; prefetch?: boolean; replace?: boolean; scroll?: boolean };

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, prefetch: _p, replace: _r, scroll: _s, ...rest }, ref) {
  return <a ref={ref} href={typeof href === "string" ? href : href.pathname} {...rest} />;
});
export default Link;
