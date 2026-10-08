import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { TvDashboard } from "@/components/tv-dashboard";
import { createTvData, type TvSnapshot } from "@/lib/tv-data";
import { createExampleTvData } from "@/lib/tv-data.example";
import { getTvSnapshot, saveTvMetas } from "@/lib/tv.functions";

export const Route = createFileRoute("/tv")({
  ssr: false,
  component: TvPage,
});

function TvPage() {
  const { user, primaryRole, loading } = useAuth();
  const fetchSnapshot = useServerFn(getTvSnapshot);
  const saveMetas = useServerFn(saveTvMetas);
  const [snapshot, setSnapshot] = useState<TvSnapshot | null>(null);
  const [connected, setConnected] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);

  const useExampleData = (import.meta.env as any).VT_TV_USE_EXAMPLE === "true";

  const data = useMemo(
    () => useExampleData
      ? createExampleTvData()
      : createTvData(
          () => fetchSnapshot() as Promise<TvSnapshot>,
          (payload) => saveMetas({ data: payload } as any),
        ),
    [fetchSnapshot, saveMetas, useExampleData],
  );

  const refresh = useCallback(async () => {
    try {
      const next = await data.snapshot();
      setSnapshot(next);
      setConnected(true);
    } catch (error) {
      console.error("[Painel TV] falha ao atualizar snapshot", error);
      setConnected(false);
    } finally {
      setFirstLoad(false);
    }
  }, [data]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousBackground = document.body.style.background;
    document.body.style.overflow = "hidden";
    document.body.style.background = "#10151c";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.background = previousBackground;
    };
  }, []);

  useEffect(() => {
    if (!user || primaryRole !== "telespectador") return;
    void refresh();
    return data.assinar(
      (next) => {
        setSnapshot(next);
        setConnected(true);
      },
      () => setConnected(false),
    );
  }, [user, primaryRole, data, refresh]);

  if (loading) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-[#10151c] text-[#e6ebf1]">
        <Loader2 className="size-7 animate-spin text-[#22c55e]" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (primaryRole !== "telespectador") return <Navigate to="/dashboard" replace />;

  if (firstLoad && !snapshot) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-[#10151c] text-[#e6ebf1]">
        <div className="flex items-center gap-3 text-sm">
          <Loader2 className="size-5 animate-spin text-[#22c55e]" />
          Carregando Painel TV…
        </div>
      </div>
    );
  }

  const safeSnapshot: TvSnapshot = snapshot ?? {
    equipe: "Telecom",
    fontes: [],
    consultores: [],
    contratos: [],
    metas: {},
    atualizado_em: new Date().toISOString(),
  };

  return (
    <TvDashboard
      snapshot={safeSnapshot}
      connected={connected}
      onRefresh={() => void refresh()}
    />
  );
}
