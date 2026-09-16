import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, type StaffRoleName } from "@/lib/role-guard";

/** Everyone who works the board may reorder the preparation queue. */
const QUEUE_ROLES: StaffRoleName[] = ["admin", "sales", "social", "kitchen"];

export type QueueRank = { orderId: string; queue_rank: number };

/**
 * Stores the manual queue order (up / down moves). Ranks are plain integers;
 * the smallest rank is prepared first, unranked orders keep the date order.
 */
export const setQueueRanks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { items: QueueRank[] }) => {
    const items = Array.isArray(input?.items) ? input.items : [];
    if (items.length === 0) throw new Error("لا يوجد ترتيب · Nothing to reorder");
    if (items.length > 200) throw new Error("عدد كبير جداً · Too many rows");
    return {
      items: items.map((item) => {
        const rank = Math.trunc(Number(item.queue_rank));
        if (!item?.orderId) throw new Error("orderId is required");
        if (!Number.isFinite(rank) || rank < 0 || rank > 100000) {
          throw new Error("ترتيب غير صالح · Invalid rank");
        }
        return { orderId: String(item.orderId), queue_rank: rank };
      }),
    };
  })
  .handler(async ({ data, context }) => {
    await assertRole(context, QUEUE_ROLES);
    for (const item of data.items) {
      const { error } = await context.supabase
        .from("orders")
        .update({ queue_rank: item.queue_rank } as never)
        .eq("id", item.orderId);
      if (error) throw new Error(error.message);
    }
    return { ok: true, updated: data.items.length };
  });

/**
 * Computes the new ranks after moving one order up or down inside the list the
 * staff member is currently looking at. Whole visible window is renumbered so
 * the result is stable no matter what the previous ranks were.
 */
export function reorderRanks<T extends { id: string }>(
  list: T[],
  id: string,
  direction: -1 | 1,
): QueueRank[] {
  const index = list.findIndex((row) => row.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= list.length) return [];
  const next = [...list];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved!);
  return next.slice(0, 200).map((row, position) => ({
    orderId: row.id,
    queue_rank: (position + 1) * 10,
  }));
}
