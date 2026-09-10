/**
 * Server-side role assertions for staff server functions.
 * Roles are read from the database as the signed-in user (RLS scoped),
 * so the caller cannot spoof them from the client.
 */
export type StaffRoleName = "admin" | "sales" | "kitchen" | "social";

type RoleContext = {
  supabase: { from: (table: string) => any };
  userId: string;
};

export async function getRoles(context: RoleContext): Promise<StaffRoleName[]> {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { role: StaffRoleName }) => row.role);
}

/** Throws unless the caller holds at least one of the allowed roles. */
export async function assertRole(
  context: RoleContext,
  allowed: StaffRoleName[],
): Promise<StaffRoleName[]> {
  const roles = await getRoles(context);
  if (!roles.some((role) => allowed.includes(role))) {
    throw new Error("غير مصرّح · Not authorised");
  }
  return roles;
}
