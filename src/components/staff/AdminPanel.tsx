import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  Ban,
  Download,
  KeyRound,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  Wallet,
  Lock,
  Unlock,
  SlidersHorizontal,
  Building2,
  QrCode,
  MapPin,
  Sparkles,
  Palette,
  CheckCircle2,
  Layers,
  Utensils,
  Store,
  Clock,
  Save,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import { BRAND_PALETTES, useBrandPalette } from "@/lib/brand-palette";
import {
  createStaff,
  getAdminAccess,
  getAdminAnalytics,
  listStaff,
  removeStaff,
  resetStaffPassword,
  setStaffCode,
  setStaffRole,
  type OrderLog,
  type StaffRole,
} from "@/lib/admin.functions";
import {
  getStaffPermissionMatrix,
  updateStaffProductPermission,
} from "@/lib/permissions.functions";
import {
  listAuditLogs,
  listStaffAuthorizations,
  setStaffAuthorization,
  type StaffAuthorizationRow,
} from "@/lib/authorization.functions";
import { getCmsContent, saveBanner } from "@/lib/cms.functions";
import type { StorefrontContent } from "@/lib/storefront-content";
import { DELIVERY_ZONES } from "@/lib/delivery-zones";
import { WHATSAPP } from "@/lib/menu";

/** Keeps an authorisation failure from blanking the screen. */
export function AdminErrorScreen({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "خطأ غير معروف · Unknown error";
  const navigate = useNavigate();
  const leave = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", search: { role: "admin" }, replace: true });
  };
  return (
    <main dir="rtl" className="grid min-h-dvh place-items-center bg-[#FDFBF7] px-4">
      <div className="max-w-sm rounded-3xl border border-[#EFE8DC] bg-white p-6 text-center shadow-lg">
        <h1 className="font-display text-lg font-bold text-[#26160F]">هذه اللوحة للمديرين فقط</h1>
        <p className="mt-2 text-sm text-[#4A3B32]">This dashboard is limited to admin accounts.</p>
        <p className="mt-3 rounded-xl bg-[#FAF5EB] p-2 text-xs text-[#6E3917]">{message}</p>
        <button
          type="button"
          onClick={() => void leave()}
          className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full bg-[#B8801C] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#9E6C14]"
        >
          تسجيل الدخول بحساب مدير · Sign in as admin
        </button>
      </div>
    </main>
  );
}

const jod = (n: number) => `${n.toFixed(2)} د.أ`;

const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "مدير · Admin",
  sales: "مبيعات · Sales",
  kitchen: "مطبخ · Kitchen",
  social: "سوشال · Social",
};

const STATUS_LABEL: Record<string, string> = {
  new: "جديد 🆕",
  confirmed: "مؤكد ⚡",
  baking: "قيد التجهيز 👩‍🍳",
  ready: "جاهز ✨",
  out_for_delivery: "بالطريق 🛵",
  delivered: "تم التوصيل 🚚",
  completed: "مكتمل ✅",
  cancelled: "ملغي ❌",
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: "نقداً عند التسليم · Cash",
  cliq: "كليك · CliQ",
  visa: "بطاقة ائتمان · Visa",
  unpaid: "غير مدفوع · Unpaid",
};

const AUDIT_ACTION_LABEL: Record<string, { ar: string; class: string }> = {
  price_override: { ar: "تعديل سعر ✏️", class: "bg-amber-100 text-amber-900 border-amber-300" },
  custom_discount: { ar: "تطبيق خصم 🏷️", class: "bg-purple-100 text-purple-900 border-purple-300" },
  status_change: { ar: "تغيير حالة 🔄", class: "bg-blue-100 text-blue-900 border-blue-300" },
  order_edit: { ar: "تعديل طلب 📝", class: "bg-emerald-100 text-emerald-900 border-emerald-300" },
};

