
import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";
import { Link, isRedirect, isNotFound } from "@tanstack/react-router";

interface Props {
  children: ReactNode;
  name?: string;
  title?: string;
  description?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  /** Redirects/notFound do roteador não são erros de renderização — deixa passar. */
  private static isRouterControlFlow(error: unknown): boolean {
    return isRedirect(error) || isNotFound(error);
  }

  public static getDerivedStateFromError(error: Error): State {
    if (ErrorBoundary.isRouterControlFlow(error)) return { hasError: false, error: null };
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (ErrorBoundary.isRouterControlFlow(error)) return;
    console.error(`Uncaught error in ${this.props.name || "ErrorBoundary"}:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] w-full flex flex-col items-center justify-center p-6 text-center space-y-4 rounded-xl border border-destructive/20 bg-destructive/5 animate-in fade-in duration-500">
          <div className="size-16 rounded-full bg-destructive/10 grid place-items-center mb-2">
            <AlertTriangle className="size-8 text-destructive" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-display font-bold text-foreground">
              {this.props.title ?? "Algo deu errado ao carregar esta área."}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {this.props.description
                ?? "Ocorreu uma falha ao carregar esta área. Tente atualizar a página ou volte para o Dashboard."}
            </p>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <pre className="mt-4 p-3 rounded bg-black/50 text-[10px] text-destructive-foreground overflow-auto max-w-full text-left font-mono">
                {this.state.error.message}
                {"\n"}
                {this.state.error.stack}
              </pre>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={() => this.setState({ hasError: false, error: null })}
              className="gap-2"
            >
              <RefreshCw className="size-4" /> Tentar novamente
            </Button>

            <Button variant="outline" onClick={() => window.location.reload()} className="gap-2">
              <RefreshCw className="size-4" /> Recarregar página
            </Button>
            
            <Button asChild className="gap-2 bg-omni text-black hover:bg-omni/90">
              <Link to="/dashboard">
                <LayoutDashboard className="size-4" /> Voltar ao Dashboard
              </Link>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
