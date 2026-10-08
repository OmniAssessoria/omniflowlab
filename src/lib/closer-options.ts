import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CloserOptionCategory =
  | "onvox_order_type"
  | "onvox_product"
  | "onvox_stage"
  | "onvox_portability_status"
  | "takeflow_stage";

export type CloserOption = {
  id: string;
  categoria: CloserOptionCategory;
  valor: string;
  nome: string;
  ativo: boolean;
  ordem: number;
};

export const CLOSER_OPTION_CATEGORY_LABELS: Record<CloserOptionCategory, string> = {
  onvox_order_type: "ONVOX · Tipo de pedido",
  onvox_product: "ONVOX · Produto",
  onvox_stage: "ONVOX · Etapas",
  onvox_portability_status: "ONVOX · Status de portabilidade",
  takeflow_stage: "Take Flow · Etapas",
};

export const CLOSER_OPTION_CATEGORIES = Object.keys(
  CLOSER_OPTION_CATEGORY_LABELS,
) as CloserOptionCategory[];

const fallback: Record<CloserOptionCategory, Omit<CloserOption, "id">[]> = {
  onvox_order_type: [
    { categoria: "onvox_order_type", valor: "NOVO", nome: "Novo", ativo: true, ordem: 10 },
    { categoria: "onvox_order_type", valor: "PORTABILIDADE", nome: "Portabilidade", ativo: true, ordem: 20 },
    { categoria: "onvox_order_type", valor: "TT", nome: "TT", ativo: true, ordem: 30 },
    { categoria: "onvox_order_type", valor: "PORTABILIDADE PF", nome: "Portabilidade PF", ativo: true, ordem: 40 },
  ],
  onvox_product: [
    { categoria: "onvox_product", valor: "DID", nome: "DID", ativo: true, ordem: 10 },
    { categoria: "onvox_product", valor: "0800", nome: "0800", ativo: true, ordem: 20 },
    { categoria: "onvox_product", valor: "RAMAIS", nome: "Ramais", ativo: true, ordem: 30 },
    { categoria: "onvox_product", valor: "4.004", nome: "4.004", ativo: true, ordem: 40 },
    { categoria: "onvox_product", valor: "APARELHO", nome: "Aparelho", ativo: true, ordem: 50 },
  ],
  onvox_stage: [
    { categoria: "onvox_stage", valor: "CONTRATO", nome: "Contrato", ativo: true, ordem: 10 },
    { categoria: "onvox_stage", valor: "EQUIPAMENTO", nome: "Equipamento", ativo: true, ordem: 20 },
    { categoria: "onvox_stage", valor: "ONBOARDING 1", nome: "Onboarding 1", ativo: true, ordem: 30 },
    { categoria: "onvox_stage", valor: "CONFIGURAÇÃO DO SISTEMA", nome: "Configuração do sistema", ativo: true, ordem: 40 },
    { categoria: "onvox_stage", valor: "TELEFONIA", nome: "Telefonia", ativo: true, ordem: 50 },
    { categoria: "onvox_stage", valor: "ONBOARDING 2", nome: "Onboarding 2", ativo: true, ordem: 60 },
    { categoria: "onvox_stage", valor: "ATIVAÇÃO", nome: "Ativação", ativo: true, ordem: 70 },
    { categoria: "onvox_stage", valor: "FATURAMENTO", nome: "Faturamento", ativo: true, ordem: 80 },
    { categoria: "onvox_stage", valor: "ONBOARDING 3", nome: "Onboarding 3", ativo: true, ordem: 90 },
    { categoria: "onvox_stage", valor: "PERÍODO DE TESTE", nome: "Período de teste", ativo: true, ordem: 100 },
    { categoria: "onvox_stage", valor: "CANCELADO", nome: "Cancelado", ativo: true, ordem: 110 },
    { categoria: "onvox_stage", valor: "PENDÊNCIA COMERCIAL", nome: "Pendência comercial", ativo: true, ordem: 120 },
  ],
  onvox_portability_status: [
    { categoria: "onvox_portability_status", valor: "CONCLUÍDO", nome: "Concluído", ativo: true, ordem: 10 },
    { categoria: "onvox_portability_status", valor: "AGUARDANDO", nome: "Aguardando", ativo: true, ordem: 20 },
    { categoria: "onvox_portability_status", valor: "CANCELADA", nome: "Cancelada", ativo: true, ordem: 30 },
  ],
  takeflow_stage: [
    { categoria: "takeflow_stage", valor: "CONTRATO", nome: "Contrato", ativo: true, ordem: 10 },
    { categoria: "takeflow_stage", valor: "EQUIPAMENTO", nome: "Equipamento", ativo: true, ordem: 20 },
    { categoria: "takeflow_stage", valor: "ONBOARDING 1", nome: "Onboarding 1", ativo: true, ordem: 30 },
    { categoria: "takeflow_stage", valor: "CONFIGURAÇÃO DO SISTEMA", nome: "Configuração do sistema", ativo: true, ordem: 40 },
    { categoria: "takeflow_stage", valor: "TELEFONIA", nome: "Telefonia", ativo: true, ordem: 50 },
    { categoria: "takeflow_stage", valor: "ONBOARDING 2", nome: "Onboarding 2", ativo: true, ordem: 60 },
    { categoria: "takeflow_stage", valor: "ATIVAÇÃO", nome: "Ativação", ativo: true, ordem: 70 },
    { categoria: "takeflow_stage", valor: "FATURAMENTO", nome: "Faturamento", ativo: true, ordem: 80 },
    { categoria: "takeflow_stage", valor: "ONBOARDING 3", nome: "Onboarding 3", ativo: true, ordem: 90 },
    { categoria: "takeflow_stage", valor: "PERÍODO DE TESTE", nome: "Período de teste", ativo: true, ordem: 100 },
    { categoria: "takeflow_stage", valor: "CANCELADO", nome: "Cancelado", ativo: true, ordem: 110 },
    { categoria: "takeflow_stage", valor: "TREINAMENTO IA", nome: "Treinamento IA", ativo: true, ordem: 120 },
    { categoria: "takeflow_stage", valor: "PENDÊNCIA COMERCIAL", nome: "Pendência comercial", ativo: true, ordem: 130 },
  ],
};

