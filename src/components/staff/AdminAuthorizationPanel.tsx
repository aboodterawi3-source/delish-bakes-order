import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock, Search, SlidersHorizontal, Unlock } from "lucide-react";
import { toast } from "sonner";

import { ROLE_LABEL } from "@/components/staff/admin-shared";
import {
  listAuditLogs,
  listStaffAuthorizations,
  setStaffAuthorization,
  type StaffAuthorizationRow,
} from "@/lib/authorization.functions";
import { jod } from "@/lib/currency";

const AUDIT_ACTION_LABEL: Record<string, { ar: string; class: string }> = {
  price_override: { ar: "تعديل سعر ✏️", class: "bg-amber-100 text-amber-900 border-amber-300" },
  custom_discount: { ar: "تطبيق خصم 🏷️", class: "bg-purple-100 text-purple-900 border-purple-300" },
  status_change: { ar: "تغيير حالة 🔄", class: "bg-blue-100 text-blue-900 border-blue-300" },
  order_edit: { ar: "تعديل طلب 📝", class: "bg-emerald-100 text-emerald-900 border-emerald-300" },
};

/** Staff authorization matrix (price/discount caps) and immutable audit log viewer. */
export function AdminAuthorizationPanel() {
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
    mutationFn: (input: { userId: string } & Partial<StaffAuthorizationRow>) =>
      saveFn({ data: input }),
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
      <div className="space-y-4 rounded-3xl border border-[#EFE8DC] bg-white p-5 shadow-xs sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-black text-[#26160F]">
          <SlidersHorizontal className="h-5 w-5 text-[#B8801C]" aria-hidden="true" />
          مصفوفة صلاحيات تعديل الأسعار والخصومات المباشرة
        </h2>
        <p className="text-xs leading-relaxed text-[#4A3B32]/80">
          قم بتفعيل أو إلغاء صلاحية تعديل الأسعار والخصومات لكل موظف مبيعات وسوشال ميديا، وحدّد أقصى
          نسبة خصم مسموحة.
        </p>

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
            {error}
          </p>
        ) : null}

        {rows.isPending ? (
          <p className="flex items-center gap-2 text-xs text-[#4A3B32]/70">
            <Loader2 className="h-4 w-4 animate-spin text-[#B8801C]" aria-hidden="true" /> جارٍ
            التحميل…
          </p>
        ) : (
          <div className="space-y-3">
            {(rows.data ?? []).map((row) => (
              <div
                key={row.user_id}
                className="space-y-3 rounded-2xl border border-[#EFE8DC] bg-[#FDFBF7] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFE8DC] pb-2">
                  <span className="text-sm font-bold text-[#26160F]">{row.username}</span>
                  <div className="flex items-center gap-1">
                    {row.roles.map((role) => (
                      <span
                        key={role}
                        className="rounded-full border border-[#EFE8DC] bg-[#FEF7EB] px-2.5 py-0.5 text-[10px] font-bold text-[#B8801C]"
                      >
                        {ROLE_LABEL[role as keyof typeof ROLE_LABEL] ?? role}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() =>
                      save.mutate({
                        userId: row.user_id,
                        allow_price_override: !row.allow_price_override,
                      })
                    }
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition-all ${
                      row.allow_price_override
                        ? "bg-[#B8801C] text-white shadow-xs"
                        : "border border-[#EFE8DC] bg-white text-[#4A3B32] hover:bg-[#FEF7EB]"
                    }`}
                  >
                    {row.allow_price_override ? (
                      <Unlock className="h-4 w-4" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    <span>
                      {row.allow_price_override
                        ? "تعديل الأسعار (مسموح) 🔓"
                        : "تعديل الأسعار (مقيد) 🔒"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      save.mutate({
                        userId: row.user_id,
                        allow_custom_discount: !row.allow_custom_discount,
                      })
                    }
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition-all ${
                      row.allow_custom_discount
                        ? "bg-[#B8801C] text-white shadow-xs"
                        : "border border-[#EFE8DC] bg-white text-[#4A3B32] hover:bg-[#FEF7EB]"
                    }`}
                  >
                    {row.allow_custom_discount ? (
                      <Unlock className="h-4 w-4" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    <span>
                      {row.allow_custom_discount
                        ? "الخصم الخاص (مسموح) 🏷️"
                        : "الخصم الخاص (مقيد) 🔒"}
                    </span>
                  </button>

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

      <div className="space-y-4 rounded-3xl border border-[#EFE8DC] bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE8DC] pb-3">
          <div>
            <h3 className="text-base font-black text-[#26160F]">
              📜 سجل التدقيق الأمني والعمليات (Audit Log)
            </h3>
            <p className="mt-0.5 text-xs text-[#4A3B32]/70">
              سجل توثيقي غير قابل للتعديل لجميع تعديلات الأسعار والخصومات (عرض تلقائي لآخر 30
              يوماً).
            </p>
          </div>
          <div className="relative w-full max-w-xs sm:w-auto">
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
                  <td colSpan={8} className="p-4 text-center text-xs text-[#4A3B32]/70">
                    لا توجد سجلات مطابقة.
                  </td>
                </tr>
              ) : (
                filteredAudit.map((entry) => {
                  const badge = AUDIT_ACTION_LABEL[entry.action] ?? {
                    ar: entry.action,
                    class: "bg-slate-100 text-slate-700",
                  };
                  return (
                    <tr key={entry.id} className="hover:bg-[#FEF7EB]">
                      <td className="p-3 font-bold text-[#26160F]">{entry.staff_name}</td>
                      <td className="p-3 font-bold text-[#6E3917]">{entry.order_number ?? "—"}</td>
                      <td className="p-3">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${badge.class}`}
                        >
                          {badge.ar}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-[#4A3B32]">
                        {entry.original_amount ? jod(entry.original_amount) : "—"}
                      </td>
                      <td className="p-3 font-bold text-[#26160F]">
                        {entry.modified_amount ? jod(entry.modified_amount) : "—"}
                      </td>
                      <td className="p-3 font-bold text-[#B8801C]">
                        {entry.discount_percent != null ? `${entry.discount_percent}%` : "—"}
                      </td>
                      <td className="p-3 text-xs text-[#4A3B32]">
                        {entry.reason ?? "تعديل عبر النظام"}
                      </td>
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
