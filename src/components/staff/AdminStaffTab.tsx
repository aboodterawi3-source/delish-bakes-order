import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  KeyRound,
  Loader2,
  Lock,
  Plus,
  Search,
  SlidersHorizontal,
  Unlock,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { ROLE_LABEL } from "@/components/staff/admin-shared";
import { supabase } from "@/integrations/supabase/client";
import {
  createStaff,
  listStaff,
  removeStaff,
  resetStaffPassword,
  setStaffCode,
  setStaffRole,
  type StaffRole,
} from "@/lib/admin.functions";
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

export function AdminStaffTab() {
  return (
    <div className="space-y-8">
      <StaffPanel />
      <AuthorizationPanel />
    </div>
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

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-[#EFE8DC] bg-[#FEF7EB] p-3 text-xs font-bold text-[#B8801C]"
        >
          {notice}
        </p>
      )}

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
        className="grid gap-3 rounded-2xl border border-[#EFE8DC] bg-white p-5 shadow-xs sm:grid-cols-2 lg:grid-cols-4"
      >
        <Text
          label="اسم الموظف / المستخدم *"
          type="text"
          value={username}
          onChange={setUsername}
          required
        />
        <Text
          label="كلمة المرور (8 أحرف+) *"
          type="password"
          value={password}
          onChange={setPassword}
          required
        />
        <Text
          label="رقم الموظف (موظف #1, #2...)"
          type="number"
          value={newStaffCode}
          onChange={setNewStaffCode}
        />
        <label className="block text-xs font-bold text-[#26160F]">
          الدور والصلاحية *
          <select
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as StaffRole)}
            className="mt-1 min-h-11 w-full rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-3 text-xs font-bold text-[#26160F]"
          >
            {(Object.keys(ROLE_LABEL) as StaffRole[]).map((key) => (
              <option key={key} value={key}>
                {ROLE_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end pt-1 lg:col-span-4">
          <button
            type="submit"
            disabled={createMutation.isPending || password.length < 8 || !username.trim()}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#B8801C] px-5 text-xs font-bold text-white shadow-xs hover:bg-[#9E6C14] disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
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
    <article className="grid items-center gap-3 rounded-2xl border border-[#EFE8DC] bg-white p-4 shadow-xs lg:grid-cols-[1fr_auto_auto]">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#26160F] sm:text-base">{member.username}</span>
          {member.staff_code && (
            <span className="rounded-full border border-[#EFE8DC] bg-[#FEF7EB] px-2.5 py-0.5 text-[10px] font-extrabold text-[#B8801C]">
              موظف #{member.staff_code}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs font-medium text-[#4A3B32]/70">
          الدور الحالي:{" "}
          <span className="font-bold text-[#6E3917]">
            {member.roles.map((r) => ROLE_LABEL[r]).join(" · ") || "بدون دور"}
          </span>
          {member.last_sign_in_at
            ? ` · آخر تسجيل دخول: ${member.last_sign_in_at.slice(0, 10)}`
            : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={member.roles[0] ?? "sales"}
          onChange={(event) => onRole(event.target.value as StaffRole)}
          className="min-h-10 rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-2.5 text-xs font-bold text-[#26160F]"
        >
          {(Object.keys(ROLE_LABEL) as StaffRole[]).map((key) => (
            <option key={key} value={key}>
              {ROLE_LABEL[key]}
            </option>
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
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#EFE8DC] bg-white px-3 text-xs font-bold text-[#26160F] hover:bg-[#FEF7EB] disabled:opacity-50"
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