function withFallbackIds(category: CloserOptionCategory): CloserOption[] {
  return fallback[category].map((item, index) => ({
    id: `fallback-${category}-${index}`,
    ...item,
  }));
}

export function normalizeCloserOptionValue(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
}

export function useCloserOptions() {
  const [rows, setRows] = useState<CloserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const reload = useCallback(async () => {
    const db = supabase as any;
    const { data, error } = await db
      .from("closer_opcoes_catalogo")
      .select("id,categoria,valor,nome,ativo,ordem")
      .order("categoria")
      .order("ordem")
      .order("nome");

    if (error) {
      console.error("[CLOSER OPTIONS]", error);
      setLoadFailed(true);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as CloserOption[]);
    setLoadFailed(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const activeByCategory = useMemo(() => {
    const map = new Map<CloserOptionCategory, CloserOption[]>();
    for (const category of CLOSER_OPTION_CATEGORIES) {
      const items = rows
        .filter((row) => row.categoria === category && row.ativo !== false)
        .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));

      map.set(
        category,
        loading || loadFailed ? withFallbackIds(category) : items,
      );
    }
    return map;
  }, [rows, loading, loadFailed]);

  const optionsFor = useCallback(
    (category: CloserOptionCategory) => activeByCategory.get(category) ?? [],
    [activeByCategory],
  );

  const allFor = useCallback(
    (category: CloserOptionCategory) =>
      rows
        .filter((row) => row.categoria === category)
        .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR")),
    [rows],
  );

  const labelFor = useCallback(
    (category: CloserOptionCategory, value: string | null | undefined) => {
      if (!value) return "—";
      const found = rows.find(
        (row) => row.categoria === category && row.valor === value,
      );
      if (found) return found.nome;
      const fallbackFound = withFallbackIds(category).find((row) => row.valor === value);
      return fallbackFound?.nome ?? value;
    },
    [rows],
  );

  return {
    rows,
    loading,
    loadFailed,
    reload,
    optionsFor,
    allFor,
    labelFor,
  };
}

export type CloserOptionsController = ReturnType<typeof useCloserOptions>;
