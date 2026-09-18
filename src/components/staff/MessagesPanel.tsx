import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Phone, RotateCcw, MessageSquare, ExternalLink } from "lucide-react";
import {
  listCustomerMessages,
  setCustomerMessageStatus,
  type CustomerMessage,
} from "@/lib/customer-messages.functions";
import { supabase } from "@/integrations/supabase/client";

const MESSAGES_KEY = ["staff", "customer-messages"] as const;

function formatWhatsappPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("962")) return digits;
  if (digits.startsWith("07") && digits.length === 10) return `962${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 9) return `962${digits}`;
  return digits;
}

/** Customer comments and complaints sent from the public website. */
export function MessagesPanel() {
  const queryClient = useQueryClient();
  const load = useServerFn(listCustomerMessages);
  const setStatus = useServerFn(setCustomerMessageStatus);

  const messages = useQuery({
    queryKey: MESSAGES_KEY,
    queryFn: () => load(),
    refetchInterval: 30_000,
  });

  // Real-time subscription for incoming customer messages
  useEffect(() => {
    const invalidate = () => void queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
    const channel = supabase
      .channel(`customer-messages-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_messages" }, invalidate)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const update = useMutation({
    mutationFn: (input: { id: string; status: "new" | "handled" }) => setStatus({ data: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MESSAGES_KEY }),
  });

  const rows: CustomerMessage[] = messages.data ?? [];
  const openCount = rows.filter((row) => row.status !== "handled").length;

  return (
    <main dir="rtl" className="mx-auto w-full max-w-4xl space-y-4 px-4 py-5">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <h1 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            رسائل العملاء والشكاوى (Customer Messages)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            متابعة استفسارات وشكاوى وآراء العملاء المرسلة عبر الموقع والتواصل المباشر معهم.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3.5 py-1 text-xs font-black transition-all ${
            openCount > 0 ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse" : "bg-emerald-100 text-emerald-800 border border-emerald-300"
          }`}>
            {openCount > 0 ? `جديدة: ${openCount} 📬` : "كل الرسائل مجابة ✅"}
          </span>
        </div>
      </header>

      {messages.isPending ? (
        <p className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> جاري تحميل الرسائل والشكاوى…
        </p>
      ) : messages.isError ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          تعذّر تحميل الرسائل · Could not load messages
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-xs">
          لا توجد رسائل أو شكاوى مرسلة حتى الآن 🌸
        </p>
      ) : (
        <ul className="space-y-3.5">
          {rows.map((row) => {
            const handled = row.status === "handled";
            const waPhone = formatWhatsappPhone(row.phone);
            const waText = encodeURIComponent(`مرحباً ${row.name} الكريم، معك فريق مخبز ديليش بخصوص رسالتك/ملاحظتك 🌸`);
            const waUrl = `https://wa.me/${waPhone}?text=${waText}`;

            return (
              <li
                key={row.id}
                className={`rounded-2xl border p-4 sm:p-5 shadow-xs transition-all ${
                  handled
                    ? "border-slate-200 bg-white/70 opacity-80"
                    : "border-amber-300 bg-[#FFFDF9] ring-1 ring-amber-400/30"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-foreground">{row.name}</span>
                      {!handled && (
                        <span className="rounded-full bg-amber-500 text-white px-2 py-0.5 text-[10px] font-black uppercase">
                          جديدة
                        </span>
                      )}
                    </div>
                    <a
                      href={`tel:${row.phone}`}
                      dir="ltr"
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden /> {row.phone}
                    </a>
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("ar-JO")}
                  </span>
                </div>

                {/* Message Body */}
                <div className="mt-3 rounded-xl bg-white p-3.5 border border-border/60 text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                  {row.message}
                </div>

                {/* Action Buttons Row */}
                <div className="mt-4 flex flex-wrap items-center gap-2 pt-1">
                  {/* Action 1: WhatsApp Chat */}
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[#25D366] px-4 text-xs font-extrabold text-white shadow-xs hover:bg-[#20ba59] active:scale-95 transition-all"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>💬 تواصل عبر واتساب</span>
                    <ExternalLink className="h-3 w-3 opacity-80" />
                  </a>

                  {/* Action 2: Toggle Status */}
                  <button
                    type="button"
                    disabled={update.isPending}
                    onClick={() => update.mutate({ id: row.id, status: handled ? "new" : "handled" })}
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-xs font-bold transition-all disabled:opacity-60 cursor-pointer ${
                      handled
                        ? "border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                        : "bg-[#B8801C] text-white shadow-xs hover:bg-[#9E6C14]"
                    }`}
                  >
                    {handled ? (
                      <>
                        <RotateCcw className="h-4 w-4" /> 🔄 إعادة كجديدة
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" /> ✅ تم الاطلاع / تم الحل
                      </>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
