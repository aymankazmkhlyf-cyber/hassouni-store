import { cn } from "./cn";

const STAR = "M12 2.8l2.85 5.9 6.45.85-4.75 4.45 1.2 6.4L12 17.3l-5.75 3.1 1.2-6.4L2.7 9.55l6.45-.85z";

/** Read-only star rating; supports fractional values (e.g. 4.3). */
export function Stars({ value, label, className }: { value: number; label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="relative inline-block size-[1em]">
            <svg viewBox="0 0 24 24" className="absolute inset-0 size-full text-line-strong" fill="currentColor" aria-hidden="true"><path d={STAR} /></svg>
            {fill > 0 ? (
              <span className="absolute inset-y-0 start-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <svg viewBox="0 0 24 24" className="size-[1em] text-amber-400" fill="currentColor" aria-hidden="true"><path d={STAR} /></svg>
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
