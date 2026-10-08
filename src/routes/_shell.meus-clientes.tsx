import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/error-boundary";
import { ClientesPedidosArea } from "@/components/clientes-pedidos";
import { PedidosFilterVisibility } from "@/components/pedidos-filter-visibility";
import { GlobalPeriodFiltersVisibility } from "@/components/global-period-filters-visibility";

export const Route = createFileRoute("/_shell/meus-clientes")({
  head: () => ({
    meta: [
      { title: "Meus Pedidos | OMNI Flow Lab" },
      { name: "description", content: "Consulte e gerencie seus pedidos no OMNI Flow Lab." },
      { property: "og:title", content: "Meus Pedidos | OMNI Flow Lab" },
      { property: "og:description", content: "Consulte e gerencie seus pedidos no OMNI Flow Lab." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    denied: s.denied === 1 || s.denied === "1" ? 1 : undefined,
  }),
  errorComponent: () => <ErrorBoundary name="Meus Pedidos" title="Não foi possível carregar Meus Pedidos.">{null}</ErrorBoundary>,
  component: MeusClientesPage,
});

function MeusClientesPage() {
  const { denied } = Route.useSearch();
  useEffect(() => {
    if (denied) toast.error("Você não tem permissão para acessar a visão global de clientes e pedidos.");
  }, [denied]);
  return (
    <ErrorBoundary name="Meus Pedidos" title="Não foi possível carregar Meus Pedidos.">
      <GlobalPeriodFiltersVisibility />
      <PedidosFilterVisibility />
      <ClientesPedidosArea scope="meus" />
    </ErrorBoundary>
  );
}
