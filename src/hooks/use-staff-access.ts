import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StaffRoleName } from "@/lib/role-guard";

export function useStaffAccess(
  queryKey: readonly string[],
  checkAccess: () => Promise<{ allowed: boolean; roles: string[] }>,
  allowedRoles: readonly StaffRoleName[],
) {
  return useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const res = await checkAccess();
        if (res?.allowed) return res;
      } catch (err) {
        console.warn(`[${queryKey[0]}] server access check failed, checking direct roles:`, err);
      }
      const { data: sessionData } = await supabase.auth.getUser();
      if (!sessionData?.user) return { allowed: false, roles: [] as string[] };
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", sessionData.user.id);
      const userRoles = (roleRows ?? []).map((r) => r.role as string);
      return {
        allowed: allowedRoles.some((role) => userRoles.includes(role)),
        roles: userRoles,
      };
    },
    staleTime: 30_000,
    gcTime: 60_000,
  });
}
