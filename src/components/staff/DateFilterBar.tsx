import { DATE_FILTERS, type CustomRange, type DateFilterKey } from "@/lib/date-filter";

/** Universal date filter chips, optimized for tablet & mobile touch (min 48px). */
export function DateFilterBar({
  value,
  onChange,
  custom,
  onCustom,
}: {
  value: DateFilterKey;
  onChange: (key: DateFilterKey) => void;
  custom: CustomRange;
  onCustom: (range: CustomRange) => void;
}) {
  return (
    <div className="min-w-0">
      <div
        className="no-scrollbar flex w-full max-w-full items-center gap-2 overflow-x-auto overscroll-x-contain py-1"
        role="group"
        aria-label="فلتر التاريخ السلس باللمس"
      >
        {DATE_FILTERS.map((item) => {
          const isActive = value === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              aria-pressed={isActive}
              className={`min-h-[48px] px-4 shrink-0 rounded-xl text-xs font-black transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm scale-102"
                  : "border border-border bg-background text-foreground hover:bg-secondary/60"
              }`}
            >
              {item.ar}
            </button>
          );
        })}
      </div>

      {value === "custom" && (
        <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:items-end animate-in fade-in duration-150">
          <label className="min-w-0 text-xs font-bold text-foreground">
            من
            <input
              type="date"
              value={custom.from}
              onChange={(event) => onCustom({ ...custom, from: event.target.value })}
              className="mt-1 block min-h-[48px] w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm font-bold"
            />
          </label>
          <label className="min-w-0 text-xs font-bold text-foreground">
            إلى
            <input
              type="date"
              value={custom.to}
              onChange={(event) => onCustom({ ...custom, to: event.target.value })}
              className="mt-1 block min-h-[48px] w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm font-bold"
            />
          </label>
        </div>
      )}
    </div>
  );
}