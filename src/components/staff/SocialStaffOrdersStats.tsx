import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Award,
  Calendar,
  Clock,
  Flame,
  Loader2,
  MessageCircle,
  Package,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { getSocialStaffStats, type SocialStaffStatsResult } from "@/lib/social.functions";
import { jordanDay } from "@/lib/date-filter";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";
import { OrderStatusBadge } from "@/components/staff/OrderStatusBadge";

export function SocialStaffOrdersStats() {
  const fetchStats = useServerFn(getSocialStaffStats);
  const [timeFilter, setTimeFilter] = useState<"today" | "week" | "month" | "all">("today");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isPending, isError, error, refetch, isFetching } = useQuery<SocialStaffStatsResult>(
    {
      queryKey: ["social-staff-stats"],
      queryFn: () => fetchStats({}),
      refetchInterval: 30000, // auto-refresh every 30 seconds
    },
  );

  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => jordanDay(now), [now]);
  const monthPrefix = useMemo(() => todayStr.slice(0, 7), [todayStr]);
  const sevenDaysAgo = useMemo(
    () => new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    [now],
  );

  const filteredOrders = useMemo(() => {
    if (!data?.myOrders) return [];
    let list = data.myOrders;

    // Time filtering
    if (timeFilter === "today") {
      list = list.filter((o) => jordanDay(o.created_at) === todayStr);
    } else if (timeFilter === "week") {
      list = list.filter((o) => o.created_at && o.created_at >= sevenDaysAgo);
    } else if (timeFilter === "month") {
      list = list.filter((o) => jordanDay(o.created_at).startsWith(monthPrefix));
    }

    // Text search
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          (o.order_number ?? "").toLowerCase().includes(q) ||
          (o.customer_name ?? "").toLowerCase().includes(q) ||
          (o.customer_phone ?? "").includes(q) ||
          (o.order_name ?? "").toLowerCase().includes(q),
      );
    }

    return list;
  }, [data?.myOrders, timeFilter, searchQuery, todayStr, sevenDaysAgo, monthPrefix]);

  if (isPending) {
    return (
      <div className="grid min-h-[350px] place-items-center rounded-3xl border border-border/80 bg-white p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-9 w-9 animate-spin text-[#8B4513]" />
          <p className="text-sm font-bold text-[#5D2E17]">جاري احتساب إحصائيات وطلباتك...</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-2 rounded-3xl border border-red-200 bg-red-50 p-6 text-center text-red-900">
        <p className="text-sm font-bold">تعذّر تحميل إحصائيات الطلبات.</p>
        {error && (
          <p className="inline-block max-w-md rounded-xl bg-red-100/60 p-2 font-mono text-xs text-red-700">
            {error instanceof Error ? error.message : String(error)}
          </p>
        )}
        <div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 cursor-pointer rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-700"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  const { currentStaff, myStats } = data;

  return (
    <div className="animate-in space-y-5 duration-200 fade-in">
      {/* 1. Header greeting & Live Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#FDE2CF] bg-gradient-to-r from-[#FFFDF9] to-[#FDF4EA] p-4 shadow-2xs sm:p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#8B4513] text-white shadow-sm">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-[#3E2723] sm:text-lg">
                إنجاز وسجل طلباتي · {currentStaff.username}
              </h2>
              {currentStaff.staffCode && (
                <span className="rounded-full bg-[#FDE2CF] px-2.5 py-0.5 text-xs font-black text-[#8B4513]">
                  كود #{currentStaff.staffCode}
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-[#7A6458]">
              تابعي إنجازك الشخصي اليومي والشهري وتفاصيل الطلبات التي قمتِ بإدخالها
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex cursor-pointer items-center gap-1.5 rounded-2xl border border-[#FDE2CF] bg-white px-3.5 py-2 text-xs font-black text-[#5D2E17] shadow-2xs transition hover:bg-amber-50 active:scale-95"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-[#8B4513]" : ""}`} />
          <span>تحديث</span>
        </button>
      </div>

      {/* 2. Key Stats Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Today */}
        <div className="space-y-1 rounded-2xl border border-amber-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-[#7A6458]">
            <span>طلباتي اليوم</span>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-100 text-amber-800">
              <Flame className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="text-2xl font-black text-[#8B4513]">{myStats.todayCount}</p>
          <p className="text-[11px] font-bold text-muted-foreground">
            بقيمة: {myStats.todaySales.toFixed(2)} د.أ
          </p>
        </div>

        {/* This Week */}
        <div className="space-y-1 rounded-2xl border border-amber-200/80 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-[#7A6458]">
            <span>طلباتي هذا الأسبوع</span>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-100 text-blue-800">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="text-2xl font-black text-[#3E2723]">{myStats.weekCount}</p>
          <p className="text-[11px] font-bold text-muted-foreground">آخر ٧ أيام</p>
        </div>

        {/* This Month */}
        <div className="space-y-1 rounded-2xl border border-amber-200/80 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-[#7A6458]">
            <span>طلباتي هذا الشهر</span>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-purple-100 text-purple-800">
              <Award className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="text-2xl font-black text-[#8B4513]">{myStats.monthCount}</p>
          <p className="text-[11px] font-bold text-muted-foreground">
            بقيمة: {myStats.monthSales.toFixed(2)} د.أ
          </p>
        </div>

        {/* Total All Time */}
        <div className="space-y-1 rounded-2xl border border-amber-200/80 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-[#7A6458]">
            <span>إجمالي طلباتي</span>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-100 text-emerald-800">
              <Package className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="text-2xl font-black text-[#3E2723]">{myStats.totalCount}</p>
          <p className="text-[11px] font-bold text-muted-foreground">
            إجمالي: {myStats.totalSales.toFixed(2)} د.أ
          </p>
        </div>
      </div>

      {/* 3. Section Title */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
        <h3 className="flex items-center gap-2 text-sm font-black text-[#5D2E17]">
          <Package className="h-4 w-4 text-[#8B4513]" />
          <span>سجل وقائمة طلباتي المفصلة ({filteredOrders.length})</span>
        </h3>
      </div>

      {/* MY ORDERS LIST */}
      <div className="animate-in space-y-3.5 duration-150 fade-in">
        {/* Filters Bar: Search & Time Chips */}
        <div className="flex flex-col items-stretch justify-between gap-2.5 sm:flex-row sm:items-center">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحثي برقم الطلب، اسم العميل، أو الهاتف..."
              className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white pr-10 pl-3 text-xs font-bold text-[#3E2723] focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
            />
          </div>

          {/* Time Filter Chips */}
          <div className="flex shrink-0 items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1">
            {(
              [
                { key: "today", label: "اليوم" },
                { key: "week", label: "هذا الأسبوع" },
                { key: "month", label: "هذا الشهر" },
                { key: "all", label: "كافة الطلبات" },
              ] as const
            ).map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setTimeFilter(chip.key)}
                className={`cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap transition ${
                  timeFilter === chip.key
                    ? "bg-[#8B4513] text-white shadow-2xs"
                    : "text-[#5D2E17] hover:bg-amber-50"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Cards List */}
        {filteredOrders.length === 0 ? (
          <div className="space-y-2 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <Package className="mx-auto h-10 w-10 text-slate-300" />
            <p className="text-sm font-bold text-[#5D2E17]">لا توجد طلبات مسجلة تحت هذا الفلتر</p>
            <p className="text-xs text-muted-foreground">
              يمكنك إدخال طلب جديد من تبويب "طلب جديد" وستظهر طلباتك هنا فوراً!
            </p>
          </div>
        ) : (
          <div className="grid gap-2.5">
            {filteredOrders.map((ord) => {
              const waUrl = ord.customer_phone ? getWhatsAppChatUrl(ord.customer_phone) : null;

              return (
                <div
                  key={ord.id}
                  className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs transition hover:border-[#8B4513]/40"
                >
                  {/* Top Row: Order Number, Time, Status */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-[#8B4513]">{ord.order_number}</span>
                      {ord.order_name && (
                        <span className="max-w-[200px] truncate text-xs font-bold text-slate-700">
                          {ord.order_name}
                        </span>
                      )}
                      <OrderStatusBadge status={ord.status} size="sm" />
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {ord.created_at?.slice(0, 10)}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {ord.created_at?.slice(11, 16)}
                      </span>
                    </div>
                  </div>

                  {/* Middle Row: Customer Info & Fulfillment */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-[#3E2723]">{ord.customer_name}</span>
                      <span dir="ltr" className="font-bold text-muted-foreground">
                        {ord.customer_phone}
                      </span>
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                        >
                          <MessageCircle className="h-3 w-3" />
                          <span>واتساب</span>
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-[#8B4513]">
                        {ord.method === "delivery"
                          ? `🛵 توصيل (${ord.area || "عمان"})`
                          : "🏪 استلام محلي"}
                      </span>
                      <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                        {ord.payment_method === "cliq" ? "⚡ كليك" : "💵 كاش"}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Row: Financials */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-1 text-xs font-bold">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>
                        الموعد المطلوب: {ord.requested_date} ({ord.requested_time?.slice(0, 5)})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {ord.deposit_paid > 0 && ord.deposit_paid < ord.total && (
                        <span className="text-muted-foreground">
                          مدفوع: {ord.deposit_paid.toFixed(2)} د.أ
                        </span>
                      )}
                      <span className="text-sm font-black text-[#8B4513]">
                        {ord.total.toFixed(2)} د.أ
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