/** Builds a UTF-8 CSV (Excel friendly) and triggers a download. */
function downloadCsv(name: string, headers: string[], rows: (string | number)[][]) {
  const escape = (value: string | number) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const body = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

type MainTab = "analytics" | "staff" | "menu" | "settings";

export function AdminPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<MainTab>("analytics");

  const accessFn = useServerFn(getAdminAccess);
  const access = useQuery({
    queryKey: ["admin", "access"],
    queryFn: () => accessFn({}),
    staleTime: 0,
    retry: false,
  });

  const analyticsFn = useServerFn(getAdminAnalytics);
  const analytics = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: () => analyticsFn({}),
    enabled: access.data?.allowed === true,
    staleTime: 30_000,
  });

  // KPIs follow order activity live.
  useOrdersRealtime(["admin", "analytics"], access.data?.allowed === true, "admin-analytics-live");

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  if (access.isLoading) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-[#FDFBF7]">
        <Loader2 className="h-7 w-7 animate-spin text-[#B8801C]" aria-label="جاري التحميل" />
      </main>
    );
  }

  if (!access.data?.allowed) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-[#FDFBF7] px-4">
        <div className="max-w-sm rounded-3xl border border-[#EFE8DC] bg-white p-6 text-center shadow-lg">
          <h1 className="font-display text-lg font-bold text-[#26160F]">هذه اللوحة للمديرين فقط</h1>
          <p className="mt-2 text-sm text-[#4A3B32]">This dashboard is limited to admin accounts.</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full bg-[#B8801C] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#9E6C14]"
          >
            تسجيل الخروج · Sign out
          </button>
        </div>
      </main>
    );
  }

  const data = analytics.data;

  return (
    <main dir="rtl" className="min-h-dvh w-full overflow-x-hidden bg-[#FDFBF7] text-[#4A3B32] pb-16">
      {/* Top Main Navigation Header */}
      <header className="sticky top-0 z-20 border-b border-[#EFE8DC] bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="font-serif text-2xl font-bold tracking-wider text-[#B8801C] uppercase">DELISH</span>
              <span className="-mt-1.5 font-script text-xl italic text-[#6E3917]">Bakes Admin Center</span>
            </div>
            <span className="hidden sm:inline-block rounded-full bg-[#FEF7EB] px-3 py-1 text-xs font-extrabold text-[#B8801C] border border-[#EFE8DC]">
              مركز الإدارة والتحكم الشامل
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex h-9 items-center rounded-full border border-[#EFE8DC] bg-[#FAF5EB] px-4 text-xs font-bold text-[#6E3917] hover:bg-[#FEF7EB] shadow-xs"
            >
              المتجر الرئيسية 🛒
            </Link>
            <button
              type="button"
              onClick={() => void analytics.refetch()}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#EFE8DC] bg-white px-3.5 text-xs font-bold text-[#26160F] hover:bg-[#FEF7EB] shadow-xs"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[#B8801C]" aria-hidden />
              <span>تحديث البيانات</span>
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#6E3917] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#5A2E12]"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              <span>خروج</span>
            </button>
          </div>
        </div>

        {/* Unified 4-Tab Admin Navigation Bar */}
        <nav aria-label="أقسام اللوحة" className="no-scrollbar mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto overscroll-x-contain px-4 sm:px-6 pb-3 pt-1">
          {[
            { id: "analytics", label: "📊 لوحة المؤشرات والتقارير", desc: "Analytics & Sales Reports" },
            { id: "staff", label: "👥 الموظفون والصلاحيات وسجل التدقيق", desc: "Staff & Audit Logs" },
            { id: "menu", label: "🎂 إعدادات المتجر ومنيو الكيك", desc: "Store & Menu CMS" },
            { id: "settings", label: "⚙️ إعدادات النظام والدفع والتوصيل", desc: "Settings & Operations" },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setActiveTab(tab.id as MainTab)}
                className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                  active
                    ? "bg-[#B8801C] text-white shadow-md scale-[1.01]"
                    : "border border-[#EFE8DC] bg-white text-[#26160F] hover:bg-[#FEF7EB] hover:border-[#B8801C]/40"
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Wide Container */}
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pt-6 space-y-8">
        {/* TAB 1: DASHBOARD & ANALYTICS */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            {analytics.isLoading && (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-[#EFE8DC] bg-white p-8 shadow-xs">
                <Loader2 className="h-6 w-6 animate-spin text-[#B8801C]" />
                <span className="text-sm font-bold text-[#6E3917]">جاري تحميل التحليلات والتقارير…</span>
              </div>
            )}
            {analytics.isError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 space-y-3 shadow-xs">
                <p className="font-bold text-base flex items-center gap-2">
                  <Ban className="h-5 w-5 text-red-600" />
                  حدث خطأ أثناء جلب تحليلات الإيرادات والطلبات
                </p>
                <p className="text-xs text-red-700 bg-white/80 p-3 rounded-xl border border-red-200">
                  {analytics.error instanceof Error ? analytics.error.message : "خطأ غير معروف أثناء الاتصال بالسيرفر"}
                </p>
                <button
                  type="button"
                  onClick={() => void analytics.refetch()}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 active:scale-95 transition-all"
                >
                  <RefreshCw className="h-4 w-4" /> إعادة المحاولة الآن
                </button>
              </div>
            )}
            {data && (
              <>
                {/* Top KPI Summary Cards */}
                <section aria-labelledby="kpi-heading" className="space-y-3">
                  <h2 id="kpi-heading" className="font-sans text-lg font-black text-[#26160F]">
                    لوحة الإيرادات والأداء اليومي
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <KpiCard icon={TrendingUp} label="💵 مبيعات اليوم (Gross)" value={jod(data.revenue.gross)} badge="تحديث مباشر" />
                    <KpiCard icon={Wallet} label="📈 المبلغ المحصّل (Collected)" value={jod(data.revenue.collected)} badge="نقدي + كليك" />
                    <KpiCard icon={Ban} label="⏳ المتبقي على العملاء (Outstanding)" value={jod(data.revenue.outstanding)} badge="مستحقات" />
                    <KpiCard
                      icon={BadgeCheck}
                      label="🎂 إجمالي الطلبات (Orders)"
                      value={`${data.revenue.orders} طلب`}
                      subText={`متوسط الطلب: ${jod(data.revenue.avgOrder)}`}
                    />
                  </div>
                </section>

                {/* CliQ vs Cash Payment Breakdown */}
                <section aria-labelledby="pay-heading" className="space-y-3">
                  <h2 id="pay-heading" className="font-sans text-lg font-black text-[#26160F]">
                    ⚡ توزيع طرق الدفع (CliQ vs Cash)
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {data.payments.map((row) => (
                      <div key={row.method} className="rounded-2xl border border-[#EFE8DC] bg-white p-4 shadow-xs">
                        <p className="text-xs font-bold text-[#6E3917]">{PAYMENT_LABEL[row.method] ?? row.method}</p>
                        <p className="mt-1 font-sans text-xl font-black text-[#26160F]">{jod(row.collected)}</p>
                        <p className="text-xs font-medium text-[#4A3B32]/70">{row.orders} طلب مسجّل</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Reports Exporters & Staff Performance */}
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Staff Performance Table */}
                  <section aria-labelledby="agents-heading" className="space-y-3">
                    <h2 id="agents-heading" className="font-sans text-lg font-black text-[#26160F]">
                      👥 أداء فريق المبيعات والسوشال
                    </h2>
                    <div className="overflow-x-auto rounded-2xl border border-[#EFE8DC] bg-white shadow-xs">
                      <table className="w-full text-start text-xs sm:text-sm">
                        <thead className="bg-[#FAF5EB] text-xs font-bold text-[#26160F]">
                          <tr>
                            <th scope="col" className="p-3 text-start">الموظف</th>
                            <th scope="col" className="p-3 text-start">عدد الطلبات</th>
                            <th scope="col" className="p-3 text-start">حجم المبيعات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EFE8DC]">
                          {data.agents.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="p-4 text-center text-xs text-[#4A3B32]/70">لا توجد طلبات مسجلة بعد.</td>
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

                  {/* Export Reports Center */}
                  <section aria-labelledby="export-heading" className="space-y-3">
                    <h2 id="export-heading" className="font-sans text-lg font-black text-[#26160F]">
                      📥 مركز تصدير التقارير (CSV Reports)
                    </h2>
                    <div className="rounded-2xl border border-[#EFE8DC] bg-white p-5 space-y-4 shadow-xs">
                      <p className="text-xs text-[#4A3B32]/80 leading-relaxed">
                        قم بتنزيل تقارير المبيعات ودليل العملاء مباشرة بصيغة Excel CSV مع ترميز UTF-8 باللغة العربية.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            downloadCsv(
                              "delish-sales-report",
                              ["رقم الطلب", "العميل", "الهاتف", "الحالة", "الطريقة", "التاريخ", "الوقت", "الإجمالي", "المدفوع", "طريقة الدفع", "سبب الإلغاء"],
                              [...data.active, ...data.completed, ...data.cancelled].map((row) => [
                                row.order_number,
                                row.customer_name,
                                row.customer_phone,
                                STATUS_LABEL[row.status] ?? row.status,
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
                              data.customers.map((row) => [row.phone, row.name, row.orders, row.spend, row.last_order]),
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

                {/* Orders Tables */}
                <OrderLogs title="الطلبات النشطة اليوم" rows={data.active} />
                <OrderLogs title="الطلبات المكتملة" rows={data.completed} />
                <OrderLogs title="الطلبات الملغاة (مع ذكر السبب)" rows={data.cancelled} showReason />

                <CustomerDirectory customers={data.customers} />
              </>
            )}
          </div>
        )}

        {/* TAB 2: STAFF & AUDIT LOG */}
        {activeTab === "staff" && (
          <div className="space-y-8">
            <StaffPanel />
            <AuthorizationPanel />
          </div>
        )}

        {/* TAB 3: STORE & MENU CMS */}
        {activeTab === "menu" && <StoreCmsPanel />}

        {/* TAB 4: SETTINGS & OPERATIONS */}
        {activeTab === "settings" && <StoreOperationsPanel />}
      </div>
    </main>
  );
}

function KpiCard({ icon: Icon, label, value, badge, subText }: { icon: typeof TrendingUp; label: string; value: string; badge?: string; subText?: string }) {
  return (
    <div className="rounded-2xl border border-[#EFE8DC] bg-white p-4 shadow-xs space-y-1">
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

function OrderLogs({ title, rows, showReason }: { title: string; rows: OrderLog[]; showReason?: boolean }) {
  return (
    <section className="space-y-3">
      <h2 className="font-sans text-base font-black text-[#26160F]">
        {title} <span className="text-xs font-bold text-[#B8801C]">({rows.length})</span>
      </h2>
      <div className="overflow-x-auto rounded-2xl border border-[#EFE8DC] bg-white shadow-xs">
        <table className="w-full text-start text-xs sm:text-sm">
          <thead className="bg-[#FAF5EB] text-xs font-bold text-[#26160F]">
            <tr>
              <th scope="col" className="p-3 text-start">الطلب</th>
              <th scope="col" className="p-3 text-start">العميل</th>
              <th scope="col" className="p-3 text-start">الموعد</th>
              <th scope="col" className="p-3 text-start">الإجمالي</th>
              <th scope="col" className="p-3 text-start">الحالة</th>
              {showReason && <th scope="col" className="p-3 text-start">السبب</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFE8DC]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={showReason ? 6 : 5} className="p-4 text-center text-xs text-[#4A3B32]/70">لا توجد طلبات مسجلة في هذا القسم.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-[#FEF7EB]">
                  <td className="p-3 font-bold text-[#26160F]">{row.order_number}</td>
                  <td className="p-3">
                    <span className="font-bold text-[#26160F]">{row.customer_name}</span>
                    <span className="block text-xs text-[#4A3B32]/60" dir="ltr">{row.customer_phone}</span>
                  </td>
                  <td className="p-3 text-xs text-[#4A3B32]" dir="ltr">{row.requested_date} {row.requested_time.slice(0, 5)}</td>
                  <td className="p-3 font-black text-[#6E3917]">{jod(row.total)}</td>
                  <td className="p-3 font-bold text-[#B8801C]">{STATUS_LABEL[row.status] ?? row.status}</td>
                  {showReason && <td className="p-3 text-xs text-[#4A3B32]/70">{row.cancel_reason ?? "—"}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CustomerDirectory({ customers }: { customers: { phone: string; name: string; orders: number; spend: number; last_order: string }[] }) {
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
        <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-[#4A3B32]/50" aria-hidden />
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
              <th scope="col" className="p-3 text-start">الاسم</th>
              <th scope="col" className="p-3 text-start">الهاتف</th>
              <th scope="col" className="p-3 text-start">الطلبات</th>
              <th scope="col" className="p-3 text-start">إجمالي الشراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFE8DC]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-xs text-[#4A3B32]/70">لا نتائج مطابقة.</td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.phone} className="hover:bg-[#FEF7EB]">
                  <td className="p-3 font-bold text-[#26160F]">{row.name}</td>
                  <td className="p-3 font-semibold text-[#4A3B32]" dir="ltr">{row.phone}</td>
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

function Text({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-bold text-[#26160F]">
      {label}
      <input
        type={type}
        step={type === "number" ? "0.01" : undefined}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-3 text-xs font-semibold text-[#26160F] outline-none focus:border-[#B8801C]"
      />
    </label>
  );
}

/* ---------------------------------- Staff & Permissions ---------------------------------- */

function StaffPanel() {
  const queryClient = useQueryClient();
  const listStaffFn = useServerFn(listStaff);
  const staff = useQuery({
    queryKey: ["admin", "staff"],
    queryFn: () => listStaffFn({}),
    staleTime: 60_000,
  });
  const create = useServerFn(createStaff);
  const reset = useServerFn(resetStaffPassword);
  const role = useServerFn(setStaffRole);
  const code = useServerFn(setStaffCode);
  const remove = useServerFn(removeStaff);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState<StaffRole>("sales");
  const [newStaffCode, setNewStaffCode] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const me = useQuery({
    queryKey: ["admin", "me"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: 5 * 60_000,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
  const handleError = (caught: Error) => {
    setNotice(null);
    setError(caught.message);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          username,
          password,
          role: newRole,
          staffCode: newStaffCode.trim() ? Number(newStaffCode) : null,
        },
      }),
    onSuccess: (result) => {
      setUsername("");
      setPassword("");
      setNewStaffCode("");
      setError(null);
      setNotice(
        result?.reused
          ? "هذا الاسم مسجّل مسبقاً: تم تحديث كلمة المرور والدور"
          : "تم إنشاء الحساب بنجاح 🌸",
      );
      invalidate();
    },
    onError: handleError,
  });

  const resetMutation = useMutation({
    mutationFn: (input: { userId: string; password: string }) => reset({ data: input }),
    onSuccess: () => {
      setError(null);
      setNotice("تم تحديث كلمة المرور بنجاح");
    },
    onError: handleError,
  });

  const roleMutation = useMutation({
    mutationFn: (input: { userId: string; role: StaffRole }) => role({ data: input }),
    onSuccess: () => {
      setError(null);
      setNotice("تم تحديث دور الموظف");
      invalidate();
    },
    onError: handleError,
  });

  const codeMutation = useMutation({
    mutationFn: (input: { userId: string; staffCode: number | null }) => code({ data: input }),
    onSuccess: () => {
      setError(null);
      setNotice("تم تحديث رقم الموظف");
      invalidate();
    },
    onError: handleError,
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => remove({ data: { userId } }),
    onSuccess: () => {
      setError(null);
      setNotice("تم إلغاء تفعيل/حذف الحساب");
      invalidate();
    },
    onError: handleError,
  });

  return (
    <section aria-labelledby="staff-heading" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 id="staff-heading" className="font-sans text-lg font-black text-[#26160F]">
          👥 سجل الموظفين وإضافة حساب جديد
        </h2>
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-[#FEF7EB] border border-[#EFE8DC] p-3 text-xs font-bold text-[#B8801C]">{notice}</p>}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!username.trim()) {
            setNotice(null);
            setError("اسم المستخدم مطلوب");
            return;
          }
          if (password.length < 8) {
            setNotice(null);
            setError("كلمة المرور 8 أحرف على الأقل");
            return;
          }
          setError(null);
          createMutation.mutate();
        }}
        className="grid gap-3 rounded-2xl border border-[#EFE8DC] bg-white p-5 sm:grid-cols-2 lg:grid-cols-4 shadow-xs"
      >
        <Text label="اسم الموظف / المستخدم *" type="text" value={username} onChange={setUsername} required />
        <Text label="كلمة المرور (8 أحرف+) *" type="password" value={password} onChange={setPassword} required />
        <Text label="رقم الموظف (موظف #1, #2...)" type="number" value={newStaffCode} onChange={setNewStaffCode} />
        <label className="block text-xs font-bold text-[#26160F]">
          الدور والصلاحية *
          <select
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as StaffRole)}
            className="mt-1 min-h-11 w-full rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-3 text-xs font-bold text-[#26160F]"
          >
            {(Object.keys(ROLE_LABEL) as StaffRole[]).map((key) => (
              <option key={key} value={key}>{ROLE_LABEL[key]}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end lg:col-span-4 pt-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            disabled={createMutation.isPending || password.length < 8 || !username.trim()}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#B8801C] px-5 text-xs font-bold text-white shadow-xs hover:bg-[#9E6C14] disabled:opacity-50"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            إنشاء حساب موظف جديد
          </button>
        </div>
      </form>

      {staff.isLoading && <p className="text-xs text-[#4A3B32]/70">جاري تحميل حسابات الموظفين…</p>}

      <div className="space-y-3">
        {(staff.data ?? []).map((member) => (
          <StaffRow
            key={member.id}
            member={member}
            onReset={(pwd) => resetMutation.mutate({ userId: member.id, password: pwd })}
            onRole={(value) => roleMutation.mutate({ userId: member.id, role: value })}
            onCode={(value) => codeMutation.mutate({ userId: member.id, staffCode: value })}
            onRemove={() => removeMutation.mutate(member.id)}
            isSelf={me.data === member.id}
          />
        ))}
      </div>
    </section>
  );
}

function StaffRow({
  member,
  onReset,
  onRole,
  onCode,
  onRemove,
  isSelf = false,
}: {
  member: {
    id: string;
    username: string;
    roles: StaffRole[];
    last_sign_in_at: string | null;
    staff_code: number | null;
  };
  onReset: (password: string) => void;
  onRole: (role: StaffRole) => void;
  onCode: (staffCode: number | null) => void;
  onRemove: () => void;
  isSelf?: boolean;
}) {
  const [password, setPassword] = useState("");
  const [staffCode, setStaffCode] = useState(member.staff_code ? String(member.staff_code) : "");

  return (
    <article className="grid gap-3 rounded-2xl border border-[#EFE8DC] bg-white p-4 lg:grid-cols-[1fr_auto_auto] items-center shadow-xs">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#26160F] text-sm sm:text-base">{member.username}</span>
          {member.staff_code && (
            <span className="rounded-full bg-[#FEF7EB] px-2.5 py-0.5 text-[10px] font-extrabold text-[#B8801C] border border-[#EFE8DC]">
              موظف #{member.staff_code}
            </span>
          )}
        </div>
        <p className="text-xs font-medium text-[#4A3B32]/70 mt-0.5">
          الدور الحالي: <span className="font-bold text-[#6E3917]">{member.roles.map((r) => ROLE_LABEL[r]).join(" · ") || "بدون دور"}</span>
          {member.last_sign_in_at ? ` · آخر تسجيل دخول: ${member.last_sign_in_at.slice(0, 10)}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={member.roles[0] ?? "sales"}
          onChange={(event) => onRole(event.target.value as StaffRole)}
          className="min-h-10 rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-2.5 text-xs font-bold text-[#26160F]"
        >
          {(Object.keys(ROLE_LABEL) as StaffRole[]).map((key) => (
            <option key={key} value={key}>{ROLE_LABEL[key]}</option>
          ))}
        </select>

        <input
          type="password"
          value={password}
          placeholder="كلمة مرور جديدة"
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-10 w-36 rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-2.5 text-xs text-[#26160F]"
        />
        <button
          type="button"
          disabled={password.length < 8}
          onClick={() => {
            onReset(password);
            setPassword("");
          }}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#EFE8DC] bg-white px-3 text-xs font-bold text-[#26160F] disabled:opacity-50 hover:bg-[#FEF7EB]"
        >
          <KeyRound className="h-3.5 w-3.5 text-[#B8801C]" aria-hidden /> تحديث
        </button>

        <input
          type="number"
          min={1}
          max={9999}
          value={staffCode}
          placeholder="رقم الموظف"
          onChange={(event) => setStaffCode(event.target.value)}
          className="min-h-10 w-24 rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-2.5 text-xs text-[#26160F]"
        />
        <button
          type="button"
          onClick={() => onCode(staffCode.trim() === "" ? null : Number(staffCode))}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#EFE8DC] bg-[#FAF5EB] px-3 text-xs font-bold text-[#6E3917] hover:bg-[#FEF7EB]"
        >
          حفظ الرقم
        </button>
      </div>

      {isSelf ? (
        <span className="inline-flex min-h-10 items-center justify-center px-3 text-xs font-bold text-[#4A3B32]/60">
          حسابك الحالي
        </span>
      ) : (
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 hover:bg-rose-100"
        >
          <Users className="h-3.5 w-3.5" aria-hidden /> إلغاء التفعيل
        </button>
      )}
    </article>
  );
}

/* ============ Staff Authorizations & Refactored Audit Logs ============ */

function AuthorizationPanel() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listStaffAuthorizations);
  const saveFn = useServerFn(setStaffAuthorization);
  const auditFn = useServerFn(listAuditLogs);
  const [error, setError] = useState<string | null>(null);
  const [auditSearch, setAuditSearch] = useState("");

  const rows = useQuery({
    queryKey: ["admin", "authorizations"],
    queryFn: () => listFn({}),
    staleTime: 15_000,
  });

  const audit = useQuery({
    queryKey: ["admin", "audit-logs"],
    queryFn: () => auditFn({}),
    staleTime: 15_000,
  });

  const save = useMutation({
    mutationFn: (input: { userId: string } & Partial<StaffAuthorizationRow>) => saveFn({ data: input }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "authorizations"] });
      toast.success("تم تحديث تصاريح الموظف بنجاح");
    },
    onError: (err: Error) => setError(err.message),
  });

  const filteredAudit = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return audit.data ?? [];
    return (audit.data ?? []).filter(
      (entry) =>
        entry.staff_name.toLowerCase().includes(q) ||
        (entry.order_number && entry.order_number.toLowerCase().includes(q)) ||
        (entry.reason && entry.reason.toLowerCase().includes(q)) ||
        entry.action.toLowerCase().includes(q),
    );
  }, [audit.data, auditSearch]);

  return (
    <section className="space-y-6">
      {/* Staff Authorizations Matrix */}
      <div className="rounded-3xl border border-[#EFE8DC] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <h2 className="flex items-center gap-2 text-base font-black text-[#26160F]">
          <SlidersHorizontal className="h-5 w-5 text-[#B8801C]" aria-hidden="true" />
          مصفوفة صلاحيات تعديل الأسعار والخصومات المباشرة
        </h2>
        <p className="text-xs text-[#4A3B32]/80 leading-relaxed">
          قم بتفعيل أو إلغاء صلاحية تعديل الأسعار والخصومات لكل موظف مبيعات وسوشال ميديا، وحدّد أقصى نسبة خصم مسموحة.
        </p>

        {error ? (
          <p className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-700">{error}</p>
        ) : null}

        {rows.isPending ? (
          <p className="flex items-center gap-2 text-xs text-[#4A3B32]/70">
            <Loader2 className="h-4 w-4 animate-spin text-[#B8801C]" aria-hidden="true" /> جارٍ التحميل…
          </p>
        ) : (
          <div className="space-y-3">
            {(rows.data ?? []).map((row) => (
              <div key={row.user_id} className="rounded-2xl border border-[#EFE8DC] bg-[#FDFBF7] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFE8DC] pb-2">
                  <span className="font-bold text-[#26160F] text-sm">{row.username}</span>
                  <div className="flex items-center gap-1">
                    {row.roles.map((role) => (
                      <span key={role} className="rounded-full bg-[#FEF7EB] px-2.5 py-0.5 text-[10px] font-bold text-[#B8801C] border border-[#EFE8DC]">
                        {ROLE_LABEL[role as keyof typeof ROLE_LABEL] ?? role}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {/* Toggle Price Override */}
                  <button
                    type="button"
                    onClick={() =>
                      save.mutate({ userId: row.user_id, allow_price_override: !row.allow_price_override })
                    }
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition-all ${
                      row.allow_price_override
                        ? "bg-[#B8801C] text-white shadow-xs"
                        : "border border-[#EFE8DC] bg-white text-[#4A3B32] hover:bg-[#FEF7EB]"
                    }`}
                  >
                    {row.allow_price_override ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    <span>{row.allow_price_override ? "تعديل الأسعار (مسموح) 🔓" : "تعديل الأسعار (مقيد) 🔒"}</span>
                  </button>

                  {/* Toggle Custom Discount */}
                  <button
                    type="button"
                    onClick={() =>
                      save.mutate({ userId: row.user_id, allow_custom_discount: !row.allow_custom_discount })
                    }
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition-all ${
                      row.allow_custom_discount
                        ? "bg-[#B8801C] text-white shadow-xs"
                        : "border border-[#EFE8DC] bg-white text-[#4A3B32] hover:bg-[#FEF7EB]"
                    }`}
                  >
                    {row.allow_custom_discount ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    <span>{row.allow_custom_discount ? "الخصم الخاص (مسموح) 🏷️" : "الخصم الخاص (مقيد) 🔒"}</span>
                  </button>

                  {/* Max Discount Input */}
                  <label className="block text-xs font-bold text-[#26160F]">
                    أقصى نسبة خصم %
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      defaultValue={row.max_discount_percent}
                      onBlur={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value) && value !== row.max_discount_percent) {
                          save.mutate({ userId: row.user_id, max_discount_percent: value });
                        }
                      }}
                      className="mt-1 min-h-11 w-full rounded-xl border border-[#EFE8DC] bg-white px-3 text-xs font-bold text-[#26160F]"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Refactored Arabic Audit Log */}
      <div className="rounded-3xl border border-[#EFE8DC] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE8DC] pb-3">
          <div>
            <h3 className="text-base font-black text-[#26160F]">📜 سجل التدقيق الأمني والعمليات (Audit Log)</h3>
            <p className="mt-0.5 text-xs text-[#4A3B32]/70">سجل توثيقي غير قابل للتعديل لجميع تعديلات الأسعار والخصومات.</p>
          </div>
          <div className="relative max-w-xs w-full sm:w-auto">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-[#4A3B32]/50" />
            <input
              type="search"
              placeholder="فلترة بالاسم أو رقم الطلب…"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              className="min-h-10 w-full rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] ps-9 pe-3 text-xs text-[#26160F] outline-none focus:border-[#B8801C]"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#EFE8DC] bg-white">
          <table className="w-full text-start text-xs sm:text-sm">
            <thead className="bg-[#FAF5EB] text-xs font-bold text-[#26160F]">
              <tr>
                <th className="p-3 text-start">الموظف</th>
                <th className="p-3 text-start">رقم الطلب</th>
                <th className="p-3 text-start">الإجراء</th>
                <th className="p-3 text-start">المبلغ السابق</th>
                <th className="p-3 text-start">المبلغ المعدل</th>
                <th className="p-3 text-start">نسبة الخصم</th>
                <th className="p-3 text-start">السبب والتفاصيل</th>
                <th className="p-3 text-start">التاريخ والوقت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DC]">
              {filteredAudit.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-xs text-[#4A3B32]/70">لا توجد سجلات مطابقة.</td>
                </tr>
              ) : (
                filteredAudit.map((entry) => {
                  const badge = AUDIT_ACTION_LABEL[entry.action] ?? { ar: entry.action, class: "bg-slate-100 text-slate-700" };
                  return (
                    <tr key={entry.id} className="hover:bg-[#FEF7EB]">
                      <td className="p-3 font-bold text-[#26160F]">{entry.staff_name}</td>
                      <td className="p-3 font-bold text-[#6E3917]">{entry.order_number ?? "—"}</td>
                      <td className="p-3">
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${badge.class}`}>
                          {badge.ar}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-[#4A3B32]">{entry.original_amount ? jod(entry.original_amount) : "—"}</td>
                      <td className="p-3 font-bold text-[#26160F]">{entry.modified_amount ? jod(entry.modified_amount) : "—"}</td>
                      <td className="p-3 font-bold text-[#B8801C]">{entry.discount_percent != null ? `${entry.discount_percent}%` : "—"}</td>
                      <td className="p-3 text-xs text-[#4A3B32]">{entry.reason ?? "تعديل عبر النظام"}</td>
                      <td className="p-3 text-xs text-[#4A3B32]/70" dir="ltr">
                        {new Date(entry.created_at).toLocaleString("ar-JO")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- Tab 3: Store & Menu CMS ---------------------------------- */

function StoreCmsPanel() {
  const queryClient = useQueryClient();
  const cmsFn = useServerFn(getCmsContent);
  const saveBannerFn = useServerFn(saveBanner);

  const cms = useQuery({
    queryKey: ["admin", "cms-content"],
    queryFn: () => cmsFn({}),
    staleTime: 30_000,
  });

  const [discountText, setDiscountText] = useState("40% OFF");
  const [subtitle, setSubtitle] = useState("Everyone's Favorite");
  const [buttonText, setButtonText] = useState("Order now");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const { paletteId: selectedPalette, setPalette: setSelectedPalette } = useBrandPalette();

  const banner = cms.data?.banner;

  useMemo(() => {
    if (banner) {
      setDiscountText(banner.discount_text ?? "40% OFF");
      setSubtitle(banner.subtitle ?? "Everyone's Favorite");
      setButtonText(banner.button_text ?? "Order now");
      setImageUrl(banner.image_url ?? "");
      setIsActive(banner.is_active !== false);
    }
  }, [banner]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveBannerFn({
        data: {
          discount_text: discountText,
          subtitle,
          button_text: buttonText,
          image_url: imageUrl || null,
          is_active: isActive,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "cms-content"] });
      queryClient.invalidateQueries({ queryKey: ["storefront-content"] });
      toast.success("تم حفظ ونشر البانر الرئيسي على الموقع بنجاح 🌸");
    },
    onError: (err: Error) => toast.error(`تعذر الحفظ: ${err.message}`),
  });

  return (
    <section aria-labelledby="cms-heading" className="space-y-6">
      {/* Hero Banner Management */}
      <div className="rounded-3xl border border-[#EFE8DC] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE8DC] pb-3">
          <div>
            <h2 id="cms-heading" className="text-base font-black text-[#26160F] flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#B8801C]" />
              إدارة البانر العلوي للمتجر (Hero Banner Management)
            </h2>
            <p className="text-xs text-[#4A3B32]/70 mt-0.5">تعديل ونشر البانر البارز في أعلى الصفحة الرئيسية للمتجر.</p>
          </div>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#B8801C] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#9E6C14] cursor-pointer"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>💾 حفظ ونشر البانر على الموقع / Save & Publish</span>
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs font-bold text-[#26160F]">
            العنوان الرئيسي للبانر (Headline)
            <input
              type="text"
              value={discountText}
              onChange={(e) => setDiscountText(e.target.value)}
              placeholder="مثال: كيكات مميزة تُصنع بحب لمناسباتكم الخاصة 🎂"
              className="mt-1 min-h-11 w-full rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-3 text-xs text-[#26160F]"
            />
          </label>

          <label className="block text-xs font-bold text-[#26160F]">
            الوصف الفرعي (Subtitle)
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="مثال: سواء كان حفل تخرج، عيد ميلاد، أو ذكرى مميزة.."
              className="mt-1 min-h-11 w-full rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-3 text-xs text-[#26160F]"
            />
          </label>

          <label className="block text-xs font-bold text-[#26160F]">
            رابط صورة البانر (Image URL)
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 min-h-11 w-full rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-3 text-xs text-[#26160F]"
            />
          </label>
        </div>
      </div>

      {/* Card Color Palette Selector */}
      <div className="rounded-3xl border border-[#EFE8DC] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#EFE8DC] pb-3">
          <div>
            <h3 className="text-base font-black text-[#26160F] flex items-center gap-2">
              <Palette className="h-5 w-5 text-[#B8801C]" />
              مُحدّد الهوية البصرية لكروت المتجر (Brand Palette Selector)
            </h3>
            <p className="text-xs text-[#4A3B32]/70 mt-0.5">
              اختر ثيم الألوان المعتمد لكروت المنتجات في واجهة الزبائن (يتحدث فورياً).
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Object.values(BRAND_PALETTES).map((theme) => {
            const active = selectedPalette === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={async () => {
                  try {
                    await setSelectedPalette(theme.id);
                    toast.success(`تم حفظ وتطبيق ثيم ${theme.nameAr} بنجاح 🎨`);
                  } catch (err) {
                    const message = err instanceof Error ? err.message : "خطأ غير متوقع";
                    toast.error(`تعذر حفظ الثيم: ${message}`);
                  }
                }}
                className={`flex flex-col items-center gap-2.5 rounded-2xl border p-4 text-center transition-all cursor-pointer ${
                  active
                    ? "border-2 border-[#B8801C] bg-[#FEF7EB] shadow-md scale-105 ring-2 ring-[#B8801C]/20"
                    : "border-[#EFE8DC] bg-white hover:border-[#B8801C]/50 hover:bg-[#FAF5EB]"
                }`}
              >
                <div
                  className="h-10 w-10 rounded-full shadow-md border border-black/10 flex items-center justify-center text-white font-bold transition-transform group-hover:scale-110"
                  style={{ backgroundColor: theme.main }}
                >
                  {active && <Check className="h-5 w-5 stroke-[3]" />}
                </div>
                <div className="space-y-1">
                  <span className="block text-xs font-black text-[#26160F]">{theme.nameAr}</span>
                  <div className="flex justify-center gap-1">
                    <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: theme.cardBg }} title="خلفية الصورة" />
                    <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: theme.main }} title="اللون الرئيسي" />
                    <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: theme.secondary }} title="النصوص واللمسات" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- Tab 4: Settings & Operations ---------------------------------- */

function StoreOperationsPanel() {
  const [address, setAddress] = useState("عمّان - الشميساني الرئيسي، مقابل مجمع بنك الاتحاد");
  const [phone, setPhone] = useState("+962 7 9000 0000");

  const handleSaveSettings = () => {
    toast.success("تم حفظ بيانات الفرع الرئيسي بنجاح 🌸");
  };

  return (
    <section aria-labelledby="settings-heading" className="space-y-6">
      {/* Branch Information */}
      <div className="rounded-3xl border border-[#EFE8DC] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#EFE8DC] pb-3">
          <h2 id="settings-heading" className="text-base font-black text-[#26160F] flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#B8801C]" />
            بيانات فرع عمّان الرئيسي (Single Physical Branch)
          </h2>
          <button
            type="button"
            onClick={handleSaveSettings}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#B8801C] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#9E6C14]"
          >
            <Save className="h-4 w-4" />
            <span>حفظ البيانات</span>
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-bold text-[#26160F]">
            العنوان التفصيلي
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-3 text-xs font-semibold text-[#26160F]"
            />
          </label>

          <label className="block text-xs font-bold text-[#26160F]">
            هاتف الاستفسارات المباشر
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-3 text-xs font-semibold text-[#26160F]"
              dir="ltr"
            />
          </label>
        </div>
      </div>

      {/* Delivery Zones */}
      <div className="rounded-3xl border border-[#EFE8DC] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <h3 className="text-base font-black text-[#26160F] flex items-center gap-2">
          <MapPin className="h-5 w-5 text-[#B8801C]" />
          مناطق وأجور التوصيل المعتمدة في عمّان (Amman Delivery Zones)
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DELIVERY_ZONES.map((zone) => (
            <div key={zone.labelAr} className="rounded-2xl border border-[#EFE8DC] bg-[#FDFBF7] p-4 space-y-2">
              <div className="flex items-center justify-between border-b border-[#EFE8DC] pb-2">
                <span className="font-bold text-[#26160F] text-xs">{zone.labelAr}</span>
                <span className="rounded-full bg-[#FEF7EB] px-2.5 py-0.5 text-xs font-extrabold text-[#B8801C] border border-[#EFE8DC]">
                  {jod(zone.fee)}
                </span>
              </div>
              <p className="text-[11px] text-[#4A3B32]/80 leading-relaxed">
                المناطق: {zone.areas.join("، ")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
