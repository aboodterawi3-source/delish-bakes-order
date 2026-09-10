import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, ChefHat, Clock3, RefreshCw } from "lucide-react";
import { loadOrders, ORDER_EVENT, saveOrders, statusMeta, statusOrder, type Order, type OrderStatus } from "@/lib/orders";

export const Route = createFileRoute("/kds")({
  head: () => ({
    meta: [
      { title: "Kitchen Display | Delish Cake & Bake" },
      { name: "description", content: "Live kitchen order preparation display for Delish Cake & Bake." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Kitchen Display | Delish Cake & Bake" },
      { property: "og:description", content: "Live bakery preparation and order schedule display." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/kds" }],
  }),
  component: KdsPage,
});

const kitchenStatuses: OrderStatus[] = ["new", "confirmed", "baking", "ready"];

function KdsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [sound, setSound] = useState(false);
  const previousCount = useRef(0);

  const refresh = () => {
    const next = loadOrders();
    if (sound && previousCount.current > 0 && next.length > previousCount.current) playBell();
    previousCount.current = next.length;
    setOrders(next);
  };

  useEffect(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(ORDER_EVENT, refresh);
    const timer = window.setInterval(refresh, 5000);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(ORDER_EVENT, refresh);
      window.clearInterval(timer);
    };
  }, [sound]);

  const active = useMemo(() => orders.filter((order) => order.status !== "delivered"), [orders]);

  const patchOrder = (id: string, patch: Partial<Order>) => {
    const next = orders.map((order) => (order.id === id ? { ...order, ...patch } : order));
    setOrders(next);
    saveOrders(next);
  };

  return (
    <div dir="rtl" className="min-h-dvh bg-foreground text-primary-foreground">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-primary-foreground/15 px-4 py-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary"><ChefHat className="h-6 w-6" /></div>
          <div className="min-w-0"><h1 className="truncate font-display text-xl font-bold sm:text-2xl">شاشة المطبخ</h1><p className="text-xs text-primary-foreground/65">{active.length} طلبات نشطة</p></div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => { setSound((value) => !value); if (!sound) playBell(); }} aria-pressed={sound} aria-label="تنبيهات صوتية" className="grid h-12 w-12 place-items-center rounded-full border border-primary-foreground/25">
            {sound ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </button>
          <button type="button" onClick={refresh} aria-label="تحديث" className="grid h-12 w-12 place-items-center rounded-full border border-primary-foreground/25"><RefreshCw className="h-5 w-5" /></button>
          <Link to="/admin" className="inline-flex min-h-12 items-center rounded-full bg-primary px-4 text-sm font-bold">الإدارة</Link>
        </div>
      </header>

      <main className="no-scrollbar flex min-h-[calc(100dvh-81px)] gap-3 overflow-x-auto p-3 lg:grid lg:grid-cols-4 lg:overflow-visible">
        {kitchenStatuses.map((status) => {
          const lane = active.filter((order) => order.status === status);
          return (
            <section key={status} className="w-[85vw] shrink-0 rounded-2xl bg-primary-foreground/7 p-3 sm:w-80 lg:w-auto">
              <h2 className="flex items-center gap-2 border-b border-primary-foreground/15 pb-3 text-sm font-bold"><span className={`h-3 w-3 rounded-full ${statusMeta[status].dot}`} />{statusMeta[status].ar}<span className="text-primary-foreground/55">({lane.length})</span></h2>
              <div className="mt-3 space-y-3">
                {lane.map((order) => <KitchenTicket key={order.id} order={order} onPatch={(patch) => patchOrder(order.id, patch)} />)}
                {lane.length === 0 && <p className="py-10 text-center text-xs text-primary-foreground/45">لا توجد طلبات</p>}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}

function KitchenTicket({ order, onPatch }: { order: Order; onPatch: (patch: Partial<Order>) => void }) {
  const index = statusOrder.indexOf(order.status);
  const next = statusOrder[index + 1];
  return (
    <article className="rounded-xl bg-card p-4 text-card-foreground shadow-[var(--shadow-soft)]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><div className="min-w-0"><h3 className="truncate font-bold">{order.id} · {order.customer}</h3><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{order.date} · {order.time}</p></div><span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-xs font-bold">{order.total.toFixed(2)} د.أ</span></div>
      <ul className="mt-3 space-y-3 border-y border-border py-3">
        {order.lines.map((line) => <li key={line.key}><p className="text-sm font-bold">{line.qty}× {line.ar}</p>{line.detailsAr.map((detail) => <p key={detail} className="mt-0.5 text-xs text-muted-foreground">• {detail}</p>)}</li>)}
      </ul>
      {order.inscription && <p className="mt-3 rounded-lg bg-secondary p-2 text-xs font-bold">الكتابة: {order.inscription}</p>}
      {order.notes && <p className="mt-2 text-xs text-muted-foreground">ملاحظة: {order.notes}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-[10px] font-bold text-muted-foreground">التاريخ<input type="date" value={order.date} onChange={(event) => onPatch({ date: event.target.value })} className="mt-1 min-h-12 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label>
        <label className="text-[10px] font-bold text-muted-foreground">الوقت<input type="time" value={order.time} onChange={(event) => onPatch({ time: event.target.value })} className="mt-1 min-h-12 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label>
      </div>
      {next && <button type="button" onClick={() => onPatch({ status: next })} className="mt-3 min-h-12 w-full rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground">{statusMeta[next].ar}</button>}
    </article>
  );
}

function playBell() {
  const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.setValueAtTime(880, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.3);
  gain.gain.setValueAtTime(0.18, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.45);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.45);
}