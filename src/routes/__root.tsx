import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { ReactNode } from "react";

import appCss from "../styles.css?url";
import { OmniProvider } from "@/lib/omni-store";
import { AuthProvider, useAuth } from "@/lib/auth";
import { FeaturesProvider } from "@/lib/features";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/sonner";
import { VendaHistoricoGlobal } from "@/components/venda-historico-global";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "OMNI Flow Lab — Pipeline Comercial OMNI" },
      { name: "description", content: "O laboratório inteligente do pipeline comercial OMNI: vendas, assinatura e suporte Claro e Vivo em um único centro de comando." },
      { name: "theme-color", content: "#FACC15" },
      { property: "og:title", content: "OMNI Flow Lab — Pipeline Comercial OMNI" },
      { property: "og:description", content: "O laboratório inteligente do pipeline comercial OMNI: vendas, assinatura e suporte Claro e Vivo em um único centro de comando." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "OMNI Flow Lab — Pipeline Comercial OMNI" },
      { name: "twitter:description", content: "O laboratório inteligente do pipeline comercial OMNI: vendas, assinatura e suporte Claro e Vivo em um único centro de comando." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/42f9d8a9-3329-405b-a52b-f277cdf43646/id-preview-56059008--1e9e293f-2276-46d2-9d2a-4b08c685e7b2.lovable.app-1782993090599.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/42f9d8a9-3329-405b-a52b-f277cdf43646/id-preview-56059008--1e9e293f-2276-46d2-9d2a-4b08c685e7b2.lovable.app-1782993090599.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", href: "/icon-192.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-background text-foreground">
      <div className="text-center">
        <div className="text-7xl font-display font-bold text-omni">404</div>
        <p className="mt-2 text-muted-foreground">Rota não encontrada no Flow Lab.</p>
        <a href="/dashboard" className="mt-4 inline-block px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold">Voltar ao Dashboard</a>
      </div>
    </div>
  ),
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RoleAwareRoot />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RoleAwareRoot() {
  const { primaryRole, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (primaryRole === "telespectador") {
    return (
      <>
        <ErrorBoundary name="Painel TV">
          <Outlet />
        </ErrorBoundary>
        <Toaster position="top-right" theme="dark" />
      </>
    );
  }

  return (
    <FeaturesProvider>
      <OmniProvider>
        <ErrorBoundary name="Layout Principal">
          <Outlet />
        </ErrorBoundary>
        <ErrorBoundary name="Histórico Completo">
          <VendaHistoricoGlobal />
        </ErrorBoundary>
        <Toaster position="top-right" theme="dark" />
      </OmniProvider>
    </FeaturesProvider>
  );
}
