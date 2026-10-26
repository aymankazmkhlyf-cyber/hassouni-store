import Link from "next/link";

/**
 * Renders chat text safely (React escapes everything). Only automatic replies get
 * clickable links, and only to this site's own pages, so nobody can inject phishing links.
 */
export function MessageBody({ body, linkify }: { body: string; linkify: boolean }) {
  if (!linkify) return <span className="whitespace-pre-line break-words">{body}</span>;
  const parts = body.split(/(\/(?:ar|en)\/[\w\-/]*)/g);
  return (
    <span className="whitespace-pre-line break-words">
      {parts.map((part, i) =>
        /^\/(ar|en)\//.test(part) ? (
          <Link key={i} href={part} className="font-semibold underline underline-offset-2" dir="ltr">
            {part}
          </Link>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

export type ChatMessage = { id: number; sender: "customer" | "staff" | "bot"; body: string; createdAt: string };

export function timeOf(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-IQ-u-nu-latn" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baghdad" }).format(new Date(iso));
}
