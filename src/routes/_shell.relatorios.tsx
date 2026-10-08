import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useOmni } from "@/lib/omni-store";
import { brl, getEtapa, MESES_PT, type Venda } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart3, BriefcaseBusiness, CalendarRange, CheckCircle2, CircleDollarSign,
  Clock, Clock3, Download, FileSpreadsheet, FileText, Handshake, Search,
  TrendingUp, Users, Wallet, Workflow, XCircle,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFeatures } from "@/lib/features";

export const Route = createFileRoute("/_shell/relatorios")({
  component: RelatoriosPage,
});

type RelTipo = "consultores" | "closers" | "operadora" | "sla" | "comparativo" | "comissoes";

type TeamMember = {
  id: string;
  nome: string;
  email: string | null;
  roles: string[];
};

type CloserPedido = {
  id: string;
  numero: number | null;
  closer_id: string;
  closer_nome: string | null;
  produto: "ONVOX" | "TAKE_FLOW";
  etapa: string;
  receita_total: number | string | null;
  created_at: string;
  updated_at: string;
  concluido_em: string | null;
  cancelado_em: string | null;
};

type CommissionItem = {
  venda_id: string;
  consultor_id: string | null;
  consultor_nome: string | null;
  valor_comissao: number;
  status: string;
};

type SummaryTone = "neutral" | "warning" | "success" | "revenue" | "danger" | "info";

type ReportSummary = {
  label: string;
  value: string;
  helper?: string;
  tone?: SummaryTone;
};

type ReportData = {
  title: string;
  subtitle: string;
  headers: string[];
  rows: (string | number)[][];
  rowKeys?: string[];
  drillKind?: "consultor" | "closer";
  summary: ReportSummary[];
};

const REPORTS: Array<{
  id: RelTipo;
  nome: string;
  descricao: string;
  icon: ReactNode;
}> = [
  {
    id: "consultores",
    nome: "Desempenho dos Consultores",
    descricao: "Vendas, linhas, receita, ativações e SLA por consultor",
    icon: <Users className="size-5" />,
  },
  {
    id: "closers",
    nome: "Desempenho dos Closers",
    descricao: "ONVOX, Take Flow, andamento, concluídos e receita por closer",
    icon: <Handshake className="size-5" />,
  },
  {
    id: "operadora",
    nome: "Pipeline por Operadora",
    descricao: "Comparativo Claro × Vivo com volume, receita e SLA",
    icon: <Workflow className="size-5" />,
  },
  {
    id: "sla",
    nome: "SLA por Etapa",
    descricao: "Tempo médio, atrasos e concentração por etapa",
    icon: <Clock className="size-5" />,
  },
  {
    id: "comparativo",
    nome: "Comparativo Mensal",
    descricao: "Evolução mensal no ano selecionado",
    icon: <TrendingUp className="size-5" />,
  },
  {
    id: "comissoes",
    nome: "Comissões por Consultor",
    descricao: "Comissão total, confirmada e detalhamento por consultor",
    icon: <Wallet className="size-5" />,
  },
];

const REPORT_TONE: Record<RelTipo, string> = {
  consultores: "#FEA801",
  closers: "#D92FA0",
  operadora: "#60A5FA",
  sla: "#FACC15",
  comparativo: "#A78BFA",
  comissoes: "#22C55E",
};

function isVendaConcluida(v: Venda) {
  return Boolean(
    v.ativado100Em ||
    v.concluidoEm ||
    v.statusPedido === "ativado" ||
    v.etapaId === "s-concluido"
  );
}

