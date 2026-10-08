import { createContext, useContext, useMemo, useState, useCallback, useEffect, type ReactNode } from "react";
import { type Venda, type Operadora, normalizarEtapa } from "./mock-data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatNumeroPedido } from "@/lib/pedido-numero";

type Ambiente = "GERAL" | Operadora;

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s: string) => UUID_RX.test(s);

interface OmniState {
  ambiente: Ambiente;
  setAmbiente: (a: Ambiente) => void;
  mesRef: number;
  setMesRef: (m: number) => void;
  anoRef: number;
  setAnoRef: (y: number) => void;
  vendas: Venda[];
  vendasFiltradas: Venda[];
  vendasAtivadasMes: Venda[];
  vendasPipeline: Venda[];
  loaded: boolean;
  moveVenda: (id: string, etapaId: string) => Promise<boolean>;
  concluirVenda: (id: string) => Promise<boolean>;
  updateVenda: (id: string, patch: Record<string, unknown>) => Promise<boolean>;
  upsertVenda: (v: Venda) => void;
  reloadFromDb: () => Promise<void>;
}

const Ctx = createContext<OmniState | null>(null);

interface DbVendaRow {
  id: string;
  cliente_id?: string | null;
  created_by?: string | null;
  numero: string | null;
  operadora: "CLARO" | "VIVO";
  mes_ref: number;
  ano_ref: number;
  cliente_razao_social: string;
  cliente_cnpj: string;
  cliente_uf?: string | null;
  cliente_contato?: string | null;
  cliente_telefone?: string | null;
  cliente_email?: string | null;
  funil: string;
  etapa_id: string;
  status: string | null;
  tipo_pedido: string | null;
  tipo_pedidos?: string[] | null;
  produto: string | null;
  produtos?: string[] | null;
  quantidade_linhas: number;
  valor: number;
  consultor_nome: string | null;
  consultor_id: string | null;
  consultor_colab_id: string | null;
  data_recebimento: string | null;
  data_aceite: string | null;
  data_ativacao: string | null;
  data_preenchimento?: string | null;
  data_envio?: string | null;
  data_input?: string | null;
  data_entrega?: string | null;
  data_portabilidade?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  proxima_acao: string | null;
  proxima_acao_data: string | null;
  dias_na_etapa: number;
  sla_status: string;
  prioridade: string;
  observacao: string | null;
  tem_erro: boolean | null;
  tem_biometria: boolean | null;
  status_biometria?: string | null;
  nota_modo?: string | null;
  nota_manual?: string | null;
  bko_colab_id?: string | null;
  bko_id?: string | null;
  status_pedido?: string | null;
  status_pedido_obs?: string | null;
  status_pedido_user_nome?: string | null;
  status_pedido_em?: string | null;
  concluido_em?: string | null;
  concluido_por?: string | null;
  status_comercial_id?: string | null;
  status_comercial_nome?: string | null;
  status_comercial_em?: string | null;
  sla_horas_atual?: number | null;
  sla_metade_em?: string | null;
  sla_limite_em?: string | null;
  ativado_100_em?: string | null;
  ativado_100_por?: string | null;
}

