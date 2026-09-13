import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

function roleHintFromPath(pathname: string): string | undefined {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/sales")) return "sales";
  if (pathname.startsWith("/kds")) return "kitchen";
  if (pathname.startsWith("/social-portal")) return "social";
  return undefined;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      const role = roleHintFromPath(location.pathname);
      throw redirect({ to: "/auth", search: role ? { role } : {} });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
