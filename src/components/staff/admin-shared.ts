import type { StaffRole } from "@/lib/admin.functions";

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "مدير · Admin",
  sales: "مبيعات · Sales",
  kitchen: "مطبخ · Kitchen",
  social: "سوشال · Social",
};
