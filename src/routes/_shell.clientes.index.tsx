import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ErrorBoundary } from "@/components/error-boundary";
import { ClientesPedidosArea } from "@/components/clientes-pedidos";
import { PedidosFilterVisibility } from "@/components/pedidos-filter-visibility";
import { GlobalPeriodFiltersVisibility } from "@/components/global-period-filters-visibility";

const GLOBAL_ROLES = ["admin", "gestor", "bko"];

type Search = { tab?: "clientes" | "pedidos"; clienteId?: string };

export const Route = createFileRoute("/_shell/clientes/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: s.tab === "pedidos" ? "pedidos" : s.tab === "clientes" ? "clientes" : undefined,
    clienteId: typeof s.clienteId === "string" && s.clienteId ? s.clienteId : undefined,
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const list = (roles ?? []).map(r => r.role as string);
    if (!list.some(r => GLOBAL_ROLES.includes(r))) {
      throw redirect({ to: "/meus-clientes", search: { denied: 1 } });
    }
  },
  component: () => (
    <ErrorBoundary name="Clientes / Pedidos" title="Não foi possível carregar Clientes / Pedidos.">
      <GlobalPeriodFiltersVisibility />
      <PedidosFilterVisibility />
      <ClientesPedidosArea scope="global" />
    </ErrorBoundary>
  ),
});