function dbToVenda(d: DbVendaRow): Venda {
  const normalized = normalizarEtapa(d.funil, d.etapa_id);
  return {
    id: d.id,
    numero: formatNumeroPedido(d.numero, d.created_by),
    clienteId: d.cliente_id ?? d.cliente_cnpj,
    operadora: d.operadora,
    mesRef: d.mes_ref,
    anoRef: d.ano_ref,
    funil: normalized.funil as Venda["funil"],
    etapaId: normalized.etapaId,
    status: d.status ?? "",
    tipoPedido: d.tipo_pedidos?.[0] ?? d.tipo_pedido ?? "",
    tipoPedidos: d.tipo_pedidos?.length ? d.tipo_pedidos : (d.tipo_pedido ? [d.tipo_pedido] : []),
    produto: d.produtos?.[0] ?? d.produto ?? "",
    produtos: d.produtos?.length ? d.produtos : (d.produto ? [d.produto] : []),
    quantidadeLinhas: d.quantidade_linhas,
    receita: Number(d.valor),
    consultorId: d.consultor_id ?? "imported",
    consultorColabId: d.consultor_colab_id ?? undefined,
    consultorNome: d.consultor_nome ?? undefined,
    clienteRazaoSocial: d.cliente_razao_social,
    clienteCnpj: d.cliente_cnpj,
    clienteUf: d.cliente_uf ?? undefined,
    clienteContato: d.cliente_contato ?? undefined,
    clienteTelefone: d.cliente_telefone ?? undefined,
    clienteEmail: d.cliente_email ?? undefined,
    dataRecebimento: d.data_recebimento ?? "",
    dataAceite: d.data_aceite ?? undefined,
    dataAtivacao: d.data_ativacao ?? undefined,
    dataPreenchimento: d.data_preenchimento ?? undefined,
    dataEnvio: d.data_envio ?? undefined,
    dataInput: d.data_input ?? undefined,
    dataEntrega: d.data_entrega ?? undefined,
    dataPortabilidade: d.data_portabilidade ?? undefined,
    criadoEm: d.created_at ?? undefined,
    atualizadoEm: d.updated_at ?? undefined,
    bkoColabId: d.bko_colab_id ?? undefined,
    bkoId: d.bko_id ?? undefined,
    proximaAcao: d.proxima_acao ?? "—",
    proximaAcaoData: d.proxima_acao_data ?? new Date().toISOString().slice(0, 10),
    diasNaEtapa: d.dias_na_etapa,
    slaStatus: d.sla_status as Venda["slaStatus"],
    prioridade: d.prioridade as Venda["prioridade"],
    observacao: d.observacao ?? undefined,
    temErro: d.tem_erro ?? false,
    temBiometria: d.tem_biometria ?? false,
    statusBiometria: (d.status_biometria ?? "") as Venda["statusBiometria"],
    notaModo: (d.nota_modo as "auto" | "manual") ?? "auto",
    notaManual: d.nota_manual ?? undefined,
    statusPedido: (d.status_pedido ?? "") as Venda["statusPedido"],
    statusPedidoObs: d.status_pedido_obs ?? undefined,
    statusPedidoUserNome: d.status_pedido_user_nome ?? undefined,
    statusPedidoEm: d.status_pedido_em ?? undefined,
    concluidoEm: d.concluido_em ?? undefined,
    concluidoPor: d.concluido_por ?? undefined,
    statusComercialId: d.status_comercial_id ?? undefined,
    statusComercialNome: d.status_comercial_nome ?? undefined,
    statusComercialEm: d.status_comercial_em ?? undefined,
    slaHorasAtual: d.sla_horas_atual ?? undefined,
    slaMetadeEm: d.sla_metade_em ?? undefined,
    slaLimiteEm: d.sla_limite_em ?? undefined,
    ativado100Em: d.ativado_100_em ?? undefined,
    ativado100Por: d.ativado_100_por ?? undefined,
  } as Venda;
}

