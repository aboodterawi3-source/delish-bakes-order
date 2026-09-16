import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, RefreshCw, Search } from "lucide-react";
import { listOrderHistory, type HistoryRow, type SalesStatus } from "@/lib/sales.functions";
import { statusMeta, payMeta } from "@/components/staff/OrdersWorkspace";
import { orderLabel } from "@/lib/order-label";
import { isoDay } from "@/lib/date-filter";

const STATUS_OPTIONS: { value: SalesStatus | "all"; ar: string }[] = [
  { value: "all", ar: "كل الحالات" },
  { value: "new", ar: "قيد الانتظار" },
  { value: "baking", ar: "قيد التنفيذ" },
  { value: "ready", ar: "جاهز" },
  { value: "out_for_delivery", ar: "خارج للتوصيل" },
  { value: "completed", ar: "مكتمل" },
  { value: "delivered", ar: "تم التسليم" },
  { value: "cancelled", ar: "ملغي" },
];

const money = (value: number) => `${value.toFixed(2)}`;

/** First day of the month, three months back — a sensible archive window. */
const defaultFrom = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 3);
  date.setDate(1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
};

const CSV_HEADERS = [
  "رقم الطلب",
  "رقم الموظف",
  "اسم الطلب",
  "العميل",
  "الهاتف",
  "الطريقة",
  "المنطقة",
  "التاريخ",
  "الوقت",
  "الحالة",
  "الأصناف",
  "المجموع",
  "التوصيل",
  "الخصم",
  "الإجمالي",
  "المدفوع",
  "المتبقي",
  "طريقة الدفع",
];

const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

/** Exports the visible archive as a spreadsheet-friendly CSV (Excel-safe Arabic). */
function exportCsv(rows: HistoryRow[], from: string, to: string) {
  const lines = [CSV_HEADERS.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.order_number,
        row.staff_code ?? "",
        row.order_name ?? "",
        row.customer_name,
        row.customer_phone,
        row.method === "delivery" ? "توصيل" : "استلام",
        row.area ?? "",
        row.requested_date,
        row.requested_time.slice(0, 5),
        statusMeta[row.status]?.ar ?? row.status,
        row.items,
        money(row.subtotal),
        money(row.delivery_fee),
        money(row.discount_amount),
        money(row.total),
        money(row.deposit_paid),
        money(Math.max(row.total - row.deposit_paid, 0)),
        row.payment_method ? payMeta[row.payment_method].ar : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `delish-orders-${from}_${to}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Order archive: every past and new order, filterable and exportable. */
export function HistoryPanel() {
  const historyFn = useServerFn(listOrderHistory);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(() => isoDay(30));
  const [status, setStatus] = useState<SalesStatus | "all">("all");
  const [term, setTerm] = useState("");

  const history = useQuery({
    queryKey: ["order-history", from, to, status],
    queryFn: () => historyFn({ data: { from, to, status } }),
    staleTime: 30_000,
  });

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const list = history.data ?? [];
    if (!needle) return list;
    return list.filter((row) =>
      [row.order_number, row.order_name ?? "", row.customer_name, row.customer_phone, row.area ?? "", row.items]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [history.data, term]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          total: acc.total + row.total,
          paid: acc.paid + row.deposit_paid,
        }),
        { total: 0, paid: 0 },
      ),
    [rows],
  );

  return (
    <section dir="rtl" className="mx-auto w-full max-w-6xl px-4 py-5">
      <h1 className="font-display text-xl font-bold text-[#3E2723]">سجل الطلبات · Order history</h1>
      <p className="mt-1 text-sm text-[#7A6458]">كل الطلبات القديمة والجديدة مرتبة بالتاريخ، مع إمكانية التصدير.</p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-xs font-bold text-[#5D2E17]">
          من تاريخ
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-1 block min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
          />
        </label>
        <label className="text-xs font-bold text-[#5D2E17]">
          إلى تاريخ
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mt-1 block min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
          />
        </label>
        <label className="text-xs font-bold text-[#5D2E17]">
          الحالة
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as SalesStatus | "all")}
            className="mt-1 block min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.ar}
              </option>
            ))}
          </select>
        </label>
        <label className="relative min-w-[12rem] flex-1 text-xs font-bold text-[#5D2E17]">
          بحث
          <Search className="pointer-events-none absolute end-3 bottom-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="رقم الطلب، الاسم، المنطقة…"
            className="mt-1 block min-h-11 w-full rounded-xl border border-input bg-background pe-9 ps-3 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => void history.refetch()}
          aria-label="تحديث السجل"
          className="grid min-h-11 min-w-11 place-items-center rounded-full border border-slate-200 bg-white text-[#5D2E17]"
        >
          <RefreshCw className={`h-4 w-4 ${history.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => exportCsv(rows, from, to)}
          disabled={rows.length === 0}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#8B4513] px-4 text-xs font-bold text-white disabled:opacity-50"
        >
          <Download className="h-4 w-4" aria-hidden="true" /> تصدير Excel/CSV
        </button>
      </div>

      <p className="mt-3 text-xs font-bold text-[#5D2E17]">
        {rows.length} طلب · إجمالي {totals.total.toFixed(2)} د.أ · محصّل {totals.paid.toFixed(2)} د.أ
      </p>

      <div className="mt-3 w-full max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[52rem] text-right text-xs">
          <thead className="bg-[#FDE2CF] text-[#7B3F00]">
            <tr>
              <th className="p-2 font-extrabold">الطلب</th>
              <th className="p-2 font-extrabold">اسم الطلب</th>
              <th className="p-2 font-extrabold">العميل</th>
              <th className="p-2 font-extrabold">الموعد</th>
              <th className="p-2 font-extrabold">المنطقة</th>
              <th className="p-2 font-extrabold">الأصناف</th>
              <th className="p-2 font-extrabold">الإجمالي</th>
              <th className="p-2 font-extrabold">المدفوع</th>
              <th className="p-2 font-extrabold">المتبقي</th>
              <th className="p-2 font-extrabold">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {history.isPending ? (
              <tr>
                <td colSpan={10} className="p-6 text-center text-[#7A6458]">
                  جارٍ تحميل السجل…
                </td>
              </tr>
            ) : history.isError ? (
              <tr>
                <td colSpan={10} className="p-6 text-center text-destructive">
                  تعذّر تحميل السجل
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-6 text-center text-[#7A6458]">
                  لا توجد طلبات في هذا النطاق
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="p-2 font-bold">{orderLabel(row.order_number, row.staff_code)}</td>
                  <td className="p-2">{row.order_name ?? "—"}</td>
                  <td className="p-2">
                    {row.customer_name}
                    <br />
                    <span className="text-[#7A6458]">{row.customer_phone}</span>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {row.requested_date}
                    <br />
                    {row.requested_time.slice(0, 5)}
                  </td>
                  <td className="p-2">{row.method === "delivery" ? row.area ?? "—" : "استلام"}</td>
                  <td className="p-2 max-w-[16rem] break-words">{row.items || "—"}</td>
                  <td className="p-2 whitespace-nowrap">{money(row.total)} د.أ</td>
                  <td className="p-2 whitespace-nowrap">{money(row.deposit_paid)} د.أ</td>
                  <td className="p-2 whitespace-nowrap font-bold">
                    {money(Math.max(row.total - row.deposit_paid, 0))} د.أ
                  </td>
                  <td className="p-2">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusMeta[row.status].chip}`}>
                      {statusMeta[row.status].ar}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
