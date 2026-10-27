import type { Locale } from "@/lib/i18n/config";
import { formatIQD } from "@/lib/domain/money";
import { CopyButton } from "@/components/ui/copy-button";

export type PaymentMethodInfo = {
  nameAr: string;
  nameEn: string;
  accountDetails: string;
  instructionsAr: string;
  instructionsEn: string;
  qrFileId: string | null;
};

export type PaymentDetailsStrings = {
  amountDue: string;
  payTo: string;
  payToMissing: string;
  scanQr: string;
  scanQrHint: string;
  saveQr: string;
  qrAlt: string;
  copy: string;
  copied: string;
};

export function paymentDetailsStrings(t: { order: Omit<PaymentDetailsStrings, "copy" | "copied">; common: { copy: string; copied: string } }): PaymentDetailsStrings {
  const { amountDue, payTo, payToMissing, scanQr, scanQrHint, saveQr, qrAlt } = t.order;
  return { amountDue, payTo, payToMissing, scanQr, scanQrHint, saveQr, qrAlt, copy: t.common.copy, copied: t.common.copied };
}

/** Amount, where to pay (number + optional transfer QR) and the method's instructions. */
export function PaymentDetails({ method, amount, locale, s }: { method: PaymentMethodInfo | undefined; amount: number | null; locale: Locale; s: PaymentDetailsStrings }) {
  const ar = locale === "ar";
  const instructions = method ? (ar ? method.instructionsAr : method.instructionsEn) : "";
  return (
    <div className="grid gap-3 rounded-xl bg-muted p-4 sm:grid-cols-2" data-testid="payment-details">
      <div>
        <p className="text-xs text-fg-subtle">{s.amountDue}</p>
        <p className="ltr-nums text-2xl font-black" dir="ltr">{amount ? formatIQD(amount, locale) : "—"}</p>
      </div>
      <div>
        <p className="text-xs text-fg-subtle">{s.payTo}{method ? ` — ${ar ? method.nameAr : method.nameEn}` : ""}</p>
        {method?.accountDetails ? (
          <p className="flex items-center gap-2">
            <span className="ltr-nums font-bold" dir="ltr">{method.accountDetails}</span>
            <CopyButton value={method.accountDetails} label={s.copy} copiedLabel={s.copied} />
          </p>
        ) : (
          <p className="text-sm text-fg-muted">{s.payToMissing}</p>
        )}
      </div>
      {method?.qrFileId ? (
        <figure className="flex flex-col items-center gap-2 rounded-xl bg-elevated p-3 sm:col-span-2 sm:flex-row sm:items-center sm:gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- DB-backed image route */}
          <img src={`/api/files/${method.qrFileId}`} alt={s.qrAlt} className="w-48 max-w-full rounded-lg" />
          <figcaption className="space-y-1 text-sm">
            <p className="font-bold">{s.scanQr}</p>
            <p className="text-fg-muted">{s.scanQrHint}</p>
            <a href={`/api/files/${method.qrFileId}`} download="payment-qr" className="inline-block font-semibold text-brand hover:underline">{s.saveQr}</a>
          </figcaption>
        </figure>
      ) : null}
      {instructions ? <p className="text-sm whitespace-pre-line text-fg-muted sm:col-span-2">{instructions}</p> : null}
    </div>
  );
}
