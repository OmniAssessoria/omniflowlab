import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { installHistoricoEnhancer } from "./lib/historico-enhancer";
import { installNotaClienteEnhancer } from "./lib/nota-cliente-enhancer";
import { installPedidoNumeroEnhancer } from "./lib/pedido-numero-enhancer";

export const getRouter = () => {
  installHistoricoEnhancer();
  installNotaClienteEnhancer();
  installPedidoNumeroEnhancer();

  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
