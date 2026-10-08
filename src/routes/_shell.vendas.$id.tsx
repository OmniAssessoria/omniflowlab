import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useOmni } from "@/lib/omni-store";
import {
  ETAPAS, FUNIS, HISTORICO, brl, getCliente, getColaborador, getEtapa, maskCpfCnpj,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Banknote, Hash, Building2, Calendar, Clock, Copy, FileSignature,
  AlertTriangle, Fingerprint, MessageSquare, History, Printer, FileText, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Download, LifeBuoy, ArrowRightCircle, Pencil, Save, RefreshCw, Eye, Undo2, X,
  Plus, Minus, Trash2, CopyPlus, CheckCircle2, XCircle, AlertCircle, LifeBuoy as Headphones, Info, Bot, MoreHorizontal, ArrowLeftRight, Users, Package, Maximize2, Minimize2,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ObservacoesPedido } from "@/components/observacoes-pedido";
import { AssinaturaNotasChat } from "@/components/notas-consultor-pedido";
import { DocumentosPedido } from "@/components/documentos-pedido";
import { PdfCanvasViewer } from "@/components/pdf-canvas-viewer";
import { PedidoHeaderMeta } from "@/components/pedido-header-meta";
import { CedentePedidoCard } from "@/components/cedente-pedido-card";
import { CedentesPedidoManager } from "@/components/cedentes-pedido-manager";
import { ClienteRepresentantes } from "@/components/cliente-representantes";
import { CatalogoMultiCheckbox } from "@/components/catalogo-multi-checkbox";
import { CatalogoLinhaSelect } from "@/components/catalogo-linha-select";
import { PlanoOfertaSelect } from "@/components/plano-oferta-select";
import { LinhaOperationalExtras } from "@/components/linha-operational-extras";
import { StatusComercialPedido } from "@/components/status-comercial-pedido";
import { VendaLifecycleActions } from "@/components/venda-lifecycle-actions";
import { MoveVendaDialog } from "@/components/move-venda-dialog";
import { SupportPriorityPicker } from "@/components/support-priority-ui";
import type { SupportPriority } from "@/lib/support-priority";
import { isTipoProdutoAparelho } from "@/lib/linha-aparelho";
import {
  getLinhaCampoRules,
  linhaDescricaoAdicionalLabel,
  linhaPermiteOperadoraDoadora,
  linhaRulePatch,
  normalizeLinhaLabel,
  operadoraPermiteProduto,
} from "@/lib/linha-campos-regras";
import { isProdutoPassaporteAdicional, linhaPermitePassaporte } from "@/lib/linha-passaporte";
import { isNumeroPedidoNaoInformado, numeroPedidoPersistido } from "@/lib/pedido-numero";
import { useSmartBack } from "@/lib/navigation-memory";

import { Fragment, useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { gerarNotaPDF } from "@/lib/pdf-nota";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useFeatures } from "@/lib/features";
import { useClientesDB, useColaboradoresDB, useCatalogo, useConsultoresReais } from "@/lib/catalogos";
import { buildVendaDetailUrl } from "@/lib/rotas";
import { usePipelineStructure } from "@/hooks/use-pipeline-structure";
import { firstActiveDestinationForFunnel, nextActiveCommercialDestination } from "@/lib/pipeline-structure";
import { normalizedDisplayKey, uppercaseDisplay } from "@/lib/display-normalization";


export const Route = createFileRoute("/_shell/vendas/$id")({
  component: VendaDetalhePage,
  validateSearch: (search: Record<string, unknown>) => ({
    suporte: search.suporte === 1 || search.suporte === "1" ? 1 : undefined,
    etapaSuporte: typeof search.etapaSuporte === "string" ? search.etapaSuporte : undefined,
    clienteId: typeof search.clienteId === "string" ? search.clienteId : undefined,
  } as { suporte?: number; etapaSuporte?: string; clienteId?: string }),
});

type HistoricoUnificadoItem = {
  id: string;
  created_at: string;
  origem: "Pipeline" | "Status Comercial" | "Observações" | "Notas" | "Documentos" | "Erros" | "Suporte" | "Pedido";
  descricao: string;
  autor?: string | null;
  valor_anterior?: string | null;
  valor_novo?: string | null;
  detalhe?: string | null;
};

function historicoTone(origem: HistoricoUnificadoItem["origem"]) {
  if (origem === "Pipeline") return "purple";
  if (origem === "Status Comercial") return "info";
  if (origem === "Observações") return "omni";
  if (origem === "Notas") return "warning";
  if (origem === "Documentos") return "success";
  if (origem === "Erros") return "destructive";
  if (origem === "Suporte") return "info";
  return "muted-foreground";
}

