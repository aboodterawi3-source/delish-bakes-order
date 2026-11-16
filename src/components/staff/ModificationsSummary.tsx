import type { OrderModification } from "@/lib/order-modifications";

interface ModificationsSummaryProps {
  modifications: OrderModification[];
  headerTimestamp?: string | null | undefined;
  title?: string;
}

function formatModTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("ar-JO", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** Displays consolidated modifications using the new approved value and timestamp. */
export function ModificationsSummary({
  modifications,
  headerTimestamp,
  title = "التعديلات",
}: ModificationsSummaryProps) {
  if (modifications.length === 0) return null;

  return (
    <div className="space-y-2 rounded-2xl border border-border/80 bg-secondary/20 p-3.5 text-xs shadow-2xs">
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <span className="flex items-center gap-1.5 font-black text-foreground">
          <span>📋</span>
          <span>{title}</span>
        </span>
        {headerTimestamp && (
          <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">
            {formatModTime(headerTimestamp)}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {modifications.map((mod, idx) => (
          <div
            key={`${mod.field}-${mod.updatedAt}-${idx}`}
            className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-card p-2 text-xs"
          >
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <span className="font-black text-primary">• {mod.field}:</span>
              <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-black text-emerald-800 dark:text-emerald-300">
                {mod.newValue}
              </span>
            </div>
            {mod.updatedAt && (
              <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">
                {formatModTime(mod.updatedAt)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
