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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
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


/** Keeps an authorisation failure from blanking the screen. */
export function AdminErrorScreen({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "خطأ غير معروف · Unknown error";
  const navigate = useNavigate();
  const leave = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", search: { role: "admin" }, replace: true });
  };
  return (
    <main dir="rtl" className="grid min-h-dvh place-items-center bg-[#F9FBFC] px-4">
      <div className="max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-lg">
        <h1 className="font-display text-lg font-bold text-[#3E2723]">هذه اللوحة للمديرين فقط</h1>
        <p className="mt-2 text-sm text-[#7A6458]">This dashboard is limited to admin accounts.</p>
        <p className="mt-3 rounded-xl bg-slate-50 p-2 text-xs text-[#7A6458]">{error.message}</p>
        <button
          type="button"
          onClick={() => void leave()}
          className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full bg-[#8B4513] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#5D2E17]"
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
  new: "جديد",
  confirmed: "مؤكد",
  baking: "قيد التجهيز",
  ready: "جاهز",
  out_for_delivery: "بالطريق",
  delivered: "تم التوصيل",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: "نقداً · Cash",
  cliq: "كليك · CliQ",
  visa: "فيزا · Visa",
  unpaid: "غير مدفوع · Unpaid",
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

type Tab = "analytics" | "staff" | "permissions" | "authorization";

export function AdminPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("analytics");

  const access = useQuery({
    queryKey: ["admin", "access"],
    queryFn: useServerFn(getAdminAccess),
    staleTime: 0,
    retry: false,
  });

  const analyticsFn = useServerFn(getAdminAnalytics);
  const analytics = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: analyticsFn,
    enabled: access.data?.allowed === true,
    staleTime: 30_000,
  });

  // KPIs follow order activity live, like the sales and kitchen boards.
  useOrdersRealtime(["admin", "analytics"], access.data?.allowed === true, "admin-analytics-live");

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  if (access.isLoading) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-[#F9FBFC]">
        <Loader2 className="h-6 w-6 animate-spin text-[#B8860B]" aria-label="جاري التحميل" />
      </main>
    );
  }

  if (!access.data?.allowed) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-[#F9FBFC] px-4">
        <div className="max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-lg">
          <h1 className="font-display text-lg font-bold text-[#3E2723]">هذه اللوحة للمديرين فقط</h1>
          <p className="mt-2 text-sm text-[#7A6458]">This dashboard is limited to admin accounts.</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full bg-[#8B4513] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#5D2E17]"
          >
            تسجيل الخروج · Sign out
          </button>
        </div>
      </main>
    );
  }

  const data = analytics.data;

  return (
    <main dir="rtl" className="min-h-dvh w-full max-w-full overflow-x-hidden bg-[#F9FBFC] text-[#3E2723] bg-delish-pattern pb-16">
      <header className="border-b border-[#F1F5F9] bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 px-4 py-4 sm:flex sm:flex-wrap sm:gap-3">
          <div className="min-w-0 sm:me-auto">
            <div className="flex min-w-0 items-center gap-2">
              <span className="font-serif text-2xl font-bold tracking-widest text-[#B8860B] uppercase">DELISH</span>
              <span className="-mt-1 hidden font-script text-2xl italic text-[#8B4513] sm:inline">Bakes</span>
            </div>
            <p className="truncate text-xs font-bold text-[#7A6458]">لوحة الإدارة الشاملة · Admin Dashboard</p>
          </div>
          <Link
            to="/"
            className="hidden min-h-11 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-bold text-[#5D2E17] hover:bg-slate-50 shadow-xs sm:inline-flex"
          >
            المتجر · Store
          </Link>
          <button
            type="button"
            onClick={() => void analytics.refetch()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-xs font-bold text-[#5D2E17] hover:bg-slate-50 shadow-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> تحديث
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#8B4513] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#5D2E17]"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden /> خروج
          </button>
        </div>
         <nav aria-label="أقسام اللوحة" className="no-scrollbar mx-auto flex w-full max-w-6xl gap-2 overflow-x-auto overscroll-x-contain px-4 pb-3">
          {(
            [
              ["analytics", "التحليلات والسجلات · Analytics"],
              ["staff", "حسابات الموظفين · Staff"],
              ["permissions", "مصفوفة صلاحيات الأسعار · Price Permissions"],
              ["authorization", "تصاريح الموظفين والأسعار والخصومات · Authorization"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-current={tab === key ? "page" : undefined}
              onClick={() => setTab(key)}
              className={`min-h-11 whitespace-nowrap rounded-full px-5 text-xs sm:text-sm font-bold transition-all ${
                tab === key
                  ? "bg-[#8B4513] text-white shadow-sm"
                  : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-8 px-4 pt-6">
        {tab === "analytics" && (
          <>
            {analytics.isLoading && <p className="text-sm text-muted-foreground">جاري تحميل التحليلات…</p>}
            {data && (
              <>
                <section aria-labelledby="kpi-heading" className="space-y-3">
                  <h2 id="kpi-heading" className="font-display text-lg font-bold text-foreground">
                    مؤشرات الإيرادات
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Kpi icon={TrendingUp} label="إجمالي المبيعات" value={jod(data.revenue.gross)} />
                    <Kpi icon={Wallet} label="المحصّل" value={jod(data.revenue.collected)} />
                    <Kpi icon={Ban} label="المتبقي على العملاء" value={jod(data.revenue.outstanding)} />
                    <Kpi
                      icon={BadgeCheck}
                      label="عدد الطلبات"
                      value={`${data.revenue.orders} · متوسط ${jod(data.revenue.avgOrder)}`}
                    />
                  </div>
                </section>

                <section aria-labelledby="pay-heading" className="space-y-3">
                  <h2 id="pay-heading" className="font-display text-lg font-bold text-foreground">
                    توزيع طرق الدفع
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {data.payments.map((row) => (
                      <div key={row.method} className="rounded-2xl border border-border bg-card p-4">
                        <p className="text-xs font-bold text-muted-foreground">{PAYMENT_LABEL[row.method]}</p>
                        <p className="mt-1 font-display text-lg font-bold text-foreground">{jod(row.collected)}</p>
                        <p className="text-xs text-muted-foreground">{row.orders} طلب</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section aria-labelledby="export-heading" className="space-y-3">
                  <h2 id="export-heading" className="font-display text-lg font-bold text-foreground">
                    تصدير البيانات
                  </h2>
                  <div className="flex flex-wrap gap-2">
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
                      className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
                    >
                      <Download className="h-4 w-4" aria-hidden /> تقرير المبيعات CSV
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
                      className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border px-5 text-sm font-bold text-foreground"
                    >
                      <Download className="h-4 w-4" aria-hidden /> دليل العملاء CSV
                    </button>
                  </div>
                </section>

                <OrderLogs title="طلبات نشطة" rows={data.active} />
                <OrderLogs title="طلبات مكتملة" rows={data.completed} />
                <OrderLogs title="طلبات ملغاة (مع السبب)" rows={data.cancelled} showReason />

                <section aria-labelledby="agents-heading" className="space-y-3">
                  <h2 id="agents-heading" className="font-display text-lg font-bold text-foreground">
                    أداء فريق السوشال ميديا
                  </h2>
                   <div className="overscroll-x-contain overflow-x-auto rounded-2xl border border-border bg-card">
                    <table className="w-full min-w-[32rem] text-start text-sm">
                      <thead className="bg-muted text-xs font-bold text-muted-foreground">
                        <tr>
                          <th scope="col" className="p-3 text-start">الموظف</th>
                          <th scope="col" className="p-3 text-start">عدد الطلبات</th>
                          <th scope="col" className="p-3 text-start">حجم المبيعات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.agents.length === 0 && (
                          <tr>
                            <td colSpan={3} className="p-3 text-muted-foreground">لا توجد طلبات مسجلة بعد.</td>
                          </tr>
                        )}
                        {data.agents.map((row) => (
                          <tr key={row.agent} className="border-t border-border">
                            <td className="p-3 font-bold text-foreground">{row.agent}</td>
                            <td className="p-3">{row.orders}</td>
                            <td className="p-3">{jod(row.volume)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <CustomerDirectory customers={data.customers} />
              </>
            )}
          </>
        )}

        {tab === "staff" && <StaffPanel />}
        {tab === "permissions" && <StaffPermissionMatrixPanel />}
        {tab === "authorization" && <AuthorizationPanel />}
      </div>
    </main>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof TrendingUp; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" aria-hidden /> {label}
      </p>
      <p className="mt-1 font-display text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function OrderLogs({ title, rows, showReason }: { title: string; rows: OrderLog[]; showReason?: boolean }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-bold text-foreground">
        {title} <span className="text-sm font-bold text-muted-foreground">({rows.length})</span>
      </h2>
       <div className="overscroll-x-contain overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[40rem] text-start text-sm">
          <thead className="bg-muted text-xs font-bold text-muted-foreground">
            <tr>
              <th scope="col" className="p-3 text-start">الطلب</th>
              <th scope="col" className="p-3 text-start">العميل</th>
              <th scope="col" className="p-3 text-start">الموعد</th>
              <th scope="col" className="p-3 text-start">الإجمالي</th>
              <th scope="col" className="p-3 text-start">الحالة</th>
              {showReason && <th scope="col" className="p-3 text-start">السبب</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={showReason ? 6 : 5} className="p-3 text-muted-foreground">لا توجد طلبات.</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="p-3 font-bold text-foreground">{row.order_number}</td>
                <td className="p-3">
                  {row.customer_name}
                  <span className="block text-xs text-muted-foreground" dir="ltr">{row.customer_phone}</span>
                </td>
                <td className="p-3 text-xs" dir="ltr">{row.requested_date} {row.requested_time.slice(0, 5)}</td>
                <td className="p-3">{jod(row.total)}</td>
                <td className="p-3">{STATUS_LABEL[row.status] ?? row.status}</td>
                {showReason && <td className="p-3 text-xs text-muted-foreground">{row.cancel_reason ?? "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CustomerDirectory({ customers }: { customers: { phone: string; name: string; orders: number; spend: number; last_order: string }[] }) {
  const [query, setQuery] = useState("");
  // Typing stays smooth: filtering runs after the keystrokes settle.
  const debounced = useDebouncedValue(query, 180);
  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((row) => row.phone.includes(q) || row.name.toLowerCase().includes(q));
  }, [customers, debounced]);

  return (
    <section aria-labelledby="customers-heading" className="space-y-3">
      <h2 id="customers-heading" className="font-display text-lg font-bold text-foreground">
        دليل العملاء وأرقام الهاتف
      </h2>
      <label className="relative block max-w-md">
        <span className="sr-only">بحث عن عميل بالاسم أو الهاتف</span>
        <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground" aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="بحث بالاسم أو رقم الهاتف"
          className="min-h-12 w-full rounded-full border border-input bg-background ps-9 pe-4 text-sm"
        />
      </label>
       <div className="overscroll-x-contain overflow-x-auto rounded-2xl border border-border bg-card">
         <table className="w-full min-w-[32rem] text-start text-sm">
          <thead className="bg-muted text-xs font-bold text-muted-foreground">
            <tr>
              <th scope="col" className="p-3 text-start">الاسم</th>
              <th scope="col" className="p-3 text-start">الهاتف</th>
              <th scope="col" className="p-3 text-start">الطلبات</th>
              <th scope="col" className="p-3 text-start">إجمالي الشراء</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="p-3 text-muted-foreground">لا نتائج مطابقة.</td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr key={row.phone} className="border-t border-border">
                <td className="p-3 font-bold text-foreground">{row.name}</td>
                <td className="p-3" dir="ltr">{row.phone}</td>
                <td className="p-3">{row.orders}</td>
                <td className="p-3">{jod(row.spend)}</td>
              </tr>
            ))}
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
    <label className="block text-sm font-bold text-foreground">
      {label}
      <input
        type={type}
        step={type === "number" ? "0.01" : undefined}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal"
      />
    </label>
  );
}

/* ---------------------------------- staff ---------------------------------- */

function StaffPanel() {
  const queryClient = useQueryClient();
  const staff = useQuery({
    queryKey: ["admin", "staff"],
    queryFn: useServerFn(listStaff),
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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The server refuses to delete the signed-in admin, so hide that action instead of erroring.
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
    mutationFn: () => create({ data: { username, password, role: newRole } }),
    onSuccess: (result) => {
      setUsername("");
      setPassword("");
      setError(null);
      setNotice(
        result?.reused
          ? "هذا الاسم مسجّل مسبقاً: تم تحديث كلمة المرور والدور · Existing account updated"
          : "تم إنشاء الحساب · Account created",
      );
      invalidate();
    },
    onError: handleError,
  });

  const resetMutation = useMutation({
    mutationFn: (input: { userId: string; password: string }) => reset({ data: input }),
    onSuccess: () => {
      setError(null);
      setNotice("تم تحديث كلمة المرور · Password updated");
    },
    onError: handleError,
  });

  const roleMutation = useMutation({
    mutationFn: (input: { userId: string; role: StaffRole }) => role({ data: input }),
    onSuccess: () => {
      setError(null);
      setNotice("تم تحديث الدور · Role updated");
      invalidate();
    },
    onError: handleError,
  });

  const codeMutation = useMutation({
    mutationFn: (input: { userId: string; staffCode: number | null }) => code({ data: input }),
    onSuccess: () => {
      setError(null);
      setNotice("تم تحديث رقم الموظف · Staff ID updated");
      invalidate();
    },
    onError: handleError,
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => remove({ data: { userId } }),
    onSuccess: () => {
      setError(null);
      setNotice("تم حذف الحساب · Account removed");
      invalidate();
    },
    onError: handleError,
  });

  return (
    <section aria-labelledby="staff-heading" className="space-y-4">
      <h2 id="staff-heading" className="font-display text-lg font-bold text-foreground">
        حسابات الموظفين وكلمات المرور
      </h2>

      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-xs font-bold text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-primary/10 p-3 text-xs font-bold text-foreground">{notice}</p>}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!username.trim()) {
            setNotice(null);
            setError("اسم المستخدم مطلوب · Name is required");
            return;
          }
          if (password.length < 8) {
            setNotice(null);
            setError("كلمة المرور 8 أحرف على الأقل · Password must be at least 8 characters");
            return;
          }
          setError(null);
          createMutation.mutate();
        }}
        className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2"
      >
        <Text label="اسم المستخدم · Name" type="text" value={username} onChange={setUsername} required />
        <Text label="كلمة المرور (8 أحرف+)" type="password" value={password} onChange={setPassword} required />
        <label className="block text-sm font-bold text-foreground">
          الدور · Role
          <select
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as StaffRole)}
            className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal"
          >
            {(Object.keys(ROLE_LABEL) as StaffRole[]).map((key) => (
              <option key={key} value={key}>{ROLE_LABEL[key]}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
        <button
            type="submit"
            disabled={createMutation.isPending || password.length < 8 || !username.trim()}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            إنشاء حساب موظف
          </button>
        </div>
      </form>

      {staff.isLoading && <p className="text-sm text-muted-foreground">جاري تحميل الحسابات…</p>}

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
    <article className="grid gap-3 rounded-2xl border border-border bg-card p-4 lg:grid-cols-[1fr_auto_auto]">
      <div>
        <p className="font-bold text-foreground" dir="ltr">{member.username}</p>
        <p className="text-xs text-muted-foreground">
          {member.roles.map((r) => ROLE_LABEL[r]).join(" · ") || "بدون دور"}
          {member.last_sign_in_at ? ` · آخر دخول ${member.last_sign_in_at.slice(0, 10)}` : ""}
          {member.staff_code ? ` · رقم الموظف ${member.staff_code}` : " · بدون رقم موظف"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-bold text-muted-foreground">
          <span className="sr-only">تغيير دور {member.username}</span>
          <select
            value={member.roles[0] ?? "sales"}
            onChange={(event) => onRole(event.target.value as StaffRole)}
            className="min-h-12 rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground"
          >
            {(Object.keys(ROLE_LABEL) as StaffRole[]).map((key) => (
              <option key={key} value={key}>{ROLE_LABEL[key]}</option>
            ))}
          </select>
        </label>
        <input
          type="password"
          value={password}
          placeholder="كلمة مرور جديدة"
          onChange={(event) => setPassword(event.target.value)}
          aria-label={`كلمة مرور جديدة لحساب ${member.username}`}
          className="min-h-12 w-40 rounded-xl border border-input bg-background px-3 text-sm"
        />
        <button
          type="button"
          disabled={password.length < 8}
          onClick={() => {
            onReset(password);
            setPassword("");
          }}
          className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border px-4 text-sm font-bold text-foreground disabled:opacity-50"
        >
          <KeyRound className="h-4 w-4" aria-hidden /> تحديث
        </button>
        {/* Numeric staff ID shown beside every order number this employee creates. */}
        <input
          type="number"
          min={1}
          max={9999}
          inputMode="numeric"
          value={staffCode}
          placeholder="رقم الموظف"
          onChange={(event) => setStaffCode(event.target.value)}
          aria-label={`رقم الموظف لحساب ${member.username}`}
          className="min-h-12 w-28 rounded-xl border border-input bg-background px-3 text-sm"
        />
        <button
          type="button"
          onClick={() => onCode(staffCode.trim() === "" ? null : Number(staffCode))}
          className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border px-4 text-sm font-bold text-foreground"
        >
          حفظ الرقم
        </button>
      </div>

      {isSelf ? (
        <span className="inline-flex min-h-12 items-center justify-center px-4 text-xs font-bold text-muted-foreground">
          حسابك الحالي
        </span>
      ) : (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`حذف حساب ${member.username}`}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-destructive/40 px-4 text-sm font-bold text-destructive"
        >
          <Users className="h-4 w-4" aria-hidden /> حذف
        </button>
      )}
    </article>
  );
}

function StaffPermissionMatrixPanel() {
  const queryClient = useQueryClient();
  const matrixFn = useServerFn(getStaffPermissionMatrix);
  const updatePermFn = useServerFn(updateStaffProductPermission);
  const staffFn = useServerFn(listStaff);

  const matrixQuery = useQuery({
    queryKey: ["admin", "permission-matrix"],
    queryFn: () => matrixFn({}),
    staleTime: 30_000,
  });

  const staffQuery = useQuery({
    queryKey: ["admin", "staff-list"],
    queryFn: () => staffFn({}),
    staleTime: 60_000,
  });

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  const staffMembers = staffQuery.data ?? [];
  const activeUserId = selectedUserId || (staffMembers[0]?.id ?? "");

  const updateMutation = useMutation({
    mutationFn: (input: { userId: string; productId: string; canEditPrice: boolean }) =>
      updatePermFn({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.setQueryData(["admin", "permission-matrix"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          matrix: {
            ...old.matrix,
            [variables.userId]: {
              ...(old.matrix?.[variables.userId] ?? {}),
              [variables.productId]: variables.canEditPrice,
            },
          },
        };
      });
    },
  });

  const products = matrixQuery.data?.products ?? [];
  const matrix = (matrixQuery.data?.matrix ?? {}) as Record<string, Record<string, boolean>>;

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (p) =>
        p.name_ar.toLowerCase().includes(term) ||
        p.name_en.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  const grantAll = (grant: boolean) => {
    if (!activeUserId) return;
    for (const prod of products) {
      updateMutation.mutate({
        userId: activeUserId,
        productId: prod.id,
        canEditPrice: grant,
      });
    }
  };

  return (
    <section aria-labelledby="matrix-heading" className="space-y-6">
      <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_8px_24px_-8px_rgba(62,39,35,0.06)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 id="matrix-heading" className="font-serif text-lg font-bold text-[#3E2723]">
              مصفوفة صلاحيات تعديل الأسعار للموظفين
            </h2>
            <p className="text-xs text-[#7A6458]">
              Staff Price Modification Matrix · حدد المنتجات المسموح لكل موظف مبيعات تعديل سعرها بالطلب
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => grantAll(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#FDE2CF] px-4 py-2 text-xs font-bold text-[#7B3F00] hover:bg-[#fed6bc] transition shadow-xs"
            >
              <Unlock className="h-3.5 w-3.5 text-[#B8860B]" />
              منح تعديل الكل
            </button>
            <button
              type="button"
              onClick={() => grantAll(false)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
            >
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              تقييد الكل (قفل)
            </button>
          </div>
        </div>

        {/* Employee Selector Bar */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-[#3E2723]">الموظف · Staff:</span>
          <div className="flex flex-wrap gap-2">
            {staffMembers.map((member) => {
              const active = activeUserId === member.id;
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedUserId(member.id)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                    active
                      ? "bg-[#8B4513] text-white shadow-sm"
                      : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50"
                  }`}
                >
                  {member.username} ({member.roles.join(", ")})
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-4">
          <input
            type="search"
            placeholder="بحث بالمنتج أو التصنيف…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-sm rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 py-2 text-xs text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
          />
        </div>

        {/* Matrix Table */}
        <div className="mt-5 overscroll-x-contain overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full min-w-[38rem] text-start text-xs sm:text-sm">
            <thead className="bg-[#F9FBFC] text-xs font-bold text-[#7A6458]">
              <tr>
                <th scope="col" className="whitespace-nowrap p-3 text-start">المنتج · Product</th>
                <th scope="col" className="whitespace-nowrap p-3 text-start">التصنيف</th>
                <th scope="col" className="whitespace-nowrap p-3 text-start">السعر الافتراضي</th>
                <th scope="col" className="whitespace-nowrap p-3 text-start">صلاحية تعديل السعر (can_edit_price)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredProducts.map((prod) => {
                const canEdit = matrix?.[activeUserId]?.[prod.id] ?? true;
                return (
                  <tr
                    key={prod.id}
                    className="transition hover:bg-[#FDE2CF]/15"
                  >
                    <td className="p-3">
                      <p className="font-bold text-[#3E2723]">{prod.name_ar}</p>
                      <p className="text-[11px] text-[#7A6458]">{prod.name_en}</p>
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                        {prod.category}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-[#5D2E17]">
                      {jod(prod.price)}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateMutation.mutate({
                            userId: activeUserId,
                            productId: prod.id,
                            canEditPrice: !canEdit,
                          })
                        }
                        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-all shadow-xs ${
                          canEdit
                            ? "bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100"
                            : "bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {canEdit ? (
                          <>
                            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                            <span>مسموح بتعديل السعر ✏️</span>
                          </>
                        ) : (
                          <>
                            <span className="h-2 w-2 rounded-full bg-slate-400" />
                            <span>مقيد · سعر ثابت فقط 🔒</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ============ Staff Authorization, Price & Discount Controls ============ */

function AuthorizationPanel() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listStaffAuthorizations);
  const saveFn = useServerFn(setStaffAuthorization);
  const auditFn = useServerFn(listAuditLogs);
  const [error, setError] = useState<string | null>(null);

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
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <SlidersHorizontal className="h-5 w-5 text-primary" aria-hidden="true" />
          تصاريح الموظفين والأسعار والخصومات · Staff Authorization, Price &amp; Discount Controls
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          فعّل تعديل الأسعار أو الخصومات لكل موظف مبيعات، وحدّد أقصى نسبة خصم مسموحة.
        </p>

        {error ? (
          <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs font-bold text-destructive">{error}</p>
        ) : null}

        {rows.isPending ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> جارٍ التحميل…
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {(rows.data ?? []).map((row) => (
              <li key={row.user_id} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="me-auto font-bold text-foreground">{row.username}</p>
                  {row.roles.map((role) => (
                    <span key={role} className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">
                      {role}
                    </span>
                  ))}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() =>
                      save.mutate({ userId: row.user_id, allow_price_override: !row.allow_price_override })
                    }
                    aria-pressed={row.allow_price_override}
                    className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition-transform hover:scale-[1.02] active:scale-95 ${
                      row.allow_price_override
                        ? "bg-primary text-primary-foreground"
                        : "border border-input bg-card text-muted-foreground"
                    }`}
                  >
                    {row.allow_price_override ? (
                      <Unlock className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Lock className="h-4 w-4" aria-hidden="true" />
                    )}
                    تعديل الأسعار · Price overrides
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      save.mutate({ userId: row.user_id, allow_custom_discount: !row.allow_custom_discount })
                    }
                    aria-pressed={row.allow_custom_discount}
                    className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition-transform hover:scale-[1.02] active:scale-95 ${
                      row.allow_custom_discount
                        ? "bg-primary text-primary-foreground"
                        : "border border-input bg-card text-muted-foreground"
                    }`}
                  >
                    {row.allow_custom_discount ? (
                      <Unlock className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Lock className="h-4 w-4" aria-hidden="true" />
                    )}
                    خصم خاص · Custom discount
                  </button>

                  <label className="block text-xs font-bold text-foreground">
                    أقصى نسبة خصم % · Max discount
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
                      className="mt-1 min-h-12 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground"
                    />
                  </label>
                </div>
              </li>
            ))}
            {(rows.data ?? []).length === 0 ? (
              <li className="text-sm text-muted-foreground">لا يوجد موظفو مبيعات بعد.</li>
            ) : null}
          </ul>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-card p-4 sm:p-6">
        <h3 className="text-base font-bold text-foreground">سجل التدقيق · Audit log</h3>
        <p className="mt-1 text-xs text-muted-foreground">سجل غير قابل للتعديل لكل تغيير على الأسعار والخصومات.</p>
        <div className="mt-3 overscroll-x-contain overflow-x-auto">
          <table className="w-full min-w-[50rem] text-start text-xs sm:text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="whitespace-nowrap p-2 text-start">الموظف</th>
                <th className="whitespace-nowrap p-2 text-start">الطلب</th>
                <th className="whitespace-nowrap p-2 text-start">الإجراء</th>
                <th className="whitespace-nowrap p-2 text-start">قبل</th>
                <th className="whitespace-nowrap p-2 text-start">بعد</th>
                <th className="whitespace-nowrap p-2 text-start">الخصم</th>
                <th className="whitespace-nowrap p-2 text-start">السبب</th>
                <th className="whitespace-nowrap p-2 text-start">الوقت</th>
              </tr>
            </thead>
            <tbody>
              {(audit.data ?? []).map((entry) => (
                <tr key={entry.id} className="border-t border-border text-foreground">
                  <td className="p-2 font-bold">{entry.staff_name}</td>
                  <td className="p-2">{entry.order_number ?? "—"}</td>
                  <td className="p-2">{entry.action}</td>
                  <td className="p-2">{entry.original_amount ?? "—"}</td>
                  <td className="p-2">{entry.modified_amount ?? "—"}</td>
                  <td className="p-2">{entry.discount_percent != null ? `${entry.discount_percent}%` : "—"}</td>
                  <td className="p-2">{entry.reason ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString("ar-JO")}
                  </td>
                </tr>
              ))}
              {(audit.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-3 text-muted-foreground">
                    لا توجد سجلات بعد.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
