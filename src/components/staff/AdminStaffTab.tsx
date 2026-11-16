import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { AdminAuthorizationPanel } from "@/components/staff/AdminAuthorizationPanel";
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

export function AdminStaffTab() {
  return (
    <div className="space-y-8">
      <StaffPanel />
      <AdminAuthorizationPanel />
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
