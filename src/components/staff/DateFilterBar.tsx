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
      <div className="no-scrollbar flex w-full max-w-full gap-2 overflow-x-auto overscroll-x-contain py-2" role="group" aria-label="فلتر التاريخ">
        {DATE_FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            aria-pressed={value === item.key}
            className={`min-h-11 shrink-0 rounded-full px-4 text-xs font-bold transition-all ${
              value === item.key
                ? "bg-[#8B4513] text-white shadow-sm"
                : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50"
            }`}
          >
            {item.ar}
          </button>
        ))}
      </div>

      {value === "custom" ? (
        <div className="flex flex-wrap items-end gap-2 pb-2">
          <label className="text-xs font-bold text-[#5D2E17]">
            من
            <input
              type="date"
              value={custom.from}
              onChange={(event) => onCustom({ ...custom, from: event.target.value })}
              className="mt-1 block min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
            />
          </label>
          <label className="text-xs font-bold text-[#5D2E17]">
            إلى
            <input
              type="date"
              value={custom.to}
              onChange={(event) => onCustom({ ...custom, to: event.target.value })}
              className="mt-1 block min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
