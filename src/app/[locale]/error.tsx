"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const strings = {
  ar: { title: "حدث خطأ غير متوقع", body: "يرجى المحاولة مرة أخرى. إذا استمرت المشكلة تواصل معنا.", retry: "حاول مرة أخرى", home: "العودة إلى الرئيسية" },
  en: { title: "Something went wrong", body: "Please try again. If the problem continues, contact us.", retry: "Try again", home: "Back to home" },
};

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ locale?: string }>();
  const locale = params.locale === "en" ? "en" : "ar";
  const s = strings[locale];
  useEffect(() => {
    // Only the digest is logged client-side; details stay in server logs.
    if (error.digest) console.error("error digest", error.digest);
  }, [error]);
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-20 text-center" role="alert">
      <h1 className="text-2xl font-extrabold">{s.title}</h1>
      <p className="text-fg-muted">{s.body}</p>
      <div className="flex gap-2">
        <Button onClick={reset}>{s.retry}</Button>
        <a href={`/${locale}`} className="inline-flex h-11 items-center rounded-xl px-4 font-semibold hover:bg-muted">{s.home}</a>
      </div>
    </div>
  );
}
