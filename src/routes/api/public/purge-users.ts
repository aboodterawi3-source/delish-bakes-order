import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY maintenance endpoint. Deleted right after the one-time purge.
export const Route = createFileRoute("/api/public/purge-users")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 });
        if (error) return new Response(error.message, { status: 500 });
        const results: string[] = [];
        for (const user of data.users) {
          const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
          results.push(`${user.email ?? user.id}: ${delError ? delError.message : "deleted"}`);
        }
        await supabaseAdmin.from("user_roles").delete().not("user_id", "is", null);
        return new Response(JSON.stringify(results), { headers: { "content-type": "application/json" } });
      },
    },
  },
});