function VendaDetalhePage() {
  const { id } = Route.useParams();
  const { vendas, vendasPipeline, ambiente, moveVenda, updateVenda, reloadFromDb, loaded } = useOmni();
  const search = Route.useSearch();
  const { suporte: suporteSearch, clienteId: clienteIdSearch } = search;
  const navigate = useNavigate();
  const voltarPaginaAnterior = useSmartBack("/pipeline");
  const { user, profile, roles, primaryRole } = useAuth();
  const { comissoesVisible } = useFeatures();
  const { data: colabsDB } = useColaboradoresDB();
  const { data: colabsAll } = useColaboradoresDB();
  const { funis: pipelineFunis, etapas: pipelineEtapas, supportEnabled } = usePipelineStructure();

  const venda = useMemo(() => vendas.find(v => v.id === id), [vendas, id]);
  const stageQueue = useMemo(() => {
    if (!venda) return [];
    return vendasPipeline.filter(item =>
      item.funil === venda.funil
      && item.etapaId === venda.etapaId
      && (ambiente === "GERAL" || item.operadora === ambiente)
    );
  }, [vendasPipeline, venda, ambiente]);

  const stageQueueIndex = useMemo(
    () => stageQueue.findIndex(item => item.id === venda?.id),
    [stageQueue, venda?.id],
  );

  const previousStageVenda = stageQueueIndex > 0 ? stageQueue[stageQueueIndex - 1] : null;
  const nextStageVenda = stageQueueIndex >= 0 && stageQueueIndex < stageQueue.length - 1
    ? stageQueue[stageQueueIndex + 1]
    : null;

  const goToSiblingVenda = useCallback((targetId: string) => {
    navigate({ ...buildVendaDetailUrl(targetId), search: { suporte: undefined, etapaSuporte: undefined, clienteId: undefined } });
  }, [navigate]);

  // venda já declarado acima

  const [historicoDb, setHistoricoDb] = useState<any[]>([]);
  useEffect(() => {
    if (!venda?.id) return;
    (async () => {
      const { data } = await supabase
        .from("venda_historico")
        .select("id, created_at, tipo, campo, valor_anterior, valor_novo, descricao, user_nome")
        .eq("venda_id", venda?.id)
        .order("created_at", { ascending: false });
      setHistoricoDb((data ?? []) as any[]);
    })();
  }, [venda?.id, vendas]);

  const [historicoUnificado, setHistoricoUnificado] = useState<HistoricoUnificadoItem[]>([]);
  const fetchHistoricoUnificado = useCallback(async () => {
    if (!venda?.id) {
      setHistoricoUnificado([]);
      return;
    }

    const db = supabase as any;
    const [
      historicoRes,
      statusRes,
      observacoesRes,
      notasRes,
      documentosRes,
      errosRes,
      suporteRes,
    ] = await Promise.all([
      db.from("venda_historico")
        .select("id,created_at,tipo,campo,valor_anterior,valor_novo,descricao,user_nome")
        .eq("venda_id", venda.id),
      db.from("venda_status_comercial_historico")
        .select("id,created_at,status_nome_snapshot,user_nome,user_role,observacao,operadora_snapshot")
        .eq("venda_id", venda.id),
      db.from("venda_observacoes")
        .select("id,created_at,updated_at,texto,autor_nome,autor_perfil,tag_nome_snapshot")
        .eq("venda_id", venda.id),
      db.from("venda_consultor_notas")
        .select("id,created_at,conteudo,autor_nome,imagens")
        .eq("venda_id", venda.id),
      db.from("venda_documentos")
        .select("id,created_at,deleted_at,titulo,arquivo_nome_original,created_by_nome,deleted_by_nome")
        .eq("venda_id", venda.id),
      db.from("venda_erros")
        .select("id,created_at,resolvido_em,observacao,resolvido,erro:erros_catalogo(nome)")
        .eq("venda_id", venda.id),
      db.from("suporte_solicitacoes")
        .select("id,numero,created_at,concluido_em,criado_por_nome,motivo,status,prioridade,responsavel_nome,deleted_at,deletion_reason")
        .eq("venda_id", venda.id),
    ]);

    const eventos: HistoricoUnificadoItem[] = [];

    for (const h of historicoRes.data ?? []) {
      // Fontes abaixo entram pelas tabelas próprias para não duplicar a linha do tempo.
      if (h.tipo === "observacao" || h.tipo === "nota" || h.campo === "documento_pedido") continue;
      const origem: HistoricoUnificadoItem["origem"] =
        h.tipo === "etapa" || h.tipo === "funil" || h.tipo === "criacao"
          ? "Pipeline"
          : "Pedido";
      eventos.push({
        id: `historico:${h.id}`,
        created_at: h.created_at,
        origem,
        descricao: h.descricao || "Alteração registrada no pedido.",
        autor: h.user_nome || "Sistema",
        valor_anterior: h.valor_anterior,
        valor_novo: h.valor_novo,
        detalhe: h.campo ? `Campo: ${h.campo}` : null,
      });
    }

    for (const h of statusRes.data ?? []) {
      eventos.push({
        id: `status:${h.id}`,
        created_at: h.created_at,
        origem: "Status Comercial",
        descricao: h.status_nome_snapshot || "Status Comercial atualizado",
        autor: h.user_nome || "Sistema",
        valor_novo: h.status_nome_snapshot,
        detalhe: [h.operadora_snapshot, h.observacao].filter(Boolean).join(" · ") || null,
      });
    }

    for (const h of observacoesRes.data ?? []) {
      eventos.push({
        id: `observacao:${h.id}`,
        created_at: h.created_at,
        origem: "Observações",
        descricao: h.texto || "Observação registrada.",
        autor: h.autor_nome || "Usuário",
        detalhe: h.tag_nome_snapshot ? `Tag: ${h.tag_nome_snapshot}` : null,
      });
      if (h.updated_at && h.updated_at !== h.created_at) {
        eventos.push({
          id: `observacao-edicao:${h.id}`,
          created_at: h.updated_at,
          origem: "Observações",
          descricao: "Observação editada",
          autor: h.autor_nome || "Usuário",
          detalhe: h.texto || null,
        });
      }
    }

    // A própria RLS decide quem pode ler Assinatura Notas.
    for (const h of notasRes.data ?? []) {
      const imagens = Array.isArray(h.imagens) ? h.imagens.length : 0;
      eventos.push({
        id: `nota:${h.id}`,
        created_at: h.created_at,
        origem: "Notas",
        descricao: h.conteudo || (imagens ? "Nota com imagem anexada." : "Nota registrada."),
        autor: h.autor_nome || "Usuário",
        detalhe: imagens ? `${imagens} imagem(ns)` : null,
      });
    }

    for (const h of documentosRes.data ?? []) {
      eventos.push({
        id: `documento:${h.id}`,
        created_at: h.created_at,
        origem: "Documentos",
        descricao: `Documento adicionado: ${h.titulo || h.arquivo_nome_original || "arquivo"}`,
        autor: h.created_by_nome || "Usuário",
        detalhe: h.arquivo_nome_original || null,
      });
      if (h.deleted_at) {
        eventos.push({
          id: `documento-removido:${h.id}`,
          created_at: h.deleted_at,
          origem: "Documentos",
          descricao: `Documento removido: ${h.titulo || h.arquivo_nome_original || "arquivo"}`,
          autor: h.deleted_by_nome || "Usuário",
        });
      }
    }

    for (const h of errosRes.data ?? []) {
      const nomeErro = h.erro?.nome || "Erro";
      eventos.push({
        id: `erro:${h.id}`,
        created_at: h.created_at,
        origem: "Erros",
        descricao: `${nomeErro} registrado`,
        autor: "Sistema",
        detalhe: h.observacao || null,
      });
      if (h.resolvido_em) {
        eventos.push({
          id: `erro-resolvido:${h.id}`,
          created_at: h.resolvido_em,
          origem: "Erros",
          descricao: `${nomeErro} resolvido`,
          autor: "Usuário",
          detalhe: h.observacao || null,
        });
      }
    }

    for (const h of suporteRes.data ?? []) {
      eventos.push({
        id: `suporte:${h.id}`,
        created_at: h.created_at,
        origem: "Suporte",
        descricao: `Suporte ${h.numero || ""} aberto`.trim(),
        autor: h.criado_por_nome || "Usuário",
        detalhe: [h.prioridade ? `Prioridade: ${h.prioridade}` : null, h.motivo].filter(Boolean).join(" · ") || null,
      });
      if (h.concluido_em) {
        eventos.push({
          id: `suporte-concluido:${h.id}`,
          created_at: h.concluido_em,
          origem: "Suporte",
          descricao: `Suporte ${h.numero || ""} concluído`.trim(),
          autor: h.responsavel_nome || "Usuário",
          detalhe: h.status || null,
        });
      }
      if (h.deleted_at) {
        eventos.push({
          id: `suporte-removido:${h.id}`,
          created_at: h.deleted_at,
          origem: "Suporte",
          descricao: `Suporte ${h.numero || ""} removido`.trim(),
          autor: "Usuário",
          detalhe: h.deletion_reason || null,
        });
      }
    }

    eventos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setHistoricoUnificado(eventos);
  }, [venda?.id]);

  useEffect(() => {
    void fetchHistoricoUnificado();
  }, [fetchHistoricoUnificado, vendas]);

  const legendaRoboPorStatus = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of historicoDb) {
      if (item?.campo !== "status_pedido") continue;
      const status = String(item?.valor_novo ?? "").trim();
      const descricao = String(item?.descricao ?? "").trim();
      if (!status || !descricao) continue;

      const generica = /^Robô ADM API \(Update Padrão\)$/i.test(descricao)
        || /^Robo ADM API \(Update Padrao\)$/i.test(descricao);

      if (!generica && !map.has(status)) {
        map.set(status, descricao);
      }
    }
    return map;
  }, [historicoDb]);

  const [roboLogs, setRoboLogs] = useState<any[]>([]);
  const fetchRoboLogs = useCallback(async () => {
    if (!venda?.id) {
      setRoboLogs([]);
      return;
    }

    let query = (supabase as any)
      .from("venda_robo_logs")
      .select("id, venda_id, venda_numero, created_at, robo_nome, origem, acao, campo, campo_label, valor_anterior, valor_novo, descricao, detalhes, observacao_bko, observacao_bko_user_nome, observacao_bko_user_role, observacao_bko_em")
      .order("created_at", { ascending: false });

    const numeroPersistido = numeroPedidoPersistido(venda?.numero);
    if (numeroPersistido) {
      query = query.or(`venda_id.eq.${venda.id},venda_numero.eq.${numeroPersistido}`);
    } else {
      query = query.eq("venda_id", venda.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[LOG ROBÔ] Não foi possível carregar os eventos:", error);
      return;
    }

    setRoboLogs(data ?? []);
  }, [venda?.id, venda?.numero]);

  useEffect(() => {
    fetchRoboLogs();
    if (!venda?.id) return;

    const numeroPersistido = numeroPedidoPersistido(venda.numero);
    const channel = supabase
      .channel(`venda-robo-logs-${numeroPersistido || venda.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "venda_robo_logs",
          filter: numeroPersistido ? `venda_numero=eq.${numeroPersistido}` : `venda_id=eq.${venda.id}`,
        },
        () => fetchRoboLogs(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venda?.id, venda?.numero, fetchRoboLogs]);


  // colabsDB já definido acima
  const [clienteReal, setClienteReal] = useState<any>(null);
  const [loadingCliente, setLoadingCliente] = useState(false);

  const fetchCliente = useCallback(async () => {
    if (!venda?.clienteId) return;
    setLoadingCliente(true);
    const { data } = await supabase
      .from("clientes")
      .select("id, razao_social, cnpj_cpf, contato, telefone, email, uf, ddd, endereco, observacao, operadoras")
      .eq("id", venda.clienteId)
      .maybeSingle();
    if (data) setClienteReal(data);
    setLoadingCliente(false);
  }, [venda?.clienteId]);

  useEffect(() => {
    fetchCliente();
    if (!venda?.clienteId) return;
    const channel = supabase
      .channel(`venda-cliente-${venda.clienteId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "clientes", filter: `id=eq.${venda.clienteId}` }, () => fetchCliente())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [venda?.clienteId, fetchCliente]);

  const cliente = useMemo(() => {
    if (clienteReal) {
      return {
        id: clienteReal.id,
        razaoSocial: clienteReal.razao_social,
        cnpj: clienteReal.cnpj_cpf,
        uf: clienteReal.uf || "—",
        ddd: clienteReal.ddd || "",
        operadoras: clienteReal.operadoras || [],
        contato: clienteReal.contato || "—",
        telefone: clienteReal.telefone || "—",
        email: clienteReal.email || "—",
        endereco: clienteReal.endereco || "—",
        observacao: clienteReal.observacao || "—",
        totalLinhas: (vendas || []).filter(v => v.clienteId === clienteReal.id && !v.etapaId?.includes("cancel")).reduce((acc, v) => acc + (v.quantidadeLinhas || 0), 0),
        receitaMensal: (vendas || []).filter(v => v.clienteId === clienteReal.id && !v.etapaId?.includes("cancel")).reduce((acc, v) => acc + (v.receita || 0), 0),
      };
    }
    return {
      id: venda?.clienteId || "",
      razaoSocial: venda?.clienteRazaoSocial ?? "—",
      cnpj: venda?.clienteCnpj ?? "",
      uf: venda?.clienteUf ?? "—",
      ddd: "",
      operadoras: [venda?.operadora as any],
      contato: venda?.clienteContato ?? "—",
      telefone: venda?.clienteTelefone ?? "—",
      email: venda?.clienteEmail ?? "—",
      endereco: "—",
      observacao: venda?.observacao ?? "—",
      totalLinhas: venda?.quantidadeLinhas ?? 0,
      receitaMensal: venda?.receita ?? 0,
    };
  }, [venda, clienteReal, vendas]);

  const colabReal = venda?.consultorColabId
    ? colabsDB.find(c => c.id === venda?.consultorColabId)
    : colabsDB.find(c => c.user_id === venda?.consultorId);
  const consultor = colabReal
    ? {
        id: colabReal.id,
        nome: colabReal.nome_exibicao,
        iniciais: colabReal.nome_exibicao.split(/\s+/).slice(0, 2).map(p => p[0] ?? "").join("").toUpperCase(),
        funcao: colabReal.funcao,
      }
    : (venda?.consultorNome
        ? { id: "", nome: venda?.consultorNome, iniciais: venda?.consultorNome.split(/\s+/).slice(0,2).map(p=>p[0]??"").join("").toUpperCase(), funcao: null }
        : getColaborador(venda?.consultorId || ""));
  const bko = venda?.bkoId ? getColaborador(venda?.bkoId || "") : null;

  const etapa = pipelineEtapas.find(e => e.id === venda?.etapaId) ?? getEtapa(venda?.etapaId || "");
  const funilNome = pipelineFunis.find(f => f.id === venda?.funil)?.nome ?? FUNIS.find(f => f.id === venda?.funil)?.nome ?? "—";

  const historicoLegacy = HISTORICO.filter(h => h.vendaId === venda?.id);

  // Transições de funil
  const podeVirarVenda = venda?.etapaId === "p-proposta";
  const podeEnviarAssinatura = venda?.etapaId === "f-contrato";

  // Hooks search e suporte*
  // Hooks search e suporte* (search já extraído no topo)
  const [suporteOpen, setSuporteOpen] = useState(Boolean(suporteSearch));
  const [suporteMotivo, setSuporteMotivo] = useState("");
  const [suportePrioridade, setSuportePrioridade] = useState<SupportPriority | "">("");
  const [suporteSaving, setSuporteSaving] = useState(false);
  const [confirmAcao, setConfirmAcao] = useState<null | "virar" | "assinar">(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [cancelarAtendimentoOpen, setCancelarAtendimentoOpen] = useState(false);
  const [cancelarAtendimentoReason, setCancelarAtendimentoReason] = useState("");
  const [cancelarAtendimentoSaving, setCancelarAtendimentoSaving] = useState(false);
  const [finalizarCanceladoOpen, setFinalizarCanceladoOpen] = useState(false);
  const [finalizarCanceladoSaving, setFinalizarCanceladoSaving] = useState(false);
  const [trocarOperadoraOpen, setTrocarOperadoraOpen] = useState(false);
  const [trocarOperadoraSaving, setTrocarOperadoraSaving] = useState(false);
  const [trocarOperadoraConfirmacao, setTrocarOperadoraConfirmacao] = useState("");
  const [novaOperadora, setNovaOperadora] = useState<"CLARO" | "VIVO">("VIVO");
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewData, setPdfPreviewData] = useState<Uint8Array | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);

  useEffect(() => {
    if (id === "nova" && clienteIdSearch) {
      setEditOpen(true);
    }
  }, [id, clienteIdSearch]);

  // Edição da venda
  const isBKO = roles.includes("bko");
  const isAdmin = roles.includes("admin");
  const isGestor = roles.includes("gestor");
  const isConsultor = roles.includes("consultor");


  // Auto-abrir edição ao criar nova venda
  useEffect(() => {
    if (id === 'nova' && clienteIdSearch && loaded && !editOpen) {
      abrirEdicao();
    }
  }, [id, clienteIdSearch, loaded]);

  // Exclusão definitiva do pedido: somente Admin e BKO.
  // Gestor pode cancelar o pedido, mas não excluí-lo.
  const podeExcluirPedido = isAdmin || isBKO;
  const isDono = venda?.consultorId === user?.id || ((venda as any)?.created_by ?? "") === user?.id;
  const concluida = Boolean(venda?.concluidoEm);
  const podeVerAssinaturaNotas = Boolean(
    venda?.id
      && venda.funil === "assinatura"
      && (isGestor || (roles.includes("consultor") && isDono)),
  );
  const podeEditar = isAdmin || isBKO || (!concluida && (isGestor || isDono));

  // Edição comercial da tela de Informações da Venda:
  // ADM/BKO, Gestor e o Consultor responsável podem manter Linhas, Cedentes,
  // Representantes e dados da Empresa. Isso NÃO libera status, conclusão,
  // finalização, exclusão do pedido nem demais ações operacionais protegidas.
  const podeEditarInformacoesVenda = isAdmin || isBKO || isGestor || (isConsultor && isDono);
  const podeEditarLinhas = podeEditarInformacoesVenda;
  const podeEditarDatas = isAdmin || isBKO;
  const podeEditarBiometriaStatus = isAdmin || isBKO;
  const podeGerenciarCedentes = podeEditarInformacoesVenda;
  const podeGerenciarRepresentantes = podeEditarInformacoesVenda;
  const podeEditarCliente = podeEditarInformacoesVenda && Boolean(clienteReal?.id);

  const statusAtualParaCancelamento = useMemo(() => {
    const statusPedido = venda?.statusPedido?.trim() || "";
    const statusRobo = venda?.statusPedidoRoboNome?.trim() || "";
    const statusManual = venda?.statusComercialNome?.trim() || "";

    // Se status_pedido foi alterado por uma pessoa, ele é o status operacional vigente.
    if (statusPedido && venda?.statusPedidoUserNome) return statusPedido;

    const roboEventoEm = venda?.statusPedidoRoboEm ?? venda?.statusPedidoEm;
    const roboTime = roboEventoEm ? new Date(roboEventoEm).getTime() : Number.NEGATIVE_INFINITY;
    const manualTime = venda?.statusComercialEm ? new Date(venda.statusComercialEm).getTime() : Number.NEGATIVE_INFINITY;
    const statusAutomatico = statusRobo || statusPedido;

    if (statusAutomatico && statusManual) {
      if (Number.isFinite(roboTime) || Number.isFinite(manualTime)) {
        return roboTime >= manualTime ? statusAutomatico : statusManual;
      }
      return statusAutomatico;
    }
    return statusAutomatico || statusManual;
  }, [
    venda?.statusPedidoRoboNome,
    venda?.statusPedidoRoboEm,
    venda?.statusPedido,
    venda?.statusPedidoUserNome,
    venda?.statusPedidoEm,
    venda?.statusComercialNome,
    venda?.statusComercialEm,
  ]);

  const pedidoCancelado = /CANCELAD/i.test(statusAtualParaCancelamento);

  if (!venda) {
    if (!loaded) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
          Carregando venda…
        </div>
      );
    }
    if (id !== "nova" || !clienteIdSearch) {
      throw notFound();
    }
  }

  function abrirEdicao() {
    if (id !== "nova" && !venda) {
      toast.error("O pedido ainda não terminou de carregar.");
      return;
    }
    setEditOpen(true);
  }

  async function salvarEdicao(form: Record<string, any>, consultoresReais: any[]) {
    if (editSaving) return;
    setEditSaving(true);

    try {
      const patch: Record<string, any> = {};

      Object.entries(form).forEach(([k, v]) => {
        patch[k] = v === "" || v === undefined ? null : v;
      });

      if ("clienteId" in patch) {
        patch.cliente_id = patch.clienteId;
        delete patch.clienteId;
      }

      if (id !== "nova" && (isAdmin || isBKO)) {
        const consultorId = patch.consultor_id || null;

        if (consultorId) {
          const consultorSelecionado = consultoresReais.find(c => c.id === consultorId);
          if (!consultorSelecionado) {
            toast.error("Consultor selecionado não está mais disponível.");
            return;
          }

          const colabSelecionado = colabsAll.find(c => c.user_id === consultorId) ?? null;
          patch.consultor_id = consultorId;
          patch.consultor_nome = colabSelecionado?.nome_exibicao ?? consultorSelecionado.nome_completo;
          patch.consultor_colab_id = colabSelecionado?.id ?? null;
        } else {
          patch.consultor_id = null;
          patch.consultor_nome = null;
          patch.consultor_colab_id = null;
        }
      }

      if (id === "nova") {
        const { data: destinoRaw, error: destinoError } = await supabase
          .rpc("pipeline_resolve_initial_destination" as any)
          .maybeSingle();
        const destino = destinoRaw as { funil_id: string; etapa_id: string } | null;

        if (destinoError || !destino) {
          toast.error("Nenhum destino comercial ativo está disponível", {
            description: "Ative pelo menos um funil comercial com uma etapa ativa em Configurações → Estrutura.",
          });
          return;
        }

        patch.funil = destino.funil_id;
        patch.etapa_id = destino.etapa_id;

        const etapaSel = pipelineEtapas.find(e => e.id === patch.etapa_id);
        if (etapaSel) patch.funil = etapaSel.funil_id;
      } else {
        delete patch.funil;
        delete patch.etapa_id;
      }

      patch.valor = Number(patch.valor) || 0;
      patch.quantidade_linhas = Number(patch.quantidade_linhas) || 0;

      let ok = false;

      if (id === "nova") {
        const { data, error } = await supabase
          .from("vendas")
          .insert([patch as any])
          .select()
          .single();

        if (error) {
          toast.error("Erro ao criar venda: " + error.message);
          return;
        }

        toast.success("Venda criada com sucesso");
        await reloadFromDb();
        navigate({ ...buildVendaDetailUrl(data.id) });
        ok = true;
      } else {
        if (!venda?.id) {
          toast.error("Pedido não encontrado para edição.");
          return;
        }
        ok = await updateVenda(venda.id, patch);
      }

      if (ok) setEditOpen(false);
    } catch (error: any) {
      console.error("[EDITAR PEDIDO]", error);
      toast.error("Não foi possível salvar o pedido.", {
        description: error?.message ?? "Erro inesperado",
      });
    } finally {
      setEditSaving(false);
    }
  }

  const podeTransicionar = roles.some(r => r === "admin" || r === "gestor" || r === "consultor");

  async function cancelarAtendimento() {
    if (!venda?.id || !(isAdmin || isBKO || isGestor) || cancelarAtendimentoSaving) return;

    const motivo = cancelarAtendimentoReason.trim();
    if (!motivo) {
      toast.error("Informe o motivo do cancelamento.");
      return;
    }

    setCancelarAtendimentoSaving(true);
    try {
      const { error } = await (supabase as any).rpc("pipeline_cancelar_atendimento", {
        p_venda_id: venda.id,
        p_motivo: motivo,
      });
      if (error) throw error;

      toast.success("Pedido cancelado", {
        description: "O pedido foi marcado como CANCELADO, saiu do Pipeline ativo e o cancelamento ficou registrado no histórico.",
      });
      setCancelarAtendimentoOpen(false);
      setCancelarAtendimentoReason("");
      await reloadFromDb();
    } catch (error: any) {
      console.error("[CANCELAR ATENDIMENTO]", error);
      toast.error("Não foi possível cancelar o pedido.", { description: error?.message });
    } finally {
      setCancelarAtendimentoSaving(false);
    }
  }

  async function finalizarPedidoCancelado() {
    if (!venda?.id || !isBKO || !pedidoCancelado || concluida) return;

    setFinalizarCanceladoSaving(true);
    try {
      const { error } = await (supabase as any).rpc("pipeline_finalizar_pedido_cancelado", {
        p_venda_id: venda.id,
      });
      if (error) throw error;

      toast.success("Pedido cancelado finalizado", {
        description: "O pedido saiu do Pipeline ativo e continua disponível em Clientes / Pedidos.",
      });
      setFinalizarCanceladoOpen(false);
      await reloadFromDb();
    } catch (error: any) {
      console.error("[FINALIZAR CANCELADO]", error);
      toast.error("Não foi possível finalizar o pedido cancelado.", { description: error?.message });
    } finally {
      setFinalizarCanceladoSaving(false);
    }
  }

  async function trocarOperadoraPedido() {
    if (!venda?.id || !(isBKO || isAdmin) || trocarOperadoraSaving) return;

    const destino = novaOperadora;
    if (destino === venda.operadora) {
      toast.info("Selecione uma operadora diferente da atual.");
      return;
    }

    const fraseEsperada = `TROCAR PARA ${destino}`;
    if (trocarOperadoraConfirmacao.trim().toUpperCase() !== fraseEsperada) {
      toast.error(`Digite "${fraseEsperada}" para confirmar a troca.`);
      return;
    }

    setTrocarOperadoraSaving(true);
    try {
      const { data, error } = await (supabase as any).rpc("pipeline_trocar_operadora", {
        p_venda_id: venda.id,
        p_nova_operadora: destino,
      });
      if (error) throw error;

      await reloadFromDb();
      await fetchRoboLogs();
      setTrocarOperadoraOpen(false);
      setTrocarOperadoraConfirmacao("");

      const etapaMudou = data?.etapa_anterior && data?.etapa_nova && data.etapa_anterior !== data.etapa_nova;
      toast.success(`Operadora alterada para ${destino}`, {
        description: etapaMudou
          ? `Pedido atualizado em todo o sistema e etapa ajustada para ${data.etapa_nova}.`
          : "Pedido atualizado em todo o sistema, com SLA, status e catálogos reprocessados.",
      });
    } catch (error: any) {
      console.error("[TROCAR OPERADORA]", error);
      toast.error("Não foi possível trocar a operadora.", { description: error?.message });
    } finally {
      setTrocarOperadoraSaving(false);
    }
  }

  async function carregarLinhasNotaPDF() {
    if (!venda?.id) return [];
    const { data, error } = await (supabase as any)
      .from("venda_linhas")
      .select("ordem, numero, ddd, plano, produto, valor_mensal, status, observacao")
      .eq("venda_id", venda.id)
      .order("ordem", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async function baixarPDF() {
    if (!venda) return;
    try {
      const linhas = await carregarLinhasNotaPDF();
      const doc = gerarNotaPDF(venda, cliente, consultor?.nome, etapa?.nome, linhas as any);
      doc.save(`OMNI-${venda.numero}.pdf`);
      toast.success("PDF gerado com os dados atuais do pedido");
    } catch (error: any) {
      console.error("[NOTA PDF]", error);
      toast.error("Não foi possível gerar a Nota PDF.", { description: error?.message });
    }
  }

  async function preverPDF() {
    if (!venda) return;

    setPdfPreviewOpen(true);
    setPdfPreviewLoading(true);
    setPdfPreviewData(null);

    try {
      const linhas = await carregarLinhasNotaPDF();
      const doc = gerarNotaPDF(venda, cliente, consultor?.nome, etapa?.nome, linhas as any);
      const buffer = doc.output("arraybuffer") as ArrayBuffer;
      setPdfPreviewData(new Uint8Array(buffer));
    } catch (error: any) {
      setPdfPreviewOpen(false);
      console.error("[PRÉ-VISUALIZAÇÃO PDF]", error);
      toast.error("Não foi possível abrir a pré-visualização.", { description: error?.message });
    } finally {
      setPdfPreviewLoading(false);
    }
  }

  async function logHistorico(descricao: string) {
    if (!user) return;
    await supabase.from("venda_historico").insert({
      venda_id: venda?.id || "",
      tipo: "observacao",
      descricao,
      user_id: user.id,
      user_nome: profile?.nome_completo ?? user.email ?? null,
    });
  }

  async function editarCampoCliente(
    campo: "razao_social" | "cnpj_cpf" | "contato" | "telefone" | "email" | "uf" | "ddd" | "endereco" | "observacao",
    label: string,
    valorAtual: string,
    novoValor: string,
  ) {
    if (!clienteReal?.id) return false;

    const novo = novoValor.trim();

    if (campo === "cnpj_cpf") {
      const atualNormalizado = String(valorAtual ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
      const novoNormalizado = novo.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
      if (novoNormalizado !== atualNormalizado) {
        const { data: documentoEmUso, error: documentoError } = await (supabase as any)
          .rpc("cliente_documento_em_uso", {
            p_documento: novo,
            p_excluir_cliente_id: clienteReal.id,
          });
        if (documentoError) {
          toast.error("Não foi possível validar o CNPJ/CPF.", { description: documentoError.message });
          return false;
        }
        if (documentoEmUso) {
          toast.error("Este CNPJ/CPF já está cadastrado em outra empresa.");
          return false;
        }
      }
    }

    const { error } = await (supabase as any)
      .from("clientes")
      .update({ [campo]: novo || null })
      .eq("id", clienteReal.id);

    if (error) {
      toast.error("Não foi possível atualizar o cliente.", { description: error.message });
      return false;
    }

    if (venda?.id && user) {
      await (supabase as any).from("venda_historico").insert({
        venda_id: venda.id,
        tipo: "campo",
        campo: `cliente.${campo}`,
        valor_anterior: valorAtual || null,
        valor_novo: novo || null,
        descricao: `Cliente: ${label} atualizado`,
        user_id: user.id,
        user_nome: profile?.nome_completo ?? user.email ?? null,
      });
    }

    await fetchCliente();
    await reloadFromDb();
    await fetchHistoricoUnificado();
    toast.success(`${label} atualizado.`);
    return true;
  }

  async function virarVenda() {
    if (!venda) return;
    const destino = nextActiveCommercialDestination(venda.funil, pipelineFunis, pipelineEtapas);
    if (!destino) {
      toast.error("Nenhum próximo funil comercial ativo está disponível.");
      return;
    }
    const moved = await moveVenda(venda.id, destino.etapaId);
    if (!moved) return;
  }

  async function enviarAssinatura() {
    if (!venda) return;
    const destino = firstActiveDestinationForFunnel("assinatura", pipelineFunis, pipelineEtapas);
    if (!destino) {
      toast.error("O funil Assinatura está desativado ou não possui etapa ativa.");
      return;
    }
    const moved = await moveVenda(venda.id, destino.etapaId);
    if (!moved) return;
  }

  async function confirmarSuporte() {
    if (!supportEnabled) {
      toast.error("O funil Suporte está desativado em Configurações → Estrutura.");
      setSuporteOpen(false);
      return;
    }
    if (!suporteMotivo.trim()) {
      toast.error("Descreva o motivo do envio para Suporte");
      return;
    }
    if (!suportePrioridade) {
      toast.error("Selecione a prioridade do atendimento");
      return;
    }
    if (!venda?.id) return;

    setSuporteSaving(true);
    try {
      const { createSupportRequest } = await import("@/lib/support.functions");
      const solicitacaoId = await createSupportRequest(venda.id, suporteMotivo.trim(), suportePrioridade);
      await logHistorico(
        `Solicitação de suporte ${solicitacaoId} criada sem mover o pedido: ${suporteMotivo.trim()}`,
      );
      setSuporteOpen(false);
      setSuporteMotivo("");
      setSuportePrioridade("");
      toast.success("Solicitação enviada ao Suporte", {
        description: "O pedido continua no funil e na etapa atuais.",
      });
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível enviar a solicitação ao Suporte");
    } finally {
      setSuporteSaving(false);
    }
  }


  return (
    <div className="omni-venda-page p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div>
        <div className="relative mb-3 flex min-h-8 flex-col gap-2 sm:flex-row sm:items-start sm:justify-center">
          <button
            type="button"
            onClick={voltarPaginaAnterior}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground sm:absolute sm:left-0 sm:top-1"
          >
            <ArrowLeft className="size-3" /> Voltar
          </button>

        </div>

        <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
              <PedidoHeaderMeta
                operadora={venda?.operadora}
                tipoPedido={venda?.tipoPedidos?.length ? venda.tipoPedidos : venda?.tipoPedido}
                statusBiometria={(venda?.statusBiometria ?? "") as "" | "pendente" | "concluido" | "cancelado"}
                canEditBiometria={podeEditarBiometriaStatus}
                onBiometriaChange={async (status) => {
                  if (!podeEditarBiometriaStatus) return false;
                  return updateVenda(venda?.id || "", { status_biometria: status === "" ? null : status });
                }}
              />
              {venda?.temErro && (
                <Badge className="bg-destructive/15 text-destructive border-destructive/40 text-[9px] gap-1 shadow-[0_0_8px_-2px_hsl(var(--destructive)/0.7)]">
                  <span className="size-1.5 rounded-full bg-destructive animate-pulse shadow-[0_0_5px_hsl(var(--destructive))]" />ERRO EM ABERTO
                </Badge>
              )}
              {comissoesVisible && <ComissaoBadge vendaId={venda?.id || ""} />}

            </div>
            <div className="min-w-0">
              <h1
                className="block min-w-0 truncate whitespace-nowrap text-xl font-display font-bold tracking-tight 2xl:text-2xl"
                title={uppercaseDisplay(cliente.razaoSocial)}
              >
                {uppercaseDisplay(cliente.razaoSocial)}
              </h1>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                {cliente.cnpj && (
                  <CopyCnpj value={cliente.cnpj} />
                )}
              </div>
            </div>
          </div>
          <div
            className={cn(
              "relative flex min-w-0 flex-wrap items-center gap-2 xl:flex-nowrap xl:justify-end",
              (isAdmin || isBKO) ? "pt-10" : "pt-6",
            )}
          >
            <div className="absolute right-0 top-0 flex flex-col items-end whitespace-nowrap">
              {(isAdmin || isBKO) && (
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                    Número do pedido
                  </span>
                  <span
                    className="font-mono text-[11px] font-bold text-foreground"
                    title={venda?.numero || "—"}
                  >
                    {venda?.numero || "—"}
                  </span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-white/5",
                          venda?.operadora === "VIVO"
                            ? "hover:text-violet-300"
                            : "hover:text-red-300",
                        )}
                        title="Editar número do pedido"
                        aria-label="Editar número do pedido"
                      >
                        <Pencil className="size-2.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72">
                      <NumeroPedidoEditor
                        vendaId={venda?.id || ""}
                        numeroAtual={isNumeroPedidoNaoInformado(venda?.numero) ? "" : (venda?.numero || "")}
                        updateVenda={updateVenda}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              <div className="text-[10px] text-muted-foreground">
                {uppercaseDisplay(funilNome)} → <span className="font-semibold text-foreground">{uppercaseDisplay(etapa?.nome)}</span>
              </div>
            </div>
            {venda && !venda.concluidoEm && (
              <MoveVendaDialog
                vendaId={venda.id}
                vendaNumero={venda.numero}
                currentFunilId={venda.funil}
                currentEtapaId={venda.etapaId}
                role={primaryRole}
                funis={pipelineFunis}
                etapas={pipelineEtapas}
                visibleCommercialFunilIds={pipelineFunis
                  .filter(item => item.ativo && item.participa_fluxo_comercial)
                  .sort((a, b) => a.ordem - b.ordem)
                  .map(item => item.id)}
              />
            )}
            {venda && stageQueueIndex >= 0 && stageQueue.length > 1 && (
              <TooltipProvider delayDuration={120}>
                <div className="inline-flex items-center overflow-hidden rounded-lg border border-border bg-surface-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-none border-r border-border"
                        disabled={!previousStageVenda}
                        onClick={() => previousStageVenda && goToSiblingVenda(previousStageVenda.id)}
                        aria-label="Pedido anterior desta etapa"
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {previousStageVenda
                        ? `Anterior: ${uppercaseDisplay(previousStageVenda.clienteRazaoSocial || previousStageVenda.numero)}`
                        : "Primeiro pedido desta etapa"}
                    </TooltipContent>
                  </Tooltip>

                  <div
                    className="min-w-[72px] px-2 text-center"
                    title={etapa?.nome ? `${etapa.nome}: ${stageQueue.length} pedidos visíveis` : undefined}
                  >
                    <div className="text-[8px] font-black uppercase tracking-[0.12em] text-muted-foreground">Etapa</div>
                    <div className="font-mono text-[10px] font-bold text-foreground">
                      {stageQueueIndex + 1} / {stageQueue.length}
                    </div>
                  </div>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-none border-l border-border"
                        disabled={!nextStageVenda}
                        onClick={() => nextStageVenda && goToSiblingVenda(nextStageVenda.id)}
                        aria-label="Próximo pedido desta etapa"
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {nextStageVenda
                        ? `Próximo: ${uppercaseDisplay(nextStageVenda.clienteRazaoSocial || nextStageVenda.numero)}`
                        : "Último pedido desta etapa"}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            )}
            {venda && <VendaLifecycleActions venda={venda} funis={pipelineFunis} etapas={pipelineEtapas} showMove={false} />}
            {podeVirarVenda && podeTransicionar && (
              <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 font-semibold gap-1.5 whitespace-nowrap" onClick={() => setConfirmAcao("virar")}>
                <ArrowRightCircle className="size-3.5" /> Virar Venda
              </Button>
            )}
            {podeEnviarAssinatura && podeTransicionar && (
              <Button size="sm" className="bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)] font-semibold gap-1.5 whitespace-nowrap" onClick={() => setConfirmAcao("assinar")}>
                <FileSignature className="size-3.5" /> Enviar para Assinatura
              </Button>
            )}
            <DropdownMenu>
              <TooltipProvider delayDuration={120}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-9 shrink-0"
                        aria-label="Mais ações do pedido"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Mais ações</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Ações do pedido
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {podeGerenciarCedentes && venda && (
                  <DropdownMenuItem className="gap-2" onSelect={abrirEdicao}>
                    <Pencil className="size-4" />
                    Editar pedido
                  </DropdownMenuItem>
                )}

                {!isBKO && (
                  <DropdownMenuItem
                    disabled={!supportEnabled}
                    className="gap-2"
                    onSelect={() => {
                      if (supportEnabled) setSuporteOpen(true);
                      else toast.error("O funil Suporte está desativado em Configurações → Estrutura.");
                    }}
                  >
                    <LifeBuoy className="size-4" />
                    <div className="flex flex-col">
                      <span>Suporte</span>
                      {!supportEnabled && <span className="text-[9px] text-muted-foreground">Funil desativado</span>}
                    </div>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem className="gap-2" onSelect={() => void preverPDF()}>
                  <Printer className="size-4" />
                  Pré-visualizar
                </DropdownMenuItem>

                <DropdownMenuItem className="gap-2" onSelect={() => void baixarPDF()}>
                  <Download className="size-4" />
                  Nota PDF
                </DropdownMenuItem>

                {(isBKO || isAdmin) && venda && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="gap-2"
                      onSelect={() => {
                        setNovaOperadora(venda.operadora === "CLARO" ? "VIVO" : "CLARO");
                        setTrocarOperadoraConfirmacao("");
                        setTrocarOperadoraOpen(true);
                      }}
                    >
                      <ArrowLeftRight className="size-4 text-warning" />
                      <div className="flex flex-col">
                        <span>Trocar operadora</span>
                        <span className="text-[9px] text-muted-foreground">Ação crítica · replica no pedido inteiro</span>
                      </div>
                    </DropdownMenuItem>
                  </>
                )}

                {(isBKO || isAdmin || isGestor) && venda && !pedidoCancelado && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                      onSelect={() => {
                        setCancelarAtendimentoReason("");
                        setCancelarAtendimentoOpen(true);
                      }}
                    >
                      <XCircle className="size-4" />
                      <div className="flex flex-col">
                        <span>Cancelar pedido</span>
                        <span className="text-[9px] text-muted-foreground">Não exclui o pedido · registra no histórico</span>
                      </div>
                    </DropdownMenuItem>
                  </>
                )}

                {isBKO && pedidoCancelado && !concluida && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="gap-2 text-warning focus:bg-warning/10 focus:text-warning"
                      onSelect={() => setFinalizarCanceladoOpen(true)}
                    >
                      <CheckCircle2 className="size-4" />
                      Finalizar pedido cancelado
                    </DropdownMenuItem>
                  </>
                )}

                {podeExcluirPedido && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                      onSelect={() => {
                        setDeleteReason("");
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="size-4" />
                      Excluir pedido
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog
              open={trocarOperadoraOpen}
              onOpenChange={(open) => {
                if (!trocarOperadoraSaving) {
                  setTrocarOperadoraOpen(open);
                  if (!open) setTrocarOperadoraConfirmacao("");
                }
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="size-5 text-warning" />
                    Trocar operadora do pedido?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <span className="block">
                      Esta é uma ação crítica. A alteração será replicada em todo o pedido e mudará a operadora exibida no Pipe,
                      Clientes / Pedidos, relatórios, filtros, SLA, status e regras disponíveis nas linhas.
                    </span>
                    <span className="block rounded-lg border border-warning/30 bg-warning/5 p-3 text-foreground">
                      O histórico será preservado. Produto, tipo do pedido e o último status permanecem exatamente como estavam.
                      O SLA e as regras disponíveis passam a seguir a nova operadora; os dados já preenchidos não serão apagados.
                    </span>
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-2">
                  <Label>Nova operadora</Label>
                  <Select
                    value={novaOperadora}
                    onValueChange={(value) => {
                      setNovaOperadora(value as "CLARO" | "VIVO");
                      setTrocarOperadoraConfirmacao("");
                    }}
                    disabled={trocarOperadoraSaving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLARO" disabled={venda?.operadora === "CLARO"}>CLARO</SelectItem>
                      <SelectItem value="VIVO" disabled={venda?.operadora === "VIVO"}>VIVO</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-[10px] text-muted-foreground">
                    Atual: <strong>{venda?.operadora}</strong> · Destino: <strong>{novaOperadora}</strong>
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-destructive/25 bg-destructive/[0.035] p-3">
                  <Label htmlFor="confirmar-troca-operadora" className="text-destructive">
                    Confirmação obrigatória
                  </Label>
                  <div className="text-[11px] text-muted-foreground">
                    Digite <strong className="text-foreground">TROCAR PARA {novaOperadora}</strong> para liberar esta ação crítica.
                  </div>
                  <Input
                    id="confirmar-troca-operadora"
                    value={trocarOperadoraConfirmacao}
                    onChange={(event) => setTrocarOperadoraConfirmacao(event.target.value)}
                    placeholder={`TROCAR PARA ${novaOperadora}`}
                    autoComplete="off"
                    disabled={trocarOperadoraSaving}
                  />
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel disabled={trocarOperadoraSaving}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={
                      trocarOperadoraSaving
                      || novaOperadora === venda?.operadora
                      || trocarOperadoraConfirmacao.trim().toUpperCase() !== `TROCAR PARA ${novaOperadora}`
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      void trocarOperadoraPedido();
                    }}
                    className="bg-warning text-black hover:bg-warning/90"
                  >
                    {trocarOperadoraSaving ? "Alterando operadora..." : `Confirmar troca para ${novaOperadora}`}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
              open={cancelarAtendimentoOpen}
              onOpenChange={(open) => {
                if (!cancelarAtendimentoSaving) {
                  setCancelarAtendimentoOpen(open);
                  if (!open) setCancelarAtendimentoReason("");
                }
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <XCircle className="size-5 text-destructive" />
                    Cancelar pedido?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    O pedido não será excluído. Ele será marcado como CANCELADO, deixará de aparecer no Pipeline ativo
                    e continuará disponível para consulta, com todo o histórico preservado.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-2">
                  <Label>Motivo do cancelamento (obrigatório)</Label>
                  <Textarea
                    value={cancelarAtendimentoReason}
                    onChange={event => setCancelarAtendimentoReason(event.target.value)}
                    placeholder="Ex: Cliente desistiu, pedido aberto indevidamente, solicitação cancelada..."
                    rows={4}
                  />
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel disabled={cancelarAtendimentoSaving}>Voltar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={!cancelarAtendimentoReason.trim() || cancelarAtendimentoSaving}
                    onClick={(event) => {
                      event.preventDefault();
                      void cancelarAtendimento();
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {cancelarAtendimentoSaving ? "Cancelando..." : "Cancelar pedido"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={finalizarCanceladoOpen} onOpenChange={(open) => {
              if (!finalizarCanceladoSaving) setFinalizarCanceladoOpen(open);
            }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Finalizar pedido cancelado?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O pedido continuará disponível em Clientes / Pedidos e manterá todo o histórico,
                    mas deixará de aparecer no Pipeline ativo. Status atual: {statusAtualParaCancelamento || "Cancelado"}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={finalizarCanceladoSaving}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={finalizarCanceladoSaving}
                    onClick={(event) => {
                      event.preventDefault();
                      void finalizarPedidoCancelado();
                    }}
                    className="bg-warning text-black hover:bg-warning/90"
                  >
                    {finalizarCanceladoSaving ? "Finalizando..." : "Finalizar pedido cancelado"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={deleteOpen} onOpenChange={(open) => {
              if (!open && !editSaving) {
                setDeleteOpen(false);
                setDeleteReason("");
              }
            }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir pedido?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir este pedido? O pedido e seus dados vinculados serão excluídos definitivamente. Um registro separado de auditoria da exclusão será preservado.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Label>Motivo da exclusão (obrigatório)</Label>
                  <Textarea
                    value={deleteReason}
                    onChange={e => setDeleteReason(e.target.value)}
                    placeholder="Ex: Pedido duplicado, cancelamento solicitado pelo cliente..."
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <Button variant="destructive" disabled={!deleteReason.trim() || editSaving} onClick={async () => {
                     setEditSaving(true);
                     const { deleteVenda } = await import("@/lib/exclusao.functions");
                     try {
                       const res = await deleteVenda({ data: { vendaId: venda?.id, reason: deleteReason.trim() } });
                       if (res.success) {
                         setDeleteOpen(false);
                         setDeleteReason("");
                         toast.success("Pedido excluído definitivamente.");
                         navigate({ to: "/pipeline" });
                       }
                     } catch (e: any) {
                       console.error("[ERRO EXCLUSÃO]", e);
                       toast.error(e.message || "Não foi possível excluir o pedido. Tente novamente.");
                     } finally {
                       setEditSaving(false);
                     }
                  }}>{editSaving ? "Excluindo..." : "Confirmar exclusão"}</Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <Dialog
        open={pdfPreviewOpen}
        onOpenChange={(open) => {
          setPdfPreviewOpen(open);
          if (!open) {
            setPdfPreviewLoading(false);
            setPdfPreviewData(null);
          }
        }}
      >
        <DialogContent className="flex h-[90vh] w-[calc(100vw-2rem)] max-w-6xl flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border/70 px-5 py-4">
            <div className="flex min-w-0 items-start justify-between gap-4 pr-7">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2">
                  <Printer className="size-4 text-omni" />
                  Pré-visualização da Nota PDF
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Pedido {venda?.numero || "—"} · visualização dentro do sistema
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-2"
                onClick={() => void baixarPDF()}
                disabled={pdfPreviewLoading}
              >
                <Download className="size-3.5" />
                Baixar PDF
              </Button>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden bg-black/20">
            {pdfPreviewLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <RefreshCw className="mr-2 size-5 animate-spin" />
                Gerando pré-visualização…
              </div>
            ) : pdfPreviewData ? (
              <PdfCanvasViewer data={pdfPreviewData} className="h-full" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Não foi possível carregar a Nota PDF.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="resumo">
        <div
          data-pedido-status-inline="true"
          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <TabsList className="w-fit shrink-0 border border-border bg-surface-1">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="cliente">Cliente</TabsTrigger>
            <TabsTrigger value="linhas">Linhas</TabsTrigger>
            <TabsTrigger value="nota">Nota do Pedido</TabsTrigger>
            {podeVerAssinaturaNotas && (
              <TabsTrigger value="assinatura-notas">Assinatura Notas</TabsTrigger>
            )}
            <TabsTrigger value="documentos" className="gap-1.5">
              <FileText className="size-3.5" />
              Documentos do Pedido
            </TabsTrigger>
          </TabsList>

          <TabsList className="w-fit shrink-0 border border-border bg-surface-1 sm:ml-auto">
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            {(isBKO || isAdmin) && (
              <TabsTrigger value="robo" className="gap-1.5">
                <Bot className="size-3.5" />
                Log dos Robôs
                {roboLogs.length > 0 && (
                  <span className="ml-0.5 rounded-full bg-purple/15 px-1.5 py-0.5 text-[9px] font-bold text-purple">
                    {roboLogs.length}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Resumo compacto do pedido */}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="flex min-h-12 items-center gap-3 rounded-lg border border-border bg-card/55 px-3 py-2">
            <Building2 className="size-4 text-purple" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Consultor</span>
            <span className="ml-auto max-w-[55%] truncate text-sm font-semibold" title={consultor?.nome}>
              {uppercaseDisplay(consultor?.nome)}
            </span>
          </div>

          <div className="flex min-h-12 items-center gap-3 rounded-lg border border-border bg-card/55 px-3 py-2">
            <Hash className="size-4 text-info" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Linhas</span>
            <span className="ml-auto text-sm font-bold">{String(venda?.quantidadeLinhas ?? 0)}</span>
          </div>

          <div className="flex min-h-12 items-center gap-3 rounded-lg border border-border bg-card/55 px-3 py-2">
            <Banknote className="size-4 text-success" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor da venda</span>
            <span className="ml-auto text-sm font-bold">{brl(venda?.receita ?? 0)}</span>
          </div>
        </div>

        <TabsContent value="resumo" className="mt-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:items-start">
            <div className="xl:col-span-2">
              <StatusComercialPedido
                vendaId={venda?.id || ""}
                operadora={(venda?.operadora ?? "CLARO") as "CLARO" | "VIVO"}
                canEdit={isAdmin || isBKO}
                onChanged={reloadFromDb}
              />
            </div>
            <Block title="Datas do Sistema" className="omni-venda-datas-card">
              <DatasBlock venda={venda} canEdit={podeEditarDatas} updateVenda={updateVenda} user={user} profile={profile} roles={roles} reloadFromDb={reloadFromDb} />
            </Block>
          </div>
          <div className="mt-4">
            <ObservacoesPedido vendaId={venda?.id || ""} />
          </div>
        </TabsContent>

        <TabsContent value="cliente" className="mt-3">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-1/35 px-3 py-2">
              <div className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-background/50">
                <Building2 className="size-4 text-omni" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-display font-bold" title={uppercaseDisplay(cliente.razaoSocial)}>
                  {uppercaseDisplay(cliente.razaoSocial)}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {cliente.cnpj && <CopyCnpj value={cliente.cnpj} className="border-0 bg-transparent px-0 py-0 text-[10px] shadow-none hover:bg-transparent" />}
                  {cliente.operadoras.map((op: string) => (
                    <Badge key={op} variant="outline" className={cn(
                      "h-4 px-1.5 py-0 text-[8px] uppercase tracking-wider",
                      op === "CLARO" ? "border-[var(--claro)]/40 text-[var(--claro)]" : "border-[var(--vivo)]/40 text-[var(--vivo)]"
                    )}>
                      {op}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 p-3 lg:grid-cols-2">
              <section className="rounded-lg border border-border/75 bg-background/25 p-2.5">
                <div className="mb-2 flex items-center gap-2">
                  <Building2 className="size-3.5 text-omni" />
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Empresa</h3>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  <ClienteInfoField
                    label="Razão Social"
                    value={cliente.razaoSocial}
                    canEdit={podeEditarCliente}
                    className="sm:col-span-2"
                    onSave={(value) => editarCampoCliente("razao_social", "Razão Social", cliente.razaoSocial, value)}
                  />
                  <ClienteInfoField
                    label="CNPJ/CPF"
                    value={cliente.cnpj}
                    display={cliente.cnpj ? <CopyCnpj value={cliente.cnpj} className="border-0 bg-transparent px-0 py-0 shadow-none hover:bg-transparent" /> : "—"}
                    canEdit={podeEditarCliente}
                    onSave={(value) => editarCampoCliente("cnpj_cpf", "CNPJ/CPF", cliente.cnpj, value)}
                  />
                  <ClienteInfoField
                    label="UF"
                    value={cliente.uf}
                    canEdit={podeEditarCliente}
                    onSave={(value) => editarCampoCliente("uf", "UF", cliente.uf, value)}
                  />
                  <ClienteInfoField
                    label="DDD"
                    value={cliente.ddd || "—"}
                    canEdit={podeEditarCliente}
                    onSave={(value) => editarCampoCliente("ddd", "DDD", cliente.ddd || "", value)}
                  />
                  <ClienteInfoField
                    label="ENDEREÇO"
                    value={cliente.endereco}
                    canEdit={podeEditarCliente}
                    className="sm:col-span-2"
                    onSave={(value) => editarCampoCliente("endereco", "Endereço", cliente.endereco, value)}
                  />
                  {comissoesVisible && (
                    <ClienteInfoField
                      label="Receita mensal"
                      value={brl(cliente.receitaMensal)}
                      canEdit={false}
                    />
                  )}
                  <ClienteInfoField
                    label="Observação do Cliente"
                    value={cliente.observacao}
                    canEdit={podeEditarCliente}
                    multiline
                    className="sm:col-span-2"
                    onSave={(value) => editarCampoCliente("observacao", "Observação do Cliente", cliente.observacao, value)}
                  />
                </div>
              </section>

              <section className="rounded-lg border border-border/75 bg-background/25 p-2.5">
                <div className="mb-2 flex items-center gap-2">
                  <Users className="size-3.5 text-info" />
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Contato</h3>
                </div>
                <div className="grid gap-1.5">
                  <ClienteInfoField
                    label="Nome"
                    value={cliente.contato}
                    canEdit={podeEditarCliente}
                    onSave={(value) => editarCampoCliente("contato", "Contato", cliente.contato, value)}
                  />
                  <ClienteInfoField
                    label="Telefone"
                    value={cliente.telefone}
                    canEdit={podeEditarCliente}
                    onSave={(value) => editarCampoCliente("telefone", "Telefone", cliente.telefone, value)}
                  />
                  <ClienteInfoField
                    label="E-mail"
                    value={cliente.email}
                    canEdit={podeEditarCliente}
                    onSave={(value) => editarCampoCliente("email", "E-mail", cliente.email, value)}
                  />
                </div>
              </section>
            </div>

            {clienteReal?.id && (
              <div className="border-t border-border bg-surface-1/15 px-3 py-3">
                <ClienteRepresentantes
                  clienteId={clienteReal.id}
                  canManage={podeGerenciarRepresentantes}
                  compact
                  onChanged={fetchCliente}
                />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="linhas" className="mt-4">
          {venda?.id && clienteReal?.id && (
            <div className="mb-4">
              <CedentePedidoCard
                vendaId={venda.id}
                clienteId={clienteReal.id}
                tipoPedido={venda.tipoPedidos?.length ? venda.tipoPedidos : venda.tipoPedido}
                canManage={podeGerenciarCedentes}
                onChanged={reloadFromDb}
              />
            </div>
          )}

          <LinhasTab
            vendaId={venda?.id || ""}
            clienteId={clienteReal?.id || ""}
            operadora={venda?.operadora || ""}
            dddPadrao={cliente.ddd}
            receitaVenda={venda?.receita ?? 0}
            qtdVenda={venda?.quantidadeLinhas ?? 0}
            podeEditar={podeEditarInformacoesVenda}
            podeEditarLinhas={podeEditarLinhas}
            podeGerenciarCatalogos={isAdmin || isBKO}
            podeGerenciarPlanos={isAdmin || isBKO || isGestor}
            userId={user?.id ?? null}
            reloadVenda={reloadFromDb}
            comissoesVisible={comissoesVisible}
          />
        </TabsContent>


        <TabsContent value="nota" className="mt-4">
          <NotaPedidoTab
            venda={venda}
            cliente={cliente}
            consultorNome={consultor?.nome}
            etapaNome={etapa?.nome ?? ""}
            podeEditar={podeEditar}
            onPdf={baixarPDF}
            onPreviewPdf={() => void preverPDF()}
            updateVenda={updateVenda}
            userId={user?.id ?? null}
            userNome={profile?.nome_completo ?? user?.email ?? null}
            historicoDatas={historicoDb.filter(h => (h.campo ?? "").startsWith("data_"))}
            comissoesVisible={comissoesVisible}
          />
        </TabsContent>

        {podeVerAssinaturaNotas && venda?.id && (
          <TabsContent value="assinatura-notas" className="mt-4">
            <AssinaturaNotasChat vendaId={venda.id} readOnly={concluida} />
          </TabsContent>
        )}

        <TabsContent value="documentos" className="mt-4">
          <DocumentosPedido vendaId={venda?.id || ""} />
        </TabsContent>

        <TabsContent value="historico" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <History className="size-4 text-omni" />
                <h3 className="font-display font-semibold">Linha do Tempo Unificada</h3>
              </div>
              <div className="text-[9px] text-muted-foreground">
                Pipeline · Status Comercial · Observações · Notas · Documentos · Erros · Suporte
              </div>
            </div>

            <div className="relative space-y-3 pl-6">
              <div className="absolute bottom-2 left-2 top-2 w-px bg-border" />
              {historicoUnificado.map(item => {
                const tone = historicoTone(item.origem);
                const data = new Date(item.created_at);
                return (
                  <div key={item.id} className="relative rounded-lg border border-border/60 bg-surface-1/20 px-3 py-2.5">
                    <span
                      className={cn(
                        "absolute -left-[18px] top-3 size-2.5 rounded-full ring-4 ring-card",
                        `bg-[var(--${tone})]`,
                      )}
                    />
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Badge
                        variant="outline"
                        className="h-5 px-1.5 text-[8px] font-bold uppercase tracking-[0.08em]"
                      >
                        {item.origem}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {Number.isNaN(data.getTime()) ? item.created_at : data.toLocaleString("pt-BR")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        · {item.autor || "Sistema"}
                      </span>
                    </div>

                    <div className="mt-1.5 whitespace-pre-wrap break-words text-xs font-medium text-foreground">
                      {item.descricao}
                    </div>

                    {(item.valor_anterior != null || item.valor_novo != null) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                        <span className="max-w-full break-words rounded border border-border bg-background/50 px-1.5 py-0.5 text-muted-foreground">
                          {item.valor_anterior || "—"}
                        </span>
                        <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                        <span className="max-w-full break-words rounded border border-border bg-background/70 px-1.5 py-0.5 font-semibold text-foreground">
                          {item.valor_novo || "—"}
                        </span>
                      </div>
                    )}

                    {item.detalhe && (
                      <div className="mt-1.5 whitespace-pre-wrap break-words text-[10px] leading-relaxed text-muted-foreground">
                        {item.detalhe}
                      </div>
                    )}
                  </div>
                );
              })}

              {historicoUnificado.length === 0 && historicoLegacy.length === 0 && (
                <div className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs italic text-muted-foreground">
                  Nenhum evento registrado ainda.
                </div>
              )}

              {historicoUnificado.length === 0 && historicoLegacy.map(h => (
                <div key={h.id} className="relative rounded-lg border border-border/60 bg-surface-1/20 px-3 py-2.5">
                  <span className="absolute -left-[18px] top-3 size-2.5 rounded-full bg-[var(--omni)] ring-4 ring-card" />
                  <div className="font-mono text-[10px] text-muted-foreground">{h.data} · {h.autor}</div>
                  <div className="mt-1 text-xs">{h.descricao}</div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {(isBKO || isAdmin) && (
          <TabsContent value="robo" className="mt-4 space-y-4">
          <div className="rounded-xl border border-purple/25 bg-card overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-border bg-gradient-to-r from-purple/10 via-card to-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-purple/25 bg-purple/10">
                  <Bot className="size-5 text-purple" />
                </div>
                <div>
                  <h3 className="font-display font-semibold">Log dos Robôs</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Registro automático das ações executadas pelo robô e pelas automações do sistema neste pedido.
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="w-fit border-purple/30 bg-purple/5 text-purple">
                {roboLogs.length} {roboLogs.length === 1 ? "evento" : "eventos"}
              </Badge>
            </div>

            {roboLogs.length > 0 ? (
              <div className="divide-y divide-border">
                {roboLogs.map((log) => {
                  const quando = new Date(log.created_at);
                  const statusRobo = log?.detalhes?.status_robo;
                  const legado = log.origem === "registro_legado";
                  const statusLegenda = log.campo === "status_pedido"
                    ? legendaRoboPorStatus.get(String(log.valor_novo ?? "").trim())
                    : null;
                  const descricaoExibida = statusLegenda || log.descricao;
                  return (
                    <div key={log.id} className="group px-5 py-4 transition-colors hover:bg-purple/[0.035]">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 gap-3">
                          <div className={cn(
                            "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border",
                            legado
                              ? "border-warning/30 bg-warning/10 text-warning"
                              : "border-purple/30 bg-purple/10 text-purple",
                          )}>
                            <Bot className="size-4" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold">{log.robo_nome || "Robô OMNI"}</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "h-5 px-1.5 text-[9px] uppercase tracking-wider",
                                  legado
                                    ? "border-warning/30 text-warning"
                                    : "border-purple/30 text-purple",
                                )}
                              >
                                {legado ? "registro legado" : "automação"}
                              </Badge>
                              {log.campo_label && (
                                <Badge variant="outline" className="h-5 border-border bg-surface-1 px-1.5 text-[9px]">
                                  {log.campo_label}
                                </Badge>
                              )}
                            </div>

                            <div className="mt-1 text-sm text-foreground/90">{descricaoExibida}</div>

                            {(log.valor_anterior != null || log.valor_novo != null) && !legado && (
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-mono">
                                <span className="rounded-md border border-border bg-surface-2 px-2 py-1 text-muted-foreground">
                                  {formatRobotValue(log.campo, log.valor_anterior)}
                                </span>
                                <ChevronRight className="size-3.5 text-purple" />
                                <span className="rounded-md border border-purple/25 bg-purple/5 px-2 py-1 font-semibold text-foreground">
                                  {formatRobotValue(log.campo, log.valor_novo)}
                                </span>
                              </div>
                            )}

                            {statusRobo && (
                              <div className="mt-2 text-[11px] text-muted-foreground">
                                Status informado pelo robô: <span className="font-medium text-foreground/80">{statusRobo}</span>
                              </div>
                            )}

                            {log.observacao_bko && (
                              <div className="mt-2 rounded-lg border border-purple/20 bg-purple/[0.035] px-3 py-2 text-xs">
                                <div className="font-medium text-foreground/90">{log.observacao_bko}</div>
                                {log.observacao_bko_em && (
                                  <div className="mt-1 text-[10px] text-muted-foreground">
                                    {log.observacao_bko_user_nome || "Usuário"} · {log.observacao_bko_user_role === "admin" ? "Administrador" : "BKO"} · {new Date(log.observacao_bko_em).toLocaleString("pt-BR")}
                                  </div>
                                )}
                              </div>
                            )}

                            {legado && log?.detalhes?.snapshot_pos_execucao && (
                              <div className="mt-3 rounded-lg border border-warning/20 bg-warning/[0.035] p-3">
                                <div className="flex items-center gap-2 text-[11px] font-semibold text-warning">
                                  <History className="size-3.5" />
                                  Estado recuperado após a execução
                                </div>
                                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                  {Object.entries(log.detalhes.snapshot_pos_execucao as Record<string, unknown>).map(([label, value]) => (
                                    <div key={label} className="rounded-md border border-border/70 bg-surface-1 px-2.5 py-2">
                                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
                                      <div className="mt-0.5 text-xs font-medium text-foreground">{String(value)}</div>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-2 text-[10px] leading-4 text-muted-foreground">
                                  {log?.detalhes?.observacao_reconstrucao}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 text-left lg:text-right">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground lg:justify-end">
                            <Clock className="size-3.5" />
                            {quando.toLocaleDateString("pt-BR")}
                          </div>
                          <div className="mt-0.5 text-[11px] font-mono text-muted-foreground">
                            {quando.toLocaleTimeString("pt-BR")}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-10 text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-dashed border-border bg-surface-1">
                  <Bot className="size-5 text-muted-foreground" />
                </div>
                <div className="mt-3 text-sm font-medium">Nenhuma atuação do robô registrada</div>
                <div className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                  Quando uma automação alterar datas, status ou outros campos operacionais deste pedido, o evento aparecerá aqui automaticamente.
                </div>
              </div>
            )}
          </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Modal Suporte */}
      <Dialog open={suporteOpen} onOpenChange={setSuporteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LifeBuoy className="size-4 text-[var(--omni)]" /> Enviar para Suporte
            </DialogTitle>
            <DialogDescription>
              O pedido <span className="font-mono">{venda?.numero}</span> permanecerá no funil e na etapa atuais.
              Somente a solicitação será enviada ao BKO e ficará registrada no histórico da venda.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Prioridade do atendimento</Label>
              <SupportPriorityPicker
                value={suportePrioridade}
                onChange={setSuportePrioridade}
                disabled={suporteSaving}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Motivo / descrição</Label>
              <Textarea
                rows={4}
                value={suporteMotivo}
                onChange={e => setSuporteMotivo(e.target.value)}
                placeholder="Descreva o que precisa ser tratado pelo Suporte"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuporteOpen(false)} disabled={suporteSaving}>
              Cancelar
            </Button>
            <Button
              className="bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)] font-semibold"
              onClick={confirmarSuporte}
              disabled={suporteSaving}
            >
              {suporteSaving ? "Enviando…" : "Enviar para Suporte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação Virar/Assinar */}
      {/* Modal Editar Venda — isolada para evitar re-render da página inteira */}
      {editOpen && (
        <PedidoEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          id={id}
          clienteIdSearch={clienteIdSearch}
          venda={venda}
          clienteReal={clienteReal}
          isAdmin={isAdmin}
          isBKO={isBKO}
          isGestor={isGestor}
          isConsultor={isConsultor}
          editSaving={editSaving}
          onSave={salvarEdicao}
          onChanged={reloadFromDb}
        />
      )}

      <AlertDialog open={confirmAcao !== null} onOpenChange={(o: boolean) => { if (!o) setConfirmAcao(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAcao === "virar" ? "Virar Venda?" : "Enviar para Assinatura?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAcao === "virar"
                ? `O pedido ${venda?.numero} será movido para o próximo funil comercial ativo. Esta ação ficará registrada no histórico.`
                : `O pedido ${venda?.numero} será movido para a primeira etapa ativa do funil Assinatura. Esta ação ficará registrada no histórico.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const acao = confirmAcao;
                setConfirmAcao(null);
                if (acao === "virar") await virarVenda();
                else if (acao === "assinar") await enviarAssinatura();
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function PedidoEditDialog({
  open,
  onOpenChange,
  id,
  clienteIdSearch,
  venda,
  clienteReal,
  isAdmin,
  isBKO,
  isGestor,
  isConsultor,
  editSaving,
  onSave,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
  clienteIdSearch?: string;
  venda: any;
  clienteReal: any;
  isAdmin: boolean;
  isBKO: boolean;
  isGestor: boolean;
  isConsultor: boolean;
  editSaving: boolean;
  onSave: (form: Record<string, any>, consultoresReais: any[]) => void | Promise<void>;
  onChanged: () => void | Promise<void>;
}) {
  // Admin/BKO/Gestor/Consultor possuem a aba Dados do Pedido.
  // Consultor continua limitado às vendas que já consegue acessar/editar pelas RLS.
  const canEditPedido = isAdmin || isBKO || isGestor || isConsultor;
  const canManageRepresentantes = canEditPedido;
  const gestorRestrito = (isGestor || isConsultor) && !isAdmin && !isBKO;
  const [editTab, setEditTab] = useState<"dados" | "representantes" | "cedentes">(
    canEditPedido ? "dados" : "cedentes",
  );
  const [form, setForm] = useState<Record<string, any>>({});

  const operadoraPadrao = venda?.operadora ?? "CLARO";

  // Estes catálogos só passam a existir enquanto a modal está aberta.
  // Como este componente é montado somente durante a edição, a página principal
  // deixa de carregar dados exclusivos do editor antes de eles serem necessários.
  const { data: statusCat } = useCatalogo("status_catalogo", operadoraPadrao);
  const { data: tiposPedidoCat } = useCatalogo("tipos_pedido_catalogo", operadoraPadrao);
  const { data: produtosPedidoCat } = useCatalogo("produtos_catalogo", operadoraPadrao);
  const { data: consultoresReais } = useConsultoresReais();
  const { data: clientesDisponiveis } = useClientesDB();
  const [empresaPickerOpen, setEmpresaPickerOpen] = useState(false);
  const [empresaBusca, setEmpresaBusca] = useState("");
  const empresasFiltradas = useMemo(() => {
    const termo = empresaBusca.trim().toLocaleLowerCase("pt-BR");
    const lista = termo
      ? clientesDisponiveis.filter(cliente =>
          String(cliente.razao_social ?? "").toLocaleLowerCase("pt-BR").includes(termo)
          || String(cliente.cnpj_cpf ?? "").replace(/\D/g, "").includes(termo.replace(/\D/g, ""))
        )
      : clientesDisponiveis;
    return lista.slice(0, 200);
  }, [clientesDisponiveis, empresaBusca]);
  const empresaSelecionada = useMemo(
    () => clientesDisponiveis.find(cliente => cliente.id === form.clienteId) ?? null,
    [clientesDisponiveis, form.clienteId],
  );
  const statusCatUnicos = useMemo(() => {
    const unicos = new Map<string, (typeof statusCat)[number]>();
    for (const item of statusCat) {
      const key = normalizedDisplayKey(item.nome);
      if (key && !unicos.has(key)) unicos.set(key, item);
    }
    return Array.from(unicos.values());
  }, [statusCat]);

  useEffect(() => {
    if (!open) return;

    const dateValue = (value: unknown) => {
      if (!value) return "";
      const raw = String(value);
      return raw.length >= 10 ? raw.slice(0, 10) : raw;
    };

    const slaAtual = String(venda?.slaStatus ?? "ok").toLowerCase();
    const slaNormalizado = ["ok", "alerta", "atrasado"].includes(slaAtual) ? slaAtual : "ok";

    setEditTab(canEditPedido ? "dados" : "cedentes");
    setEmpresaBusca("");
    setForm({
      clienteId: id === "nova" ? clienteIdSearch : venda?.clienteId,
      valor: venda?.receita ?? 0,
      quantidade_linhas: venda?.quantidadeLinhas ?? 0,
      status: venda?.status || "",
      tipo_pedidos: venda?.tipoPedidos?.length ? venda.tipoPedidos : (venda?.tipoPedido ? [venda.tipoPedido] : []),
      produtos: venda?.produtos?.length ? venda.produtos : (venda?.produto ? [venda.produto] : []),
      consultor_id: venda?.consultorId && venda.consultorId !== "imported" ? venda.consultorId : null,
      bko_colab_id: venda?.bkoColabId || null,
      sla_status: slaNormalizado,
      data_recebimento: dateValue(venda?.dataRecebimento) || new Date().toISOString().slice(0, 10),
      data_preenchimento: dateValue(venda?.dataPreenchimento),
      data_envio: dateValue(venda?.dataEnvio),
      data_aceite: dateValue(venda?.dataAceite),
      data_input: dateValue(venda?.dataInput),
      data_ativacao: dateValue(venda?.dataAtivacao),
      data_portabilidade: dateValue(venda?.dataPortabilidade),
      data_entrega: dateValue(venda?.dataEntrega),
      proxima_acao: venda?.proximaAcao ?? "",
      proxima_acao_data: dateValue(venda?.proximaAcaoData),
      observacao: venda?.observacao ?? "",
      cliente_contato: venda?.clienteContato ?? "",
      cliente_telefone: venda?.clienteTelefone ?? "",
      cliente_email: venda?.clienteEmail ?? "",
      cliente_uf: venda?.clienteUf ?? "",
      status_portabilidade: venda?.statusPortabilidade ?? "",
      status_biometria: venda?.statusBiometria ?? "",
      nota_fiscal: venda?.notaFiscal ?? "",
      cod_rastreio: venda?.codRastreio ?? "",
      equipamentos: venda?.equipamentos ?? "",
    });
  }, [open, id, clienteIdSearch, canEditPedido]);

  // Para pedido novo, os dados do cliente são buscados apenas com o editor aberto.
  useEffect(() => {
    if (!open || id !== "nova" || !clienteIdSearch) return;

    let ativo = true;
    void (async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, razao_social, cnpj_cpf, uf, contato, telefone, email, operadoras")
        .eq("id", clienteIdSearch)
        .maybeSingle();

      if (!ativo || !data) return;
      setForm(prev => ({
        ...prev,
        clienteId: clienteIdSearch,
        clienteRazaoSocial: data.razao_social,
        clienteCnpj: data.cnpj_cpf,
        clienteUf: data.uf,
        clienteContato: data.contato || "",
        clienteTelefone: data.telefone || "",
        clienteEmail: data.email || "",
        operadora: data.operadoras?.[0] || "CLARO",
      }));
    })();

    return () => {
      ativo = false;
    };
  }, [open, id, clienteIdSearch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="omni-pedido-info-dialog sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4 text-[var(--omni)]" /> {id === "nova" ? "Novo Pedido" : "Editar pedido " + (venda?.numero ?? "")}
          </DialogTitle>
          <DialogDescription>
            Revise os dados e clique em Salvar alterações. As mudanças ficam registradas no histórico.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={editTab} onValueChange={value => setEditTab(value as "dados" | "representantes" | "cedentes")}>
          <TabsList className={cn("mb-4 grid w-full", canEditPedido ? "grid-cols-3" : "grid-cols-2")}>
            {canEditPedido && <TabsTrigger value="dados">Dados do pedido</TabsTrigger>}
            <TabsTrigger value="representantes">Representantes</TabsTrigger>
            <TabsTrigger value="cedentes">Cedentes / Cessionários</TabsTrigger>
          </TabsList>

          <TabsContent value="representantes" className="mt-0">
            {clienteReal?.id ? (
              <ClienteRepresentantes
                clienteId={clienteReal.id}
                canManage={canManageRepresentantes}
                onChanged={onChanged}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                Cliente indisponível para gerenciar representantes.
              </div>
            )}
          </TabsContent>

          <TabsContent value="cedentes" className="mt-0">
            {venda?.id && clienteReal?.id ? (
              <CedentesPedidoManager
                vendaId={venda.id}
                clienteId={clienteReal.id}
                tipoPedido={venda.tipoPedidos?.length ? venda.tipoPedidos : venda.tipoPedido}
                onChanged={onChanged}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                Pedido ou cliente indisponível para gerenciar Cedentes/Cessionários.
              </div>
            )}
          </TabsContent>

          {canEditPedido && (
            <>
              <TabsContent value="dados" className="mt-0 space-y-5">
                <Secao titulo="Comercial">
                  {id !== "nova" && (
                    <>
                      {(isAdmin || isBKO) && (
                        <Campo label="Consultor responsável">
                          <Select
                            value={form.consultor_id ?? "_none"}
                            onValueChange={v => setForm(f => ({ ...f, consultor_id: v === "_none" ? null : v }))}
                          >
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">— Sem consultor —</SelectItem>
                              {consultoresReais.map(c => (
                                <SelectItem key={c.id} value={c.id}>
                                  {uppercaseDisplay(c.nome_completo)}{c.email ? " · " + c.email : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Campo>
                      )}

                      <div className="col-span-full grid gap-4 lg:grid-cols-2">
                        <Campo label="Tipos de pedido">
                          <CatalogoMultiCheckbox
                            items={tiposPedidoCat}
                            value={Array.isArray(form.tipo_pedidos) ? form.tipo_pedidos : []}
                            onChange={value => setForm(f => ({ ...f, tipo_pedidos: value }))}
                            emptyLabel="Nenhum Tipo de Pedido selecionado."
                          />
                        </Campo>

                        <Campo label="Produtos">
                          <CatalogoMultiCheckbox
                            items={produtosPedidoCat}
                            value={Array.isArray(form.produtos) ? form.produtos : []}
                            onChange={value => setForm(f => ({ ...f, produtos: value }))}
                            emptyLabel="Nenhum Produto selecionado."
                          />
                        </Campo>
                      </div>

                      <Campo label="Operadora">
                        <div className="flex h-10 items-center justify-between rounded-md border border-border bg-surface-1 px-3 text-sm">
                          <span className="font-semibold">{venda?.operadora}</span>
                          <span className="text-[10px] text-muted-foreground">Use “Trocar operadora” para alterar</span>
                        </div>
                      </Campo>
                    </>
                  )}

                  <Campo label="Receita (R$)">
                    <Input type="number" step="0.01" value={form.valor ?? 0}
                      onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
                  </Campo>
                  <Campo label="Qtd. linhas">
                    <Input type="number" value={form.quantidade_linhas ?? 0}
                      onChange={e => setForm(f => ({ ...f, quantidade_linhas: e.target.value }))} />
                  </Campo>
                  {!gestorRestrito && (
                    <Campo label="Status">
                      <Select value={form.status ?? ""} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {statusCatUnicos.map(t => <SelectItem key={t.id} value={t.nome}>{uppercaseDisplay(t.nome)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Campo>
                  )}
                </Secao>

                <Secao titulo="Cliente">
                  <div className="col-span-full">
                    <Campo label="Empresa do pedido">
                      <Popover open={empresaPickerOpen} onOpenChange={setEmpresaPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-between bg-surface-1 font-normal"
                          >
                            <span className="min-w-0 truncate text-left">
                              {empresaSelecionada
                                ? `${uppercaseDisplay(empresaSelecionada.razao_social)} · ${maskCpfCnpj(empresaSelecionada.cnpj_cpf ?? "")}`
                                : "Selecione a empresa"}
                            </span>
                            <ChevronDown className="ml-2 size-3.5 shrink-0 text-muted-foreground" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-[min(560px,85vw)] p-2">
                          <Input
                            value={empresaBusca}
                            onChange={event => setEmpresaBusca(event.target.value)}
                            placeholder="Buscar por razão social ou CNPJ/CPF..."
                            className="mb-2 h-8 text-xs"
                          />
                          <div className="max-h-72 overflow-y-auto">
                            {empresasFiltradas.length === 0 ? (
                              <div className="px-2 py-4 text-xs text-muted-foreground">
                                Nenhuma empresa encontrada.
                              </div>
                            ) : (
                              empresasFiltradas.map(cliente => {
                                const selecionada = cliente.id === form.clienteId;
                                return (
                                  <button
                                    key={cliente.id}
                                    type="button"
                                    onClick={() => {
                                      setForm(atual => ({
                                        ...atual,
                                        clienteId: cliente.id,
                                        cliente_razao_social: cliente.razao_social,
                                        cliente_cnpj: cliente.cnpj_cpf,
                                        cliente_contato: cliente.contato ?? "",
                                        cliente_telefone: cliente.telefone ?? "",
                                        cliente_email: cliente.email ?? "",
                                        cliente_uf: cliente.uf ?? "",
                                        ddd: cliente.ddd ?? "",
                                      }));
                                      setEmpresaPickerOpen(false);
                                      setEmpresaBusca("");
                                    }}
                                    className={cn(
                                      "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-muted",
                                      selecionada && "bg-muted/70",
                                    )}
                                  >
                                    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded border border-border">
                                      {selecionada && <CheckCircle2 className="size-3 text-omni" />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-xs font-semibold">
                                        {uppercaseDisplay(cliente.razao_social)}
                                      </span>
                                      <span className="block font-mono text-[10px] text-muted-foreground">
                                        {maskCpfCnpj(cliente.cnpj_cpf ?? "")}
                                      </span>
                                    </span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                          {clientesDisponiveis.length > 200 && !empresaBusca.trim() && (
                            <div className="mt-2 border-t border-border pt-2 text-[9px] text-muted-foreground">
                              Digite para pesquisar entre todas as empresas.
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    </Campo>
                  </div>
                  <Campo label="Contato"><Input value={form.cliente_contato ?? ""} onChange={e => setForm(f => ({ ...f, cliente_contato: e.target.value }))} /></Campo>
                  <Campo label="Telefone"><Input value={form.cliente_telefone ?? ""} onChange={e => setForm(f => ({ ...f, cliente_telefone: e.target.value }))} /></Campo>
                  <Campo label="E-mail"><Input value={form.cliente_email ?? ""} onChange={e => setForm(f => ({ ...f, cliente_email: e.target.value }))} /></Campo>
                  <Campo label="UF"><Input value={form.cliente_uf ?? ""} onChange={e => setForm(f => ({ ...f, cliente_uf: e.target.value }))} /></Campo>
                </Secao>
              </TabsContent>

            </>
          )}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={editSaving}>
            {canEditPedido ? "Cancelar" : "Fechar"}
          </Button>
          {canEditPedido && editTab !== "cedentes" && editTab !== "representantes" && (
            <Button
              className="bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)] font-semibold gap-2"
              onClick={() => void onSave(form, consultoresReais)}
              disabled={editSaving}
            >
              <Save className="size-3.5" /> {editSaving ? "Salvando…" : "Salvar alterações"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MiniKpi({ label, value, sublabel, icon, tone }: {
  label: string; value: string; sublabel?: string; icon: React.ReactNode; tone: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn("size-7 rounded-lg grid place-items-center", `bg-[var(--${tone})]/15 text-[var(--${tone})]`)}>
          {icon}
        </div>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className="font-display text-lg font-bold leading-tight">{value}</div>
      {sublabel && <div className="text-[10px] text-muted-foreground truncate">{sublabel}</div>}
    </div>
  );
}

function Block({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <h3 className="font-display font-semibold mb-3 text-sm">{title}</h3>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}

type BiometriaStatus = "" | "pendente" | "concluido" | "cancelado";
const BIO_OPTS: { value: BiometriaStatus; label: string; tone: string }[] = [
  { value: "", label: "Sem informação", tone: "bg-muted text-muted-foreground border-border" },
  { value: "pendente", label: "Biometria pendente", tone: "bg-warning/15 text-warning border-warning/40" },
  { value: "concluido", label: "Biometria concluída", tone: "bg-success/15 text-success border-success/40" },
  { value: "cancelado", label: "Biometria cancelada", tone: "bg-destructive/15 text-destructive border-destructive/40" },
];
export function bioLabel(s?: string | null) {
  return BIO_OPTS.find(o => o.value === (s ?? ""))?.label ?? "Sem informação";
}
export function bioTone(s?: string | null) {
  return BIO_OPTS.find(o => o.value === (s ?? ""))?.tone ?? BIO_OPTS[0].tone;
}

function BiometriaBlock({ status, canEdit, onChange }: {
  status: BiometriaStatus; canEdit: boolean; onChange: (s: BiometriaStatus) => Promise<void> | void;
}) {
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const current = BIO_OPTS.find(o => o.value === status) ?? BIO_OPTS[0];

  const vis = {
    "": {
      ringFrom: "#3a3a45", ringTo: "#1a1a22", glow: "transparent",
      iconClass: "text-muted-foreground/60", text: "Sem informação",
      bg: "from-slate-900/40 to-slate-950/60",
    },
    pendente: {
      ringFrom: "#facc15", ringTo: "#f97316", glow: "hsl(var(--warning))",
      iconClass: "text-warning drop-shadow-[0_0_10px_hsl(var(--warning))]",
      text: "Biometria pendente",
      bg: "from-amber-500/10 to-orange-600/5",
    },
    concluido: {
      ringFrom: "#22c55e", ringTo: "#16a34a", glow: "hsl(var(--success))",
      iconClass: "text-success drop-shadow-[0_0_12px_hsl(var(--success))]",
      text: "Biometria concluída",
      bg: "from-emerald-500/10 to-green-700/5",
    },
    cancelado: {
      ringFrom: "#ef4444", ringTo: "#7f1d1d", glow: "hsl(var(--destructive))",
      iconClass: "text-destructive drop-shadow-[0_0_10px_hsl(var(--destructive))]",
      text: "Biometria cancelada",
      bg: "from-red-600/10 to-red-900/5",
    },
  }[status || ""] as any;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border bg-card p-4 transition-shadow",
      status === "concluido" && "border-success/30 shadow-[0_0_24px_-10px_hsl(var(--success)/0.6)]",
      status === "pendente" && "border-warning/30 shadow-[0_0_24px_-10px_hsl(var(--warning)/0.6)]",
      status === "cancelado" && "border-destructive/30 shadow-[0_0_24px_-10px_hsl(var(--destructive)/0.6)]",
      !status && "border-border",
    )}>
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none", vis.bg)} />
      <div className="relative flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold text-sm flex items-center gap-2">
          <Fingerprint className="size-4 text-omni" /> Biometria
        </h3>
        <span className={cn("text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border", current.tone)}>
          {current.label}
        </span>
      </div>

      <div className="relative flex flex-col items-center gap-4 py-4">
        <Popover open={open} onOpenChange={(v) => canEdit && setOpen(v)}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={!canEdit || saving}
              className={cn(
                "group relative size-28 rounded-full grid place-items-center transition-transform",
                canEdit && "hover:scale-105 active:scale-95 cursor-pointer",
                !canEdit && "cursor-not-allowed",
              )}
              style={{
                background: `radial-gradient(circle at 30% 25%, ${vis.ringFrom}, ${vis.ringTo} 70%)`,
                boxShadow: status
                  ? `0 0 40px -8px ${vis.glow}, inset 0 2px 8px rgba(255,255,255,0.25), inset 0 -8px 16px rgba(0,0,0,0.4)`
                  : "inset 0 2px 8px rgba(255,255,255,0.08), inset 0 -8px 16px rgba(0,0,0,0.6)",
              }}
              title={canEdit ? "Clique para alterar a biometria" : "Sem permissão"}
            >
              {/* anel pulsante */}
              {status === "pendente" && (
                <span className="absolute inset-0 rounded-full ring-2 ring-warning/60 animate-pulse" />
              )}
              {status === "concluido" && (
                <span className="absolute -bottom-1 -right-1 size-7 rounded-full bg-success grid place-items-center shadow-[0_0_12px_hsl(var(--success))] ring-2 ring-background">
                  <CheckCircle2 className="size-4 text-white" />
                </span>
              )}
              {status === "cancelado" && (
                <span className="absolute -bottom-1 -right-1 size-7 rounded-full bg-destructive grid place-items-center shadow-[0_0_12px_hsl(var(--destructive))] ring-2 ring-background">
                  <XCircle className="size-4 text-white" />
                </span>
              )}
              <Fingerprint className={cn("size-14 transition-all", vis.iconClass)} strokeWidth={1.5} />
              {/* reflexo */}
              <span className="absolute top-2 left-4 size-8 rounded-full bg-white/20 blur-md" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-1" align="center">
            {BIO_OPTS.map(opt => {
              const active = opt.value === status;
              return (
                <button
                  key={opt.value || "vazio"}
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    if (active) { setOpen(false); return; }
                    setSaving(true);
                    try { await onChange(opt.value); setOpen(false); }
                    finally { setSaving(false); }
                  }}
                  className={cn(
                    "w-full text-left text-xs px-2.5 py-2 rounded-md flex items-center gap-2 transition-colors",
                    active ? cn(opt.tone, "font-semibold") : "hover:bg-muted",
                  )}
                >
                  <span className={cn(
                    "size-2 rounded-full",
                    opt.value === "" && "bg-muted-foreground/50",
                    opt.value === "pendente" && "bg-warning shadow-[0_0_6px_hsl(var(--warning))]",
                    opt.value === "concluido" && "bg-success shadow-[0_0_6px_hsl(var(--success))]",
                    opt.value === "cancelado" && "bg-destructive shadow-[0_0_6px_hsl(var(--destructive))]",
                  )} />
                  {opt.value === "" ? "Vazio" : opt.label.replace("Biometria ", "").replace(/^./, c => c.toUpperCase())}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
        <div className="text-center">
          <div className="text-sm font-semibold">{vis.text}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {canEdit ? "Clique na digital para alterar" : "Somente leitura"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== STATUS DO PEDIDO ==============
type StatusPedido = "" | "ativado" | "cancelado" | "reprovado" | "prd_suporte";
const STATUS_PEDIDO_OPTS: { value: StatusPedido; label: string; tone: string; icon: typeof CheckCircle2; needsObs: boolean; obsLabel: string }[] = [
  { value: "ativado", label: "Ativado 100%", tone: "bg-success/15 text-success border-success/40", icon: CheckCircle2, needsObs: false, obsLabel: "" },
  { value: "cancelado", label: "Cancelado", tone: "bg-destructive/15 text-destructive border-destructive/40", icon: XCircle, needsObs: true, obsLabel: "Motivo / observação do cancelamento" },
  { value: "reprovado", label: "Reprovado", tone: "bg-warning/15 text-warning border-warning/40", icon: AlertCircle, needsObs: true, obsLabel: "Motivo / observação da reprovação" },
  { value: "prd_suporte", label: "PRD/Suporte", tone: "bg-info/15 text-info border-info/40", icon: Headphones, needsObs: true, obsLabel: "Descrição da tratativa / suporte / PRD" },
];
function statusPedidoOpt(s?: string | null) {
  return STATUS_PEDIDO_OPTS.find(o => o.value === (s as StatusPedido)) ?? null;
}

function StatusPedidoBadge({ status, obs, userNome, em }: {
  status: string; obs?: string; userNome?: string; em?: string;
}) {
  const opt = statusPedidoOpt(status);
  if (!opt) return null;
  const Ico = opt.icon;
  const badge = (
    <Badge className={cn("text-[9px] gap-1 border cursor-help", opt.tone)}>
      <Ico className="size-2.5" /> {opt.label.toUpperCase()}
    </Badge>
  );
  if (!obs) return badge;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs bg-[#0a0a0f] border-2 border-warning/60 shadow-[0_0_20px_-4px_hsl(var(--warning)/0.6)] px-3 py-2.5">
          <div className="space-y-1 text-xs">
            <div className="font-bold text-sm flex items-center gap-1.5 text-warning">
              <Ico className="size-3.5" /> {opt.label}
            </div>
            <div className="border-t border-border/60 pt-1"><span className="text-muted-foreground">Observação:</span> {obs}</div>
            {userNome && <div><span className="text-muted-foreground">Por:</span> {userNome}</div>}
            {em && <div><span className="text-muted-foreground">Em:</span> {new Date(em).toLocaleString("pt-BR")}</div>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ComissaoBadge({ vendaId }: { vendaId: string }) {
  const [row, setRow] = useState<{ status: string; valor_comissao: number; sem_regra: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("comissao_itens")
        .select("status, valor_comissao, sem_regra")
        .eq("venda_id", vendaId)
        .maybeSingle();
      if (alive) setRow(data ?? null);
    })();
    return () => { alive = false; };
  }, [vendaId]);
  if (!row) return null;
  const tone =
    row.status === "confirmada" ? "bg-success/15 text-success border-success/40" :
    row.status === "cancelada" ? "bg-destructive/15 text-destructive border-destructive/40" :
    row.status === "paga" ? "bg-info/15 text-info border-info/40" :
    row.sem_regra ? "bg-muted text-muted-foreground border-muted-foreground/30" :
    "bg-warning/15 text-warning border-warning/40";
  const label =
    row.status === "confirmada" ? "COMISSÃO CONFIRMADA" :
    row.status === "cancelada" ? "COMISSÃO CANCELADA" :
    row.status === "paga" ? "COMISSÃO PAGA" :
    row.status === "revisada" ? "COMISSÃO REVISADA" :
    row.sem_regra ? "COMISSÃO SEM REGRA" :
    "COMISSÃO PENDENTE";
  return (
    <Badge className={cn("text-[9px] gap-1 border", tone)} title={`Valor: ${brl(Number(row.valor_comissao || 0))}`}>
      <Banknote className="size-2.5" /> {label}
    </Badge>
  );
}

function StatusPedidoBlock({
  status, obs, userNome, em, canEdit, onSave,
}: {
  status: StatusPedido; obs: string; userNome?: string; em?: string;
  canEdit: boolean; onSave: (status: StatusPedido, obs: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [escolha, setEscolha] = useState<StatusPedido>(status);
  const [texto, setTexto] = useState(obs);
  const [saving, setSaving] = useState(false);
  const current = statusPedidoOpt(status);
  const escolhaOpt = statusPedidoOpt(escolha);

  function abrir(s: StatusPedido) {
    if (!canEdit) return;
    setEscolha(s);
    setTexto(obs);
    setOpen(true);
  }

  async function salvar() {
    if (escolhaOpt?.needsObs && !texto.trim()) {
      toast.error("Observação obrigatória", { description: escolhaOpt.obsLabel });
      return;
    }
    setSaving(true);
    try {
      await onSave(escolha, escolhaOpt?.needsObs ? texto : (texto || ""));
      setOpen(false);
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 relative overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display font-semibold text-sm flex items-center gap-2">
          <FileSignature className="size-4 text-omni" /> Status do Pedido
        </h3>
        {current && obs && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  <Info className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs bg-[#0a0a0f] border-2 border-warning/60 shadow-[0_0_20px_-4px_hsl(var(--warning)/0.6)] px-3 py-2.5">
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-sm text-warning">{current.label}</div>
                  <div className="border-t border-border/60 pt-1"><span className="text-muted-foreground">Observação:</span> {obs}</div>
                  {userNome && <div><span className="text-muted-foreground">Por:</span> {userNome}</div>}
                  {em && <div><span className="text-muted-foreground">Em:</span> {new Date(em).toLocaleString("pt-BR")}</div>}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STATUS_PEDIDO_OPTS.map(opt => {
          const Ico = opt.icon;
          const active = opt.value === status;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={!canEdit}
              onClick={() => abrir(opt.value)}
              className={cn(
                "rounded-lg border px-2.5 py-2 text-left flex items-center justify-center sm:justify-start gap-2 text-xs font-semibold transition-all",
                active ? cn(opt.tone, "shadow-[0_0_14px_-6px_currentColor]") : "border-border bg-background hover:bg-muted/40",
                !canEdit && !active && "opacity-50 cursor-not-allowed",
              )}
            >
              <Ico className="size-4 shrink-0" />
              <span className="whitespace-nowrap">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {current && obs && (
        <div className="mt-2 rounded-lg border border-border/60 bg-background/40 p-2 text-xs">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", status === "ativado" ? "bg-success" : status === "cancelado" ? "bg-destructive" : status === "reprovado" ? "bg-warning" : "bg-info")} />
            <span className="font-semibold">{current.label}</span>
            {canEdit && (
              <button onClick={() => abrir(status)} className="ml-auto text-muted-foreground hover:text-foreground" title="Editar observação">
                <Pencil className="size-3.5" />
              </button>
            )}
          </div>
          {obs && <div className="text-muted-foreground mt-1 line-clamp-2">{obs}</div>}
          {userNome && <div className="text-[10px] text-muted-foreground mt-1">alterado por {userNome}{em ? ` · ${new Date(em).toLocaleString("pt-BR")}` : ""}</div>}
        </div>
      )}

      {!canEdit && !current && (
        <p className="text-[10px] text-muted-foreground mt-2">Sem status definido.</p>
      )}

      <Dialog open={open} onOpenChange={(v) => !saving && setOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {escolhaOpt && <escolhaOpt.icon className="size-4" />}
              Status do Pedido: {escolhaOpt?.label}
            </DialogTitle>
            <DialogDescription>
              {escolhaOpt?.needsObs
                ? "Preencha a observação obrigatória para registrar esse status."
                : "Confirme a alteração do status do pedido."}
            </DialogDescription>
          </DialogHeader>
          {escolhaOpt?.needsObs && (
            <div className="space-y-1.5">
              <Label className="text-xs">{escolhaOpt.obsLabel}</Label>
              <Textarea rows={4} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Descreva o motivo…" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving} className="bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)] font-semibold">
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CopyCnpj({ value, className }: { value: string; className?: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1100);
    } catch {
      toast.error("Não foi possível copiar o CNPJ.");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copiar()}
      className={cn(
        "group relative inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-2 py-1 font-mono text-[11px] font-semibold text-foreground transition-colors hover:bg-muted/60",
        className,
      )}
      title="Clique para copiar"
    >
      {copiado && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1 py-0.5 text-[7px] font-semibold text-background shadow-sm">
          Copiado
        </span>
      )}
      <span>{maskCpfCnpj(value)}</span>
      <Copy className="size-2.5 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function ClienteInfoField({
  label,
  value,
  display,
  canEdit,
  onSave,
  multiline = false,
  className,
}: {
  label: string;
  value: string;
  display?: React.ReactNode;
  canEdit: boolean;
  onSave?: (value: string) => Promise<boolean>;
  multiline?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value === "—" ? "" : value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) setDraft(value === "—" ? "" : value);
  }, [value, open]);

  async function salvar() {
    if (!onSave) return;
    setSaving(true);
    try {
      const ok = await onSave(draft);
      if (ok) setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("group min-w-0 rounded-md border border-border/70 bg-surface-1/30 px-2.5 py-2", className)}>
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
          <div className="mt-0.5 min-w-0 break-words text-xs font-medium text-foreground">
            {display ?? (value || "—")}
          </div>
        </div>

        {canEdit && onSave && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="mt-0.5 grid size-5 shrink-0 place-items-center rounded text-muted-foreground opacity-60 transition-colors hover:bg-muted hover:text-foreground group-hover:opacity-100"
                title={`Editar ${label}`}
                aria-label={`Editar ${label}`}
              >
                <Pencil className="size-2.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-3">
              <div className="space-y-2">
                <Label className="text-[10px]">{label}</Label>
                {multiline ? (
                  <Textarea
                    rows={4}
                    value={draft}
                    onChange={event => setDraft(event.target.value)}
                    className="text-xs"
                  />
                ) : (
                  <Input
                    value={draft}
                    onChange={event => setDraft(event.target.value)}
                    className="h-8 text-xs"
                  />
                )}
                <div className="flex justify-end gap-1.5">
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setOpen(false)} disabled={saving}>
                    Cancelar
                  </Button>
                  <Button type="button" size="sm" className="h-7 text-[10px]" onClick={() => void salvar()} disabled={saving}>
                    {saving ? "Salvando…" : "Salvar"}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

function Row({ k, v, className }: { k: string; v: string; className?: string }) {
  return (
    <div className={cn("flex justify-between items-center gap-3 py-1.5 border-b border-border/40 last:border-0", className)}>
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className="font-medium text-right truncate">{v}</span>
    </div>
  );
}

function parseISODate(s?: string | null): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
function fmtBR(s?: string | null): string {
  const d = parseISODate(s);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR");
}
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const ORDEM_DATAS: { key: string; venda: string; label: string }[] = [
  { key: "data_recebimento",   venda: "dataRecebimento",   label: "Recebimento" },
  { key: "data_preenchimento", venda: "dataPreenchimento", label: "Preenchimento" },
  { key: "data_aceite",        venda: "dataAceite",        label: "Aceite" },
  { key: "data_input",         venda: "dataInput",         label: "Input" },
  { key: "data_ativacao",      venda: "dataAtivacao",      label: "Ativação" },
  { key: "data_portabilidade", venda: "dataPortabilidade", label: "Portabilidade" },
  { key: "data_entrega",       venda: "dataEntrega",       label: "Entrega/Instalação" },
];

function NumeroPedidoEditor({
  vendaId,
  numeroAtual,
  updateVenda,
}: {
  vendaId: string;
  numeroAtual: string;
  updateVenda: (id: string, patch: Record<string, unknown>) => Promise<boolean>;
}) {
  const [value, setValue] = useState(numeroAtual);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(numeroAtual);
  }, [numeroAtual]);

  async function salvar() {
    const next = value.trim();
    if (!next) {
      toast.error("Informe o número do pedido.");
      return;
    }
    if (next === numeroAtual) return;

    setSaving(true);
    try {
      const ok = await updateVenda(vendaId, { numero: next });
      if (!ok) throw new Error("A atualização não foi confirmada.");
      toast.success("Número do pedido atualizado.");
    } catch (error: any) {
      console.error("[NÚMERO PEDIDO]", error);
      toast.error("Não foi possível atualizar o número do pedido.", { description: error?.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-semibold">Editar número do pedido</div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">Disponível apenas para BKO e Administrador.</div>
      </div>
      <Input
        value={value}
        onChange={event => setValue(event.target.value)}
        disabled={saving}
        autoFocus
        className="font-mono"
        onKeyDown={event => {
          if (event.key === "Enter") {
            event.preventDefault();
            void salvar();
          }
        }}
      />
      <Button
        type="button"
        size="sm"
        className="w-full bg-omni text-black hover:bg-omni/90"
        disabled={saving || !value.trim() || value.trim() === numeroAtual}
        onClick={() => void salvar()}
      >
        {saving ? "Salvando..." : "Salvar número"}
      </Button>
    </div>
  );
}

function DatasBlock({
  venda, canEdit, updateVenda, user, profile, roles, reloadFromDb
}: {
  venda: any; canEdit: boolean;
  updateVenda: (id: string, patch: Record<string, unknown>) => Promise<boolean>;
  user: any; profile: any; roles: string[];
  reloadFromDb: () => Promise<void>;
}) {
  const valores: Record<string, string | undefined> = {
    data_recebimento: venda?.dataRecebimento,
    data_preenchimento: venda?.dataPreenchimento,
    data_aceite: venda?.dataAceite,
    data_input: venda?.dataInput,
    data_ativacao: venda?.dataAtivacao,
    data_portabilidade: venda?.dataPortabilidade,
    data_entrega: venda?.dataEntrega,
  };
  // min = maior data anterior preenchida na ordem cronológica
  const minFor = (key: string): Date | undefined => {
    const idx = ORDEM_DATAS.findIndex(o => o.key === key);
    if (idx <= 0) return undefined;
    for (let i = idx - 1; i >= 0; i--) {
      const d = parseISODate(valores[ORDEM_DATAS[i].key] ?? null);
      if (d) return d;
    }
    return undefined;
  };
  // max = menor data posterior preenchida na ordem cronológica
  const maxFor = (key: string): Date | undefined => {
    const idx = ORDEM_DATAS.findIndex(o => o.key === key);
    if (idx === -1 || idx === ORDEM_DATAS.length - 1) return undefined;
    for (let i = idx + 1; i < ORDEM_DATAS.length; i++) {
      const d = parseISODate(valores[ORDEM_DATAS[i].key] ?? null);
      if (d) return d;
    }
    return undefined;
  };
  // Portabilidade e Entrega: precisam ser >= Aceite (se houver)
  const minAceite = parseISODate(valores.data_aceite);

  async function salvar(field: string, novoISO: string | null) {
    const original = (valores[field] as any) ?? null;
    const normalizedOriginal = original ? original.slice(0, 10) : null;
    const normalizedNovo = novoISO ? novoISO.slice(0, 10) : null;

    if (normalizedNovo === normalizedOriginal) return;

    const success = await updateVenda(venda?.id || "", {
      [field.replace(/([A-Z])/g, "_$1").toLowerCase()]: normalizedNovo,
    });

    if (success) {
      toast.success(normalizedNovo ? "Data atualizada com sucesso." : "Data removida com sucesso.");
      await reloadFromDb();
    }
  }

  return (
    <>
      {ORDEM_DATAS.map(({ key, label }) => {
        const portabilidadeSemLimite = key === "data_portabilidade";
        return (
          <DatePickerField
            key={key}
            label={label}
            value={valores[key]}
            canEdit={canEdit}
            minDate={portabilidadeSemLimite ? undefined : minFor(key)}
            maxDate={portabilidadeSemLimite ? undefined : maxFor(key)}
            onSave={(iso) => salvar(key, iso)}
            venda={venda}
          />
        );
      })}
    </>
  );
}

function DatePickerField({
  label, value, canEdit, minDate, maxDate, onSave, venda
}: {
  label: string;
  value?: string | null;
  canEdit: boolean;
  minDate?: Date;
  maxDate?: Date;
  onSave: (iso: string | null) => Promise<void> | void;
  venda?: any;
}) {
  const [open, setOpen] = useState(false);
  const { profile, user, roles } = useAuth();
  const date = parseISODate(value);

  return (
    <div className="flex justify-between items-center gap-3 py-1.5 border-b border-border/40 last:border-0 group relative">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        {venda?.statusPedidoUserNome && (label !== "Última alteração") && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-[9px] text-muted-foreground/40 mt-0.5 cursor-default truncate max-w-[80px]">
                  {venda?.statusPedidoUserNome.split(' · ')[0] || venda?.statusPedidoUserNome}
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-zinc-900 border-zinc-800 text-zinc-200 text-[10px]">
                Última atualização feita por {venda?.statusPedidoUserNome} em {venda?.statusPedidoEm ? new Date(venda?.statusPedidoEm).toLocaleString("pt-BR") : "—"}.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {!canEdit && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="size-3 text-muted-foreground/50 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="bg-zinc-900 border-zinc-800 text-zinc-200 text-[11px] max-w-[200px]">
                Campo operacional bloqueado. Somente BKO ou Administrador podem editar esta data.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={!canEdit}
              className={cn(
                "h-7 px-2 text-xs font-medium justify-start min-w-[120px]",
                !date && "text-muted-foreground",
                !canEdit && "opacity-80 cursor-not-allowed border-dashed bg-muted/20"
              )}
            >
              <Calendar className="size-3 mr-1.5" />
              {date ? date.toLocaleDateString("pt-BR") : "—"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarPicker
              mode="single"
              selected={date}
              onSelect={(d) => {
                if (!d) return;
                if (minDate && d < minDate) {
                  toast.error("Data inválida", { description: `Deve ser ≥ ${minDate.toLocaleDateString("pt-BR")}` });
                  return;
                }
                if (maxDate && d > maxDate) {
                  toast.error("Data inválida", { description: `Deve ser ≤ ${maxDate.toLocaleDateString("pt-BR")}` });
                  return;
                }
                setOpen(false);
                void onSave(toISO(d));
              }}
              disabled={(d) =>
                (minDate ? d < minDate : false) || (maxDate ? d > maxDate : false)
              }
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        {canEdit && date && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => void onSave(null)}
            title="Limpar data"
          >
            <X className="size-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

interface HistoricoDatasItem {
  created_at: string;
  campo: string | null;
  valor_anterior: string | null;
  valor_novo: string | null;
  user_nome: string | null;
}

function formatRobotValue(campo: string | null, value: string | null): string {
  if (value == null || value === "") return "—";

  const dateFields = new Set([
    "data_recebimento",
    "data_preenchimento",
    "data_envio",
    "data_aceite",
    "data_input",
    "data_ativacao",
    "data_portabilidade",
    "data_entrega",
  ]);

  if (campo && dateFields.has(campo)) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }

  if (campo && (campo.endsWith("_at") || campo.endsWith("_em"))) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString("pt-BR");
  }

  return value;
}

const DATA_LABELS: Record<string, string> = {
  data_recebimento: "Recebimento",
  data_preenchimento: "Preenchimento",
  data_envio: "Envio",
  data_aceite: "Aceite",
  data_input: "Input",
  data_ativacao: "Ativação",
  data_portabilidade: "Portabilidade",
  data_entrega: "Entrega/Instalação",
};

function fmtDataLog(s: string | null): string {
  if (!s || s === "—") return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function buildHistoricoDatas(historico: HistoricoDatasItem[]): string {
  if (!historico || historico.length === 0) return "Nenhuma alteração registrada.";
  return historico.slice(0, 20).map(h => {
    const quando = new Date(h.created_at).toLocaleString("pt-BR");
    const label = DATA_LABELS[h.campo ?? ""] ?? h.campo ?? "—";
    const ant = fmtDataLog(h.valor_anterior);
    const nov = fmtDataLog(h.valor_novo);
    const user = h.user_nome ?? "Sistema";
    return `• ${quando} — ${user} alterou ${label}: ${ant} → ${nov}`;
  }).join("\n");
}

function buildNota(
  v: any, c: any, consultor: string | undefined, etapa: string,
  historicoDatas: HistoricoDatasItem[] = [], comissoesVisible: boolean,
) {
  return `╔══════════════════════════════════════════════╗
║  OMNI FLOW LAB — NOTA DO PEDIDO              ║
╠══════════════════════════════════════════════╣

PEDIDO: ${v.numero}
OPERADORA: ${v.operadora}
TIPO: ${(v.tipoPedidos?.length ? v.tipoPedidos : (v.tipoPedido ? [v.tipoPedido] : [])).join(" | ") || "—"}
PRODUTO: ${(v.produtos?.length ? v.produtos : (v.produto ? [v.produto] : [])).join(" | ") || "—"}
ETAPA ATUAL: ${etapa}

─── CLIENTE ───────────────────────────────────
Razão Social: ${c.razaoSocial}
CNPJ: ${c.cnpj}
Contato: ${c.contato}
Telefone: ${c.telefone}
UF/DDD: ${c.uf} · ${c.ddd}

─── DADOS COMERCIAIS ──────────────────────────
Quantidade de linhas: ${v.quantidadeLinhas}
Receita: ${comissoesVisible ? brl(v.receita) : "—"}
Consultor: ${consultor ?? "—"}
${comissoesVisible ? `Mês ref.: ${String(v.mesRef).padStart(2, "0")}/${v.anoRef}` : ""}

─── OPERACIONAL ───────────────────────────────
Status: ${v.status}
SLA: ${v.slaStatus.toUpperCase()}
Recebimento: ${fmtDataLog(v.dataRecebimento)}
Preenchimento: ${fmtDataLog(v.dataPreenchimento)}
Envio: ${fmtDataLog(v.dataEnvio)}
Aceite: ${fmtDataLog(v.dataAceite)}
Input: ${fmtDataLog(v.dataInput)}
Última alteração: ${v.atualizadoEm ? `${new Date(v.atualizadoEm).toLocaleString("pt-BR")} · ${v.statusPedidoUserNome || "Sistema"}` : "—"}
Data da ativação: ${fmtDataLog(v.dataAtivacao)}
Data portabilidade: ${fmtDataLog(v.dataPortabilidade)}
Data entrega/Instalação: ${fmtDataLog(v.dataEntrega)}
Próxima ação: ${v.proximaAcao} em ${fmtDataLog(v.proximaAcaoData)}
${v.observacao ? `\nObservação: ${v.observacao}` : ""}

Histórico de Datas:
${buildHistoricoDatas(historicoDatas)}

╚══════════════════════════════════════════════╝
Gerado por OMNI Flow Lab · pipeline inteligente`;
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">{titulo}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

interface NotaVersaoRow {
  id: string;
  tipo: "auto" | "manual" | "snapshot";
  conteudo: string;
  user_nome: string | null;
  created_at: string;
}

function NotaPedidoTab({
  venda, cliente, consultorNome, etapaNome, podeEditar, onPdf, onPreviewPdf,
  updateVenda, userId, userNome, historicoDatas = [], comissoesVisible,
}: {
  venda: any; cliente: any; consultorNome?: string; etapaNome: string;
  podeEditar: boolean;
  onPdf: () => void; onPreviewPdf: () => void;
  updateVenda: (id: string, patch: Record<string, unknown>) => Promise<boolean>;
  userId: string | null; userNome: string | null;
  historicoDatas?: HistoricoDatasItem[];
  comissoesVisible: boolean;
}) {
  const notaAuto = useMemo(
    () => buildNota(venda, cliente, consultorNome, etapaNome, historicoDatas, comissoesVisible),
    [venda, cliente, consultorNome, etapaNome, historicoDatas, comissoesVisible],
  );
  const modoAtual: "auto" | "manual" = venda?.notaModo ?? "auto";
  const textoSalvo = modoAtual === "manual" ? (venda?.notaManual ?? notaAuto) : notaAuto;

  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(textoSalvo);
  const [salvando, setSalvando] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [versoes, setVersoes] = useState<NotaVersaoRow[]>([]);

  useEffect(() => {
    if (!editando) setRascunho(textoSalvo);
  }, [textoSalvo, editando]);

  const carregarVersoes = useCallback(async () => {
    const { data } = await supabase
      .from("venda_nota_versoes")
      .select("id, tipo, conteudo, user_nome, created_at")
      .eq("venda_id", venda?.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setVersoes((data ?? []) as NotaVersaoRow[]);
  }, [venda?.id]);

  useEffect(() => { carregarVersoes(); }, [carregarVersoes]);

  async function snapshot(tipo: "auto" | "manual" | "snapshot", conteudo: string) {
    await supabase.from("venda_nota_versoes").insert({
      venda_id: venda?.id || "", tipo, conteudo,
      user_id: userId, user_nome: userNome,
    });
  }

  async function salvarManual() {
    setSalvando(true);
    const ok = await updateVenda(venda?.id || "", {
      nota_modo: "manual",
      nota_manual: rascunho,
      nota_atualizada_em: new Date().toISOString(),
      nota_atualizada_por: userId,
    });
    if (ok) {
      await snapshot("manual", rascunho);
      await carregarVersoes();
      setEditando(false);
    }
    setSalvando(false);
  }

  async function restaurarAuto() {
    setSalvando(true);
    if (modoAtual === "manual" && venda?.notaManual) {
      await snapshot("snapshot", venda?.notaManual);
    }
    const ok = await updateVenda(venda?.id || "", {
      nota_modo: "auto",
      nota_manual: null,
      nota_atualizada_em: new Date().toISOString(),
      nota_atualizada_por: userId,
    });
    if (ok) {
      await snapshot("auto", notaAuto);
      await carregarVersoes();
      setEditando(false);
      setRascunho(notaAuto);
    }
    setSalvando(false);
  }

  async function regenerarAuto() {
    setSalvando(true);
    await snapshot("auto", notaAuto);
    if (modoAtual === "manual") {
      const ok = await updateVenda(venda?.id || "", {
        nota_modo: "auto",
        nota_manual: null,
        nota_atualizada_em: new Date().toISOString(),
        nota_atualizada_por: userId,
      });
      if (ok) {
        setEditando(false);
        setRascunho(notaAuto);
      }
    } else {
      setRascunho(notaAuto);
      toast.success("Nota automática regenerada");
    }
    await carregarVersoes();
    setSalvando(false);
  }

  function copiar() {
    const t = editando ? rascunho : textoSalvo;
    navigator.clipboard.writeText(t);
    toast.success("Nota copiada");
  }

  async function restaurarVersao(v: NotaVersaoRow) {
    setSalvando(true);
    const ok = await updateVenda(venda?.id || "", {
      nota_modo: "manual",
      nota_manual: v.conteudo,
      nota_atualizada_em: new Date().toISOString(),
      nota_atualizada_por: userId,
    });
    if (ok) {
      await snapshot("snapshot", v.conteudo);
      await carregarVersoes();
      setEditando(false);
      toast.success("Versão restaurada como nota manual");
    }
    setSalvando(false);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <FileText className="size-4 text-omni" /> Nota do Pedido
            <Badge variant="outline" className={cn(
              "ml-2 text-[9px] uppercase tracking-wider",
              modoAtual === "manual" ? "border-purple/40 text-purple" : "border-omni/40 text-omni"
            )}>
              {modoAtual === "manual" ? "Manual" : "Automática"}
            </Badge>
          </h3>
          <div className="flex flex-wrap gap-2">
            {!editando && podeEditar && (
              <Button size="sm" variant="outline" className="gap-2" onClick={() => { setRascunho(textoSalvo); setEditando(true); }}>
                <Pencil className="size-3.5" /> Editar
              </Button>
            )}
            {editando && (
              <>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => { setEditando(false); setRascunho(textoSalvo); }} disabled={salvando}>
                  <X className="size-3.5" /> Cancelar
                </Button>
                <Button size="sm" className="bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)] font-semibold gap-2" onClick={salvarManual} disabled={salvando}>
                  <Save className="size-3.5" /> {salvando ? "Salvando…" : "Salvar"}
                </Button>
              </>
            )}
            {modoAtual === "manual" && podeEditar && (
              <Button size="sm" variant="outline" className="gap-2" onClick={restaurarAuto} disabled={salvando}>
                <Undo2 className="size-3.5" /> Restaurar automática
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-2" onClick={copiar}>
              <Copy className="size-3.5" /> Copiar
            </Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setPreviewOpen(true)}>
              <Eye className="size-3.5" /> Pré-visualizar
            </Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={onPreviewPdf}>
              <Printer className="size-3.5" /> PDF preview
            </Button>
            <Button size="sm" className="bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)] font-semibold gap-2" onClick={onPdf}>
              <Download className="size-3.5" /> Gerar PDF
            </Button>
          </div>
        </div>

        {editando ? (
          <Textarea
            rows={22}
            value={rascunho}
            onChange={e => setRascunho(e.target.value)}
            className="font-mono text-xs leading-relaxed"
          />
        ) : (
          <pre className="bg-surface-1 border border-border rounded-lg p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed">
{textoSalvo}
          </pre>
        )}

        {venda?.notaAtualizadaEm && (
          <div className="mt-2 text-[10px] text-muted-foreground">
            Última alteração: {new Date(venda?.notaAtualizadaEm).toLocaleString("pt-BR")}
          </div>
        )}
      </div>

      {versoes.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="text-sm font-display font-semibold mb-3 flex items-center gap-2">
            <History className="size-4 text-omni" /> Versões da nota
          </h4>
          <div className="space-y-2 max-h-80 overflow-auto pr-1">
            {versoes.map(v => (
              <div key={v.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-1 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs font-mono text-muted-foreground">
                    {new Date(v.created_at).toLocaleString("pt-BR")} · {v.user_nome ?? "Sistema"} ·{" "}
                    <span className="uppercase">{v.tipo}</span>
                  </div>
                  <div className="text-[11px] truncate text-foreground/80">{v.conteudo.slice(0, 120)}…</div>
                </div>
                {podeEditar && (
                  <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={() => restaurarVersao(v)} disabled={salvando}>
                    <Undo2 className="size-3" /> Restaurar
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="size-4 text-omni" /> Pré-visualização da nota
            </DialogTitle>
          </DialogHeader>
          <pre className="bg-surface-1 border border-border rounded-lg p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed">
{editando ? rascunho : textoSalvo}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface VendaLinhaRow {
  id: string;
  venda_id: string;
  nome_aparelho: string | null;
  numero: string | null;
  operadora: string;
  operadora_doadora: string | null;
  ddd: string | null;
  plano: string | null;
  produto: string | null;
  tipo_produto: string | null;
  plano_catalogo_id: string | null;
  plano_oferta_id: string | null;
  passaporte_produto_id: string | null;
  passaporte_plano_oferta_id: string | null;
  passaporte_plano: string | null;
  passaporte_valor: number | null;
  descricao_adicional: string | null;
  siga_me_produto_id: string | null;
  siga_me_descricao: string | null;
  tamanho_plano: number | null;
  tamanho_plano_unidade: "GB" | "MB" | null;
  valor_mensal: number;
  possui_bonus: boolean | null;
  bonus_gb: number | null;
  status: "ativa" | "renovada" | "cancelada" | "portada" | "concluida";
  data_ativacao: string | null;
  iccid: string | null;
  observacao: string | null;
  ordem: number;
  created_at?: string | null;
  updated_at?: string | null;
}

const NAO_INFORMADO = "Não informado";
const PRODUTOS_NOVO_COM_QUANTIDADE = new Set(["movel", "chip dados", "chip de dados"]);

function formatBrlInput(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseBrlInput(value: string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits) / 100;
}

function linhaUsaQuantidade(linha: VendaLinhaRow) {
  const produto = normalizeLinhaLabel(linha.produto);
  if (produto === "aparelho") return true;
  return normalizeLinhaLabel(linha.tipo_produto) === "novo"
    && PRODUTOS_NOVO_COM_QUANTIDADE.has(produto);
}

function chaveLinhaNovoAgrupada(linha: VendaLinhaRow, parteVinculo?: string | null) {
  return JSON.stringify({
    operadora: normalizeLinhaLabel(linha.operadora),
    tipo_produto: normalizeLinhaLabel(linha.tipo_produto),
    produto: normalizeLinhaLabel(linha.produto),
    status: normalizeLinhaLabel(linha.status),
    ddd: linha.ddd ?? "",
    numero: linha.numero ?? "",
    plano: linha.plano ?? "",
    plano_catalogo_id: linha.plano_catalogo_id ?? null,
    plano_oferta_id: linha.plano_oferta_id ?? null,
    valor_mensal: Number(linha.valor_mensal ?? 0),
    nome_aparelho: linha.nome_aparelho ?? "",
    operadora_doadora: linha.operadora_doadora ?? "",
    passaporte_produto_id: linha.passaporte_produto_id ?? null,
    passaporte_plano_oferta_id: linha.passaporte_plano_oferta_id ?? null,
    passaporte_plano: linha.passaporte_plano ?? "",
    passaporte_valor: Number(linha.passaporte_valor ?? 0),
    descricao_adicional: linha.descricao_adicional ?? "",
    siga_me_produto_id: linha.siga_me_produto_id ?? null,
    siga_me_descricao: linha.siga_me_descricao ?? "",
    tamanho_plano: linha.tamanho_plano ?? null,
    tamanho_plano_unidade: linha.tamanho_plano_unidade ?? null,
    possui_bonus: linha.possui_bonus ?? null,
    bonus_gb: linha.bonus_gb ?? null,
    data_ativacao: linha.data_ativacao ?? null,
    iccid: linha.iccid ?? "",
    observacao: linha.observacao ?? "",
    parte_vinculo: parteVinculo ?? null,
  });
}

function LinhasTab({
  vendaId, clienteId, operadora, dddPadrao,
  receitaVenda, qtdVenda, podeEditar, podeEditarLinhas, podeGerenciarCatalogos, podeGerenciarPlanos, userId, reloadVenda, comissoesVisible,
}: {
  vendaId: string;
  clienteId: string;
  operadora: string;
  dddPadrao: string;
  receitaVenda: number;
  qtdVenda: number;
  podeEditar: boolean;
  podeEditarLinhas: boolean;
  podeGerenciarCatalogos: boolean;
  podeGerenciarPlanos: boolean;
  userId: string | null;
  reloadVenda: () => Promise<void>;
  comissoesVisible: boolean;
}) {
  const [linhas, setLinhas] = useState<VendaLinhaRow[]>([]);
  const [partesPedido, setPartesPedido] = useState<Array<{
    tipo: "cedente" | "cessionario";
    id: string;
    nome: string;
    documento: string;
  }>>([]);
  const [partesPorLinha, setPartesPorLinha] = useState<Record<string, {
    tipo: "cedente" | "cessionario";
    id: string;
    nome: string;
  }>>({});
  const [linhasSelecionadas, setLinhasSelecionadas] = useState<Set<string>>(new Set());
  const [parteMassaValue, setParteMassaValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [linhasExpandidas, setLinhasExpandidas] = useState<Set<string>>(new Set());
  const [linhasMaximizadas, setLinhasMaximizadas] = useState(false);
  const { data: produtosCatLinha, refetch: refetchProdutos } = useCatalogo("produtos_catalogo");
  const { data: tiposCatLinha, refetch: refetchTipos } = useCatalogo("tipos_pedido_catalogo");
  const tipoProdutoConfigPorNome = useMemo(() => {
    const map = new Map<string, (typeof tiposCatLinha)[number]>();
    for (const item of tiposCatLinha) {
      map.set(`${item.operadora}:${normalizeLinhaLabel(item.nome)}`, item);
    }
    return map;
  }, [tiposCatLinha]);

  const carregar = useCallback(async () => {
    setLoading(true);
    const db = supabase as any;
    const [linhasRes, cedentesRes, cessionariosRes] = await Promise.all([
      db
        .from("venda_linhas")
        .select("*")
        .eq("venda_id", vendaId)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true }),
      db
        .from("venda_cedentes")
        .select("cedente_id,cedentes(id,cnpj_cpf,razao_social,nome)")
        .eq("venda_id", vendaId),
      db
        .from("venda_cessionarios")
        .select("cessionario_id,cessionarios(id,cpf,nome)")
        .eq("venda_id", vendaId),
    ]);

    const novasLinhas = (linhasRes.data ?? []) as VendaLinhaRow[];
    setLinhas(novasLinhas);

    setPartesPedido([
      ...(cedentesRes.data ?? [])
        .map((row: any) => row.cedentes)
        .filter(Boolean)
        .map((item: any) => ({
          tipo: "cedente" as const,
          id: item.id,
          nome: item.razao_social || item.nome || "Cedente",
          documento: item.cnpj_cpf || "",
        })),
      ...(cessionariosRes.data ?? [])
        .map((row: any) => row.cessionarios)
        .filter(Boolean)
        .map((item: any) => ({
          tipo: "cessionario" as const,
          id: item.id,
          nome: item.nome || "Cessionário",
          documento: item.cpf || "",
        })),
    ]);

    const linhaIds = novasLinhas.map(item => item.id);
    if (linhaIds.length > 0) {
      const [cedentesLinhaRes, cessionariosLinhaRes] = await Promise.all([
        db
          .from("venda_linha_doadores")
          .select("linha_id,cedente_id,cedentes(id,razao_social,nome)")
          .in("linha_id", linhaIds),
        db
          .from("venda_linha_cessionarios")
          .select("linha_id,cessionario_id,cessionarios(id,nome)")
          .in("linha_id", linhaIds),
      ]);

      const mapa: Record<string, { tipo: "cedente" | "cessionario"; id: string; nome: string }> = {};
      for (const row of cedentesLinhaRes.data ?? []) {
        if (!row.cedentes) continue;
        mapa[row.linha_id] = {
          tipo: "cedente",
          id: row.cedente_id,
          nome: row.cedentes.razao_social || row.cedentes.nome || "Cedente",
        };
      }
      for (const row of cessionariosLinhaRes.data ?? []) {
        if (!row.cessionarios) continue;
        mapa[row.linha_id] = {
          tipo: "cessionario",
          id: row.cessionario_id,
          nome: row.cessionarios.nome || "Cessionário",
        };
      }
      setPartesPorLinha(mapa);
    } else {
      setPartesPorLinha({});
    }

    setLoading(false);
  }, [vendaId]);

  useEffect(() => { void carregar(); }, [carregar]);

  useEffect(() => {
    if (!linhasMaximizadas) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLinhasMaximizadas(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [linhasMaximizadas]);

  const totais = useMemo(() => {
    const ativas = linhas.filter(l => l.status !== "cancelada");
    const receita = ativas.reduce(
      (s, l) => s + (normalizeLinhaLabel(l.produto) === "aparelho" ? 0 : Number(l.valor_mensal || 0)),
      0,
    );
    const qtd = ativas.length;
    const ticket = qtd > 0 ? receita / qtd : 0;
    return { receita, qtd, ticket };
  }, [linhas]);

  const diferencaReceita = totais.receita - receitaVenda;
  const diferencaQtd = totais.qtd - qtdVenda;

  const produtosUnicos = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const linha of linhas) {
      const nome = linha.produto?.trim();
      if (!nome) continue;
      const chave = normalizeLinhaLabel(nome);
      if (!chave || chave === normalizeLinhaLabel(NAO_INFORMADO)) continue;
      if (!mapa.has(chave)) mapa.set(chave, nome.toUpperCase());
    }
    return Array.from(mapa.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [linhas]);

  const linhasExibidas = useMemo(() => {
    const grupos = new Map<string, { linha: VendaLinhaRow; membros: VendaLinhaRow[]; agrupavel: boolean }>();
    const ordemVisual: Array<{ linha: VendaLinhaRow; membros: VendaLinhaRow[]; agrupavel: boolean }> = [];

    for (const linha of linhas) {
      if (!linhaUsaQuantidade(linha)) {
        ordemVisual.push({ linha, membros: [linha], agrupavel: false });
        continue;
      }

      const parte = partesPorLinha[linha.id];
      const chave = chaveLinhaNovoAgrupada(linha, parte ? `${parte.tipo}:${parte.id}` : null);
      const existente = grupos.get(chave);
      if (existente) {
        existente.membros.push(linha);
        continue;
      }

      const grupo = { linha, membros: [linha], agrupavel: true };
      grupos.set(chave, grupo);
      ordemVisual.push(grupo);
    }

    return ordemVisual;
  }, [linhas, partesPorLinha]);

  async function afterChange() {
    await carregar();
    await reloadVenda();
  }

  async function adicionar() {
    setBusy(true);
    const ordem = linhas.length;
    const { error } = await supabase.from("venda_linhas").insert({
      venda_id: vendaId,
      numero: "",
      operadora: operadora || "CLARO",
      operadora_doadora: null,
      ddd: dddPadrao || "",
      produto: NAO_INFORMADO,
      tipo_produto: NAO_INFORMADO,
      plano: NAO_INFORMADO,
      passaporte_produto_id: null,
      passaporte_plano_oferta_id: null,
      passaporte_plano: null,
      passaporte_valor: null,
      descricao_adicional: null,
      siga_me_produto_id: null,
      siga_me_descricao: null,
      valor_mensal: 0,
      status: "ativa",
      ordem,
      created_by: userId,
    } as any);
    setBusy(false);
    if (error) {
      toast.error("Falha ao adicionar linha", { description: error.message });
      return;
    }
    toast.success("Linha adicionada");
    await afterChange();
  }

  async function duplicar(l: VendaLinhaRow, origem: "duplicar" | "quantidade" = "duplicar") {
    setBusy(true);
    const novo = {
      venda_id: l.venda_id,
      nome_aparelho: l.nome_aparelho,
      numero: l.numero,
      operadora: l.operadora || operadora,
      operadora_doadora: l.operadora_doadora,
      ddd: l.ddd,
      plano: l.plano,
      plano_catalogo_id: l.plano_catalogo_id,
      plano_oferta_id: l.plano_oferta_id,
      passaporte_produto_id: l.passaporte_produto_id,
      passaporte_plano_oferta_id: l.passaporte_plano_oferta_id,
      passaporte_plano: l.passaporte_plano,
      passaporte_valor: l.passaporte_valor,
      descricao_adicional: l.descricao_adicional,
      siga_me_produto_id: l.siga_me_produto_id,
      siga_me_descricao: l.siga_me_descricao,
      produto: l.produto,
      tipo_produto: l.tipo_produto,
      tamanho_plano: l.tamanho_plano,
      tamanho_plano_unidade: l.tamanho_plano_unidade,
      valor_mensal: l.valor_mensal,
      possui_bonus: l.possui_bonus,
      bonus_gb: l.bonus_gb,
      status: l.status,
      observacao: l.observacao,
      ordem: (l.ordem ?? 0) + 1,
      created_by: userId,
    };
    const { error } = await supabase.from("venda_linhas").insert(novo as any);
    setBusy(false);
    if (error) {
      toast.error("Falha ao duplicar", { description: error.message });
      return;
    }
    toast.success(origem === "quantidade" ? "Quantidade aumentada" : "Linha duplicada");
    await afterChange();
  }

  async function diminuirQuantidade(membros: VendaLinhaRow[]) {
    if (membros.length === 0 || busy) return;

    const alvo = [...membros].sort((a, b) => {
      const aData = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bData = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (aData !== bData) return bData - aData;
      return Number(b.ordem ?? 0) - Number(a.ordem ?? 0);
    })[0];

    setBusy(true);
    try {
      const { deleteVendaLinha } = await import("@/lib/exclusao.functions");
      await deleteVendaLinha({ data: { linhaId: alvo.id } });
      toast.success("Quantidade reduzida");
      await afterChange();
    } catch (error: any) {
      toast.error("Falha ao reduzir quantidade", { description: error?.message || "A linha não foi excluída." });
    } finally {
      setBusy(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta linha definitivamente?")) return;
    setBusy(true);
    try {
      const { deleteVendaLinha } = await import("@/lib/exclusao.functions");
      await deleteVendaLinha({ data: { linhaId: id } });
      toast.success("Linha excluída definitivamente");
      await afterChange();
    } catch (error: any) {
      toast.error("Falha ao excluir", { description: error?.message || "A linha não foi excluída." });
    } finally {
      setBusy(false);
    }
  }

  async function patchLinhas(ids: string[], p: Partial<VendaLinhaRow>) {
    const idsUnicos = Array.from(new Set(ids));
    const idsSet = new Set(idsUnicos);
    setLinhas(curr => curr.map(l => idsSet.has(l.id) ? { ...l, ...p } as VendaLinhaRow : l));

    const { error } = await (supabase.from("venda_linhas") as any)
      .update(p)
      .in("id", idsUnicos);

    if (error) {
      toast.error("Falha ao salvar", { description: error.message });
      await carregar();
      return;
    }
    if (Object.prototype.hasOwnProperty.call(p, "tipo_produto")) {
      await carregar();
    }
    await reloadVenda();
  }

  function toggleLinhaExpandida(id: string) {
    setLinhasExpandidas(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleLinhasSelecionadas(ids: string[]) {
    setLinhasSelecionadas(current => {
      const next = new Set(current);
      const todasSelecionadas = ids.every(id => next.has(id));
      for (const id of ids) {
        if (todasSelecionadas) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  async function vincularParteEmMassa() {
    if (!parteMassaValue || linhasSelecionadas.size === 0 || busy) return;
    const [tipo, parteId] = parteMassaValue.split(":", 2);
    if (!parteId || !["cedente", "cessionario"].includes(tipo)) return;

    setBusy(true);
    const resultados = await Promise.all(
      Array.from(linhasSelecionadas).map(linhaId =>
        (supabase as any).rpc("definir_parte_linha", {
          p_linha_id: linhaId,
          p_tipo: tipo,
          p_parte_id: parteId,
        }),
      ),
    );
    setBusy(false);

    const erro = resultados.find(resultado => resultado.error)?.error;
    if (erro) {
      toast.error("Não foi possível vincular às linhas selecionadas", { description: erro.message });
      return;
    }

    setLinhasSelecionadas(new Set());
    setParteMassaValue("");
    await afterChange();
    toast.success(tipo === "cedente"
      ? "Cedente vinculado às linhas selecionadas"
      : "Cessionário vinculado às linhas selecionadas");
  }

  return (
    <div className={cn(
      "space-y-4",
      linhasMaximizadas
        && "fixed inset-2 z-[90] overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-2xl sm:inset-4",
    )}>
      <div className="omni-venda-product-summary grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {comissoesVisible && <KpiLinha label="Receita das linhas" value={brl(totais.receita)} tone="success" />}
        <KpiLinha label="Qtd ativa" value={String(totais.qtd)} tone="info" />
        <div className="omni-venda-info-card flex min-h-[68px] items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <Package className="size-4 shrink-0 text-purple" />
          <div className="min-w-0">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Produtos</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {produtosUnicos.length > 0 ? produtosUnicos.map(produtoNome => (
                <Badge key={produtoNome} variant="outline" className="h-5 rounded-md px-1.5 text-[9px] font-semibold">
                  {produtoNome}
                </Badge>
              )) : (
                <span className="text-xs text-muted-foreground">Nenhum produto cadastrado</span>
              )}
            </div>
          </div>
        </div>
        {comissoesVisible && <KpiLinha label="Ticket médio" value={brl(totais.ticket)} tone="omni" />}
        {comissoesVisible && (
          <KpiLinha
            label="Diferença vs venda"
            value={`${diferencaReceita >= 0 ? "+" : ""}${brl(diferencaReceita)} · ${diferencaQtd >= 0 ? "+" : ""}${diferencaQtd}`}
            tone={Math.abs(diferencaReceita) < 0.01 && diferencaQtd === 0 ? "success" : "warning"}
          />
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-border">
          <div className="text-xs text-muted-foreground">
            {loading ? "Carregando…" : `${linhas.length} linha(s)`}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {podeEditar && linhasSelecionadas.size > 0 && partesPedido.length > 0 && (
              <>
                <Select value={parteMassaValue} onValueChange={setParteMassaValue}>
                  <SelectTrigger className="h-8 w-[270px] text-[11px]">
                    <SelectValue placeholder="Cedente/Cessionário para linhas" />
                  </SelectTrigger>
                  <SelectContent>
                    {partesPedido.map(item => (
                      <SelectItem key={`${item.tipo}:${item.id}`} value={`${item.tipo}:${item.id}`}>
                        {item.tipo === "cedente" ? "Cedente" : "Cessionário"} · {uppercaseDisplay(item.nome)}
                        {item.documento ? ` · ${item.documento}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-[11px]"
                  disabled={busy || !parteMassaValue}
                  onClick={() => void vincularParteEmMassa()}
                >
                  <Users className="size-3.5" /> Vincular em massa ({linhasSelecionadas.size})
                </Button>
              </>
            )}
            {podeEditar && (
              <Button size="sm" className="gap-2 bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)]" onClick={adicionar} disabled={busy}>
                <Plus className="size-3.5" /> Adicionar linha
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-[11px]"
              onClick={() => setLinhasMaximizadas(value => !value)}
              title={linhasMaximizadas ? "Restaurar tela de linhas" : "Maximizar tela de linhas"}
              aria-label={linhasMaximizadas ? "Restaurar tela de linhas" : "Maximizar tela de linhas"}
            >
              {linhasMaximizadas
                ? <Minimize2 className="size-3.5" />
                : <Maximize2 className="size-3.5" />}
              {linhasMaximizadas ? "Restaurar" : "Maximizar"}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[10px] min-w-[980px]">
            <thead className="bg-surface-1 text-muted-foreground uppercase tracking-wider text-[9px]">
              <tr>
                <th className="px-1.5 py-1.5 w-9">Sel.</th>
                <th className="text-left px-1.5 py-1.5 w-14">DDD</th>
                <th className="text-left px-1.5 py-1.5 w-14">Número</th>
                <th className="text-left px-1.5 py-1.5">Pedido</th>
                <th className="text-left px-1.5 py-1.5">Produto</th>
                <th className="text-left px-1.5 py-1.5">Plano</th>
                <th className="text-right px-1.5 py-1.5 w-[145px] min-w-[145px]">Valor (R$)</th>
                <th className="px-1.5 py-1.5 w-14 text-center">Qtd</th>
                <th className="px-1.5 py-1.5 w-28">Ações</th>
              </tr>
            </thead>
            <tbody>
              {linhasExibidas.map(({ linha: l, membros, agrupavel }) => {
                const idsGrupo = membros.map(item => item.id);
                const quantidadeGrupo = membros.length;
                const patchAtual = (p: Partial<VendaLinhaRow>) => patchLinhas(idsGrupo, p);
                const setLocalAtual = (p: Partial<VendaLinhaRow>) => {
                  const idsSet = new Set(idsGrupo);
                  setLinhas(curr => curr.map(item => idsSet.has(item.id) ? { ...item, ...p } as VendaLinhaRow : item));
                };
                const linhaOperadora = operadora || l.operadora || "CLARO";
                const produtosBaseDaOperadora = produtosCatLinha.filter(item =>
                  item.operadora === linhaOperadora
                  && !isProdutoPassaporteAdicional(item.nome)
                );
                const produtosDaOperadora = (linhaOperadora === "CLARO" || linhaOperadora === "VIVO")
                  ? produtosBaseDaOperadora.filter(item =>
                      normalizeLinhaLabel(item.nome) === normalizeLinhaLabel(NAO_INFORMADO)
                      || normalizeLinhaLabel(item.nome) === normalizeLinhaLabel(l.produto)
                      || operadoraPermiteProduto(linhaOperadora, l.tipo_produto, item.nome)
                    )
                  : produtosBaseDaOperadora;
                const tiposDaOperadora = tiposCatLinha.filter(item => item.operadora === linhaOperadora);
                const tipoConfig = tipoProdutoConfigPorNome.get(
                  `${linhaOperadora}:${normalizeLinhaLabel(l.tipo_produto)}`,
                );
                const regrasCampos = getLinhaCampoRules({
                  operadora: linhaOperadora,
                  produto: l.produto,
                  tipoPedido: l.tipo_produto,
                });
                const aparelho = isTipoProdutoAparelho(l.produto);
                const movel = regrasCampos.produtoMovel;
                const valorTotalGrupo = Number(l.valor_mensal || 0) * Math.max(1, quantidadeGrupo);
                const permitePassaporte = linhaPermitePassaporte({
                  operadora: linhaOperadora,
                  produto: l.produto,
                  tipoPedido: l.tipo_produto,
                });
                const passaportesDisponiveis = produtosCatLinha.filter(item =>
                  item.operadora === linhaOperadora
                  && item.ativo
                  && isProdutoPassaporteAdicional(item.nome)
                );
                const passaporteSelecionado = passaportesDisponiveis.find(item => item.id === l.passaporte_produto_id) ?? null;
                const permiteDoadorLinha = Boolean(tipoConfig?.permite_doador) && regrasCampos.produtoMovel;
                const claroPortadoMovel = normalizeLinhaLabel(linhaOperadora) === "claro"
                  && normalizeLinhaLabel(l.tipo_produto) === "portado"
                  && regrasCampos.produtoMovel;
                const permiteOperadoraDoadoraLinha = (permiteDoadorLinha || claroPortadoMovel)
                  && linhaPermiteOperadoraDoadora({
                    operadora: linhaOperadora,
                    tipoPedido: l.tipo_produto,
                  });
                const permiteBonusLinha = linhaOperadora === "VIVO"
                  && Boolean(tipoConfig?.permite_bonus)
                  && regrasCampos.produtoMovel;
                const descricaoAdicionalLabel = linhaDescricaoAdicionalLabel({
                  operadora: linhaOperadora,
                  produto: l.produto,
                  tipoPedido: l.tipo_produto,
                });
                const temHierarquia = Boolean(
                  aparelho
                  || movel
                  || permitePassaporte
                  || permiteDoadorLinha
                  || permiteOperadoraDoadoraLinha
                  || permiteBonusLinha
                  || descricaoAdicionalLabel,
                );
                const expandida = linhasExpandidas.has(l.id);

                return (
                  <Fragment key={l.id}>
                    <tr className={cn(
                      "border-t border-border hover:bg-surface-1",
                      l.status === "cancelada" && "opacity-60",
                    )}>
                      <td className="px-1 py-0.5 text-center">
                        {permiteDoadorLinha ? (
                          <Checkbox
                            checked={idsGrupo.every(id => linhasSelecionadas.has(id))}
                            onCheckedChange={() => toggleLinhasSelecionadas(idsGrupo)}
                            disabled={!podeEditar || busy}
                            aria-label="Selecionar linha para vínculo de Cedente"
                          />
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-1 py-0.5">
                        {!regrasCampos.bloqueiaDdd && (
                          <Input
                            value={l.ddd ?? ""}
                            disabled={!podeEditarLinhas}
                            placeholder="DDD"
                            className="h-7 px-2 text-[10px]"
                            onChange={e => setLocalAtual({ ddd: e.target.value })}
                            onBlur={e => void patchAtual({ ddd: e.target.value })}
                          />
                        )}
                      </td>
                      <td
                        className={cn(
                          "px-1 py-0.5",
                          regrasCampos.bloqueiaNumero ? "w-10 min-w-10" : "w-[148px] min-w-[148px]",
                        )}
                      >
                        {!regrasCampos.bloqueiaNumero && (
                          <Input
                            value={l.numero ?? ""}
                            disabled={!podeEditarLinhas}
                            placeholder="Número"
                            className="h-7 w-full min-w-[136px] px-2 text-[10px] font-mono"
                            onChange={e => setLocalAtual({ numero: e.target.value })}
                            onBlur={e => void patchAtual({ numero: e.target.value })}
                          />
                        )}
                      </td>
                      <td className="px-1 py-0.5">
                        <CatalogoLinhaSelect
                          value={l.tipo_produto || NAO_INFORMADO}
                          currentValue={l.tipo_produto}
                          items={tiposDaOperadora}
                          table="tipos_pedido_catalogo"
                          operadora={linhaOperadora}
                          canManage={podeGerenciarCatalogos}
                          disabled={!podeEditarLinhas}
                          compact
                          placeholder="Tipo de Pedido"
                          label="Tipo de Pedido"
                          onValueChange={v => {
                            const proximoTipo = tiposDaOperadora.find(item => item.nome === v);
                            const produtoAtualValido = operadoraPermiteProduto(
                              linhaOperadora,
                              v,
                              l.produto,
                            );
                            const produtoDestino = produtoAtualValido ? l.produto : NAO_INFORMADO;
                            const proximasRegras = getLinhaCampoRules({
                              operadora: linhaOperadora,
                              produto: produtoDestino,
                              tipoPedido: v,
                            });
                            const mantemPassaporte = linhaPermitePassaporte({
                              operadora: linhaOperadora,
                              produto: produtoDestino,
                              tipoPedido: v,
                            });
                            const mantemDoador = Boolean(proximoTipo?.permite_doador)
                              && proximasRegras.produtoMovel;
                            const claroPortadoMovelDestino = normalizeLinhaLabel(linhaOperadora) === "claro"
                              && normalizeLinhaLabel(v) === "portado"
                              && proximasRegras.produtoMovel;
                            const mantemOperadoraDoadora = (mantemDoador || claroPortadoMovelDestino)
                              && linhaPermiteOperadoraDoadora({
                                operadora: linhaOperadora,
                                tipoPedido: v,
                              });
                            const mantemBonus = linhaOperadora === "VIVO"
                              && Boolean(proximoTipo?.permite_bonus)
                              && proximasRegras.produtoMovel;
                            void patchAtual({
                              tipo_produto: v,
                              ...(!produtoAtualValido ? {
                                produto: NAO_INFORMADO,
                                ddd: null,
                                numero: null,
                                plano: NAO_INFORMADO,
                                plano_catalogo_id: null,
                                plano_oferta_id: null,
                                valor_mensal: 0,
                                nome_aparelho: null,
                                descricao_adicional: null,
                              } : {}),
                              ...(mantemOperadoraDoadora ? {} : { operadora_doadora: null }),
                              ...(mantemBonus ? {} : { possui_bonus: null, bonus_gb: null }),
                              ...(mantemPassaporte ? {} : {
                                passaporte_produto_id: null,
                                passaporte_plano_oferta_id: null,
                                passaporte_plano: null,
                                passaporte_valor: null,
                              }),
                              ...linhaRulePatch(proximasRegras, produtoAtualValido ? l.valor_mensal : 0, { applyDefaultValue: true }),
                            });
                          }}
                          onCatalogChanged={async () => {
                            await refetchTipos();
                            await carregar();
                            await reloadVenda();
                          }}
                        />
                      </td>
                      <td className="px-1 py-0.5">
                        <CatalogoLinhaSelect
                          value={l.produto || NAO_INFORMADO}
                          currentValue={l.produto}
                          items={produtosDaOperadora}
                          table="produtos_catalogo"
                          operadora={linhaOperadora}
                          canManage={podeGerenciarCatalogos}
                          disabled={!podeEditarLinhas}
                          compact
                          placeholder="Produto"
                          label="Produto"
                          onValueChange={v => {
                            const proximasRegras = getLinhaCampoRules({
                              operadora: linhaOperadora,
                              produto: v,
                              tipoPedido: l.tipo_produto,
                            });
                            const mantemPassaporte = linhaPermitePassaporte({
                              operadora: linhaOperadora,
                              produto: v,
                              tipoPedido: l.tipo_produto,
                            });
                            const mantemDoador = Boolean(tipoConfig?.permite_doador)
                              && proximasRegras.produtoMovel;
                            const claroPortadoMovelDestino = normalizeLinhaLabel(linhaOperadora) === "claro"
                              && normalizeLinhaLabel(l.tipo_produto) === "portado"
                              && proximasRegras.produtoMovel;
                            const mantemOperadoraDoadora = (mantemDoador || claroPortadoMovelDestino)
                              && linhaPermiteOperadoraDoadora({
                                operadora: linhaOperadora,
                                tipoPedido: l.tipo_produto,
                              });
                            const mantemBonus = linhaOperadora === "VIVO"
                              && Boolean(tipoConfig?.permite_bonus)
                              && proximasRegras.produtoMovel;
                            void patchAtual({
                              produto: v,
                              ...(mantemOperadoraDoadora ? {} : { operadora_doadora: null }),
                              ...(mantemBonus ? {} : { possui_bonus: null, bonus_gb: null }),
                              ...(!isTipoProdutoAparelho(v) ? { nome_aparelho: null } : { valor_mensal: 0 }),
                              ...(!proximasRegras.descricaoAdicional ? { descricao_adicional: null } : {}),
                              ...(mantemPassaporte ? {} : {
                                passaporte_produto_id: null,
                                passaporte_plano_oferta_id: null,
                                passaporte_plano: null,
                                passaporte_valor: null,
                              }),
                              ...linhaRulePatch(proximasRegras, l.valor_mensal, { applyDefaultValue: true }),
                            });
                          }}
                          onCatalogChanged={refetchProdutos}
                        />
                      </td>
                      <td className="px-1 py-0.5">
                        {!regrasCampos.bloqueiaPlano && (
                          <PlanoOfertaSelect
                            operadora={linhaOperadora}
                            produto={l.produto}
                            tipoProduto={l.tipo_produto}
                            value={l.plano_oferta_id}
                            currentPlano={aparelho && (!l.plano || l.plano === NAO_INFORMADO)
                              ? l.nome_aparelho
                              : l.plano}
                            canManage={podeGerenciarPlanos}
                            disabled={!podeEditarLinhas}
                            compact
                            variant={aparelho ? "aparelho" : "default"}
                            onSelect={oferta => {
                              if (!oferta) {
                                void patchAtual({
                                  plano: NAO_INFORMADO,
                                  plano_catalogo_id: null,
                                  plano_oferta_id: null,
                                  ...(aparelho ? { nome_aparelho: null } : {}),
                                });
                                return;
                              }
                              void patchAtual({
                                plano: oferta.plano_nome,
                                plano_catalogo_id: oferta.plano_id,
                                plano_oferta_id: oferta.id,
                                ...(!aparelho ? { valor_mensal: oferta.valor_mes } : {}),
                                ...(aparelho ? { nome_aparelho: oferta.plano_nome } : {}),
                              });
                            }}
                          />
                        )}
                      </td>
                      <td className="w-[145px] min-w-[145px] px-1 py-0.5">
                        {!regrasCampos.bloqueiaValor && !regrasCampos.valorSomenteExtra && (
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={formatBrlInput(valorTotalGrupo)}
                            disabled={!podeEditarLinhas}
                            onFocus={e => e.currentTarget.select()}
                            className="h-8 w-full min-w-[132px] px-2.5 text-[11px] font-mono font-semibold text-right"
                            title={quantidadeGrupo > 1
                              ? `Valor total do grupo: ${quantidadeGrupo} × ${formatBrlInput(Number(l.valor_mensal || 0))}`
                              : aparelho
                                ? "Valor do aparelho informado manualmente"
                                : "Valor da linha"}
                            onChange={e => {
                              const total = parseBrlInput(e.target.value);
                              setLocalAtual({ valor_mensal: total / Math.max(1, quantidadeGrupo) });
                            }}
                            onBlur={e => {
                              const total = parseBrlInput(e.target.value);
                              void patchAtual({ valor_mensal: total / Math.max(1, quantidadeGrupo) });
                            }}
                          />
                        )}
                      </td>
                      <td className="px-1 py-0.5 text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 min-w-7 justify-center rounded-md px-1.5 font-mono text-[9px] font-bold",
                            agrupavel && "border-[var(--omni)]/35 bg-[var(--omni)]/5 text-foreground",
                          )}
                          title={agrupavel ? `${quantidadeGrupo} linha(s) real(is) neste grupo` : "Linha individual"}
                        >
                          {quantidadeGrupo}
                        </Badge>
                      </td>
                      <td className="px-1 py-0.5">
                        <div className="flex items-center gap-0.5 justify-end">
                          {partesPorLinha[l.id] && (
                            <Badge
                              variant="outline"
                              className="max-w-[145px] truncate border-[var(--omni)]/40 text-[9px] text-[var(--omni)]"
                              title={`${partesPorLinha[l.id].tipo === "cedente" ? "Cedente" : "Cessionário"}: ${partesPorLinha[l.id].nome}`}
                            >
                              {partesPorLinha[l.id].tipo === "cedente" ? "Cedente" : "Cessionário"}: {partesPorLinha[l.id].nome}
                            </Badge>
                          )}
                          {temHierarquia && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-6"
                              onClick={() => toggleLinhaExpandida(l.id)}
                              title={expandida ? "Recolher informações da linha" : "Exibir informações da linha"}
                            >
                              {expandida ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                            </Button>
                          )}
                          {podeEditar && (
                            <>
                              {agrupavel ? (
                                <div className="inline-flex items-center overflow-hidden rounded-md border border-border bg-background/50">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="size-6 rounded-none border-r border-border"
                                    onClick={() => void diminuirQuantidade(membros)}
                                    disabled={busy}
                                    title="Diminuir quantidade"
                                    aria-label="Diminuir quantidade"
                                  >
                                    <Minus className="size-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="size-6 rounded-none"
                                    onClick={() => void duplicar(l, "quantidade")}
                                    disabled={busy}
                                    title="Aumentar quantidade"
                                    aria-label="Aumentar quantidade"
                                  >
                                    <Plus className="size-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <Button size="icon" variant="ghost" className="size-6" onClick={() => void duplicar(l)} disabled={busy} title="Duplicar">
                                  <CopyPlus className="size-3.5" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" className="size-6 text-destructive hover:bg-destructive/10" onClick={() => void excluir(l.id)} disabled={busy} title="Excluir">
                                <Trash2 className="size-3.5" />
                              </Button>
                            </>
                          )}
                          {!podeEditar && podeEditarLinhas && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-6 text-destructive hover:bg-destructive/10"
                              onClick={() => void excluir(l.id)}
                              disabled={busy}
                              title="Excluir"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {temHierarquia && expandida && (
                      <tr className={cn("border-t border-border/60 bg-surface-1/40", l.status === "cancelada" && "opacity-60")}>
                        <td colSpan={9} className="px-2 py-2">
                          <div className="space-y-2 rounded-md border border-border/60 bg-background/30 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                                Informações da linha
                              </div>
                              <div className="text-[9px] text-muted-foreground">
                                {l.numero || `Linha #${(l.ordem ?? 0) + 1}`}
                              </div>
                            </div>

                            <div className="grid gap-2 xl:grid-cols-2">
                              {permitePassaporte && (
                                <div className="rounded-md border border-border/60 bg-card/60 p-2 space-y-2">
                                  <Label className="text-[9px] font-semibold">Passaporte</Label>

                                  <div className="grid gap-2 sm:grid-cols-3">
                                    <div className="space-y-1">
                                      <Label className="text-[9px]">Passaporte</Label>
                                      <CatalogoLinhaSelect
                                        value={passaporteSelecionado?.nome ?? NAO_INFORMADO}
                                        currentValue={passaporteSelecionado?.nome}
                                        items={passaportesDisponiveis}
                                        table="produtos_catalogo"
                                        operadora={linhaOperadora}
                                        canManage={podeGerenciarCatalogos}
                                        disabled={!podeEditarLinhas}
                                        compact
                                        placeholder="Passaporte"
                                        label="Passaporte"
                                        onValueChange={value => {
                                          const selecionado = passaportesDisponiveis.find(item => item.nome === value) ?? null;
                                          void patchAtual({
                                            passaporte_produto_id: selecionado?.id ?? null,
                                            passaporte_plano_oferta_id: null,
                                            passaporte_plano: null,
                                            passaporte_valor: null,
                                          });
                                        }}
                                        onCatalogChanged={async () => {
                                          await refetchProdutos();
                                          await carregar();
                                          await reloadVenda();
                                        }}
                                      />
                                    </div>

                                    <div className="space-y-1">
                                      <Label className="text-[9px]">Plano / Gigas</Label>
                                      <PlanoOfertaSelect
                                        operadora={linhaOperadora}
                                        produto={passaporteSelecionado?.nome ?? null}
                                        tipoProduto={null}
                                        value={l.passaporte_plano_oferta_id}
                                        currentPlano={l.passaporte_plano}
                                        produtoIdOverride={passaporteSelecionado?.id ?? null}
                                        canManage={podeGerenciarPlanos}
                                        disabled={!podeEditarLinhas || !passaporteSelecionado}
                                        compact
                                        variant="passaporte"
                                        onSelect={oferta => {
                                          if (!oferta) {
                                            void patchAtual({
                                              passaporte_plano_oferta_id: null,
                                              passaporte_plano: null,
                                              passaporte_valor: null,
                                            });
                                            return;
                                          }
                                          void patchAtual({
                                            passaporte_plano_oferta_id: oferta.id,
                                            passaporte_plano: oferta.plano_nome,
                                            passaporte_valor: oferta.valor_mes,
                                          });
                                        }}
                                      />
                                    </div>

                                    <div className="space-y-1">
                                      <Label className="text-[9px]">Valor</Label>
                                      {linhaOperadora === "VIVO" ? (
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          value={passaporteSelecionado ? formatBrlInput(l.passaporte_valor ?? 0) : ""}
                                          disabled={!podeEditarLinhas || !passaporteSelecionado}
                                          onFocus={e => e.currentTarget.select()}
                                          placeholder="R$ 0,00"
                                          className="h-7 min-w-[120px] px-2 text-[10px] font-mono text-right"
                                          onChange={e => setLocalAtual({ passaporte_valor: parseBrlInput(e.target.value) })}
                                          onBlur={e => void patchAtual({ passaporte_valor: parseBrlInput(e.target.value) })}
                                        />
                                      ) : (
                                        <Input
                                          value={passaporteSelecionado && l.passaporte_plano_oferta_id
                                            ? Number(l.passaporte_valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                            : "Não informado"}
                                          disabled
                                          className="h-7 px-2 text-[10px] font-mono"
                                        />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {(movel || aparelho) && (
                                <div className="rounded-md border border-border/60 bg-card/60 p-2 space-y-1">
                                  <Label className="text-[9px]">{aparelho ? "Parcelas / valor total do aparelho" : "Observação"}</Label>
                                  <Textarea
                                    value={l.observacao ?? ""}
                                    disabled={!podeEditarLinhas}
                                    placeholder={aparelho
                                      ? "Ex.: 24x de R$ 568,70 · Total R$ 13.648,80"
                                      : "Observação da linha"}
                                    className="min-h-12 resize-y px-2 py-1.5 text-[10px]"
                                    onChange={e => setLocalAtual({ observacao: e.target.value })}
                                    onBlur={e => void patchAtual({ observacao: e.target.value.trim() || null })}
                                  />
                                </div>
                              )}

                              {permiteOperadoraDoadoraLinha && (
                                <div className="rounded-md border border-border/60 bg-card/60 p-2 space-y-1">
                                  <Label className="text-[9px]">Operadora Doadora</Label>
                                  <Input
                                    value={l.operadora_doadora ?? ""}
                                    disabled={!podeEditarLinhas}
                                    placeholder="Ex.: TIM, Oi, Algar..."
                                    className="h-7 px-2 text-[10px]"
                                    onChange={e => setLocalAtual({ operadora_doadora: e.target.value })}
                                    onBlur={e => void patchAtual({ operadora_doadora: e.target.value.trim() || null })}
                                  />
                                </div>
                              )}

                              {descricaoAdicionalLabel && (
                                <div className="rounded-md border border-border/60 bg-card/60 p-2 space-y-1">
                                  <Label className="text-[9px]">{descricaoAdicionalLabel}</Label>
                                  <Textarea
                                    value={l.descricao_adicional ?? ""}
                                    disabled={!podeEditarLinhas}
                                    placeholder={`Descreva ${descricaoAdicionalLabel.toLocaleLowerCase("pt-BR")}`}
                                    className="min-h-12 resize-y px-2 py-1.5 text-[10px]"
                                    onChange={e => setLocalAtual({ descricao_adicional: e.target.value })}
                                    onBlur={e => void patchAtual({ descricao_adicional: e.target.value.trim() || null })}
                                  />
                                </div>
                              )}
                            </div>

                            <LinhaOperationalExtras
                              vendaId={vendaId}
                              clienteId={clienteId}
                              linhaId={l.id}
                              operadora={linhaOperadora}
                              possuiBonus={l.possui_bonus}
                              bonusGb={l.bonus_gb}
                              permiteBonus={permiteBonusLinha}
                              permiteDoador={permiteDoadorLinha}
                              canEdit={podeEditarLinhas}
                              canManageBonusCatalog={podeGerenciarCatalogos}
                              onChanged={afterChange}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}

              {!loading && linhas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-xs text-muted-foreground">
                    Nenhuma linha cadastrada. {podeEditar ? "Clique em \"Adicionar linha\" para começar." : ""}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

function KpiLinha({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="omni-venda-info-card rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={cn("font-display text-lg font-bold leading-tight", `text-[var(--${tone})]`)}>{value}</div>
    </div>
  );
}
