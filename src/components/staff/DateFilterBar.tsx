import { DATE_FILTERS, type CustomRange, type DateFilterKey } from "@/lib/date-filter";

/** Universal date filter chips, reused by the order desk, kitchen and history. */
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
        className="no-scrollbar flex w-full max-w-full items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 sm:flex-wrap sm:overflow-visible"
        role="group"
        aria-label="فلتر التاريخ"
      >
        {DATE_FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            aria-pressed={value === item.key}
            className={`min-h-10 shrink-0 rounded-lg px-3 text-xs font-bold transition-colors ${
              value === item.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-background text-foreground hover:bg-muted"
            }`}
          >
            {item.ar}
          </button>
        ))}
      </div>

      {value === "custom" ? (
        <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:items-end">
          <label className="min-w-0 text-xs font-bold text-foreground">
            من
            <input
              type="date"
              value={custom.from}
              onChange={(event) => onCustom({ ...custom, from: event.target.value })}
              className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm"
            />
          </label>
          <label className="min-w-0 text-xs font-bold text-foreground">
            إلى
            <input
              type="date"
              value={custom.to}
              onChange={(event) => onCustom({ ...custom, to: event.target.value })}
              className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
