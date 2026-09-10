import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  ClipboardList,
  Columns3,
  Download,
  ExternalLink,
  List,
  Printer,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { WHATSAPP } from "@/lib/menu";
import { useDismissable } from "@/lib/a11y";
import {
  loadOrders,
  saveOrders,
  seedOrders,
  statusMessage,
  statusMeta,
  statusOrder,
  type Order,
  type OrderStatus,
} from "@/lib/orders";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "لوحة إدارة الطلبات | Delish Cake & Bake" },
      {
        name: "description",
        content: "لوحة تحكم داخلية لفريق Delish Cake & Bake لمتابعة الطلبات وتحديث حالتها وإرسال التحديثات للعملاء عبر واتساب.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "لوحة إدارة الطلبات | Delish Cake & Bake" },
      { property: "og:description", content: "متابعة طلبات المخبز وتحديث حالتها لحظياً." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/admin" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/admin" }],
  }),
  component: AdminPage,
});

const jod = (n: number) => `${n.toFixed(2)} د.أ`;

function AdminPage() {
  const [orders, setOrders] = useState<Order[]>(seedOrders);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [view, setView] = useState<"board" | "list">("board");
  const [openId, setOpenId] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const searchId = useId();

  useEffect(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    setOrders(loadOrders());
  }, []);

  const update = (next: Order[]) => {
    setOrders(next);
    saveOrders(next);
  };

  const move = (id: string, dir: 1 | -1) => {
    const next = orders.map((o) => {
      if (o.id !== id) return o;
      const i = statusOrder.indexOf(o.status);
      const target = statusOrder[Math.min(statusOrder.length - 1, Math.max(0, i + dir))]!;
      setLive(`الطلب ${o.id}: ${statusMeta[target].ar}`);
      return { ...o, status: target };
    });
    update(next);
  };

  const setStatus = (id: string, status: OrderStatus) => {
    update(orders.map((o) => (o.id === id ? { ...o, status } : o)));
    setLive(`الطلب ${id}: ${statusMeta[status].ar}`);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      const okStatus = filter === "all" || o.status === filter;
      const okQuery =
        !q ||
        [o.id, o.customer, o.phone, o.area ?? "", ...o.lines.map((l) => l.ar), ...o.lines.map((l) => l.en)]
          .join(" ")
          .toLowerCase()
          .includes(q);
      return okStatus && okQuery;
    });
  }, [orders, query, filter]);

  const kpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todays = orders.filter((o) => o.createdAt.slice(0, 10) === today);
    return {
      count: todays.length,
      pending: orders.filter((o) => o.status !== "delivered").length,
      revenue: todays.reduce((s, o) => s + o.total, 0),
      ready: orders.filter((o) => o.status === "ready").length,
    };
  }, [orders]);

  const openOrder = orders.find((o) => o.id === openId) ?? null;

  const exportExcel = () => {
    const rows = [
      ["Order", "Customer", "Phone", "Date", "Time", "Status", "Total JOD"],
      ...orders.map((o) => [o.id, o.customer, o.phone, o.date, o.time, statusMeta[o.status].en, o.total.toFixed(2)]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `delish-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setLive("تم تصدير ملف الطلبات");
  };

  return (
    <div dir="rtl" className="min-h-dvh bg-background">
      <a
        href="#orders"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:start-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        تخطَّ إلى قائمة الطلبات
      </a>

      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold sm:text-2xl">لوحة الطلبات</h1>
            <p className="mt-1 text-xs font-semibold text-gold-light">Delish Cake &amp; Bake — فريق العمل</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={exportExcel} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-primary-foreground/40 px-4 text-sm font-semibold">
              <Download className="h-4 w-4" aria-hidden="true" /> Excel
            </button>
            <Link to="/kds" className="inline-flex min-h-12 items-center rounded-full border border-primary-foreground/40 px-4 text-sm font-semibold">
              شاشة المطبخ
            </Link>
            <button
              onClick={() => {
                setOrders(loadOrders());
                setLive("تم تحديث القائمة");
              }}
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-primary-foreground/40 px-4 text-sm font-semibold"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> تحديث
            </button>
            <Link
              to="/"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-gold px-4 text-sm font-bold text-cocoa"
            >
              الموقع
            </Link>
          </div>
        </div>
      </header>

      <p aria-live="polite" className="sr-only">
        {live}
      </p>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <h2 className="sr-only">ملخّص اليوم</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={ClipboardList} label="طلبات اليوم" value={String(kpis.count)} />
          <Kpi icon={CalendarClock} label="قيد التنفيذ" value={String(kpis.pending)} />
          <Kpi icon={Wallet} label="إيرادات اليوم" value={jod(kpis.revenue)} />
          <Kpi icon={Columns3} label="جاهز للتسليم" value={String(kpis.ready)} />
        </div>

        <section aria-labelledby="analytics-title" className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-5">
            <h2 id="analytics-title" className="flex items-center gap-2 font-display text-lg font-bold"><TrendingUp className="h-5 w-5 text-gold-deep" /> تحليل المبيعات</h2>
            <div className="mt-5 flex h-36 items-end gap-3" aria-label="مبيعات الطلبات الحالية">
              {orders.slice(0, 7).reverse().map((order) => {
                const max = Math.max(...orders.map((item) => item.total), 1);
                return <div key={order.id} className="flex min-w-0 flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-md bg-primary" style={{ height: `${Math.max(12, (order.total / max) * 110)}px` }} /><span className="truncate text-[10px] text-muted-foreground">{order.id.replace("DL-", "")}</span></div>;
              })}
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Users className="h-5 w-5 text-gold-deep" /> دليل العملاء</h2>
            <ul className="mt-4 max-h-40 space-y-2 overflow-y-auto">
              {Array.from(new Map(orders.map((order) => [order.phone, order])).values()).map((order) => (
                <li key={order.phone} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border pb-2 text-sm last:border-0">
                  <span className="truncate font-semibold">{order.customer}</span><a dir="ltr" href={`tel:${order.phone}`} className="shrink-0 text-primary underline">{order.phone}</a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="orders" aria-labelledby="orders-title" className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="orders-title" className="font-display text-lg font-semibold">
              مسار الطلبات
            </h2>
            <div className="flex gap-2" role="group" aria-label="طريقة العرض">
              <button
                onClick={() => setView("board")}
                aria-pressed={view === "board"}
                className={`inline-flex min-h-12 items-center gap-2 rounded-full border px-4 text-sm ${
                  view === "board" ? "border-gold bg-secondary font-semibold" : "border-border text-foreground"
                }`}
              >
                <Columns3 className="h-4 w-4" aria-hidden="true" /> لوحة
              </button>
              <button
                onClick={() => setView("list")}
                aria-pressed={view === "list"}
                className={`inline-flex min-h-12 items-center gap-2 rounded-full border px-4 text-sm ${
                  view === "list" ? "border-gold bg-secondary font-semibold" : "border-border text-foreground"
                }`}
              >
                <List className="h-4 w-4" aria-hidden="true" /> قائمة
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <label htmlFor={searchId} className="mb-2 block text-xs font-bold text-muted-foreground uppercase">
                بحث بالاسم أو الرقم أو المنتج
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 start-4 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id={searchId}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="مثال: DL-1041 أو رنا"
                  className="min-h-12 w-full rounded-2xl border border-input bg-card ps-11 pe-4 text-sm outline-none focus:border-gold"
                />
              </div>
            </div>
            <div>
              <span className="mb-2 block text-xs font-bold text-muted-foreground uppercase">تصفية بالحالة</span>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
                  الكل ({orders.length})
                </FilterChip>
                {statusOrder.map((s) => (
                  <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>
                    {statusMeta[s].ar} ({orders.filter((o) => o.status === s).length})
                  </FilterChip>
                ))}
              </div>
            </div>
          </div>

          {filtered.length === 0 && (
            <p className="mt-8 rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              لا توجد طلبات مطابقة لبحثك.
            </p>
          )}

          {view === "board" ? (
            <div className="no-scrollbar -mx-4 mt-6 flex gap-4 overflow-x-auto px-4 pb-2 xl:mx-0 xl:grid xl:grid-cols-5 xl:overflow-visible xl:px-0">
              {statusOrder.map((s) => {
                const col = filtered.filter((o) => o.status === s);
                return (
                  <section
                    key={s}
                    aria-label={`${statusMeta[s].ar} — ${col.length} طلب`}
                    className="w-72 shrink-0 rounded-3xl border border-border bg-card p-3 xl:w-auto"
                  >
                    <h3 className="flex items-center gap-2 px-1 pb-3 text-sm font-bold">
                      <span className={`h-2.5 w-2.5 rounded-full ${statusMeta[s].dot}`} aria-hidden="true" />
                      {statusMeta[s].ar}
                      <span className="text-xs font-normal text-muted-foreground">({col.length})</span>
                    </h3>
                    <ul className="space-y-3">
                      {col.map((o) => (
                        <li key={o.id}>
                          <OrderCard order={o} onOpen={() => setOpenId(o.id)} onMove={move} />
                        </li>
                      ))}
                      {col.length === 0 && <li className="px-1 pb-2 text-xs text-muted-foreground">لا شيء هنا</li>}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {filtered.map((o) => (
                <li key={o.id}>
                  <OrderCard order={o} onOpen={() => setOpenId(o.id)} onMove={move} wide />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {openOrder && (
        <OrderDialog
          order={openOrder}
          onClose={() => setOpenId(null)}
          onStatus={(s) => setStatus(openOrder.id, s)}
        />
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4 text-gold-deep" aria-hidden="true" />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-12 rounded-full border px-4 text-sm whitespace-nowrap ${
        active ? "border-gold bg-gold font-bold text-cocoa" : "border-border bg-card text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function OrderCard({
  order,
  onOpen,
  onMove,
  wide,
}: {
  order: Order;
  onOpen: () => void;
  onMove: (id: string, dir: 1 | -1) => void;
  wide?: boolean;
}) {
  const i = statusOrder.indexOf(order.status);
  return (
    <article className={`rounded-2xl border border-border bg-background p-3 ${wide ? "sm:flex sm:items-center sm:gap-4" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="truncate text-sm font-bold">
            {order.customer} <span className="font-normal text-muted-foreground">· {order.id}</span>
          </h4>
          <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-xs font-bold">{jod(order.total)}</span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {order.lines.map((l) => `${l.ar} ×${l.qty}`).join(" · ")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {order.method === "delivery" ? `توصيل — ${order.area ?? ""}` : "استلام من الفرع"} · {order.time}
        </p>
      </div>
      <div className="mt-3 flex items-center gap-2 sm:mt-0">
        <button
          onClick={() => onMove(order.id, -1)}
          disabled={i === 0}
          aria-label={`إرجاع الطلب ${order.id} إلى المرحلة السابقة`}
          className="grid h-12 w-12 place-items-center rounded-full border border-border disabled:opacity-40"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          onClick={() => onMove(order.id, 1)}
          disabled={i === statusOrder.length - 1}
          aria-label={`تقديم الطلب ${order.id} إلى المرحلة التالية`}
          className="grid h-12 w-12 place-items-center rounded-full border border-border disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          onClick={onOpen}
          className="min-h-12 flex-1 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          التفاصيل
        </button>
      </div>
    </article>
  );
}

function OrderDialog({
  order,
  onClose,
  onStatus,
}: {
  order: Order;
  onClose: () => void;
  onStatus: (s: OrderStatus) => void;
}) {
  const titleId = useId();
  useDismissable(true, onClose);
  const waUrl = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(statusMessage(order, order.status))}`;

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex items-end justify-center bg-primary/75 sm:items-center sm:p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label="إغلاق التفاصيل"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card sm:rounded-3xl"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <h2 id={titleId} className="font-display text-lg font-semibold">
            الطلب {order.id}
          </h2>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="grid h-12 w-12 place-items-center rounded-full border border-border"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <section aria-label="بيانات العميل" className="rounded-2xl border border-border p-4 text-sm">
            <h3 className="mb-2 text-xs font-bold text-muted-foreground uppercase">بيانات العميل</h3>
            <p className="font-semibold">{order.customer}</p>
            <p dir="ltr" className="text-muted-foreground">
              {order.phone}
            </p>
            <p className="mt-2 text-muted-foreground">
              {order.method === "delivery" ? `توصيل — ${order.area ?? ""}` : "استلام من الفرع"}
            </p>
            {order.address && <p className="text-muted-foreground">{order.address}</p>}
            <p className="mt-1 text-muted-foreground">
              {order.date} · {order.time}
            </p>
          </section>

          <section aria-label="عناصر الطلب">
            <h3 className="mb-2 text-xs font-bold text-muted-foreground uppercase">عناصر الطلب</h3>
            <ul className="space-y-3">
              {order.lines.map((l) => (
                <li key={l.key} className="flex gap-3 rounded-2xl border border-border p-3">
                  {l.image && (
                    <img
                      src={l.image}
                      alt={l.ar}
                      loading="lazy"
                      width={64}
                      height={64}
                      className="h-16 w-16 shrink-0 rounded-xl object-cover"
                    />
                  )}
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold">
                      {l.ar} × {l.qty}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {l.detailsAr.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                      {l.notes && <li>ملاحظة: {l.notes}</li>}
                    </ul>
                  </div>
                  <span className="ms-auto shrink-0 text-sm font-semibold">{jod(l.unit * l.qty)}</span>
                </li>
              ))}
            </ul>
          </section>

          {(order.inscription || order.designImage) && (
            <section aria-label="الكتابة والتصميم" className="rounded-2xl border border-gold/40 bg-secondary/50 p-4">
              <h3 className="mb-2 text-xs font-bold text-muted-foreground uppercase">الكتابة على الكيك والتصميم</h3>
              {order.inscription && <p className="text-sm font-semibold">«{order.inscription}»</p>}
              {order.designImage && (
                <img
                  src={order.designImage}
                  alt={`صورة التصميم المرفقة مع الطلب ${order.id}`}
                  loading="lazy"
                  width={640}
                  height={420}
                  className="mt-3 aspect-4/3 w-full rounded-xl object-cover"
                />
              )}
            </section>
          )}

          {order.notes && (
            <section aria-label="ملاحظات" className="rounded-2xl border border-border p-4 text-sm">
              <h3 className="mb-1 text-xs font-bold text-muted-foreground uppercase">ملاحظات العميل</h3>
              <p>{order.notes}</p>
            </section>
          )}

          <section aria-label="الحساب" className="rounded-2xl bg-secondary/60 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">المجموع</span>
              <span>{jod(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">التوصيل</span>
              <span>{jod(order.deliveryFee)}</span>
            </div>
            <div className="mt-1 flex justify-between font-display text-base font-bold">
              <span>الإجمالي</span>
              <span>{jod(order.total)}</span>
            </div>
          </section>

          <button type="button" onClick={() => window.print()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-primary px-5 text-sm font-bold text-primary">
            <Printer className="h-4 w-4" aria-hidden="true" /> طباعة حرارية
          </button>

          <section aria-label="تحديث الحالة">
            <h3 className="mb-2 text-xs font-bold text-muted-foreground uppercase">تحديث الحالة</h3>
            <div className="flex flex-wrap gap-2">
              {statusOrder.map((s) => (
                <button
                  key={s}
                  onClick={() => onStatus(s)}
                  aria-pressed={order.status === s}
                  className={`min-h-12 rounded-full border px-4 text-sm ${
                    order.status === s ? "border-gold bg-gold font-bold text-cocoa" : "border-border text-foreground"
                  }`}
                >
                  {statusMeta[s].ar}
                </button>
              ))}
            </div>
          </section>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#128C3C] px-5 text-sm font-bold text-white"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            إرسال تحديث «{statusMeta[order.status].ar}» عبر واتساب
          </a>
        </div>
      </div>
    </div>
  );
}