export function OmniProvider({ children }: { children: ReactNode }) {
  const [ambiente, setAmbiente] = useState<Ambiente>("GERAL");
  const [mesRef, setMesRef] = useState(new Date().getMonth() + 1);
  const [anoRef, setAnoRef] = useState(2026);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reloadFromDb = useCallback(async () => {
    const { data, error } = await supabase
      .from("vendas")
      .select("*")
      .is("deleted_at", null)
      .is("is_deleted", false)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Erro ao carregar vendas", error);
      setLoaded(true);
      return;
    }

    const rows = (data ?? []) as DbVendaRow[];
    const vendaIds = rows.map(row => row.id);

    let latestRobotByVenda = new Map<string, { nome: string; em: string }>();
    const linhasComerciaisPorVenda = new Map<string, { temLinhaAtiva: boolean; temLinhaNaoAparelho: boolean }>();

    if (vendaIds.length > 0) {
      const [{ data: robotLogs, error: robotError }, { data: linhasVenda, error: linhasError }] = await Promise.all([
        (supabase as any)
          .from("venda_robo_logs")
          .select("venda_id, created_at, valor_novo")
          .in("venda_id", vendaIds)
          .eq("campo", "status_pedido")
          .not("valor_novo", "is", null)
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("venda_linhas")
          .select("venda_id, produto, status")
          .in("venda_id", vendaIds),
      ]);

      if (robotError) {
        console.error("Erro ao carregar último status real do robô", robotError);
      } else {
        latestRobotByVenda = new Map();
        for (const log of robotLogs ?? []) {
          if (!log.venda_id || latestRobotByVenda.has(log.venda_id)) continue;
          latestRobotByVenda.set(log.venda_id, {
            nome: String(log.valor_novo ?? ""),
            em: String(log.created_at ?? ""),
          });
        }
      }

      if (linhasError) {
        console.error("Erro ao carregar produtos das linhas para o Pipeline", linhasError);
      } else {
        for (const linha of linhasVenda ?? []) {
          const vendaId = String(linha.venda_id ?? "");
          if (!vendaId) continue;

          const status = String(linha.status ?? "").trim().toLocaleLowerCase("pt-BR");
          if (status === "cancelada" || status === "cancelado") continue;

          const atual = linhasComerciaisPorVenda.get(vendaId) ?? {
            temLinhaAtiva: false,
            temLinhaNaoAparelho: false,
          };
          atual.temLinhaAtiva = true;

          const produto = String(linha.produto ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLocaleUpperCase("pt-BR");
          if (produto !== "APARELHO") atual.temLinhaNaoAparelho = true;

          linhasComerciaisPorVenda.set(vendaId, atual);
        }
      }
    }

    setVendas(rows.map(row => {
      const venda = dbToVenda(row);
      const robot = latestRobotByVenda.get(row.id);
      const linhasInfo = linhasComerciaisPorVenda.get(row.id);
      return {
        ...venda,
        statusPedidoRoboNome: robot?.nome || venda.statusPedido,
        statusPedidoRoboEm: robot?.em || undefined,
        somenteAparelho: Boolean(linhasInfo?.temLinhaAtiva && !linhasInfo.temLinhaNaoAparelho),
      };
    }));
    setLoaded(true);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const scheduleReload = (delay = 350) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { if (!cancelled) void reloadFromDb(); }, delay);
    };

    void reloadFromDb();
    const { data: sub } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === "SIGNED_IN" || evt === "INITIAL_SESSION") scheduleReload(150);
    });
    const channel = supabase
      .channel("omni-vendas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "vendas" }, () => scheduleReload())
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      sub.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [reloadFromDb]);

  const moveVenda = useCallback(async (id: string, etapaId: string) => {
    if (!isUuid(id)) {
      toast.error("Venda não persistida não pode ser movimentada");
      return false;
    }

    const { data, error } = await supabase
      .rpc("pipeline_move_venda", { p_venda_id: id, p_etapa_id: etapaId })
      .maybeSingle();
    if (error || !data) {
      toast.error("Não foi possível movimentar o pedido", { description: error?.message });
      await reloadFromDb();
      return false;
    }

    toast.success("Pedido movimentado", { description: `${data.funil_nome} → ${data.etapa_nome}` });
    await reloadFromDb();
    return true;
  }, [reloadFromDb]);

  const concluirVenda = useCallback(async (id: string) => {
    if (!isUuid(id)) {
      toast.error("Venda não persistida não pode ser concluída");
      return false;
    }
    const { error } = await supabase.rpc("pipeline_concluir_venda", { p_venda_id: id });
    if (error) {
      toast.error("Não foi possível concluir o pedido", { description: error.message });
      await reloadFromDb();
      return false;
    }
    toast.success("Pedido concluído", { description: "O card saiu definitivamente do Pipeline ativo e permanece disponível em Pedidos." });
    await reloadFromDb();
    return true;
  }, [reloadFromDb]);

  const updateVenda = useCallback(async (id: string, patch: Record<string, unknown>) => {
    if (!isUuid(id)) {
      toast.error("Venda não persistida não pode ser editada");
      return false;
    }
    if (["funil", "etapa_id", "concluido_em", "concluido_por"].some(key => key in patch)) {
      toast.error("Use as ações Mover para ou Concluir para alterar o ciclo do pedido.");
      return false;
    }
    const { error } = await (supabase.from("vendas") as any).update(patch).eq("id", id);
    if (error) {
      toast.error("Falha ao salvar alterações", { description: error.message });
      return false;
    }
    toast.success("Alterações salvas", { description: "Histórico registrado automaticamente." });
    await reloadFromDb();
    return true;
  }, [reloadFromDb]);

  const upsertVenda = useCallback((v: Venda) => {
    setVendas(current => {
      const index = current.findIndex(item => item.id === v.id);
      if (index === -1) return [v, ...current];
      const copy = [...current];
      copy[index] = v;
      return copy;
    });
  }, []);

  const vendasFiltradas = useMemo(() => vendas.filter(v => {
    if ((v as any).deleted_at || (v as any).is_deleted) return false;
    if (ambiente !== "GERAL" && v.operadora !== ambiente) return false;
    return v.mesRef === mesRef && v.anoRef === anoRef;
  }), [vendas, ambiente, mesRef, anoRef]);

  const vendasAtivadasMes = useMemo(() => vendas.filter(v => {
    if ((v as any).deleted_at || (v as any).is_deleted) return false;
    if (ambiente !== "GERAL" && v.operadora !== ambiente) return false;
    const ativadoEm = (v as any).ativado100Em as string | undefined;
    if (!ativadoEm) return false;
    const date = new Date(ativadoEm);
    return date.getMonth() + 1 === mesRef && date.getFullYear() === anoRef;
  }), [vendas, ambiente, mesRef, anoRef]);

  const vendasPipeline = useMemo(() => {
    const finais = new Set(["cancelado", "reprovado"]);
    return vendas.filter(v => {
      if ((v as any).deleted_at || (v as any).is_deleted) return false;
      if (ambiente !== "GERAL" && v.operadora !== ambiente) return false;
      const statusPedido = String(v.statusPedido ?? "").trim().toLocaleLowerCase("pt-BR");
      if (finais.has(statusPedido)) return false;
      if ((v as any).somenteAparelho) return false;
      if ((v as any).concluidoEm) return false;
      if (v.etapaId === "s-concluido") return false;
      return true;
    });
  }, [vendas, ambiente]);

  const value: OmniState = {
    ambiente, setAmbiente, mesRef, setMesRef, anoRef, setAnoRef,
    vendas, vendasFiltradas, vendasAtivadasMes, vendasPipeline, loaded,
    moveVenda, concluirVenda, updateVenda, upsertVenda, reloadFromDb,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOmni() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOmni precisa de OmniProvider");
  return ctx;
}