function isVendaCancelada(v: Venda) {
  return v.statusPedido === "cancelado" || v.statusPedido === "reprovado";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function RelatoriosPage() {
  const { vendas, ambiente } = useOmni();
  const { comissoesVisible } = useFeatures();

  const currentYear = new Date().getFullYear();
  const [tipo, setTipo] = useState<RelTipo>("consultores");
  const [ano, setAno] = useState(currentYear);
  const [mes, setMes] = useState("TODOS");
  const [tableSearch, setTableSearch] = useState("");
  const [historico, setHistorico] = useState<Array<{ id: string; tipo: string; formato: string; quando: string }>>([]);
  const [comissoes, setComissoes] = useState<CommissionItem[]>([]);
  const [closerPedidos, setCloserPedidos] = useState<CloserPedido[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [drill, setDrill] = useState<{ kind: "consultor" | "closer"; key: string } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadExtra() {
      const db = supabase as any;
      const [closerResult, profilesResult, rolesResult, commissionResult] = await Promise.all([
        db
          .from("closer_pedidos")
          .select("id,numero,closer_id,closer_nome,produto,etapa,receita_total,created_at,updated_at,concluido_em,cancelado_em")
          .order("created_at", { ascending: false }),
        db
          .from("profiles")
          .select("id,nome_completo,email,ativo")
          .eq("ativo", true),
        db
          .from("user_roles")
          .select("user_id,role"),
        comissoesVisible
          ? db
              .from("comissao_itens")
              .select("venda_id,consultor_id,valor_comissao,status,profiles:consultor_id(nome_completo)")
              .is("deleted_at", null)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (!active) return;

      if (closerResult.error) {
        console.error("[RELATORIOS] closer_pedidos", closerResult.error);
      } else {
        setCloserPedidos((closerResult.data ?? []).map((row: any) => ({
          ...row,
          receita_total: Number(row.receita_total ?? 0),
        })));
      }

      if (!profilesResult.error && !rolesResult.error) {
        const roleMap = new Map<string, string[]>();
        for (const row of rolesResult.data ?? []) {
          const list = roleMap.get(row.user_id) ?? [];
          list.push(String(row.role));
          roleMap.set(row.user_id, list);
        }

        setTeam((profilesResult.data ?? []).map((profile: any) => ({
          id: profile.id,
          nome: profile.nome_completo || profile.email || "Usuário",
          email: profile.email ?? null,
          roles: roleMap.get(profile.id) ?? [],
        })));
      }

      if (!commissionResult.error) {
        setComissoes((commissionResult.data ?? []).map((row: any) => ({
          venda_id: row.venda_id,
          consultor_id: row.consultor_id,
          consultor_nome: row.profiles?.nome_completo ?? null,
          valor_comissao: Number(row.valor_comissao ?? 0),
          status: String(row.status ?? ""),
        })));
      }
    }

    void loadExtra();

    const db = supabase as any;
    const channel = db
      .channel("relatorios-extra-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "closer_pedidos" }, () => void loadExtra())
      .on("postgres_changes", { event: "*", schema: "public", table: "comissao_itens" }, () => void loadExtra())
      .subscribe();

    return () => {
      active = false;
      db.removeChannel(channel);
    };
  }, [comissoesVisible]);

  const availableReports = useMemo(
    () => REPORTS.filter((report) => report.id !== "comissoes" || comissoesVisible),
    [comissoesVisible],
  );

  useEffect(() => {
    if (tipo === "comissoes" && !comissoesVisible) setTipo("consultores");
  }, [tipo, comissoesVisible]);

  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);

    for (const venda of vendas) {
      if (venda.anoRef) years.add(venda.anoRef);
    }

    for (const pedido of closerPedidos) {
      const year = new Date(pedido.created_at).getFullYear();
      if (Number.isFinite(year)) years.add(year);
    }

    return Array.from(years).sort((a, b) => b - a);
  }, [vendas, closerPedidos, currentYear]);

  const salesYearBase = useMemo(() => {
    let rows = vendas.filter((v) => !(v as any).deleted_at && !(v as any).is_deleted);
    if (ambiente !== "GERAL") rows = rows.filter((v) => v.operadora === ambiente);
    return rows.filter((v) => v.anoRef === ano);
  }, [vendas, ambiente, ano]);

  const salesBase = useMemo(() => {
    if (mes === "TODOS") return salesYearBase;
    const month = Number(mes);
    return salesYearBase.filter((v) => v.mesRef === month);
  }, [salesYearBase, mes]);

  const closerYearBase = useMemo(() => {
    return closerPedidos.filter((pedido) => new Date(pedido.created_at).getFullYear() === ano);
  }, [closerPedidos, ano]);

  const closerBase = useMemo(() => {
    if (mes === "TODOS") return closerYearBase;
    const month = Number(mes);
    return closerYearBase.filter((pedido) => new Date(pedido.created_at).getMonth() + 1 === month);
  }, [closerYearBase, mes]);

  const consultorAgg = useMemo<ConsultorRow[]>(() => {
    const map = new Map<string, ConsultorRow>();

    for (const member of team.filter((m) => m.roles.includes("consultor"))) {
      map.set(member.id, {
        key: member.id,
        nome: member.nome,
        vendas: 0,
        claro: 0,
        vivo: 0,
        andamento: 0,
        ativadas: 0,
        linhas: 0,
        receita: 0,
        atrasos: 0,
        detalhes: [],
      });
    }

    for (const venda of salesBase) {
      const key = venda.consultorId || venda.consultorNome || "sem-consultor";
      const nome = venda.consultorNome || map.get(key)?.nome || "Sem consultor";
      const row = map.get(key) ?? {
        key,
        nome,
        vendas: 0,
        claro: 0,
        vivo: 0,
        andamento: 0,
        ativadas: 0,
        linhas: 0,
        receita: 0,
        atrasos: 0,
        detalhes: [],
      };

      row.nome = nome;
      row.vendas += 1;
      row.claro += venda.operadora === "CLARO" ? 1 : 0;
      row.vivo += venda.operadora === "VIVO" ? 1 : 0;
      row.ativadas += isVendaConcluida(venda) ? 1 : 0;
      row.andamento += !isVendaConcluida(venda) && !isVendaCancelada(venda) ? 1 : 0;
      row.linhas += Number(venda.quantidadeLinhas ?? 0);
      row.receita += Number(venda.receita ?? 0);
      row.atrasos += venda.slaStatus === "atrasado" ? 1 : 0;
      row.detalhes.push(venda);
      map.set(key, row);
    }

    return Array.from(map.values()).sort((a, b) => b.receita - a.receita || b.vendas - a.vendas);
  }, [salesBase, team]);

  const closerAgg = useMemo<CloserRow[]>(() => {
    const map = new Map<string, CloserRow>();

    for (const member of team.filter((m) => m.roles.includes("closer"))) {
      map.set(member.id, {
        key: member.id,
        nome: member.nome,
        total: 0,
        onvox: 0,
        take: 0,
        andamento: 0,
        concluidos: 0,
        cancelados: 0,
        receita: 0,
        ultimaAlteracao: null,
        detalhes: [],
      });
    }

    for (const pedido of closerBase) {
      const key = pedido.closer_id || pedido.closer_nome || "sem-closer";
      const nome = pedido.closer_nome || map.get(key)?.nome || "Sem closer";
      const row = map.get(key) ?? {
        key,
        nome,
        total: 0,
        onvox: 0,
        take: 0,
        andamento: 0,
        concluidos: 0,
        cancelados: 0,
        receita: 0,
        ultimaAlteracao: null,
        detalhes: [],
      };

      row.nome = nome;
      row.total += 1;
      row.onvox += pedido.produto === "ONVOX" ? 1 : 0;
      row.take += pedido.produto === "TAKE_FLOW" ? 1 : 0;
      row.concluidos += pedido.etapa === "CONCLUÍDO" ? 1 : 0;
      row.cancelados += pedido.etapa === "CANCELADO" ? 1 : 0;
      row.andamento += !["CONCLUÍDO", "CANCELADO"].includes(pedido.etapa) ? 1 : 0;
      row.receita += Number(pedido.receita_total ?? 0);
      row.detalhes.push(pedido);

      if (!row.ultimaAlteracao || new Date(pedido.updated_at) > new Date(row.ultimaAlteracao)) {
        row.ultimaAlteracao = pedido.updated_at;
      }

      map.set(key, row);
    }

    return Array.from(map.values()).sort((a, b) => b.receita - a.receita || b.total - a.total);
  }, [closerBase, team]);

  type CommissionRow = {
    key: string;
    nome: string;
    vendas: number;
    comissao: number;
    confirmada: number;
    pendente: number;
  };

  const commissionAgg = useMemo<CommissionRow[]>(() => {
    const salesIds = new Set(salesBase.map((v) => v.id));
    const map = new Map<string, CommissionRow>();

    for (const member of team.filter((m) => m.roles.includes("consultor"))) {
      map.set(member.id, {
        key: member.id,
        nome: member.nome,
        vendas: 0,
        comissao: 0,
        confirmada: 0,
        pendente: 0,
      });
    }

    const vendaSets = new Map<string, Set<string>>();

    for (const item of comissoes) {
      if (!salesIds.has(item.venda_id)) continue;
      const key = item.consultor_id || item.consultor_nome || "sem-consultor";
      const row = map.get(key) ?? {
        key,
        nome: item.consultor_nome || "Sem consultor",
        vendas: 0,
        comissao: 0,
        confirmada: 0,
        pendente: 0,
      };

      row.comissao += item.valor_comissao;
      if (item.status === "confirmada" || item.status === "paga") {
        row.confirmada += item.valor_comissao;
      } else if (!["cancelada", "estornada"].includes(item.status)) {
        row.pendente += item.valor_comissao;
      }

      const ids = vendaSets.get(key) ?? new Set<string>();
      ids.add(item.venda_id);
      vendaSets.set(key, ids);
      row.vendas = ids.size;
      map.set(key, row);
    }

    return Array.from(map.values()).sort((a, b) => b.comissao - a.comissao);
  }, [comissoes, salesBase, team]);

  function periodLabel(includeEnvironment = true) {
    const monthLabel = mes === "TODOS" ? "Ano completo" : MESES_PT[Number(mes) - 1];
    const env = includeEnvironment ? " · " + ambiente : "";
    return monthLabel + " " + ano + env;
  }

  function buildData(): ReportData {
    if (tipo === "consultores") {
      const rows = consultorAgg.map((row) => [
        row.nome,
        row.vendas,
        row.claro,
        row.vivo,
        row.andamento,
        row.ativadas,
        row.linhas,
        brl(row.receita),
        brl(row.vendas ? row.receita / row.vendas : 0),
        row.atrasos,
      ]);

      const active = consultorAgg.filter((row) => row.vendas > 0).length;
      const receita = consultorAgg.reduce((sum, row) => sum + row.receita, 0);
      const atrasos = consultorAgg.reduce((sum, row) => sum + row.atrasos, 0);

      return {
        title: "Desempenho dos Consultores",
        subtitle: periodLabel(true),
        headers: ["Consultor", "Vendas", "Claro", "Vivo", "Em andamento", "Ativadas", "Linhas", "Receita", "Ticket médio", "Atrasos SLA"],
        rows,
        rowKeys: consultorAgg.map((row) => row.key),
        drillKind: "consultor",
        summary: [
          { label: "Consultores com vendas", value: String(active), helper: "no período", tone: "info" },
          { label: "Vendas", value: String(salesBase.length), helper: "pedidos no período", tone: "neutral" },
          { label: "Receita", value: brl(receita), helper: "volume comercial", tone: "revenue" },
          { label: "Atrasos SLA", value: String(atrasos), helper: "pedidos atrasados", tone: atrasos > 0 ? "danger" : "success" },
        ],
      };
    }

    if (tipo === "closers") {
      const rows = closerAgg.map((row) => [
        row.nome,
        row.total,
        row.onvox,
        row.take,
        row.andamento,
        row.concluidos,
        row.cancelados,
        brl(row.receita),
        brl(row.total ? row.receita / row.total : 0),
        formatDateTime(row.ultimaAlteracao),
      ]);

      const ativos = closerAgg.filter((row) => row.total > 0).length;
      const receita = closerAgg.reduce((sum, row) => sum + row.receita, 0);
      const onvox = closerAgg.reduce((sum, row) => sum + row.onvox, 0);
      const take = closerAgg.reduce((sum, row) => sum + row.take, 0);

      return {
        title: "Desempenho dos Closers",
        subtitle: periodLabel(false) + " · Operação Closer",
        headers: ["Closer", "Total", "ONVOX", "Take Flow", "Em andamento", "Concluídos", "Cancelados", "Receita", "Ticket médio", "Última alteração"],
        rows,
        rowKeys: closerAgg.map((row) => row.key),
        drillKind: "closer",
        summary: [
          { label: "Closers com pedidos", value: String(ativos), helper: "no período", tone: "info" },
          { label: "ONVOX", value: String(onvox), helper: "pedidos da marca", tone: "warning" },
          { label: "Take Flow", value: String(take), helper: "pedidos da marca", tone: "neutral" },
          { label: "Receita", value: brl(receita), helper: "ONVOX + Take Flow", tone: "revenue" },
        ],
      };
    }

    if (tipo === "operadora") {
      const operators = ["CLARO", "VIVO"] as const;
      const rows = operators.map((op) => {
        const sales = salesBase.filter((v) => v.operadora === op);
        const lines = sales.reduce((sum, v) => sum + Number(v.quantidadeLinhas ?? 0), 0);
        const receita = sales.reduce((sum, v) => sum + Number(v.receita ?? 0), 0);
        const concluidos = sales.filter(isVendaConcluida).length;
        const andamento = sales.filter((v) => !isVendaConcluida(v) && !isVendaCancelada(v)).length;
        const atrasos = sales.filter((v) => v.slaStatus === "atrasado").length;
        return [op, sales.length, andamento, concluidos, lines, brl(receita), atrasos];
      });

      const totalRevenue = salesBase.reduce((sum, v) => sum + Number(v.receita ?? 0), 0);
      const totalLines = salesBase.reduce((sum, v) => sum + Number(v.quantidadeLinhas ?? 0), 0);
      const totalDelays = salesBase.filter((v) => v.slaStatus === "atrasado").length;

      return {
        title: "Pipeline por Operadora",
        subtitle: periodLabel(true),
        headers: ["Operadora", "Vendas", "Em andamento", "Concluídas", "Linhas", "Receita", "Atrasos SLA"],
        rows,
        summary: [
          { label: "Vendas", value: String(salesBase.length), helper: "Claro + Vivo", tone: "neutral" },
          { label: "Linhas", value: String(totalLines), helper: "total comercializado", tone: "info" },
          { label: "Receita", value: brl(totalRevenue), helper: "no período", tone: "revenue" },
          { label: "Atrasos SLA", value: String(totalDelays), helper: "pedidos atrasados", tone: totalDelays > 0 ? "danger" : "success" },
        ],
      };
    }

    if (tipo === "sla") {
      const map = new Map<string, { etapa: string; total: number; atrasos: number; dias: number }>();

      for (const venda of salesBase) {
        const label = getEtapa(venda.etapaId)?.nome ?? venda.etapaId;
        const row = map.get(venda.etapaId) ?? { etapa: label, total: 0, atrasos: 0, dias: 0 };
        row.total += 1;
        row.atrasos += venda.slaStatus === "atrasado" ? 1 : 0;
        row.dias += Number(venda.diasNaEtapa ?? 0);
        map.set(venda.etapaId, row);
      }

      const aggregate = Array.from(map.values()).sort((a, b) => b.atrasos - a.atrasos || b.total - a.total);
      const rows = aggregate.map((row) => [
        row.etapa,
        row.total,
        row.atrasos,
        row.total ? ((row.atrasos / row.total) * 100).toFixed(0) + "%" : "0%",
        row.total ? (row.dias / row.total).toFixed(1) : "0.0",
      ]);

      const atrasos = aggregate.reduce((sum, row) => sum + row.atrasos, 0);
      const total = aggregate.reduce((sum, row) => sum + row.total, 0);
      const avgDays = total ? aggregate.reduce((sum, row) => sum + row.dias, 0) / total : 0;

      return {
        title: "SLA por Etapa",
        subtitle: periodLabel(true),
        headers: ["Etapa", "Total", "Atrasos", "% Atrasos", "Dias médios"],
        rows,
        summary: [
          { label: "Pedidos analisados", value: String(total), helper: "no período", tone: "neutral" },
          { label: "Atrasos", value: String(atrasos), helper: "fora do SLA", tone: atrasos > 0 ? "danger" : "success" },
          { label: "% atrasados", value: total ? ((atrasos / total) * 100).toFixed(0) + "%" : "0%", helper: "do volume analisado", tone: "warning" },
          { label: "Dias médios", value: avgDays.toFixed(1), helper: "na etapa atual", tone: "info" },
        ],
      };
    }

    if (tipo === "comparativo") {
      const rows = Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const sales = salesYearBase.filter((v) => v.mesRef === month);
        const receita = sales.reduce((sum, v) => sum + Number(v.receita ?? 0), 0);
        const linhas = sales.reduce((sum, v) => sum + Number(v.quantidadeLinhas ?? 0), 0);
        const concluidos = sales.filter(isVendaConcluida).length;
        const atrasos = sales.filter((v) => v.slaStatus === "atrasado").length;
        return [MESES_PT[index], sales.length, concluidos, linhas, brl(receita), atrasos];
      });

      const revenue = salesYearBase.reduce((sum, v) => sum + Number(v.receita ?? 0), 0);
      const lines = salesYearBase.reduce((sum, v) => sum + Number(v.quantidadeLinhas ?? 0), 0);
      const concluded = salesYearBase.filter(isVendaConcluida).length;

      return {
        title: "Comparativo Mensal",
        subtitle: "Ano " + ano + " · " + ambiente,
        headers: ["Mês", "Vendas", "Concluídas", "Linhas", "Receita", "Atrasos SLA"],
        rows,
        summary: [
          { label: "Vendas no ano", value: String(salesYearBase.length), helper: String(ano), tone: "neutral" },
          { label: "Concluídas", value: String(concluded), helper: "no ano", tone: "success" },
          { label: "Linhas", value: String(lines), helper: "no ano", tone: "info" },
          { label: "Receita", value: brl(revenue), helper: "no ano", tone: "revenue" },
        ],
      };
    }

    const rows = commissionAgg.map((row) => [
      row.nome,
      row.vendas,
      brl(row.comissao),
      brl(row.confirmada),
      brl(row.pendente),
    ]);

    const total = commissionAgg.reduce((sum, row) => sum + row.comissao, 0);
    const confirmed = commissionAgg.reduce((sum, row) => sum + row.confirmada, 0);
    const pending = commissionAgg.reduce((sum, row) => sum + row.pendente, 0);
    const consultants = commissionAgg.filter((row) => row.comissao > 0).length;

    return {
      title: "Comissões por Consultor",
      subtitle: periodLabel(true),
      headers: ["Consultor", "Vendas com comissão", "Comissão total", "Confirmada/Paga", "Pendente"],
      rows,
      summary: [
        { label: "Consultores", value: String(consultants), helper: "com comissão", tone: "info" },
        { label: "Comissão total", value: brl(total), helper: "no período", tone: "revenue" },
        { label: "Confirmada/Paga", value: brl(confirmed), helper: "valor confirmado", tone: "success" },
        { label: "Pendente", value: brl(pending), helper: "a confirmar", tone: "warning" },
      ],
    };
  }

  const preview = useMemo(
    () => buildData(),
    [tipo, ano, mes, ambiente, salesBase, salesYearBase, closerBase, consultorAgg, closerAgg, commissionAgg],
  );

  const visibleRows = useMemo(() => {
    const query = tableSearch.trim().toLocaleLowerCase("pt-BR");
    return preview.rows
      .map((row, index) => ({ row, index, key: preview.rowKeys?.[index] }))
      .filter((entry) => !query || entry.row.some((cell) => String(cell).toLocaleLowerCase("pt-BR").includes(query)));
  }, [preview, tableSearch]);

  function exportCSV() {
    const csv = [preview.headers, ...preview.rows]
      .map((row) => row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(";"))
      .join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "omni-" + tipo + "-" + ano + "-" + Date.now() + ".csv";
    anchor.click();
    URL.revokeObjectURL(url);

    setHistorico((current) => [
      { id: crypto.randomUUID(), tipo: preview.title, formato: "CSV", quando: new Date().toLocaleString("pt-BR") },
      ...current,
    ].slice(0, 20));

    toast.success("CSV exportado");
  }

  function exportPDF() {
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: preview.headers.length > 7 ? "landscape" : "portrait" });
    const width = doc.internal.pageSize.getWidth();

    doc.setFillColor("#0A0A0A");
    doc.rect(0, 0, width, 78, "F");
    doc.setFillColor("#FEA801");
    doc.rect(0, 74, width, 4, "F");

    doc.setTextColor("#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("OMNI Flow Lab", 40, 34);

    doc.setFontSize(11);
    doc.setTextColor("#FEA801");
    doc.text(preview.title, 40, 54);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor("#FFFFFF");
    doc.text(preview.subtitle, width - 40, 32, { align: "right" });
    doc.text("Gerado em " + new Date().toLocaleString("pt-BR"), width - 40, 48, { align: "right" });

    autoTable(doc, {
      startY: 96,
      head: [preview.headers],
      body: preview.rows.map((row) => row.map((cell) => String(cell))),
      theme: "grid",
      styles: { fontSize: 7.5, cellPadding: 4 },
      headStyles: { fillColor: "#111318", textColor: "#FFFFFF" },
      alternateRowStyles: { fillColor: "#F5F5F5" },
      margin: { left: 32, right: 32 },
    });

    doc.save("omni-" + tipo + "-" + ano + "-" + Date.now() + ".pdf");

    setHistorico((current) => [
      { id: crypto.randomUUID(), tipo: preview.title, formato: "PDF", quando: new Date().toLocaleString("pt-BR") },
      ...current,
    ].slice(0, 20));

    toast.success("PDF exportado");
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#111015] px-5 py-6 sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(254,168,1,.18),transparent_30%),radial-gradient(circle_at_88%_5%,rgba(113,0,202,.16),transparent_34%)]" />
        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
              <span className="size-2 rounded-full bg-[var(--omni)] shadow-[0_0_16px_var(--omni)]" />
              Inteligência gerencial
            </div>
            <h1 className="flex items-center gap-2 text-3xl font-display font-bold tracking-tight text-white">
              <BarChart3 className="size-6 text-[var(--omni)]" /> Relatórios
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/58">
              Visões consolidadas para acompanhar equipe, Operação Closer, pipeline, SLA e evolução comercial sem misturar indicadores que contam histórias diferentes.
            </p>
          </div>

          <div className="grid min-w-[280px] gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/40">Ambiente</div>
              <div className="mt-1 text-sm font-bold text-white">{ambiente}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/40">Período</div>
              <div className="mt-1 text-sm font-bold text-white">{preview.subtitle}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarRange className="size-4 text-omni" />
            Período do relatório
          </div>
          <div className="flex-1" />
          <Select value={String(ano)} onValueChange={(value) => setAno(Number(value))}>
            <SelectTrigger className="w-full lg:w-32 bg-surface-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={mes} onValueChange={setMes} disabled={tipo === "comparativo"}>
            <SelectTrigger className="w-full lg:w-44 bg-surface-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Ano completo</SelectItem>
              {MESES_PT.map((name, index) => (
                <SelectItem key={name} value={String(index + 1)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tipo === "closers" && (
            <Badge variant="outline" className="h-10 px-3 text-[10px]">
              Claro/Vivo não afeta a Operação Closer
            </Badge>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {availableReports.map((report) => {
          const selected = tipo === report.id;
          const accent = REPORT_TONE[report.id];

          return (
            <button
              key={report.id}
              type="button"
              onClick={() => {
                setTipo(report.id);
                setTableSearch("");
              }}
              className={cn(
                "relative overflow-hidden rounded-2xl border p-4 text-left transition-all",
                selected ? "bg-surface-1 shadow-xl" : "border-border bg-card hover:-translate-y-0.5 hover:border-white/20",
              )}
              style={selected ? {
                borderColor: accent,
                boxShadow: "0 18px 50px -38px " + accent,
              } : undefined}
            >
              <span
                className="pointer-events-none absolute -right-7 -top-7 size-24 rounded-full blur-3xl opacity-20"
                style={{ backgroundColor: accent }}
              />
              <div
                className="relative grid size-10 place-items-center rounded-xl"
                style={{
                  backgroundColor: selected ? accent : accent + "18",
                  color: selected ? (report.id === "consultores" || report.id === "sla" ? "#111" : "#FFF") : accent,
                }}
              >
                {report.icon}
              </div>
              <div className="relative mt-3 font-display text-sm font-bold">{report.nome}</div>
              <div className="relative mt-1 text-xs leading-relaxed text-muted-foreground">{report.descricao}</div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {preview.summary.map((item) => (
          <SummaryCard key={item.label} {...item} />
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 xl:flex-row xl:items-center">
          <div>
            <h2 className="font-display text-lg font-bold">{preview.title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {preview.subtitle} · {preview.rows.length} linhas no relatório
            </p>
          </div>

          <div className="flex-1" />

          <div className="relative w-full xl:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={tableSearch}
              onChange={(event) => setTableSearch(event.target.value)}
              placeholder="Filtrar esta tabela..."
              className="pl-9 bg-surface-1"
            />
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportCSV} className="gap-2">
              <FileSpreadsheet className="size-3.5" /> CSV
            </Button>
            <Button size="sm" onClick={exportPDF} className="bg-omni text-black hover:bg-omni-glow font-semibold gap-2">
              <Download className="size-3.5" /> PDF
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-xs">
            <thead className="bg-surface-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                {preview.headers.map((header) => (
                  <th key={header} className="px-3 py-3 text-left">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.slice(0, 100).map((entry) => {
                const clickable = Boolean(preview.drillKind && entry.key);
                return (
                  <tr
                    key={entry.index}
                    onClick={clickable ? () => setDrill({ kind: preview.drillKind!, key: entry.key! }) : undefined}
                    className={cn(
                      "border-t border-border transition-colors hover:bg-surface-1",
                      clickable && "cursor-pointer hover:bg-omni/5",
                    )}
                  >
                    {entry.row.map((cell, cellIndex) => (
                      <td key={cellIndex} className={cn("px-3 py-2.5", cellIndex === 0 ? "font-semibold" : "font-mono")}>
                        {cellIndex === 0 && clickable ? (
                          <span className="text-omni underline-offset-2 hover:underline">{String(cell)}</span>
                        ) : (
                          String(cell)
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}

              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={preview.headers.length} className="px-3 py-14 text-center">
                    <div className="text-sm font-semibold">Sem dados para este recorte.</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Ajuste período, ambiente ou filtro da tabela.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {historico.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <FileText className="size-4 text-omni" /> Exportações desta sessão
          </h3>
          <div className="space-y-1">
            {historico.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b border-border/40 py-1.5 text-xs last:border-0">
                <span className="font-medium">{item.tipo}</span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="outline" className="text-[9px]">{item.formato}</Badge>
                  <span className="font-mono">{item.quando}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={!!drill} onOpenChange={(open) => !open && setDrill(null)}>
        <DialogContent className="max-w-5xl max-h-[86vh] overflow-y-auto">
          {drill?.kind === "consultor" ? (
            <ConsultorDrill row={consultorAgg.find((row) => row.key === drill.key)} />
          ) : drill?.kind === "closer" ? (
            <CloserDrill row={closerAgg.find((row) => row.key === drill.key)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  tone = "neutral",
}: ReportSummary) {
  const toneClass: Record<SummaryTone, string> = {
    neutral: "border-border bg-card",
    warning: "border-amber-500/25 bg-amber-500/[0.06]",
    success: "border-emerald-500/25 bg-emerald-500/[0.06]",
    revenue: "border-[#FEA801]/30 bg-[#FEA801]/[0.065]",
    danger: "border-red-500/25 bg-red-500/[0.06]",
    info: "border-blue-500/25 bg-blue-500/[0.06]",
  };

  return (
    <div className={cn("rounded-2xl border p-4", toneClass[tone])}>
      <div className="text-[9px] font-black uppercase tracking-[0.17em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">{value}</div>
      {helper && <div className="mt-1 text-[11px] text-muted-foreground">{helper}</div>}
    </div>
  );
}

type ConsultorRow = {
  key: string;
  nome: string;
  vendas: number;
  claro: number;
  vivo: number;
  andamento: number;
  ativadas: number;
  linhas: number;
  receita: number;
  atrasos: number;
  detalhes: Venda[];
};

function ConsultorDrill({ row }: { row: ConsultorRow | undefined }) {
  if (!row) return null;

  const sorted = [...row.detalhes].sort((a, b) => {
    const aDate = a.atualizadoEm || a.dataAtivacao || a.dataRecebimento || "";
    const bDate = b.atualizadoEm || b.dataAtivacao || b.dataRecebimento || "";
    return bDate.localeCompare(aDate);
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Users className="size-4 text-omni" /> {row.nome}
        </DialogTitle>
        <p className="text-xs text-muted-foreground">
          {row.vendas} vendas · {row.linhas} linhas · {brl(row.receita)} de receita · {row.atrasos} atrasos SLA
        </p>
      </DialogHeader>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[820px] text-xs">
          <thead className="sticky top-0 bg-surface-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Pedido</th>
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-left">Operadora</th>
              <th className="px-3 py-2 text-left">Etapa</th>
              <th className="px-3 py-2 text-left">Situação</th>
              <th className="px-3 py-2 text-left">Linhas</th>
              <th className="px-3 py-2 text-left">Receita</th>
              <th className="px-3 py-2 text-left">SLA</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((venda) => (
              <tr key={venda.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono">{venda.numero}</td>
                <td className="px-3 py-2">{venda.clienteRazaoSocial}</td>
                <td className="px-3 py-2"><Badge variant="outline">{venda.operadora}</Badge></td>
                <td className="px-3 py-2">{getEtapa(venda.etapaId)?.nome ?? venda.etapaId}</td>
                <td className="px-3 py-2">
                  {isVendaConcluida(venda) ? "Concluída" : isVendaCancelada(venda) ? "Cancelada/Reprovada" : "Em andamento"}
                </td>
                <td className="px-3 py-2 font-mono">{venda.quantidadeLinhas}</td>
                <td className="px-3 py-2 font-mono">{brl(Number(venda.receita ?? 0))}</td>
                <td className="px-3 py-2">
                  <span className={cn(
                    "font-semibold",
                    venda.slaStatus === "atrasado" ? "text-red-500" :
                    venda.slaStatus === "alerta" || venda.slaStatus === "atencao" ? "text-amber-500" :
                    "text-emerald-500",
                  )}>
                    {venda.slaStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

type CloserRow = {
  key: string;
  nome: string;
  total: number;
  onvox: number;
  take: number;
  andamento: number;
  concluidos: number;
  cancelados: number;
  receita: number;
  ultimaAlteracao: string | null;
  detalhes: CloserPedido[];
};

function CloserDrill({ row }: { row: CloserRow | undefined }) {
  if (!row) return null;

  const sorted = [...row.detalhes].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Handshake className="size-4 text-[#D92FA0]" /> {row.nome}
        </DialogTitle>
        <p className="text-xs text-muted-foreground">
          {row.total} pedidos · {row.onvox} ONVOX · {row.take} Take Flow · {brl(row.receita)} de receita
        </p>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Em andamento" value={String(row.andamento)} helper="pedidos ativos" tone="info" />
        <SummaryCard label="Concluídos" value={String(row.concluidos)} helper="finalizados" tone="success" />
        <SummaryCard label="Cancelados" value={String(row.cancelados)} helper="no período" tone="danger" />
        <SummaryCard label="Ticket médio" value={brl(row.total ? row.receita / row.total : 0)} helper="por pedido" tone="revenue" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="sticky top-0 bg-surface-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Pedido</th>
              <th className="px-3 py-2 text-left">Produto</th>
              <th className="px-3 py-2 text-left">Etapa</th>
              <th className="px-3 py-2 text-left">Receita</th>
              <th className="px-3 py-2 text-left">Criado em</th>
              <th className="px-3 py-2 text-left">Última alteração</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((pedido) => (
              <tr key={pedido.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono">#{String(pedido.numero ?? "—").padStart(4, "0")}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className={pedido.produto === "ONVOX" ? "border-pink-500/35 text-pink-400" : "border-purple-500/35 text-purple-400"}>
                    {pedido.produto === "ONVOX" ? "ONVOX" : "Take Flow"}
                  </Badge>
                </td>
                <td className="px-3 py-2">{pedido.etapa}</td>
                <td className="px-3 py-2 font-mono">{brl(Number(pedido.receita_total ?? 0))}</td>
                <td className="px-3 py-2">{formatDate(pedido.created_at)}</td>
                <td className="px-3 py-2">{formatDateTime(pedido.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
