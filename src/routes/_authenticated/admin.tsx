import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  Ban,
  Download,
  KeyRound,
  Loader2,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createStaff,
  deleteProduct,
  getAdminAccess,
  getAdminAnalytics,
  listAdminProducts,
  listStaff,
  removeStaff,
  resetStaffPassword,
  saveProduct,
  setStaffRole,
  type AdminProduct,
  type OrderLog,
  type ProductInput,
  type StaffRole,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "لوحة إدارة ديليش | Delish Admin Dashboard" },
      {
        name: "description",
        content: "لوحة إدارة ديليش: حسابات الموظفين، المنتجات والأسعار، الإيرادات وطرق الدفع، وسجل العملاء.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "لوحة إدارة ديليش | Delish Admin Dashboard" },
      { property: "og:description", content: "Staff accounts, products, revenue analytics and customer directory." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

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

type Tab = "analytics" | "products" | "staff";

const emptyProduct: ProductInput = {
  slug: "",
  name_ar: "",
  name_en: "",
  description_ar: "",
  description_en: "",
  category: "",
  price: 0,
  is_available: true,
  is_featured: false,
  sort_order: 0,
};

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("analytics");

  const access = useQuery({ queryKey: ["admin", "access"], queryFn: useServerFn(getAdminAccess) });
  const analyticsFn = useServerFn(getAdminAnalytics);
  const analytics = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: analyticsFn,
    enabled: access.data?.allowed === true,
  });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  if (access.isLoading) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="جاري التحميل" />
      </main>
    );
  }

  if (!access.data?.allowed) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-background px-4">
        <div className="max-w-sm rounded-3xl border border-border bg-card p-6 text-center">
          <h1 className="font-display text-lg font-bold text-foreground">هذه اللوحة للمديرين فقط</h1>
          <p className="mt-2 text-sm text-muted-foreground">This dashboard is limited to admin accounts.</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
          >
            تسجيل الخروج · Sign out
          </button>
        </div>
      </main>
    );
  }

  const data = analytics.data;

  return (
    <main dir="rtl" className="min-h-dvh bg-background pb-16">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
          <div className="me-auto">
            <h1 className="font-display text-xl font-bold delish-wordmark">Delish</h1>
            <p className="text-xs font-bold text-muted-foreground">لوحة الإدارة · Admin dashboard</p>
          </div>
          <Link
            to="/"
            className="inline-flex min-h-12 items-center rounded-full border border-border px-4 text-sm font-bold text-foreground"
          >
            المتجر · Store
          </Link>
          <button
            type="button"
            onClick={() => void analytics.refetch()}
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border px-4 text-sm font-bold text-foreground"
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> تحديث
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            <LogOut className="h-4 w-4" aria-hidden /> خروج
          </button>
        </div>
        <nav aria-label="أقسام اللوحة" className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3">
          {(
            [
              ["analytics", "التحليلات والسجلات"],
              ["products", "المنتجات والأسعار"],
              ["staff", "حسابات الموظفين"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-current={tab === key ? "page" : undefined}
              onClick={() => setTab(key)}
              className={`min-h-12 whitespace-nowrap rounded-full px-4 text-sm font-bold transition-colors ${
                tab === key ? "bg-primary text-primary-foreground" : "border border-border text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-4 pt-6">
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
                  <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                    <table className="w-full text-start text-sm">
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

        {tab === "products" && <ProductsPanel />}
        {tab === "staff" && <StaffPanel />}
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
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-start text-sm">
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
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((row) => row.phone.includes(q) || row.name.toLowerCase().includes(q));
  }, [customers, query]);

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
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-start text-sm">
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

/* --------------------------------- products -------------------------------- */

function ProductsPanel() {
  const queryClient = useQueryClient();
  const products = useQuery({ queryKey: ["admin", "products"], queryFn: useServerFn(listAdminProducts) });
  const save = useServerFn(saveProduct);
  const remove = useServerFn(deleteProduct);
  const [draft, setDraft] = useState<ProductInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });

  const saveMutation = useMutation({
    mutationFn: (input: ProductInput) => save({ data: input }),
    onSuccess: () => {
      setDraft(null);
      setError(null);
      invalidate();
    },
    onError: (caught: Error) => setError(caught.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: invalidate,
    onError: (caught: Error) => setError(caught.message),
  });

  const field = (key: keyof ProductInput, value: unknown) => setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <section aria-labelledby="products-heading" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="products-heading" className="me-auto font-display text-lg font-bold text-foreground">
          إدارة المنتجات والأسعار
        </h2>
        <button
          type="button"
          onClick={() => setDraft({ ...emptyProduct })}
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
        >
          <Plus className="h-4 w-4" aria-hidden /> منتج جديد
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-xs font-bold text-destructive">{error}</p>}

      {draft && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate(draft);
          }}
          className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2"
        >
          <Text label="الاسم بالعربية" value={draft.name_ar} onChange={(v) => field("name_ar", v)} required />
          <Text label="الاسم بالإنجليزية" value={draft.name_en} onChange={(v) => field("name_en", v)} required />
          <Text label="التصنيف · Category" value={draft.category} onChange={(v) => field("category", v)} required />
          <Text label="السعر (د.أ)" type="number" value={String(draft.price)} onChange={(v) => field("price", Number(v))} required />
          <Text label="الوصف بالعربية" value={draft.description_ar ?? ""} onChange={(v) => field("description_ar", v)} />
          <Text label="الوصف بالإنجليزية" value={draft.description_en ?? ""} onChange={(v) => field("description_en", v)} />
          <Text label="ترتيب العرض" type="number" value={String(draft.sort_order)} onChange={(v) => field("sort_order", Number(v))} />
          <div className="flex flex-wrap items-center gap-4 pt-2 text-sm font-bold text-foreground">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={draft.is_available} onChange={(e) => field("is_available", e.target.checked)} className="h-5 w-5" />
              متاح
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={draft.is_featured} onChange={(e) => field("is_featured", e.target.checked)} className="h-5 w-5" />
              مميز
            </label>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} حفظ
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="inline-flex min-h-12 items-center rounded-full border border-border px-5 text-sm font-bold text-foreground"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {products.isLoading && <p className="text-sm text-muted-foreground">جاري تحميل المنتجات…</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(products.data ?? []).map((product: AdminProduct) => (
          <article key={product.id} className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <Package className="h-4 w-4 text-primary" aria-hidden /> {product.category}
            </p>
            <h3 className="mt-1 font-display text-base font-bold text-foreground">{product.name_ar}</h3>
            <p className="text-xs text-muted-foreground">{product.name_en}</p>
            <p className="mt-2 font-bold text-foreground">{jod(product.price)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{product.is_available ? "متاح" : "غير متاح"}{product.is_featured ? " · مميز" : ""}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setDraft({ ...product })}
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-border text-sm font-bold text-foreground"
              >
                تعديل
              </button>
              <button
                type="button"
                onClick={() => removeMutation.mutate(product.id)}
                aria-label={`حذف ${product.name_ar}`}
                className="inline-flex min-h-12 w-12 items-center justify-center rounded-full border border-destructive/40 text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </article>
        ))}
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
  const staff = useQuery({ queryKey: ["admin", "staff"], queryFn: useServerFn(listStaff) });
  const create = useServerFn(createStaff);
  const reset = useServerFn(resetStaffPassword);
  const role = useServerFn(setStaffRole);
  const remove = useServerFn(removeStaff);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState<StaffRole>("sales");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
  const handleError = (caught: Error) => {
    setNotice(null);
    setError(caught.message);
  };

  const createMutation = useMutation({
    mutationFn: () => create({ data: { email, password, role: newRole } }),
    onSuccess: () => {
      setEmail("");
      setPassword("");
      setError(null);
      setNotice("تم إنشاء الحساب · Account created");
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
          createMutation.mutate();
        }}
        className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2"
      >
        <Text label="البريد الإلكتروني · Email" type="email" value={email} onChange={setEmail} required />
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
            disabled={createMutation.isPending}
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
            onRemove={() => removeMutation.mutate(member.id)}
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
  onRemove,
}: {
  member: { id: string; email: string; roles: StaffRole[]; last_sign_in_at: string | null };
  onReset: (password: string) => void;
  onRole: (role: StaffRole) => void;
  onRemove: () => void;
}) {
  const [password, setPassword] = useState("");

  return (
    <article className="grid gap-3 rounded-2xl border border-border bg-card p-4 lg:grid-cols-[1fr_auto_auto]">
      <div>
        <p className="font-bold text-foreground" dir="ltr">{member.email}</p>
        <p className="text-xs text-muted-foreground">
          {member.roles.map((r) => ROLE_LABEL[r]).join(" · ") || "بدون دور"}
          {member.last_sign_in_at ? ` · آخر دخول ${member.last_sign_in_at.slice(0, 10)}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-bold text-muted-foreground">
          <span className="sr-only">تغيير دور {member.email}</span>
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
          aria-label={`كلمة مرور جديدة لحساب ${member.email}`}
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
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`حذف حساب ${member.email}`}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-destructive/40 px-4 text-sm font-bold text-destructive"
      >
        <Users className="h-4 w-4" aria-hidden /> حذف
      </button>
    </article>
  );
}
