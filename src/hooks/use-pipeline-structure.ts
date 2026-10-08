import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  displayStagesFor,
  firstActiveCommercialDestination,
  firstActiveDestinationForFunnel,
  type PipelineEtapa,
  type PipelineFunil,
} from '@/lib/pipeline-structure';

export function usePipelineStructure(channelName = 'pipeline-structure-live') {
  const [funis, setFunis] = useState<PipelineFunil[]>([]);
  const [etapas, setEtapas] = useState<PipelineEtapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [funisResult, etapasResult] = await Promise.all([
        (supabase as any)
          .from('pipeline_funis')
          .select('id,nome,ordem,ativo,participa_fluxo_comercial')
          .order('ordem'),
        (supabase as any)
          .from('pipeline_etapas')
          .select('id,funil_id,nome,cor,ordem,ordem_exibicao,ativo')
          .order('ordem'),
      ]);

      if (funisResult.error) throw funisResult.error;
      if (etapasResult.error) throw etapasResult.error;

      setFunis((funisResult.data ?? []) as unknown as PipelineFunil[]);
      setEtapas((etapasResult.data ?? []) as unknown as PipelineEtapa[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao carregar estrutura do pipeline.';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh().catch(() => undefined);

    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        void refresh().catch(() => undefined);
      }, 120);
    };

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_funis' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_etapas' }, scheduleRefresh)
      .subscribe();

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [refresh, channelName]);

  const setFunilAtivo = useCallback(async (funilId: string, ativo: boolean) => {
    const { error: rpcError } = await supabase.rpc('pipeline_set_funil_ativo' as any, {
      p_funil_id: funilId,
      p_ativo: ativo,
    });
    if (rpcError) throw new Error(rpcError.message);
    await refresh();
  }, [refresh]);

  const setEtapaAtiva = useCallback(async (etapaId: string, ativo: boolean) => {
    const { error: rpcError } = await supabase.rpc('pipeline_set_etapa_ativo' as any, {
      p_etapa_id: etapaId,
      p_ativo: ativo,
    });
    if (rpcError) throw new Error(rpcError.message);
    await refresh();
  }, [refresh]);

  const renameEtapa = useCallback(async (etapaId: string, nome: string) => {
    const { error: rpcError } = await supabase.rpc('pipeline_rename_etapa' as any, {
      p_etapa_id: etapaId,
      p_nome: nome.trim(),
    });
    if (rpcError) throw new Error(rpcError.message);
    await refresh();
  }, [refresh]);

  const reorderEtapasExibicao = useCallback(async (funilId: string, etapaIds: string[]) => {
    const { error: rpcError } = await supabase.rpc('pipeline_reorder_etapas_exibicao' as any, {
      p_funil_id: funilId,
      p_etapa_ids: etapaIds,
    });
    if (rpcError) throw new Error(rpcError.message);
    await refresh();
  }, [refresh]);

  const initialDestination = useMemo(
    () => firstActiveCommercialDestination(funis, etapas),
    [funis, etapas],
  );

  const supportEnabled = useMemo(
    () => funis.some((funil) => funil.id === 'suporte' && funil.ativo),
    [funis],
  );

  const supportStages = useMemo(
    () => displayStagesFor('suporte', etapas),
    [etapas],
  );

  const firstDestinationFor = useCallback(
    (funilId: string) => firstActiveDestinationForFunnel(funilId, funis, etapas),
    [funis, etapas],
  );

  const funilNome = useCallback(
    (funilId: string | null | undefined) => funis.find((f) => f.id === funilId)?.nome ?? '—',
    [funis],
  );

  const etapaNome = useCallback(
    (etapaId: string | null | undefined) => etapas.find((e) => e.id === etapaId)?.nome ?? '—',
    [etapas],
  );

  return {
    funis,
    etapas,
    loading,
    error,
    refresh,
    setFunilAtivo,
    setEtapaAtiva,
    renameEtapa,
    reorderEtapasExibicao,
    initialDestination,
    supportEnabled,
    supportStages,
    firstDestinationFor,
    funilNome,
    etapaNome,
  };
}
