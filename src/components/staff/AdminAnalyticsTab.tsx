import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Ban,
  Download,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
  Loader2,
} from "lucide-react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { getAdminAnalytics, OrderLog } from "@/lib/admin.functions";
import { jod } from "@/lib/currency";
import { OrderStatusBadge } from "@/components/staff/OrderStatusBadge";
import { getStatusMeta, PAYMENT_METHOD_LABELS } from "@/lib/order-status";

type AdminAnalyticsData = Awaited<ReturnType<typeof getAdminAnalytics>>;

function paymentLabel(method: string): string {
  if (method === "unpaid") return "غير مدفوع · Unpaid";
  const meta = PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS];
  return meta ? `${meta.ar} · ${meta.en}` : method;
}

/** Builds a UTF-8 CSV (Excel friendly) and triggers a download. */
function downloadCsv(name: string, headers: string[], rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    let text = String(value ?? "");
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const body = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminAnalyticsTab({
  data,
  isLoading,
  isError,
  error,
  onRefetch,
}: {
  data: AdminAnalyticsData | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRefetch: () => void;
}) {
  return (
    <div className="space-y-6">
      {isLoading && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-[#EFE8DC] bg-white p-8 shadow-xs">
          <Loader2 className="h-6 w-6 animate-spin text-[#B8801C]" />
          <span className="text-sm font-bold text-[#6E3917]">جاري تحميل التحليلات والتقارير…</span>
        </div>
      )}
      {isError && (
        <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-xs">
          <p className="flex items-center gap-2 text-base font-bold">
            <Ban className="h-5 w-5 text-red-600" />
            حدث خطأ أثناء جلب تحليلات الإيرادات والطلبات
          </p>
          <p className="rounded-xl border border-red-200 bg-white/80 p-3 text-xs text-red-700">
            {error instanceof Error ? error.message : "خطأ غير معروف أثناء الاتصال بالسيرفر"}
          </p>
          <button
            type="button"
            onClick={onRefetch}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-red-700 active:scale-95"
          >
            <RefreshCw className="h-4 w-4" /> إعادة المحاولة الآن
          </button>
        </div>
      )}
      {data && (
        <>
          <section aria-labelledby="kpi-heading" className="space-y-3">
            <h2 id="kpi-heading" className="font-sans text-lg font-black text-[#26160F]">
              لوحة الإيرادات والأداء اليومي
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                icon={TrendingUp}
                label="💵 مبيعات اليوم (Gross)"
                value={jod(data.revenue.gross)}
                badge="تحديث مباشر"
              />
              <KpiCard
                icon={Wallet}
                label="📈 المبلغ المحصّل (Collected)"
                value={jod(data.revenue.collected)}
                badge="نقدي + كليك"
              />
              <KpiCard
                icon={Ban}
                label="⏳ المتبقي على العملاء (Outstanding)"
                value={jod(data.revenue.outstanding)}
                badge="مستحقات"
              />
              <KpiCard
                icon={BadgeCheck}
                label="🎂 إجمالي الطلبات (Orders)"
                value={`${data.revenue.orders} طلب`}
                subText={`متوسط الطلب: ${jod(data.revenue.avgOrder)}`}
              />
            </div>
          </section>

          <section aria-labelledby="pay-heading" className="space-y-3">
            <h2 id="pay-heading" className="font-sans text-lg font-black text-[#26160F]">
              ⚡ توزيع طرق الدفع (CliQ vs Cash)
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.payments.map((row) => (
                <div
                  key={row.method}
                  className="rounded-2xl border border-[#EFE8DC] bg-white p-4 shadow-xs"
                >
                  <p className="text-xs font-bold text-[#6E3917]">{paymentLabel(row.method)}</p>
                  <p className="mt-1 font-sans text-xl font-black text-[#26160F]">
                    {jod(row.collected)}
                  </p>
                  <p className="text-xs font-medium text-[#4A3B32]/70">{row.orders} طلب مسجّل</p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="agents-heading" className="space-y-3">
              <h2 id="agents-heading" className="font-sans text-lg font-black text-[#26160F]">
                👥 أداء فريق المبيعات والسوشال
              </h2>
              <div className="overflow-x-auto rounded-2xl border border-[#EFE8DC] bg-white shadow-xs">
                <table className="w-full text-start text-xs sm:text-sm">
                  <thead className="bg-[#FAF5EB] text-xs font-bold text-[#26160F]">
                    <tr>
                      <th scope="col" className="p-3 text-start">
                        الموظف
                      </th>
                      <th scope="col" className="p-3 text-start">
                        عدد الطلبات
                      </th>
                      <th scope="col" className="p-3 text-start">
                        حجم المبيعات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE8DC]">
                    {data.agents.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-xs text-[#4A3B32]/70">
                          لا توجد طلبات مسجلة بعد.
                        </td>
                      </tr>
                    ) : (
                      data.agents.map((row) => (
                        <tr key={row.agent} className="hover:bg-[#FEF7EB]">
                          <td className="p-3 font-bold text-[#26160F]">{row.agent}</td>
                          <td className="p-3 font-bold text-[#B8801C]">{row.orders}</td>
                          <td className="p-3 font-black text-[#6E3917]">{jod(row.volume)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="export-heading" className="space-y-3">
              <h2 id="export-heading" className="font-sans text-lg font-black text-[#26160F]">
                📥 مركز تصدير التقارير (CSV Reports)
              </h2>
              <div className="space-y-4 rounded-2xl border border-[#EFE8DC] bg-white p-5 shadow-xs">
                <p className="text-xs leading-relaxed text-[#4A3B32]/80">
                  قم بتنزيل تقارير المبيعات ودليل العملاء مباشرة بصيغة Excel CSV مع ترميز UTF-8
                  باللغة العربية.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      downloadCsv(
                        "delish-sales-report",
                        [
                          "رقم الطلب",
                          "العميل",
                          "الهاتف",
                          "الحالة",
                          "الطريقة",
                          "التاريخ",
                          "الوقت",
                          "الإجمالي",
                          "المدفوع",
                          "طريقة الدفع",
                          "سبب الإلغاء",
                        ],
                        [...data.active, ...data.completed, ...data.cancelled].map((row) => [
                          row.order_number,
                          row.customer_name,
                          row.customer_phone,
                          getStatusMeta(row.status).ar,
                          row.method,
                          row.requested_date,
                          row.requested_time,
                          row.total,
                          row.deposit_paid,
                          row.payment_method ?? "",
                          row.cancel_reason ?? "",
                        ]),
                      )
                    }
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#B8801C] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#9E6C14] active:scale-95"
                  >
                    <Download className="h-4 w-4" aria-hidden /> تقرير المبيعات Excel CSV
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadCsv(
                        "delish-customers",
                        ["الهاتف", "الاسم", "عدد الطلبات", "إجمالي الشراء", "آخر طلب"],
                        data.customers.map((row) => [
                          row.phone,
                          row.name,
                          row.orders,
                          row.spend,
                          row.last_order,
                        ]),
                      )
                    }
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#EFE8DC] bg-[#FAF5EB] px-4 text-xs font-bold text-[#26160F] hover:bg-[#FEF7EB] active:scale-95"
                  >
                    <Download className="h-4 w-4" aria-hidden /> دليل العملاء CSV
                  </button>
                </div>
              </div>
            </section>
          </div>

          <OrderLogs title="الطلبات النشطة اليوم" rows={data.active} />
          <OrderLogs title="الطلبات المكتملة" rows={data.completed} />
          <OrderLogs title="الطلبات الملغاة (مع ذكر السبب)" rows={data.cancelled} showReason />

          <CustomerDirectory customers={data.customers} />
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  badge,
  subText,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  badge?: string;
  subText?: string;
}) {
  return (
    <div className="space-y-1 rounded-2xl border border-[#EFE8DC] bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-bold text-[#6E3917]">
          <Icon className="h-4 w-4 text-[#B8801C]" aria-hidden /> {label}
        </p>
        {badge && (
          <span className="rounded-full bg-[#FEF7EB] px-2 py-0.5 text-[9px] font-bold text-[#B8801C]">
            {badge}
          </span>
        )}
      </div>
      <p className="font-sans text-2xl font-black text-[#26160F]">{value}</p>
      {subText && <p className="text-[11px] font-medium text-[#4A3B32]/70">{subText}</p>}
    </div>
  );
}

function OrderLogs({
  title,
  rows,
  showReason,
}: {
  title: string;
  rows: OrderLog[];
  showReason?: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-sans text-base font-black text-[#26160F]">
        {title} <span className="text-xs font-bold text-[#B8801C]">({rows.length})</span>
      </h2>
      <div className="overflow-x-auto rounded-2xl border border-[#EFE8DC] bg-white shadow-xs">
        <table className="w-full text-start text-xs sm:text-sm">
          <thead className="bg-[#FAF5EB] text-xs font-bold text-[#26160F]">
            <tr>
              <th scope="col" className="p-3 text-start">
                الطلب
              </th>
              <th scope="col" className="p-3 text-start">
                العميل
              </th>
              <th scope="col" className="p-3 text-start">
                الموعد
              </th>
              <th scope="col" className="p-3 text-start">
                الإجمالي
              </th>
              <th scope="col" className="p-3 text-start">
                الحالة
              </th>
              {showReason && (
                <th scope="col" className="p-3 text-start">
                  السبب
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFE8DC]">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={showReason ? 6 : 5}
                  className="p-4 text-center text-xs text-[#4A3B32]/70"
                >
                  لا توجد طلبات مسجلة في هذا القسم.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-[#FEF7EB]">
                  <td className="p-3 font-bold text-[#26160F]">{row.order_number}</td>
                  <td className="p-3">
                    <span className="font-bold text-[#26160F]">{row.customer_name}</span>
                    <span className="block text-xs text-[#4A3B32]/60" dir="ltr">
                      {row.customer_phone}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-[#4A3B32]" dir="ltr">
                    {row.requested_date} {row.requested_time.slice(0, 5)}
                  </td>
                  <td className="p-3 font-black text-[#6E3917]">{jod(row.total)}</td>
                  <td className="p-3">
                    <OrderStatusBadge status={row.status} size="sm" />
                  </td>
                  {showReason && (
                    <td className="p-3 text-xs text-[#4A3B32]/70">{row.cancel_reason ?? "—"}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CustomerDirectory({
  customers,
}: {
  customers: { phone: string; name: string; orders: number; spend: number; last_order: string }[];
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 180);
  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((row) => row.phone.includes(q) || row.name.toLowerCase().includes(q));
  }, [customers, debounced]);

  return (
    <section aria-labelledby="customers-heading" className="space-y-3">
      <h2 id="customers-heading" className="font-sans text-base font-black text-[#26160F]">
        📖 دليل العملاء وسجل المشتريات
      </h2>
      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-[#4A3B32]/50"
          aria-hidden
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="بحث بالاسم أو رقم الهاتف…"
          className="min-h-11 w-full rounded-2xl border border-[#EFE8DC] bg-white ps-9 pe-4 text-xs font-medium text-[#26160F] outline-none focus:border-[#B8801C]"
        />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[#EFE8DC] bg-white shadow-xs">
        <table className="w-full text-start text-xs sm:text-sm">
          <thead className="bg-[#FAF5EB] text-xs font-bold text-[#26160F]">
            <tr>
              <th scope="col" className="p-3 text-start">
                الاسم
              </th>
              <th scope="col" className="p-3 text-start">
                الهاتف
              </th>
              <th scope="col" className="p-3 text-start">
                الطلبات
              </th>
              <th scope="col" className="p-3 text-start">
                إجمالي الشراء
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFE8DC]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-xs text-[#4A3B32]/70">
                  لا نتائج مطابقة.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.phone} className="hover:bg-[#FEF7EB]">
                  <td className="p-3 font-bold text-[#26160F]">{row.name}</td>
                  <td className="p-3 font-semibold text-[#4A3B32]" dir="ltr">
                    {row.phone}
                  </td>
                  <td className="p-3 font-bold text-[#B8801C]">{row.orders}</td>
                  <td className="p-3 font-black text-[#6E3917]">{jod(row.spend)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
