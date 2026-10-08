import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ClienteDB {
  id: string;
  razao_social: string;
  cnpj_cpf: string | null;
  uf: string | null;
  ddd: string | null;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  operadoras: string[];
  qtd_linhas_total: number;
  receita_total: number;
  ultima_venda_em: string | null;
}

export interface ColaboradorDB {
  id: string;
  nome_exibicao: string;
  nome_normalizado: string;
  funcao: string | null;
  operadoras: string[];
  ativo: boolean;
  user_id: string | null;
  mesa: string | null;
}

export interface CatalogoItem {
  id: string;
  nome: string;
  operadora: string;
  ativo?: boolean;
  cor?: string | null;
  sla_horas?: number | null;
  tipo?: string | null;
  permite_bonus?: boolean | null;
  permite_doador?: boolean | null;
  produto_id?: string | null;
  bonus_extra?: string | null;
  valor_mes?: number | null;
  origem?: string | null;
  pagina_fonte?: number | null;
  grupo_compatibilidade?: "G1" | "G2" | null;
}

export function useClientesDB() {
  const [data, setData] = useState<ClienteDB[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("clientes")
      .select("id, razao_social, cnpj_cpf, uf, ddd, contato, telefone, email, endereco, operadoras, qtd_linhas_total, receita_total, ultima_venda_em")
      .is("deleted_at", null)
      .is("is_deleted", false)
      .order("razao_social")
      .limit(2000);
    setData((data ?? []) as unknown as ClienteDB[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, refetch };
}

export function useColaboradoresDB() {
  const [data, setData] = useState<ColaboradorDB[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    const { data } = await supabase
      .from("colaboradores")
      .select("id, nome_exibicao, nome_normalizado, funcao, operadoras, ativo, user_id, mesa, is_deleted, deleted_at")
      .is("deleted_at", null)
      .is("is_deleted", false)
      .order("nome_exibicao")
      .limit(1000);
    setData((data ?? []) as ColaboradorDB[]);
    setLoading(false);
  };

  useEffect(() => {
    fetch();

    // Canal único por montagem do hook para evitar conflitos de subscribe/on
    const channelName = `colab-changes-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "colaboradores" }, () => {
        console.log("Realtime: colaboradores table changed, refetching...");
        fetch();
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          console.warn(`Realtime subscribe status for colaboradores (${channelName}): ${status}`);
        }
      });




    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { data, loading, refetch: fetch };
}

export type CatalogoTable =
  | "produtos_catalogo"
  | "tipos_pedido_catalogo"
  | "status_catalogo"
  | "planos_catalogo";

export function useCatalogo(
  table: CatalogoTable,
  operadora?: string,
) {
  const [data, setData] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any).from(table).select("*").eq("ativo", true).order("nome");
    if (operadora) q = q.eq("operadora", operadora);
    const { data, error } = await q;
    if (!error) setData((data ?? []) as CatalogoItem[]);
    setLoading(false);
  }, [table, operadora]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { data, loading, refetch: fetch };
}

export interface PlanoUsado {
  plano: string;
  produto: string | null;
}

/**
 * Planos já cadastrados nas linhas de venda da mesma operadora.
 * Não existe tabela planos_catalogo; derivamos valores distintos de venda_linhas.
 */
export function usePlanosDeLinhas(operadora?: string) {
  const [data, setData] = useState<PlanoUsado[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("venda_linhas")
        .select("plano, produto, vendas!inner(operadora)")
        .not("plano", "is", null)
        .limit(3000);
      if (operadora) q = q.eq("vendas.operadora", operadora as any);
      const { data } = await q;
      const seen = new Set<string>();
      const list: PlanoUsado[] = [];
      ((data ?? []) as any[]).forEach((r) => {
        const plano = (r.plano ?? "").trim();
        if (!plano) return;
        const key = `${plano}__${r.produto ?? ""}`;
        if (seen.has(key)) return;
        seen.add(key);
        list.push({ plano, produto: r.produto ?? null });
      });
      list.sort((a, b) => a.plano.localeCompare(b.plano));
      setData(list);
      setLoading(false);
    })();
  }, [operadora]);
  return { data, loading };
}


export interface ConsultorReal {
  id: string;
  nome_completo: string;
  email: string;
  iniciais: string;
  roles: string[];
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/**
 * Lista APENAS usuários reais cadastrados (admin, gestor, consultor).
 * Nada de mock, nada de catálogo de colaboradores não-vinculado.
 */
export function useConsultoresReais() {
  const [data, setData] = useState<ConsultorReal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: rows, error } = await (supabase as any)
        .rpc("listar_consultores_para_venda");

      if (error) {
        console.error("[Consultores] Falha ao carregar lista para vínculo de venda", error);
        setData([]);
        setLoading(false);
        return;
      }

      const list: ConsultorReal[] = ((rows ?? []) as Array<{
        id: string;
        nome_completo: string;
        email: string;
        roles: string[];
      }>).map(p => ({
        id: p.id,
        nome_completo: p.nome_completo,
        email: p.email,
        iniciais: iniciais(p.nome_completo),
        roles: p.roles ?? [],
      }));

      setData(list);
      setLoading(false);
    })();
  }, []);

  return { data, loading };
}

