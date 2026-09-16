import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Phone, RotateCcw } from "lucide-react";
import {
  listCustomerMessages,
  setCustomerMessageStatus,
  type CustomerMessage,
} from "@/lib/customer-messages.functions";

const MESSAGES_KEY = ["staff", "customer-messages"] as const;

/** Customer comments and issues sent from the public website. */
export function MessagesPanel() {
  const queryClient = useQueryClient();
  const load = useServerFn(listCustomerMessages);
  const setStatus = useServerFn(setCustomerMessageStatus);

  const messages = useQuery({
    queryKey: MESSAGES_KEY,
    queryFn: () => load(),
    refetchInterval: 60_000,
  });

  const update = useMutation({
    mutationFn: (input: { id: string; status: "new" | "handled" }) => setStatus({ data: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MESSAGES_KEY }),
  });

  const rows: CustomerMessage[] = messages.data ?? [];
  const open = rows.filter((row) => row.status !== "handled").length;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-lg font-bold text-[#3E2723]">
          رسائل العملاء · Customer messages
        </h1>
        <span className="rounded-full bg-[#FDF6EC] px-3 py-1 text-xs font-bold text-[#8B4513]">
          جديدة: {open}
        </span>
      </header>

      {messages.isPending ? (
        <p className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-[#7A6458]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> جاري التحميل…
        </p>
      ) : messages.isError ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          تعذّر تحميل الرسائل · Could not load messages
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-[#7A6458]">
          لا توجد رسائل بعد · No messages yet
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const handled = row.status === "handled";
            return (
              <li
                key={row.id}
                className={`rounded-2xl border p-4 shadow-xs ${
                  handled ? "border-slate-200 bg-white" : "border-[#EFA781] bg-[#FFF8F1]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#3E2723]">{row.name}</p>
                    <a
                      href={`tel:${row.phone}`}
                      dir="ltr"
                      className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-[#8B4513] underline"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden /> {row.phone}
                    </a>
                  </div>
                  <span className="text-[11px] text-[#7A6458]">
                    {new Date(row.created_at).toLocaleString("ar-JO")}
                  </span>
                </div>

                <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-white/80 p-3 text-sm text-[#3E2723]">
                  {row.message}
                </p>

                <button
                  type="button"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ id: row.id, status: handled ? "new" : "handled" })}
                  className={`mt-3 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs font-bold disabled:opacity-60 ${
                    handled
                      ? "border border-slate-200 bg-white text-[#5D2E17]"
                      : "bg-[#8B4513] text-white shadow-sm"
                  }`}
                >
                  {handled ? (
                    <>
                      <RotateCcw className="h-4 w-4" aria-hidden /> إعادة كجديدة
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" aria-hidden /> تم التعامل معها
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
