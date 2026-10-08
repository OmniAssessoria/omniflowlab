import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import {
  AlertTriangle, ArrowLeft, CalendarDays, Check, CheckCircle2, CircleDollarSign,
  Clock3, Download, Eye, FileText, Handshake, ImagePlus, MessageCircle, MoreHorizontal,
  Paperclip, Pencil, Plus, Send, Sparkles, Trash2, Upload, UserRound, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSmartBack } from "@/lib/navigation-memory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { BRAND_META, BrandLogo } from "@/components/brand-logo";
import { CloserOptionSelect } from "@/components/closer-option-select";
import { CloserOnvoxNotes } from "@/components/closer-onvox-notes";
import { useCloserOptions } from "@/lib/closer-options";
import { formatBrlInput, onvoxDidUsaNumero, onvoxProdutosPermitidos, onvoxQuantidadePersistida, onvoxValorTotalLinha, parseBrlInput, somenteDigitosOnvox, somenteDigitosTake, takeApiTipoValido } from "@/lib/closer-consultor-ui";
import { toast } from "sonner";

export const Route = createFileRoute("/_shell/operacao-closer/$id")({
  component: PedidoCloserPage,
});

type Produto = "ONVOX" | "TAKE_FLOW";

type PedidoItem = {
  id: string;
  tipo_pedido: string | null;
  produto_item: string;
  quantidade: number;
  receita: number | string;
  operadora_doadora: string | null;
  ddd: string | null;
  numero: string | null;
  data_portabilidade: string | null;
  status_portabilidade: string | null;
  data_entrega: string | null;
  equipamento: string | null;
  modelo: string | null;
  quantidade_equipamentos: number | null;
  updated_at: string;
};

type Pedido = {
  id: string;
  numero: number | null;
  produto: Produto;
  etapa: string;
  closer_id: string;
  closer_nome: string | null;
  bko_id: string | null;
  bko_nome: string | null;
  data_recebimento: string | null;
  data_envio: string | null;
  data_assinatura: string | null;
  data_implantacao: string | null;
  data_ativacao: string | null;
  data_entrega: string | null;
  observacao: string | null;
  observacao_bko: string | null;
  erro: string | null;
  receita_total: number | string | null;
  take_conexoes: number | null;
  take_usuarios: number | null;
  take_valor_implantacao: number | string | null;
  take_api_tipo: string | null;
  onvox_plano_pabx: string | null;
  representante_legal_nome: string | null;
  representante_legal_email: string | null;
  representante_legal_telefone: string | null;
  gestor_tecnico_nome: string | null;
  gestor_tecnico_email: string | null;
  gestor_tecnico_telefone: string | null;
  gestor_tecnico_email_faturas: string | null;
  created_at: string;
  updated_at: string;
  concluido_em: string | null;
  cancelado_em: string | null;
  closer_clientes?: {
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
    cnpj: string;
    contato: string | null;
    telefone: string | null;
    email: string | null;
    origem_lead: string | null;
  } | null;
  closer_pedido_itens?: PedidoItem[];
};

type Documento = {
  id: string;
  pedido_id: string;
  arquivo_nome_original: string;
  storage_path: string;
  mime_type: string;
  tamanho_bytes: number;
  enviado_por: string;
  enviado_por_nome: string | null;
  enviado_por_role: string | null;
  created_at: string;
};

type MensagemPedido = {
  id: string;
  pedido_id: string;
  user_id: string;
  user_nome: string | null;
  user_role: string | null;
  mensagem: string;
  imagem_storage_path: string | null;
  imagem_nome_original: string | null;
  imagem_mime_type: string | null;
  imagem_tamanho_bytes: number | null;
  imagem_url?: string | null;
  created_at: string;
};

type TakeConnection = {
  id?: string;
  pedido_id?: string;
  ddd: string;
  numero: string;
  ordem: number;
};

type OnvoxEditItem = {
  id?: string;
  tipo_pedido: string;
  produto_item: string;
  quantidade: string;
  valor_unitario: string;
  receita: string;
  operadora_doadora: string;
  ddd: string;
  numero: string;
  equipamento: string;
  quantidade_equipamentos: string;
};

type TakeEditDraft = {
  apiTipo: string;
  receita: string;
  conexoes: string;
  usuarios: string;
  implantacao: string;
  observacao: string;
  representanteNome: string;
  representanteEmail: string;
  representanteTelefone: string;
  gestorAtivo: boolean;
  gestorNome: string;
  gestorEmail: string;
  gestorTelefone: string;
  gestorEmailFaturas: string;
  linhas: Array<{ ddd: string; numero: string }>;
};

type ItemOperationalDraft = {
  id: string;
  data_portabilidade: string;
  status_portabilidade: string;
};

type InformationDraft = {
  razao_social: string;
  cnpj: string;
  contato: string;
  telefone: string;
  email: string;
  origem_lead: string;
  produto: Produto;
  observacao: string;
};

const ONVOX = "#D92FA0";
const TAKE = "#7A3DA8";
const PURPLE = "#7100CA";
const BUCKET = "closer-documentos";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

function brl(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

function productLabel(p: Produto) {
  return p === "ONVOX" ? "ONVOX" : "TAKE FLOW";
}

function isFinalStage(produto: Produto, etapa: string) {
  return (produto === "ONVOX" && etapa === "CONCLUÍDO")
    || (produto === "TAKE_FLOW" && etapa === "ONBOARDING 3");
}

function stageClass(etapa: string) {
  if (etapa === "CONCLUÍDO") return "border-success/40 bg-success/10 text-success";
  if (etapa === "CANCELADO") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (etapa === "PENDÊNCIA COMERCIAL") return "border-amber-500/40 bg-amber-500/10 text-amber-500";
  return "border-border bg-surface-2 text-foreground";
}

function portabilityStatusClass(status: string | null | undefined) {
  if (status === "CONCLUÍDO") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-500";
  if (status === "AGUARDANDO") return "border-amber-500/40 bg-amber-500/10 text-amber-500";
  if (status === "CANCELADA") return "border-destructive/40 bg-destructive/10 text-destructive";
  return "border-border bg-surface-2 text-muted-foreground";
}

function StageTrack({
  items,
  currentValue,
  accent,
  showDescription = true,
}: {
  items: { id: string; valor: string; nome: string }[];
  currentValue: string;
  accent: string;
  showDescription?: boolean;
}) {
  const currentIndex = items.findIndex((item) => item.valor === currentValue);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4"
      style={{
        borderColor: `${accent}44`,
        background: `linear-gradient(135deg, ${accent}0F, rgba(255,255,255,.015))`,
        boxShadow: `0 22px 60px -48px ${accent}`,
      }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-foreground">
            <Sparkles className="size-4" style={{ color: accent }} />
            Fluxo operacional completo
          </div>
          {showDescription && (
            <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Todas as etapas permanecem visíveis para BKO e Closer. A etapa atual fica iluminada e pulsando.
            </div>
          )}
        </div>
        <Badge variant="outline" className={cn("px-3 py-1.5 text-xs font-black", stageClass(currentValue))}>{currentValue}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
        {items.map((item, index) => {
          const active = item.valor === currentValue;
          const passed = currentIndex >= 0 && index < currentIndex;
          return (
            <div
              key={item.id}
              className={cn(
                "relative min-h-[66px] overflow-hidden rounded-xl border px-3.5 py-3 transition-all",
                active && "animate-[pulse_1.8s_ease-in-out_infinite]",
                !active && passed && "border-border bg-background/80",
                !active && !passed && "border-border/80 bg-background/45 opacity-90",
              )}
              style={active ? {
                borderColor: accent,
                background: `linear-gradient(135deg, ${accent}33, ${accent}10 55%, transparent)`,
                boxShadow: `0 0 0 1px ${accent}55, 0 0 26px ${accent}55, inset 0 0 22px ${accent}1F`,
              } : undefined}
            >
              {active && (
                <>
                  <span className="pointer-events-none absolute -right-3 -top-3 size-14 rounded-full blur-xl" style={{ backgroundColor: `${accent}66` }} />
                  <Sparkles className="absolute right-2 top-2 size-3.5 animate-pulse" style={{ color: accent }} />
                </>
              )}
              <div className="relative z-10 flex items-center gap-2">
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-full border text-[10px] font-black"
                  style={active ? { borderColor: accent, color: accent, boxShadow: `0 0 12px ${accent}99` } : undefined}
                >
                  {index + 1}
                </span>
                <span className={cn("text-[13px] font-bold leading-tight text-foreground/90", active && "text-foreground")}>{item.nome}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function safeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(-120);
}

function mimeFor(file: File) {
  if (file.type && Object.values(MIME_BY_EXT).includes(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "";
}

function PedidoCloserPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const voltarPaginaAnterior = useSmartBack("/operacao-closer");
  const { user, profile, primaryRole, roles } = useAuth();
  const optionCatalog = useCloserOptions();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [documents, setDocuments] = useState<Documento[]>([]);
  const [messages, setMessages] = useState<MensagemPedido[]>([]);
  const [takeConnections, setTakeConnections] = useState<TakeConnection[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [pendingChatImage, setPendingChatImage] = useState<File | null>(null);
  const [pendingChatImagePreview, setPendingChatImagePreview] = useState<string | null>(null);
  const chatImageInputRef = useRef<HTMLInputElement | null>(null);
  const [documentPreview, setDocumentPreview] = useState<{ doc: Documento; url: string } | null>(null);
  const [takeEditOpen, setTakeEditOpen] = useState(false);
  const [takeEditSaving, setTakeEditSaving] = useState(false);
  const [onvoxEditOpen, setOnvoxEditOpen] = useState(false);
  const [onvoxEditSaving, setOnvoxEditSaving] = useState(false);
  const [onvoxEditItems, setOnvoxEditItems] = useState<OnvoxEditItem[]>([]);
  const [onvoxEditObservacao, setOnvoxEditObservacao] = useState("");
  const [onvoxEditRepresentanteNome, setOnvoxEditRepresentanteNome] = useState("");
  const [onvoxEditRepresentanteEmail, setOnvoxEditRepresentanteEmail] = useState("");
  const [onvoxEditRepresentanteTelefone, setOnvoxEditRepresentanteTelefone] = useState("");
  const [onvoxEditGestorAtivo, setOnvoxEditGestorAtivo] = useState(false);
  const [onvoxEditGestorNome, setOnvoxEditGestorNome] = useState("");
  const [onvoxEditGestorEmail, setOnvoxEditGestorEmail] = useState("");
  const [onvoxEditGestorTelefone, setOnvoxEditGestorTelefone] = useState("");
  const [onvoxEditGestorEmailFaturas, setOnvoxEditGestorEmailFaturas] = useState("");
  const [onvoxFieldEdit, setOnvoxFieldEdit] = useState<{
    scope: "cliente" | "pedido";
    field: string;
    label: string;
    value: string;
  } | null>(null);
  const [onvoxFieldSaving, setOnvoxFieldSaving] = useState(false);
  const [takeEdit, setTakeEdit] = useState<TakeEditDraft>({
    apiTipo: "",
    receita: "",
    conexoes: "",
    usuarios: "",
    implantacao: "",
    observacao: "",
    representanteNome: "",
    representanteEmail: "",
    representanteTelefone: "",
    gestorAtivo: false,
    gestorNome: "",
    gestorEmail: "",
    gestorTelefone: "",
    gestorEmailFaturas: "",
    linhas: [{ ddd: "", numero: "" }],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [numberEditing, setNumberEditing] = useState(false);
  const [numberDraft, setNumberDraft] = useState("");
  const [numberSaving, setNumberSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docFilter, setDocFilter] = useState<"TODOS" | "CLOSER" | "BKO">("TODOS");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const isAdmin = roles.includes("admin");
  const isBko = roles.includes("bko");
  const isGestor = roles.includes("gestor");
  const operational = isBko || isAdmin || isGestor;
  const isCloser = roles.includes("closer") || roles.includes("consultor");
  const canUpdateStage = isBko;
  const canUpdatePortabilityStatus = isBko;
  const canManageOptions = isBko || isAdmin;
  const canEditNumber = isAdmin || isBko || isCloser;
  const canEditInformation = isAdmin || isBko || isCloser;
  const canEditTakeOrder = isAdmin || isBko || (isCloser && pedido?.closer_id === user?.id);
  const canEditOnvoxOrder = isAdmin || isBko || (isCloser && pedido?.closer_id === user?.id);
  const canEditOnvoxInfo = canEditOnvoxOrder;
  const canUpload = isCloser || operational;
  const canSendMessage = isBko || (isCloser && pedido?.closer_id === user?.id);

  const [etapa, setEtapa] = useState("CONTRATO");
  const [dataRecebimento, setDataRecebimento] = useState("");
  const [dataEnvio, setDataEnvio] = useState("");
  const [dataAssinatura, setDataAssinatura] = useState("");
  const [dataImplantacao, setDataImplantacao] = useState("");
  const [dataAtivacao, setDataAtivacao] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [observacaoBko, setObservacaoBko] = useState("");
  const [erro, setErro] = useState("");
  const [itemOps, setItemOps] = useState<ItemOperationalDraft[]>([]);
  const [pendingFinalStage, setPendingFinalStage] = useState<string | null>(null);
  const [informationEditing, setInformationEditing] = useState(false);
  const [informationSaving, setInformationSaving] = useState(false);
  const [informationDraft, setInformationDraft] = useState<InformationDraft>({
    razao_social: "",
    cnpj: "",
    contato: "",
    telefone: "",
    email: "",
    origem_lead: "",
    produto: "ONVOX",
    observacao: "",
  });

  async function load() {
    const db = supabase as any;
    setLoading(true);
    const [orderResult, historyResult, docsResult, messagesResult, takeConnectionsResult] = await Promise.all([
      db
        .from("closer_pedidos")
        .select("*, closer_clientes(*), closer_pedido_itens(*)")
        .eq("id", id)
        .maybeSingle(),
      db
        .from("closer_pedido_historico")
        .select("*")
        .eq("pedido_id", id)
        .order("created_at", { ascending: false })
        .limit(150),
      db
        .from("closer_pedido_documentos")
        .select("*")
        .eq("pedido_id", id)
        .order("created_at", { ascending: false }),
      db
        .from("closer_pedido_mensagens")
        .select("*")
        .eq("pedido_id", id)
        .order("created_at", { ascending: true })
        .limit(250),
      db
        .from("closer_take_conexoes")
        .select("*")
        .eq("pedido_id", id)
        .order("ordem", { ascending: true }),
    ]);

    if (orderResult.error) {
      toast.error("Não foi possível abrir o pedido", { description: orderResult.error.message });
      setLoading(false);
      return;
    }

    const next = (orderResult.data ?? null) as Pedido | null;
    setPedido(next);
    setHistory(historyResult.data ?? []);
    setDocuments((docsResult.data ?? []) as Documento[]);
    setTakeConnections((takeConnectionsResult.data ?? []) as TakeConnection[]);

    const hydratedMessages = await Promise.all(
      ((messagesResult.data ?? []) as MensagemPedido[]).map(async (message) => {
        if (!message.imagem_storage_path) return { ...message, imagem_url: null };
        const signed = await supabase.storage.from(BUCKET).createSignedUrl(message.imagem_storage_path, 60 * 60);
        return { ...message, imagem_url: signed.data?.signedUrl ?? null };
      }),
    );
    setMessages(hydratedMessages);

    if (next) {
      setEtapa(next.etapa);
      setDataRecebimento(next.data_recebimento ?? "");
      setDataEnvio(next.data_envio ?? "");
      setDataAssinatura(next.data_assinatura ?? "");
      setDataImplantacao(next.data_implantacao ?? "");
      setDataAtivacao(next.data_ativacao ?? "");
      setDataEntrega(next.data_entrega ?? "");
      setObservacaoBko(next.observacao_bko ?? "");
      setNumberDraft(String(next.numero ?? ""));
      setErro(next.erro ?? "");
      setItemOps((next.closer_pedido_itens ?? []).map((item) => ({
        id: item.id,
        data_portabilidade: item.data_portabilidade ?? "",
        status_portabilidade: item.status_portabilidade ?? "",
      })));
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const db = supabase as any;
    const channel = db
      .channel(`closer-pedido-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "closer_pedidos", filter: `id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "closer_pedido_itens", filter: `pedido_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "closer_pedido_documentos", filter: `pedido_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "closer_pedido_historico", filter: `pedido_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "closer_pedido_mensagens", filter: `pedido_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "closer_take_conexoes", filter: `pedido_id=eq.${id}` }, load)
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [id]);

  const accent = pedido?.produto === "ONVOX" ? ONVOX : TAKE;
  const stageCategory = pedido?.produto === "ONVOX" ? "onvox_stage" : "takeflow_stage";
  const stageOptions = optionCatalog.optionsFor(stageCategory);
  const cliente = pedido?.closer_clientes;

  const filteredDocs = useMemo(() => {
    if (docFilter === "TODOS") return documents;
    if (docFilter === "CLOSER") {
      return documents.filter((doc) => ["closer", "consultor"].includes(doc.enviado_por_role ?? ""));
    }
    return documents.filter((doc) => ["bko", "admin", "gestor"].includes(doc.enviado_por_role ?? ""));
  }, [documents, docFilter]);

  function handleStageChange(nextStage: string) {
    if (!pedido || !canUpdateStage || nextStage === etapa) return;

    const enteringFinalStage =
      isFinalStage(pedido.produto, nextStage)
      && !isFinalStage(pedido.produto, pedido.etapa);

    if (enteringFinalStage) {
      setPendingFinalStage(nextStage);
      return;
    }

    setEtapa(nextStage);
  }

  async function persistOperationalChanges() {
    if (!pedido || !operational || !user || saving) return;

    const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? "") === (b ?? "");
    const orderPatch: Record<string, unknown> = {};

    if (!same(dataRecebimento, pedido.data_recebimento)) orderPatch.data_recebimento = dataRecebimento || null;
    if (!same(dataEnvio, pedido.data_envio)) orderPatch.data_envio = dataEnvio || null;
    if (!same(dataAssinatura, pedido.data_assinatura)) orderPatch.data_assinatura = dataAssinatura || null;
    if (!same(dataImplantacao, pedido.data_implantacao)) orderPatch.data_implantacao = dataImplantacao || null;
    if (!same(dataAtivacao, pedido.data_ativacao)) orderPatch.data_ativacao = dataAtivacao || null;
    if (!same(dataEntrega, pedido.data_entrega)) orderPatch.data_entrega = dataEntrega || null;
    if (!same(observacaoBko.trim(), pedido.observacao_bko)) orderPatch.observacao_bko = observacaoBko.trim() || null;
    if (!same(erro.trim(), pedido.erro)) orderPatch.erro = erro.trim() || null;

    if (canUpdateStage && etapa !== pedido.etapa) {
      const nextIsFinal = isFinalStage(pedido.produto, etapa);
      const currentIsFinal = isFinalStage(pedido.produto, pedido.etapa);

      orderPatch.etapa = etapa;
      orderPatch.concluido_em = nextIsFinal
        ? (currentIsFinal ? pedido.concluido_em ?? new Date().toISOString() : new Date().toISOString())
        : null;
      orderPatch.cancelado_em = etapa === "CANCELADO"
        ? (pedido.etapa === "CANCELADO" ? pedido.cancelado_em ?? new Date().toISOString() : new Date().toISOString())
        : null;
    }

    const itemChanges = pedido.produto === "ONVOX"
      ? itemOps.flatMap((draft) => {
          const original = pedido.closer_pedido_itens?.find((item) => item.id === draft.id);
          if (!original) return [];
          const patch: Record<string, unknown> = {};
          if (!same(draft.data_portabilidade, original.data_portabilidade)) patch.data_portabilidade = draft.data_portabilidade || null;
          if (canUpdatePortabilityStatus && !same(draft.status_portabilidade.trim(), original.status_portabilidade)) {
            patch.status_portabilidade = draft.status_portabilidade.trim() || null;
          }
          return Object.keys(patch).length ? [{ id: draft.id, patch }] : [];
        })
      : [];

    if (!Object.keys(orderPatch).length && !itemChanges.length) return;

    setSaving(true);
    const db = supabase as any;
    try {
      if (Object.keys(orderPatch).length) {
        orderPatch.updated_by = user.id;
        if (!pedido.bko_id && isBko) {
          orderPatch.bko_id = user.id;
          orderPatch.bko_nome = profile?.nome_completo ?? null;
        }

        const update = await db
          .from("closer_pedidos")
          .update(orderPatch)
          .eq("id", pedido.id)
          .select("numero,etapa,bko_id,bko_nome,data_recebimento,data_envio,data_assinatura,data_implantacao,data_ativacao,data_entrega,observacao_bko,erro,concluido_em,cancelado_em,updated_at")
          .single();
        if (update.error) throw update.error;

        setPedido((current) => current ? { ...current, ...update.data } : current);
      }

      for (const change of itemChanges) {
        const result = await db
          .from("closer_pedido_itens")
          .update(change.patch)
          .eq("id", change.id)
          .select("id,data_portabilidade,status_portabilidade")
          .single();
        if (result.error) throw result.error;

        setPedido((current) => current ? {
          ...current,
          closer_pedido_itens: (current.closer_pedido_itens ?? []).map((item) =>
            item.id === change.id ? { ...item, ...result.data } : item
          ),
        } : current);
      }
    } catch (e: any) {
      toast.error("Não foi possível salvar automaticamente", { description: e?.message ?? String(e) });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!pedido || !operational || saving) return;

    const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? "") === (b ?? "");
    const orderChanged =
      !same(dataRecebimento, pedido.data_recebimento) ||
      !same(dataEnvio, pedido.data_envio) ||
      !same(dataAssinatura, pedido.data_assinatura) ||
      !same(dataImplantacao, pedido.data_implantacao) ||
      !same(dataAtivacao, pedido.data_ativacao) ||
      !same(dataEntrega, pedido.data_entrega) ||
      !same(observacaoBko.trim(), pedido.observacao_bko) ||
      !same(erro.trim(), pedido.erro) ||
      (canUpdateStage && etapa !== pedido.etapa);

    const itemChanged = pedido.produto === "ONVOX" && itemOps.some((draft) => {
      const original = pedido.closer_pedido_itens?.find((item) => item.id === draft.id);
      return original && (
        !same(draft.data_portabilidade, original.data_portabilidade) ||
        (canUpdatePortabilityStatus && !same(draft.status_portabilidade.trim(), original.status_portabilidade))
      );
    });

    if (!orderChanged && !itemChanged) return;

    const timer = window.setTimeout(() => {
      void persistOperationalChanges();
    }, 650);

    return () => window.clearTimeout(timer);
  }, [
    pedido,
    operational,
    canUpdateStage,
    canUpdatePortabilityStatus,
    etapa,
    dataRecebimento,
    dataEnvio,
    dataAssinatura,
    dataImplantacao,
    dataAtivacao,
    dataEntrega,
    observacaoBko,
    erro,
    itemOps,
    saving,
  ]);

  function openInformationEditor() {
    if (!pedido || !cliente || !canEditInformation) return;
    setInformationDraft({
      razao_social: cliente.razao_social ?? "",
      cnpj: cliente.cnpj ?? "",
      contato: cliente.contato ?? "",
      telefone: cliente.telefone ?? "",
      email: cliente.email ?? "",
      origem_lead: cliente.origem_lead ?? "",
      produto: pedido.produto,
      observacao: pedido.observacao ?? "",
    });
    setInformationEditing(true);
  }

  async function saveInformation() {
    if (!pedido || !canEditInformation || informationSaving) return;

    const required = [
      informationDraft.razao_social,
      informationDraft.cnpj,
      informationDraft.contato,
      informationDraft.telefone,
      informationDraft.email,
      informationDraft.origem_lead,
    ];
    if (required.some((value) => !value.trim())) {
      toast.error("Preencha todos os dados obrigatórios.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(informationDraft.email.trim())) {
      toast.error("Informe um e-mail válido.");
      return;
    }

    setInformationSaving(true);
    const db = supabase as any;
    const result = await db.rpc("closer_editar_informacoes_pedido", {
      p_pedido_id: pedido.id,
      p_razao_social: informationDraft.razao_social.trim(),
      p_cnpj: informationDraft.cnpj.trim(),
      p_contato: informationDraft.contato.trim(),
      p_telefone: informationDraft.telefone.trim(),
      p_email: informationDraft.email.trim(),
      p_origem_lead: informationDraft.origem_lead.trim(),
      p_produto: informationDraft.produto,
      p_observacao: informationDraft.observacao.trim(),
    });

    if (result.error) {
      toast.error("Não foi possível salvar as informações", { description: result.error.message });
      setInformationSaving(false);
      return;
    }

    setInformationEditing(false);
    setInformationSaving(false);
    toast.success("Informações atualizadas", { description: "As alterações foram registradas no histórico do pedido." });
    await load();
  }

  function clearPendingChatImage() {
    if (pendingChatImagePreview) URL.revokeObjectURL(pendingChatImagePreview);
    setPendingChatImage(null);
    setPendingChatImagePreview(null);
    if (chatImageInputRef.current) chatImageInputRef.current.value = "";
  }

  function setChatImage(file: File | null) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Cole ou selecione uma imagem PNG ou JPG.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("A imagem ultrapassa 10 MB.");
      return;
    }
    if (pendingChatImagePreview) URL.revokeObjectURL(pendingChatImagePreview);
    setPendingChatImage(file);
    setPendingChatImagePreview(URL.createObjectURL(file));
  }

  function handleChatPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/"));
    if (!image) return;
    event.preventDefault();
    setChatImage(image);
  }

  function openOnvoxFieldEditor(
    scope: "cliente" | "pedido",
    field: string,
    label: string,
    value: string | null | undefined,
  ) {
    if (!pedido || pedido.produto !== "ONVOX" || !canEditOnvoxInfo) return;
    setOnvoxFieldEdit({ scope, field, label, value: value ?? "" });
  }

  async function saveOnvoxFieldEditor() {
    if (!pedido || pedido.produto !== "ONVOX" || !onvoxFieldEdit || !canEditOnvoxInfo || onvoxFieldSaving) return;
    const value = onvoxFieldEdit.value.trim();
    if (["razao_social", "cnpj", "representante_legal_nome"].includes(onvoxFieldEdit.field) && !value) {
      return toast.error(`${onvoxFieldEdit.label} não pode ficar vazio.`);
    }
    if (onvoxFieldEdit.field.includes("email") && value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      return toast.error("Informe um e-mail válido.");
    }

    setOnvoxFieldSaving(true);
    const db = supabase as any;
    try {
      if (onvoxFieldEdit.scope === "cliente") {
        if (!cliente?.id) throw new Error("Cliente não encontrado.");
        const result = await db
          .from("closer_clientes")
          .update({ [onvoxFieldEdit.field]: onvoxFieldEdit.field === "email" ? value.toLowerCase() || null : value || null })
          .eq("id", cliente.id)
          .select("id")
          .single();
        if (result.error) throw result.error;
      } else {
        const result = await db
          .from("closer_pedidos")
          .update({
            [onvoxFieldEdit.field]: onvoxFieldEdit.field.includes("email") ? value.toLowerCase() || null : value || null,
            updated_by: user?.id ?? null,
          })
          .eq("id", pedido.id)
          .select("id")
          .single();
        if (result.error) throw result.error;
      }

      setOnvoxFieldEdit(null);
      toast.success(`${onvoxFieldEdit.label} atualizado.`);
      await load();
    } catch (e: any) {
      toast.error("Não foi possível atualizar o campo", { description: e?.message ?? String(e) });
    } finally {
      setOnvoxFieldSaving(false);
    }
  }

  function openOnvoxEdit() {
    if (!pedido || pedido.produto !== "ONVOX" || !canEditOnvoxOrder) return;
    const hasGestor = Boolean(
      pedido.gestor_tecnico_nome
      || pedido.gestor_tecnico_email
      || pedido.gestor_tecnico_telefone
      || pedido.gestor_tecnico_email_faturas
    );
    const currentItems = (pedido.closer_pedido_itens ?? []).map((item) => {
      const isQty = item.produto_item === "RAMAIS" || item.produto_item === "DID";
      const quantidade = Math.max(1, Number(item.quantidade || 1));
      const quantidadeCalculo = onvoxDidUsaNumero(item.tipo_pedido, item.produto_item) ? 1 : quantidade;
      const total = Number(item.receita || 0);
      return {
        id: item.id,
        tipo_pedido: item.tipo_pedido || "NOVO",
        produto_item: item.produto_item,
        quantidade: String(quantidadeCalculo),
        valor_unitario: isQty ? String(total / quantidadeCalculo) : "",
        receita: isQty ? "" : String(total),
        operadora_doadora: item.operadora_doadora || "",
        ddd: item.ddd || "",
        numero: item.numero || "",
        equipamento: item.equipamento || item.modelo || "",
        quantidade_equipamentos: item.quantidade_equipamentos ? String(item.quantidade_equipamentos) : "",
      };
    });
    setOnvoxEditItems(currentItems.length ? currentItems : [{
      tipo_pedido: "NOVO",
      produto_item: "DID",
      quantidade: "1",
      valor_unitario: "",
      receita: "",
      operadora_doadora: "",
      ddd: "",
      numero: "",
      equipamento: "",
      quantidade_equipamentos: "",
    }]);
    setOnvoxEditObservacao(pedido.observacao ?? "");
    setOnvoxEditRepresentanteNome(pedido.representante_legal_nome ?? "");
    setOnvoxEditRepresentanteEmail(pedido.representante_legal_email ?? "");
    setOnvoxEditRepresentanteTelefone(pedido.representante_legal_telefone ?? "");
    setOnvoxEditGestorAtivo(hasGestor);
    setOnvoxEditGestorNome(pedido.gestor_tecnico_nome ?? "");
    setOnvoxEditGestorEmail(pedido.gestor_tecnico_email ?? "");
    setOnvoxEditGestorTelefone(pedido.gestor_tecnico_telefone ?? "");
    setOnvoxEditGestorEmailFaturas(pedido.gestor_tecnico_email_faturas ?? "");
    setOnvoxEditOpen(true);
  }

  async function saveOnvoxEdit() {
    if (!pedido || pedido.produto !== "ONVOX" || !canEditOnvoxOrder || onvoxEditSaving) return;
    if (!onvoxEditItems.length) return toast.error("Adicione pelo menos um item ONVOX.");
    if (onvoxEditRepresentanteNome.trim().length < 2) return toast.error("Informe o nome do Representante Legal.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(onvoxEditRepresentanteEmail.trim())) {
      return toast.error("Informe um e-mail válido para o Representante Legal.");
    }
    if (onvoxEditRepresentanteTelefone.replace(/\D/g, "").length < 10) {
      return toast.error("Informe o telefone do Representante Legal com DDD.");
    }
    if (onvoxEditGestorAtivo) {
      if (onvoxEditGestorNome.trim().length < 2) return toast.error("Informe o nome do Gestor Técnico.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(onvoxEditGestorEmail.trim())) return toast.error("Informe um e-mail válido para o Gestor Técnico.");
      if (onvoxEditGestorTelefone.replace(/\D/g, "").length < 10) return toast.error("Informe o telefone do Gestor Técnico com DDD.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(onvoxEditGestorEmailFaturas.trim())) return toast.error("Informe um e-mail válido para envio das faturas mensais.");
    }

    for (const item of onvoxEditItems) {
      if (!item.produto_item) return toast.error("Selecione o produto de todos os itens.");
      if (!onvoxProdutosPermitidos(item.tipo_pedido).includes(item.produto_item)) {
        return toast.error("Existe um item incompatível com o tipo de pedido selecionado.");
      }
      if ((item.produto_item === "DID" || item.produto_item === "RAMAIS") && Number(item.valor_unitario || 0) < 0) {
        return toast.error("Informe um valor unitário válido.");
      }
      if (item.produto_item === "DID" && !somenteDigitosOnvox(item.ddd)) {
        return toast.error("Informe o DDD de todos os itens DID.");
      }
      if (onvoxDidUsaNumero(item.tipo_pedido, item.produto_item) && !somenteDigitosOnvox(item.numero)) {
        return toast.error("Informe o número de todos os DID de portabilidade.");
      }
    }

    setOnvoxEditSaving(true);
    const db = supabase as any;
    try {
      const total = onvoxEditItems.reduce((sum, item) => sum + onvoxValorTotalLinha(
        item.produto_item,
        onvoxQuantidadePersistida(item.produto_item, item.quantidade, item.tipo_pedido),
        item.valor_unitario,
        item.receita,
      ), 0);

      const pedidoResult = await db
        .from("closer_pedidos")
        .update({
          observacao: onvoxEditObservacao.trim() || null,
          representante_legal_nome: onvoxEditRepresentanteNome.trim(),
          representante_legal_email: onvoxEditRepresentanteEmail.trim().toLowerCase(),
          representante_legal_telefone: onvoxEditRepresentanteTelefone.trim(),
          gestor_tecnico_nome: onvoxEditGestorAtivo ? onvoxEditGestorNome.trim() || null : null,
          gestor_tecnico_email: onvoxEditGestorAtivo ? onvoxEditGestorEmail.trim().toLowerCase() || null : null,
          gestor_tecnico_telefone: onvoxEditGestorAtivo ? onvoxEditGestorTelefone.trim() || null : null,
          gestor_tecnico_email_faturas: onvoxEditGestorAtivo ? onvoxEditGestorEmailFaturas.trim().toLowerCase() || null : null,
          receita_total: total,
          updated_by: user?.id ?? null,
        })
        .eq("id", pedido.id)
        .select("id")
        .single();
      if (pedidoResult.error) throw pedidoResult.error;

      const existingIds = new Set((pedido.closer_pedido_itens ?? []).map((item) => item.id));
      const keptIds = new Set(onvoxEditItems.map((item) => item.id).filter(Boolean) as string[]);
      const removedIds = Array.from(existingIds).filter((id) => !keptIds.has(id));

      if (removedIds.length) {
        const removed = await db.from("closer_pedido_itens").delete().in("id", removedIds);
        if (removed.error) throw removed.error;
      }

      for (const item of onvoxEditItems) {
        const payload = {
          tipo_pedido: item.tipo_pedido || null,
          produto_item: item.produto_item,
          quantidade: onvoxQuantidadePersistida(item.produto_item, item.quantidade, item.tipo_pedido),
          receita: onvoxValorTotalLinha(
            item.produto_item,
            onvoxQuantidadePersistida(item.produto_item, item.quantidade, item.tipo_pedido),
            item.valor_unitario,
            item.receita,
          ),
          operadora_doadora: ["PORTABILIDADE", "PORTABILIDADE PF"].includes(item.tipo_pedido) ? item.operadora_doadora.trim() || null : null,
          ddd: item.produto_item === "DID" ? somenteDigitosOnvox(item.ddd) || null : null,
          numero: onvoxDidUsaNumero(item.tipo_pedido, item.produto_item)
            ? somenteDigitosOnvox(item.numero) || null
            : null,
          equipamento: item.produto_item === "APARELHO" ? item.equipamento.trim() || null : null,
          modelo: null,
          quantidade_equipamentos: item.produto_item === "APARELHO" && item.quantidade_equipamentos
            ? Math.max(1, Number(item.quantidade_equipamentos))
            : null,
        };

        if (item.id) {
          const updated = await db.from("closer_pedido_itens").update(payload).eq("id", item.id);
          if (updated.error) throw updated.error;
        } else {
          const inserted = await db.from("closer_pedido_itens").insert({
            pedido_id: pedido.id,
            ...payload,
            created_by: user?.id ?? null,
          });
          if (inserted.error) throw inserted.error;
        }
      }

      setOnvoxEditOpen(false);
      toast.success("Pedido ONVOX atualizado.");
      await load();
    } catch (e: any) {
      toast.error("Não foi possível atualizar o pedido ONVOX", { description: e?.message ?? String(e) });
    } finally {
      setOnvoxEditSaving(false);
    }
  }

  function openTakeEdit() {
    if (!pedido || pedido.produto !== "TAKE_FLOW" || !canEditTakeOrder) return;
    const hasGestor = Boolean(
      pedido.gestor_tecnico_nome
      || pedido.gestor_tecnico_email
      || pedido.gestor_tecnico_telefone
      || pedido.gestor_tecnico_email_faturas
    );
    setTakeEdit({
      apiTipo: pedido.take_api_tipo ?? "",
      receita: pedido.receita_total == null ? "" : String(pedido.receita_total),
      conexoes: pedido.take_conexoes == null ? "" : String(pedido.take_conexoes),
      usuarios: pedido.take_usuarios == null ? "" : String(pedido.take_usuarios),
      implantacao: pedido.take_valor_implantacao == null ? "" : String(pedido.take_valor_implantacao),
      observacao: pedido.observacao ?? "",
      representanteNome: pedido.representante_legal_nome ?? "",
      representanteEmail: pedido.representante_legal_email ?? "",
      representanteTelefone: pedido.representante_legal_telefone ?? "",
      gestorAtivo: hasGestor,
      gestorNome: pedido.gestor_tecnico_nome ?? "",
      gestorEmail: pedido.gestor_tecnico_email ?? "",
      gestorTelefone: pedido.gestor_tecnico_telefone ?? "",
      gestorEmailFaturas: pedido.gestor_tecnico_email_faturas ?? "",
      linhas: takeConnections.length
        ? takeConnections.map((linha) => ({ ddd: linha.ddd, numero: linha.numero }))
        : [{ ddd: "", numero: "" }],
    });
    setTakeEditOpen(true);
  }

  async function saveTakeEdit() {
    if (!pedido || pedido.produto !== "TAKE_FLOW" || !canEditTakeOrder || takeEditSaving) return;

    if (!takeApiTipoValido(takeEdit.apiTipo)) return toast.error("Selecione o Tipo de API.");
    if (takeEdit.representanteNome.trim().length < 2) return toast.error("Informe o nome do Representante Legal.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(takeEdit.representanteEmail.trim())) {
      return toast.error("Informe um e-mail válido para o Representante Legal.");
    }
    if (takeEdit.representanteTelefone.replace(/\D/g, "").length < 10) {
      return toast.error("Informe o telefone do Representante Legal com DDD.");
    }
    if (takeEdit.gestorAtivo) {
      if (takeEdit.gestorNome.trim().length < 2) return toast.error("Informe o nome do Gestor Técnico.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(takeEdit.gestorEmail.trim())) {
        return toast.error("Informe um e-mail válido para o Gestor Técnico.");
      }
      if (takeEdit.gestorTelefone.replace(/\D/g, "").length < 10) {
        return toast.error("Informe o telefone do Gestor Técnico com DDD.");
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(takeEdit.gestorEmailFaturas.trim())) {
        return toast.error("Informe um e-mail válido para envio das faturas mensais.");
      }
    }

    const linhasUsadas = takeEdit.linhas.filter((linha) => linha.ddd || linha.numero);
    if (linhasUsadas.some((linha) => !linha.ddd || !linha.numero)) {
      return toast.error("Preencha DDD e Número em todas as linhas de conexão utilizadas.");
    }

    setTakeEditSaving(true);
    const db = supabase as any;
    try {
      const update = await db
        .from("closer_pedidos")
        .update({
          take_api_tipo: takeEdit.apiTipo,
          receita_total: Number(takeEdit.receita || 0),
          take_conexoes: takeEdit.conexoes ? Number(takeEdit.conexoes) : null,
          take_usuarios: takeEdit.usuarios ? Number(takeEdit.usuarios) : null,
          take_valor_implantacao: takeEdit.implantacao ? Number(takeEdit.implantacao) : null,
          observacao: takeEdit.observacao.trim() || null,
          representante_legal_nome: takeEdit.representanteNome.trim(),
          representante_legal_email: takeEdit.representanteEmail.trim().toLowerCase(),
          representante_legal_telefone: takeEdit.representanteTelefone.trim(),
          gestor_tecnico_nome: takeEdit.gestorAtivo ? takeEdit.gestorNome.trim() || null : null,
          gestor_tecnico_email: takeEdit.gestorAtivo ? takeEdit.gestorEmail.trim().toLowerCase() || null : null,
          gestor_tecnico_telefone: takeEdit.gestorAtivo ? takeEdit.gestorTelefone.trim() || null : null,
          gestor_tecnico_email_faturas: takeEdit.gestorAtivo ? takeEdit.gestorEmailFaturas.trim().toLowerCase() || null : null,
          updated_by: user?.id ?? null,
        })
        .eq("id", pedido.id)
        .select("id")
        .single();
      if (update.error) throw update.error;

      const removed = await db.from("closer_take_conexoes").delete().eq("pedido_id", pedido.id);
      if (removed.error) throw removed.error;

      if (linhasUsadas.length) {
        const inserted = await db.from("closer_take_conexoes").insert(
          linhasUsadas.map((linha, index) => ({
            pedido_id: pedido.id,
            ddd: somenteDigitosTake(linha.ddd),
            numero: somenteDigitosTake(linha.numero),
            ordem: index,
          })),
        );
        if (inserted.error) throw inserted.error;
      }

      setTakeEditOpen(false);
      toast.success("Pedido TAKE atualizado.");
      await load();
    } catch (e: any) {
      toast.error("Não foi possível atualizar o pedido TAKE", { description: e?.message ?? String(e) });
    } finally {
      setTakeEditSaving(false);
    }
  }

  async function saveNumber() {
    if (!pedido || !canEditNumber || numberSaving) return;
    const nextNumber = Number(numberDraft.replace(/\D/g, ""));
    if (!Number.isInteger(nextNumber) || nextNumber <= 0) {
      toast.error("Informe um número de pedido válido.");
      return;
    }
    if (nextNumber === pedido.numero) {
      setNumberEditing(false);
      return;
    }

    setNumberSaving(true);
    const db = supabase as any;
    const result = await db
      .from("closer_pedidos")
      .update({ numero: nextNumber, updated_by: user?.id ?? null })
      .eq("id", pedido.id)
      .select("numero,updated_at")
      .single();

    if (result.error) {
      toast.error(
        result.error.code === "23505" ? "Esse número já está sendo usado por outro pedido." : "Não foi possível alterar o número.",
        { description: result.error.code === "23505" ? undefined : result.error.message },
      );
      setNumberSaving(false);
      return;
    }

    setPedido((current) => current ? { ...current, ...result.data } : current);
    setNumberDraft(String(result.data.numero));
    setNumberEditing(false);
    setNumberSaving(false);
    toast.success(`Pedido renumerado para #${String(result.data.numero).padStart(4, "0")}.`);
  }

  async function sendMessage() {
    if (!pedido || !user || !canSendMessage || sendingMessage || (!messageText.trim() && !pendingChatImage)) return;
    setSendingMessage(true);
    const db = supabase as any;
    let imagePath: string | null = null;

    try {
      if (pendingChatImage) {
        const imageName = pendingChatImage.name || `imagem-${Date.now()}.png`;
        imagePath = `${pedido.id}/chat/${crypto.randomUUID()}-${safeName(imageName)}`;
        const upload = await supabase.storage.from(BUCKET).upload(imagePath, pendingChatImage, {
          cacheControl: "3600",
          upsert: false,
          contentType: pendingChatImage.type,
        });
        if (upload.error) throw upload.error;
      }

      const result = await db
        .from("closer_pedido_mensagens")
        .insert({
          pedido_id: pedido.id,
          mensagem: messageText.trim(),
          imagem_storage_path: imagePath,
          imagem_nome_original: pendingChatImage?.name || null,
          imagem_mime_type: pendingChatImage?.type || null,
          imagem_tamanho_bytes: pendingChatImage?.size || null,
        })
        .select("*")
        .single();

      if (result.error) {
        if (imagePath) await supabase.storage.from(BUCKET).remove([imagePath]);
        throw result.error;
      }

      const message = result.data as MensagemPedido;
      let imagem_url: string | null = null;
      if (message.imagem_storage_path) {
        const signed = await supabase.storage.from(BUCKET).createSignedUrl(message.imagem_storage_path, 60 * 60);
        imagem_url = signed.data?.signedUrl ?? null;
      }
      setMessages((current) => [...current, { ...message, imagem_url }]);
      setMessageText("");
      clearPendingChatImage();
    } catch (e: any) {
      toast.error("Não foi possível enviar a mensagem", { description: e?.message ?? String(e) });
    } finally {
      setSendingMessage(false);
    }
  }

  async function deletePedido() {
    if (!pedido || !isAdmin) return;

    const numero = String(pedido.numero ?? "—").padStart(4, "0");
    const confirmou = window.confirm(
      `Excluir definitivamente o pedido #${numero}?\n\nEsta ação removerá itens, histórico, conversa e arquivos do pedido. O cadastro do cliente será preservado. Esta ação não pode ser desfeita.`,
    );

    if (!confirmou) return;

    setDeleting(true);
    const db = supabase as any;

    try {
      const [docsResult, chatImagesResult, noteImagesResult] = await Promise.all([
        db.from("closer_pedido_documentos").select("storage_path").eq("pedido_id", pedido.id),
        db.from("closer_pedido_mensagens").select("imagem_storage_path").eq("pedido_id", pedido.id),
        db.from("closer_pedido_notas").select("imagem_storage_path").eq("pedido_id", pedido.id),
      ]);

      if (docsResult.error) throw docsResult.error;
      if (chatImagesResult.error) throw chatImagesResult.error;
      if (noteImagesResult.error) throw noteImagesResult.error;

      const storagePaths = [
        ...(docsResult.data ?? []).map((row: any) => row.storage_path),
        ...(chatImagesResult.data ?? []).map((row: any) => row.imagem_storage_path),
        ...(noteImagesResult.data ?? []).map((row: any) => row.imagem_storage_path),
      ].filter(Boolean);

      if (storagePaths.length > 0) {
        const storageResult = await supabase.storage.from(BUCKET).remove(storagePaths);
        if (storageResult.error) throw storageResult.error;
      }

      const deleteResult = await db
        .from("closer_pedidos")
        .delete()
        .eq("id", pedido.id)
        .select("id");

      if (deleteResult.error) throw deleteResult.error;
      if (!deleteResult.data?.length) {
        throw new Error("O pedido não foi excluído. A exclusão é permitida somente para Administradores.");
      }

      toast.success(`Pedido #${numero} excluído.`);
      navigate({ to: "/operacao-closer" });
    } catch (e: any) {
      toast.error("Não foi possível excluir o pedido", { description: e?.message ?? String(e) });
    } finally {
      setDeleting(false);
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    if (!pedido || !user || !canUpload) return;
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    const db = supabase as any;
    try {
      for (const file of list) {
        const mime = mimeFor(file);
        if (!mime) throw new Error(`Formato não permitido: ${file.name}`);
        if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name} ultrapassa 10 MB.`);

        const path = `${pedido.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
        const upload = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: mime,
        });
        if (upload.error) throw upload.error;

        const insert = await db.from("closer_pedido_documentos").insert({
          pedido_id: pedido.id,
          arquivo_nome_original: file.name,
          storage_path: path,
          mime_type: mime,
          tamanho_bytes: file.size,
          enviado_por: user.id,
          enviado_por_nome: profile?.nome_completo ?? user.email ?? "Usuário",
          enviado_por_role: primaryRole,
        });
        if (insert.error) {
          await supabase.storage.from(BUCKET).remove([path]);
          throw insert.error;
        }
      }
      toast.success(list.length === 1 ? "Arquivo enviado." : `${list.length} arquivos enviados.`);
      await load();
    } catch (e: any) {
      toast.error("Falha ao enviar arquivo", { description: e?.message ?? String(e) });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function previewDocument(doc: Documento) {
    const result = await supabase.storage.from(BUCKET).download(doc.storage_path);
    if (result.error) {
      toast.error("Falha ao visualizar arquivo", { description: result.error.message });
      return;
    }
    if (documentPreview?.url) URL.revokeObjectURL(documentPreview.url);
    setDocumentPreview({ doc, url: URL.createObjectURL(result.data) });
  }

  async function downloadDocument(doc: Documento) {
    const result = await supabase.storage.from(BUCKET).download(doc.storage_path);
    if (result.error) return toast.error("Falha ao baixar arquivo", { description: result.error.message });
    const url = URL.createObjectURL(result.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.arquivo_nome_original;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function deleteDocument(doc: Documento) {
    if (!user) return;
    const canDelete = operational || doc.enviado_por === user.id;
    if (!canDelete) return;
    if (!window.confirm(`Excluir o arquivo "${doc.arquivo_nome_original}"?`)) return;
    const storage = await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    if (storage.error) return toast.error("Falha ao remover arquivo", { description: storage.error.message });
    const db = supabase as any;
    const meta = await db.from("closer_pedido_documentos").delete().eq("id", doc.id);
    if (meta.error) return toast.error("Arquivo removido do Storage, mas o registro não pôde ser excluído.", { description: meta.error.message });
    toast.success("Arquivo excluído.");
    await load();
  }


  if (loading) {
    return <div className="p-12 text-center text-sm text-muted-foreground">Carregando pedido…</div>;
  }

  if (!pedido) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={voltarPaginaAnterior}>
          <ArrowLeft className="size-4 mr-2" /> Voltar
        </Button>
        <div className="mt-12 text-center text-muted-foreground">Pedido não encontrado ou sem acesso.</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <section
        className={cn(
          "relative overflow-hidden border border-white/10 text-white shadow-xl",
          "rounded-2xl px-3 py-2 sm:px-4",
        )}
        style={{
          background: BRAND_META[pedido.produto].surface,
          boxShadow: `0 22px 60px -38px ${BRAND_META[pedido.produto].glow}`,
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(255,255,255,.18),transparent_34%)]" />

        {pedido.produto === "TAKE_FLOW" ? (
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={voltarPaginaAnterior}
              className="h-8 border-white/20 bg-black/10 px-2.5 text-white hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="size-3.5 mr-1.5" /> Voltar
            </Button>

            {/* CLOSER_CLIENTE_HEADER */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 max-w-[42%] -translate-x-1/2 -translate-y-1/2 truncate px-2 text-center font-display text-sm font-black tracking-wide text-white drop-shadow sm:max-w-[50%] sm:text-base">
              {cliente?.razao_social || "—"}
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                <div className="rounded-lg border border-white/20 bg-black/10 px-2.5 py-1.5 text-[11px]">
                  <span className="text-white/55">Closer:</span>
                  <span className="ml-1.5 font-semibold text-white">{pedido.closer_nome || "—"}</span>
                </div>
                <div className="rounded-lg border border-white/20 bg-black/10 px-2.5 py-1.5 text-[11px]">
                  <span className="text-white/55">BKO:</span>
                  <span className="ml-1.5 font-semibold text-white">{pedido.bko_nome || "Não atribuído"}</span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8 border-white/20 bg-black/10 text-white hover:bg-white/10 hover:text-white"
                    title="Ações do pedido"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44">
                  {canEditTakeOrder && (
                    <DropdownMenuItem onClick={openTakeEdit}>
                      <Pencil className="mr-2 size-3.5" /> Editar pedido
                    </DropdownMenuItem>
                  )}
                  {isAdmin && canEditTakeOrder && <DropdownMenuSeparator />}
                  {isAdmin && (
                    <DropdownMenuItem
                      onClick={() => void deletePedido()}
                      disabled={deleting}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 size-3.5" />
                      {deleting ? "Excluindo…" : "Excluir pedido"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : (
          /* ONVOX_HEADER_COMPACTO */
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={voltarPaginaAnterior}
              className="h-8 border-white/20 bg-black/10 px-2.5 text-white hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="size-3.5 mr-1.5" /> Voltar
            </Button>

            {/* CLOSER_CLIENTE_HEADER */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 max-w-[42%] -translate-x-1/2 -translate-y-1/2 truncate px-2 text-center font-display text-sm font-black tracking-wide text-white drop-shadow sm:max-w-[50%] sm:text-base">
              {cliente?.razao_social || "—"}
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                <div className="rounded-lg border border-white/20 bg-black/10 px-2.5 py-1.5 text-[11px]">
                  <span className="text-white/55">Closer:</span>
                  <span className="ml-1.5 font-semibold text-white">{pedido.closer_nome || "—"}</span>
                </div>
                <div className="rounded-lg border border-white/20 bg-black/10 px-2.5 py-1.5 text-[11px]">
                  <span className="text-white/55">BKO:</span>
                  <span className="ml-1.5 font-semibold text-white">{pedido.bko_nome || "Não atribuído"}</span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8 border-white/20 bg-black/10 text-white hover:bg-white/10 hover:text-white"
                    title="Ações do pedido"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44">
                  {canEditOnvoxOrder && (
                    <DropdownMenuItem onClick={openOnvoxEdit}>
                      <Pencil className="mr-2 size-3.5" /> Editar pedido ONVOX
                    </DropdownMenuItem>
                  )}
                  {isAdmin && canEditOnvoxOrder && <DropdownMenuSeparator />}
                  {isAdmin && (
                    <DropdownMenuItem
                      onClick={() => void deletePedido()}
                      disabled={deleting}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 size-3.5" />
                      {deleting ? "Excluindo…" : "Excluir pedido"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </section>

      {pedido.produto === "TAKE_FLOW" ? (
        <Tabs defaultValue="resumo" className="space-y-4">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto border border-border bg-surface-1 p-1">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="cliente">Cliente</TabsTrigger>
            <TabsTrigger value="itens">Produtos / Itens</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="mt-0 space-y-4">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Info label="Tipo de API" value={pedido.take_api_tipo || "—"} />
              <Info label="Receita" value={brl(pedido.receita_total)} />
              <Info label="Qtd. Conexões" value={String(pedido.take_conexoes ?? "—")} />
              <Info label="Qtd. Usuários" value={String(pedido.take_usuarios ?? "—")} />
              <Info label="Implantação" value={brl(pedido.take_valor_implantacao)} />
            </section>

            <section className="rounded-xl border border-border bg-card p-4 space-y-4">
              <SectionTitle title="Acompanhamento BKO" accent={TAKE} />
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Etapa">
                  <CloserOptionSelect
                    category={stageCategory}
                    value={etapa}
                    onValueChange={handleStageChange}
                    canManage={canManageOptions}
                    disabled={!canUpdateStage}
                    label="Etapa"
                    controller={optionCatalog}
                  />
                </Field>
                <Field label="Data recebimento"><Input type="date" value={dataRecebimento} disabled={!operational} onChange={(e) => setDataRecebimento(e.target.value)} /></Field>
                <Field label="Data envio"><Input type="date" value={dataEnvio} disabled={!operational} onChange={(e) => setDataEnvio(e.target.value)} /></Field>
                <Field label="Data assinatura"><Input type="date" value={dataAssinatura} disabled={!operational} onChange={(e) => setDataAssinatura(e.target.value)} /></Field>
                <Field label="Data implantação"><Input type="date" value={dataImplantacao} disabled={!operational} onChange={(e) => setDataImplantacao(e.target.value)} /></Field>
                <Field label="Data ativação"><Input type="date" value={dataAtivacao} disabled={!operational} onChange={(e) => setDataAtivacao(e.target.value)} /></Field>
                <Field label="Data entrega"><Input type="date" value={dataEntrega} disabled={!operational} onChange={(e) => setDataEntrega(e.target.value)} /></Field>
              </div>
              <StageTrack items={stageOptions} currentValue={etapa} accent={TAKE} showDescription={false} />
            </section>
          </TabsContent>

          <TabsContent value="cliente" className="mt-0">
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="mb-4 font-semibold">CLIENTE / REPRESENTANTE / GESTOR TÉCNICO</div>
              <div className="space-y-4">
                <InfoGroup title="Cliente">
                  <InfoLine label="Razão Social" value={cliente?.razao_social || "—"} />
                  <InfoLine label="CNPJ" value={cliente?.cnpj || "—"} />
                </InfoGroup>
                <InfoGroup title="Representante Legal">
                  <InfoLine label="Nome" value={pedido.representante_legal_nome || "—"} />
                  <InfoLine label="E-mail" value={pedido.representante_legal_email || "—"} />
                  <InfoLine label="Telefone" value={pedido.representante_legal_telefone || "—"} />
                </InfoGroup>
                <InfoGroup title="Gestor Técnico">
                  {pedido.gestor_tecnico_nome
                    || pedido.gestor_tecnico_email
                    || pedido.gestor_tecnico_telefone
                    || pedido.gestor_tecnico_email_faturas ? (
                    <>
                      <InfoLine label="Nome" value={pedido.gestor_tecnico_nome || "—"} />
                      <InfoLine label="E-mail" value={pedido.gestor_tecnico_email || "—"} />
                      <InfoLine label="Telefone" value={pedido.gestor_tecnico_telefone || "—"} />
                      <InfoLine label="E-mail para faturamento" value={pedido.gestor_tecnico_email_faturas || "—"} />
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">Não informado</div>
                  )}
                </InfoGroup>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="itens" className="mt-0 space-y-4">
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Info label="Tipo de API" value={pedido.take_api_tipo || "—"} />
                <Info label="Receita" value={brl(pedido.receita_total)} />
                <Info label="Qtd. Conexões" value={String(pedido.take_conexoes ?? "—")} />
                <Info label="Qtd. Usuários" value={String(pedido.take_usuarios ?? "—")} />
                <Info label="Implantação" value={brl(pedido.take_valor_implantacao)} />
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm font-semibold">Linhas de conexão</div>
              <div className="mt-3 overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">DDD</th>
                      <th className="px-3 py-2 text-left">Número</th>
                    </tr>
                  </thead>
                  <tbody>
                    {takeConnections.length === 0 ? (
                      <tr><td colSpan={2} className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhuma linha informada.</td></tr>
                    ) : takeConnections.map((linha, index) => (
                      <tr key={linha.id ?? index} className="border-t border-border">
                        <td className="px-3 py-2 font-semibold">{linha.ddd}</td>
                        <td className="px-3 py-2">{linha.numero}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Observação adicionada na criação</div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{pedido.observacao || "—"}</div>
            </section>
          </TabsContent>

          <TabsContent value="chat" className="mt-0">
            <section className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    <MessageCircle className="size-4" style={{ color: TAKE }} />
                    Chat Closer ↔ BKO
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Texto e imagens ficam vinculados a este pedido.</div>
                </div>
                <Badge variant="outline">{messages.length}</Badge>
              </div>

              <div className="max-h-[640px] min-h-[360px] overflow-y-auto rounded-xl border border-border bg-surface-1/45 p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="grid min-h-[330px] place-items-center text-center">
                    <div>
                      <MessageCircle className="mx-auto size-7 text-muted-foreground" />
                      <div className="mt-2 text-sm font-medium">Nenhuma mensagem ainda</div>
                      <div className="mt-1 text-xs text-muted-foreground">Use o campo abaixo para iniciar a conversa.</div>
                    </div>
                  </div>
                ) : messages.map((message) => {
                  const mine = message.user_id === user?.id;
                  return (
                    <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[82%] rounded-2xl border px-3 py-2",
                          mine ? "rounded-br-md text-foreground" : "rounded-bl-md bg-background",
                        )}
                        style={mine ? {
                          borderColor: `${TAKE}55`,
                          background: `linear-gradient(135deg, ${TAKE}22, ${TAKE}0A)`,
                        } : undefined}
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-[10px] font-bold">{message.user_nome || "Usuário"}</span>
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{message.user_role || "—"}</span>
                        </div>
                        {message.imagem_url && (
                          <a href={message.imagem_url} target="_blank" rel="noreferrer" className="mt-2 block">
                            <img
                              src={message.imagem_url}
                              alt={message.imagem_nome_original || "Imagem enviada no chat"}
                              className="max-h-[360px] max-w-full rounded-xl border border-border object-contain"
                            />
                          </a>
                        )}
                        {message.mensagem && <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{message.mensagem}</div>}
                        <div className="mt-1 text-right text-[9px] text-muted-foreground">
                          {new Date(message.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {canSendMessage ? (
                <div className="space-y-2">
                  {pendingChatImagePreview && (
                    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-1 p-2">
                      <img src={pendingChatImagePreview} alt="Imagem pronta para envio" className="h-24 w-28 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold">{pendingChatImage?.name || "Imagem colada"}</div>
                        <div className="mt-1 text-[10px] text-muted-foreground">Será enviada junto com a próxima mensagem.</div>
                      </div>
                      <Button type="button" size="icon" variant="ghost" className="size-8" onClick={clearPendingChatImage}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value.slice(0, 4000))}
                      onPaste={handleChatPaste}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendMessage();
                        }
                      }}
                      placeholder="Escreva uma mensagem ou cole uma imagem aqui…"
                      className="min-h-28 flex-1 resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    />
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="size-11"
                        onClick={() => chatImageInputRef.current?.click()}
                        title="Adicionar imagem"
                      >
                        <ImagePlus className="size-4" />
                      </Button>
                      <input
                        ref={chatImageInputRef}
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={(e) => setChatImage(e.target.files?.[0] ?? null)}
                      />
                      <Button
                        size="icon"
                        className="size-11"
                        style={{ backgroundColor: TAKE }}
                        onClick={() => void sendMessage()}
                        disabled={sendingMessage || (!messageText.trim() && !pendingChatImage)}
                        title="Enviar mensagem"
                      >
                        <Send className="size-4 text-white" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground">Você também pode copiar uma imagem e colar diretamente no campo de mensagem.</div>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-surface-1 px-3 py-2 text-xs text-muted-foreground">
                  Chat disponível para o Consultor/Closer responsável e para o BKO.
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="arquivos" className="mt-0">
            <section className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold"><Paperclip className="size-4 text-[#9d4edd]" /> Arquivos do pedido</div>
                <div className="flex gap-1">
                  {(["TODOS", "CLOSER", "BKO"] as const).map((value) => (
                    <Button key={value} size="sm" variant={docFilter === value ? "default" : "outline"} onClick={() => setDocFilter(value)} className="h-7 text-[10px]">
                      {value === "TODOS" ? `Todos (${documents.length})` : value}
                    </Button>
                  ))}
                </div>
              </div>

              {canUpload && (
                <div
                  className="rounded-xl border border-dashed border-[#7100CA]/50 bg-[#7100CA]/5 p-6 text-center cursor-pointer hover:bg-[#7100CA]/10 transition-colors"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); void uploadFiles(e.dataTransfer.files); }}
                >
                  <Upload className="mx-auto size-7 text-[#9d4edd]" />
                  <div className="mt-2 text-sm font-semibold">{uploading ? "Enviando…" : "Arraste arquivos aqui ou clique para selecionar"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">PDF, DOC, DOCX, XLS, XLSX, PNG ou JPG · até 10 MB</div>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    onChange={(e) => e.target.files && void uploadFiles(e.target.files)}
                  />
                </div>
              )}

              {filteredDocs.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Nenhum arquivo enviado ainda.</div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full min-w-[760px] text-xs">
                    <thead className="bg-surface-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Arquivo</th>
                        <th className="px-3 py-2 text-left">Enviado por</th>
                        <th className="px-3 py-2 text-left">Data</th>
                        <th className="px-3 py-2 text-left">Tamanho</th>
                        <th className="px-3 py-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDocs.map((doc) => (
                        <tr key={doc.id} className="border-t border-border">
                          <td className="px-3 py-2 font-medium">{doc.arquivo_nome_original}</td>
                          <td className="px-3 py-2">
                            <div>{doc.enviado_por_nome || "Usuário"}</div>
                            <div className="text-[9px] uppercase text-muted-foreground">{doc.enviado_por_role || "—"}</div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{new Date(doc.created_at).toLocaleString("pt-BR")}</td>
                          <td className="px-3 py-2 text-muted-foreground">{fileSize(doc.tamanho_bytes)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <Button size="sm" variant="ghost" onClick={() => void previewDocument(doc)} title="Visualizar">
                              <Eye className="size-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => void downloadDocument(doc)} title="Baixar">
                              <Download className="size-3.5" />
                            </Button>
                            {(operational || doc.enviado_por === user?.id) && (
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void deleteDocument(doc)} title="Excluir">
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>
      ) : (
        <>
          {/* ONVOX_SEM_HISTORICO */}
        <Tabs defaultValue="acompanhamento" className="space-y-4">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto border border-border bg-surface-1 p-1">
            <TabsTrigger value="acompanhamento">Acompanhamento BKO</TabsTrigger>
            <TabsTrigger value="itens-onvox">Itens da operação</TabsTrigger>
            <TabsTrigger value="informacoes-onvox">Informações</TabsTrigger>
            <TabsTrigger value="arquivos-onvox">Arquivos</TabsTrigger>
            <TabsTrigger value="chat-onvox">Chat</TabsTrigger>
          </TabsList>

          <TabsContent value="acompanhamento" className="mt-0 space-y-4">
            <section className="rounded-xl border border-border bg-card p-4">
              <SectionTitle title="Acompanhamento BKO" accent={ONVOX} />

              {/* ONVOX_ACOMPANHAMENTO_GRID */}
              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                  <section className="rounded-xl border border-border bg-surface-1/40 p-4">
                    <div className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                      FLUXO OPERACIONAL
                    </div>
                    <StageTrack
                      items={stageOptions}
                      currentValue={etapa}
                      accent={ONVOX}
                      showDescription={false}
                    />
                  </section>

                  <CloserOnvoxNotes
                    pedidoId={pedido.id}
                    closerId={pedido.closer_id}
                  />
                </div>

                <aside className="rounded-xl border border-border bg-surface-1/40 p-4">
                  <div className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    DATAS DO ACOMPANHAMENTO
                  </div>
                  <div className="space-y-3">
                    <Field label="Data recebimento">
                      <Input type="date" value={dataRecebimento} disabled={!operational} onChange={(e) => setDataRecebimento(e.target.value)} />
                    </Field>
                    <Field label="Data envio">
                      <Input type="date" value={dataEnvio} disabled={!operational} onChange={(e) => setDataEnvio(e.target.value)} />
                    </Field>
                    <Field label="Data assinatura">
                      <Input type="date" value={dataAssinatura} disabled={!operational} onChange={(e) => setDataAssinatura(e.target.value)} />
                    </Field>
                    <Field label="Data implantação">
                      <Input type="date" value={dataImplantacao} disabled={!operational} onChange={(e) => setDataImplantacao(e.target.value)} />
                    </Field>
                    <Field label="Data ativação">
                      <Input type="date" value={dataAtivacao} disabled={!operational} onChange={(e) => setDataAtivacao(e.target.value)} />
                    </Field>
                    <Field label="Data entrega">
                      <Input type="date" value={dataEntrega} disabled={!operational} onChange={(e) => setDataEntrega(e.target.value)} />
                    </Field>
                    <Field label="Última alteração">
                      <div className="flex min-h-9 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold">
                        <Clock3 className="size-4 shrink-0 text-muted-foreground" />
                        {new Date(pedido.updated_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </div>
                    </Field>
                  </div>
                </aside>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="itens-onvox" className="mt-0 space-y-4">
            <section className="rounded-2xl border border-[#D92FA0]/30 bg-card overflow-hidden">
              <div className="relative overflow-hidden p-4 border-b border-border">
                <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-[0.055]">
                  <BrandLogo brand="ONVOX" className="h-12 max-w-[220px]" imageClassName="h-full w-auto" />
                </div>
                <div className="relative z-10 flex items-center gap-3">
                  <span className="inline-flex rounded-lg px-3 py-2" style={{ background: BRAND_META.ONVOX.surface }}>
                    <BrandLogo brand="ONVOX" className="h-5 max-w-[110px]" imageClassName="h-full w-auto" />
                  </span>
                  <div className="text-sm font-semibold">Itens da operação</div>
                </div>
              </div>
              <div className="border-b border-border bg-surface-1/45 px-4 py-2 text-xs">
                <span className="font-semibold text-muted-foreground">Plano PABX:</span>{" "}
                <span className="font-bold">{pedido.onvox_plano_pabx || "—"}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-surface-1 text-muted-foreground uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="text-left px-4 py-3">Tipo</th>
                      <th className="text-left px-4 py-3">Produto</th>
                      <th className="text-left px-4 py-3">DDD</th>
                      <th className="text-left px-4 py-3">Número</th>
                      <th className="text-left px-4 py-3">Qtd.</th>
                      <th className="text-left px-4 py-3">Receita</th>
                      <th className="text-left px-4 py-3">Doadora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pedido.closer_pedido_itens ?? []).map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="px-4 py-3 font-medium">{item.tipo_pedido || "—"}</td>
                        <td className="px-4 py-3 font-bold">{item.produto_item}</td>
                        <td className="px-4 py-3">{item.ddd || "—"}</td>
                        <td className="px-4 py-3">{item.numero || "—"}</td>
                        <td className="px-4 py-3">
                          {onvoxDidUsaNumero(item.tipo_pedido, item.produto_item) ? "—" : item.quantidade}
                        </td>
                        <td className="px-4 py-3 font-semibold">{brl(item.receita)}</td>
                        <td className="px-4 py-3">{item.operadora_doadora || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-[#D92FA0]/30 bg-[#D92FA0]/5">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        RECEITA TOTAL
                      </td>
                      <td className="px-4 py-3 font-black text-[#D92FA0]">
                        {brl((pedido.closer_pedido_itens ?? []).reduce((total, item) => total + Number(item.receita || 0), 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Observação do pedido</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{pedido.observacao || "—"}</div>
                </div>
                {canEditOnvoxOrder && <Button size="sm" variant="outline" onClick={openOnvoxEdit}><Pencil className="mr-1.5 size-3.5" /> Editar pedido</Button>}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="informacoes-onvox" className="mt-0">
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="mb-4 font-semibold">CLIENTE / REPRESENTANTE / GESTOR TÉCNICO</div>
              <div className="space-y-4">
                <InfoGroup title="Cliente">
                  <EditableInfoLine label="Razão Social" value={cliente?.razao_social || "—"} canEdit={canEditOnvoxInfo} onEdit={() => openOnvoxFieldEditor("cliente", "razao_social", "Razão Social", cliente?.razao_social)} />
                  <EditableInfoLine label="CNPJ" value={cliente?.cnpj || "—"} canEdit={canEditOnvoxInfo} onEdit={() => openOnvoxFieldEditor("cliente", "cnpj", "CNPJ", cliente?.cnpj)} />
                  <EditableInfoLine label="Contato" value={cliente?.contato || "—"} canEdit={canEditOnvoxInfo} onEdit={() => openOnvoxFieldEditor("cliente", "contato", "Contato", cliente?.contato)} />
                  <EditableInfoLine label="Telefone" value={cliente?.telefone || "—"} canEdit={canEditOnvoxInfo} onEdit={() => openOnvoxFieldEditor("cliente", "telefone", "Telefone", cliente?.telefone)} />
                  <EditableInfoLine label="E-mail" value={cliente?.email || "—"} canEdit={canEditOnvoxInfo} onEdit={() => openOnvoxFieldEditor("cliente", "email", "E-mail", cliente?.email)} />
                  <EditableInfoLine label="Origem do lead" value={cliente?.origem_lead || "—"} canEdit={canEditOnvoxInfo} onEdit={() => openOnvoxFieldEditor("cliente", "origem_lead", "Origem do lead", cliente?.origem_lead)} />
                </InfoGroup>

                <InfoGroup title="Representante Legal">
                  <EditableInfoLine label="Nome" value={pedido.representante_legal_nome || "—"} canEdit={canEditOnvoxInfo} onEdit={() => openOnvoxFieldEditor("pedido", "representante_legal_nome", "Nome do Representante Legal", pedido.representante_legal_nome)} />
                  <EditableInfoLine label="E-mail" value={pedido.representante_legal_email || "—"} canEdit={canEditOnvoxInfo} onEdit={() => openOnvoxFieldEditor("pedido", "representante_legal_email", "E-mail do Representante Legal", pedido.representante_legal_email)} />
                  <EditableInfoLine label="Telefone" value={pedido.representante_legal_telefone || "—"} canEdit={canEditOnvoxInfo} onEdit={() => openOnvoxFieldEditor("pedido", "representante_legal_telefone", "Telefone do Representante Legal", pedido.representante_legal_telefone)} />
                </InfoGroup>

                <InfoGroup title="Gestor Técnico">
                  <EditableInfoLine label="Nome" value={pedido.gestor_tecnico_nome || "—"} canEdit={canEditOnvoxInfo} onEdit={() => openOnvoxFieldEditor("pedido", "gestor_tecnico_nome", "Nome do Gestor Técnico", pedido.gestor_tecnico_nome)} />
                  <EditableInfoLine label="E-mail" value={pedido.gestor_tecnico_email || "—"} canEdit={canEditOnvoxInfo} onEdit={() => openOnvoxFieldEditor("pedido", "gestor_tecnico_email", "E-mail do Gestor Técnico", pedido.gestor_tecnico_email)} />
                  <EditableInfoLine label="Telefone" value={pedido.gestor_tecnico_telefone || "—"} canEdit={canEditOnvoxInfo} onEdit={() => openOnvoxFieldEditor("pedido", "gestor_tecnico_telefone", "Telefone do Gestor Técnico", pedido.gestor_tecnico_telefone)} />
                  <EditableInfoLine label="E-mail para faturamento" value={pedido.gestor_tecnico_email_faturas || "—"} canEdit={canEditOnvoxInfo} onEdit={() => openOnvoxFieldEditor("pedido", "gestor_tecnico_email_faturas", "E-mail para faturamento", pedido.gestor_tecnico_email_faturas)} />
                </InfoGroup>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="arquivos-onvox" className="mt-0">
            <section className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold"><Paperclip className="size-4 text-[#D92FA0]" /> Arquivos do pedido</div>
                <div className="flex gap-1">
                  {(["TODOS", "CLOSER", "BKO"] as const).map((value) => (
                    <Button key={value} size="sm" variant={docFilter === value ? "default" : "outline"} onClick={() => setDocFilter(value)} className="h-7 text-[10px]">
                      {value === "TODOS" ? `Todos (${documents.length})` : value}
                    </Button>
                  ))}
                </div>
              </div>

              {canUpload && (
                <div
                  className="rounded-xl border border-dashed border-[#D92FA0]/50 bg-[#D92FA0]/5 p-6 text-center cursor-pointer hover:bg-[#D92FA0]/10 transition-colors"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); void uploadFiles(e.dataTransfer.files); }}
                >
                  <Upload className="mx-auto size-7 text-[#D92FA0]" />
                  <div className="mt-2 text-sm font-semibold">{uploading ? "Enviando…" : "Arraste arquivos aqui ou clique para selecionar"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">PDF, DOC, DOCX, XLS, XLSX, PNG ou JPG · até 10 MB</div>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    onChange={(e) => e.target.files && void uploadFiles(e.target.files)}
                  />
                </div>
              )}

              {filteredDocs.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Nenhum arquivo enviado ainda.</div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full min-w-[760px] text-xs">
                    <thead className="bg-surface-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Arquivo</th>
                        <th className="px-3 py-2 text-left">Enviado por</th>
                        <th className="px-3 py-2 text-left">Data</th>
                        <th className="px-3 py-2 text-left">Tamanho</th>
                        <th className="px-3 py-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDocs.map((doc) => (
                        <tr key={doc.id} className="border-t border-border">
                          <td className="px-3 py-2 font-medium">{doc.arquivo_nome_original}</td>
                          <td className="px-3 py-2">
                            <div>{doc.enviado_por_nome || "Usuário"}</div>
                            <div className="text-[9px] uppercase text-muted-foreground">{doc.enviado_por_role || "—"}</div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{new Date(doc.created_at).toLocaleString("pt-BR")}</td>
                          <td className="px-3 py-2 text-muted-foreground">{fileSize(doc.tamanho_bytes)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <Button size="sm" variant="ghost" onClick={() => void previewDocument(doc)} title="Visualizar">
                              <Eye className="size-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => void downloadDocument(doc)} title="Baixar">
                              <Download className="size-3.5" />
                            </Button>
                            {(operational || doc.enviado_por === user?.id) && (
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void deleteDocument(doc)} title="Excluir">
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="chat-onvox" className="mt-0">
            <section className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    <MessageCircle className="size-4" style={{ color: TAKE }} />
                    Conversa Closer ↔ BKO
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Texto e imagens ficam vinculados a este pedido.</div>
                </div>
                <Badge variant="outline">{messages.length}</Badge>
              </div>

              <div className="max-h-[640px] min-h-[360px] overflow-y-auto rounded-xl border border-border bg-surface-1/45 p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="grid min-h-[330px] place-items-center text-center">
                    <div>
                      <MessageCircle className="mx-auto size-7 text-muted-foreground" />
                      <div className="mt-2 text-sm font-medium">Nenhuma mensagem ainda</div>
                      <div className="mt-1 text-xs text-muted-foreground">Use o campo abaixo para iniciar a conversa.</div>
                    </div>
                  </div>
                ) : messages.map((message) => {
                  /* CHAT_ONVOX_BUBBLES: enviadas à direita, recebidas à esquerda */
                  const mine = message.user_id === user?.id;
                  return (
                    <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[82%] rounded-2xl border px-3 py-2",
                          mine ? "rounded-br-md text-foreground" : "rounded-bl-md bg-background",
                        )}
                        style={mine ? {
                          borderColor: `${ONVOX}55`,
                          background: `linear-gradient(135deg, ${ONVOX}22, ${ONVOX}0A)`,
                        } : undefined}
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-[10px] font-bold">{message.user_nome || "Usuário"}</span>
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{message.user_role || "—"}</span>
                        </div>
                        {message.imagem_url && (
                          <a href={message.imagem_url} target="_blank" rel="noreferrer" className="mt-2 block">
                            <img
                              src={message.imagem_url}
                              alt={message.imagem_nome_original || "Imagem enviada no chat"}
                              className="max-h-[360px] max-w-full rounded-xl border border-border object-contain"
                            />
                          </a>
                        )}
                        {message.mensagem && <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{message.mensagem}</div>}
                        <div className="mt-1 text-right text-[9px] text-muted-foreground">
                          {new Date(message.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {canSendMessage ? (
                <div className="space-y-2">
                  {pendingChatImagePreview && (
                    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-1 p-2">
                      <img src={pendingChatImagePreview} alt="Imagem pronta para envio" className="h-24 w-28 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold">{pendingChatImage?.name || "Imagem colada"}</div>
                        <div className="mt-1 text-[10px] text-muted-foreground">Será enviada junto com a próxima mensagem.</div>
                      </div>
                      <Button type="button" size="icon" variant="ghost" className="size-8" onClick={clearPendingChatImage}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value.slice(0, 4000))}
                      onPaste={handleChatPaste}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendMessage();
                        }
                      }}
                      placeholder="Escreva uma mensagem ou cole uma imagem aqui…"
                      className="min-h-28 flex-1 resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    />
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="size-11"
                        onClick={() => chatImageInputRef.current?.click()}
                        title="Adicionar imagem"
                      >
                        <ImagePlus className="size-4" />
                      </Button>
                      <input
                        ref={chatImageInputRef}
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={(e) => setChatImage(e.target.files?.[0] ?? null)}
                      />
                      <Button
                        size="icon"
                        className="size-11"
                        style={{ backgroundColor: TAKE }}
                        onClick={() => void sendMessage()}
                        disabled={sendingMessage || (!messageText.trim() && !pendingChatImage)}
                        title="Enviar mensagem"
                      >
                        <Send className="size-4 text-white" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground">Você também pode copiar uma imagem e colar diretamente no campo de mensagem.</div>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-surface-1 px-3 py-2 text-xs text-muted-foreground">
                  Chat disponível para o Consultor/Closer responsável e para o BKO.
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </>
      )}

      <Dialog open={onvoxEditOpen} onOpenChange={(open) => !onvoxEditSaving && setOnvoxEditOpen(open)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Editar pedido ONVOX</DialogTitle>
            <DialogDescription>Edite os itens e dados comerciais do pedido usando as mesmas regras do cadastro ONVOX.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">Itens ONVOX</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={onvoxEditSaving}
                  onClick={() => setOnvoxEditItems((current) => [...current, {
                    tipo_pedido: "NOVO",
                    produto_item: "DID",
                    quantidade: "1",
                    valor_unitario: "",
                    receita: "",
                    operadora_doadora: "",
                    ddd: "",
                    numero: "",
                    equipamento: "",
                    quantidade_equipamentos: "",
                  }])}
                >
                  <Plus className="mr-1 size-3.5" /> Adicionar item
                </Button>
              </div>

              {onvoxEditItems.map((item, index) => (
                <div key={item.id ?? index} className="space-y-3 rounded-xl border border-border bg-surface-1/55 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold">Item {index + 1}</div>
                    {onvoxEditItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={onvoxEditSaving}
                        onClick={() => setOnvoxEditItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        <Trash2 className="mr-1 size-3.5" /> Remover
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <Field label="Tipo de pedido">
                      <CloserOptionSelect
                        category="onvox_order_type"
                        value={item.tipo_pedido}
                        onValueChange={(value) => setOnvoxEditItems((current) => current.map((row, itemIndex) => {
                          if (itemIndex !== index) return row;
                          const permitidos = onvoxProdutosPermitidos(value);
                          const produtoAtualPermitido = permitidos.includes(row.produto_item);
                          return {
                            ...row,
                            tipo_pedido: value,
                            produto_item: produtoAtualPermitido ? row.produto_item : permitidos[0],
                            quantidade: produtoAtualPermitido && (row.produto_item === "RAMAIS" || row.produto_item === "DID")
                              ? (onvoxDidUsaNumero(value, row.produto_item) ? "1" : row.quantidade)
                              : "1",
                            valor_unitario: produtoAtualPermitido && (row.produto_item === "RAMAIS" || row.produto_item === "DID") ? row.valor_unitario : "",
                            operadora_doadora: ["PORTABILIDADE", "PORTABILIDADE PF"].includes(value) ? row.operadora_doadora : "",
                            numero: onvoxDidUsaNumero(value, produtoAtualPermitido ? row.produto_item : permitidos[0]) ? row.numero : "",
                          };
                        }))}
                        canManage={false}
                        allowedValues={["NOVO", "PORTABILIDADE", "TT", "PORTABILIDADE PF"]}
                        label="Tipo de pedido"
                        controller={optionCatalog}
                      />
                    </Field>

                    <Field label="Tipo de produto">
                      <CloserOptionSelect
                        category="onvox_product"
                        value={item.produto_item}
                        allowedValues={onvoxProdutosPermitidos(item.tipo_pedido)}
                        onValueChange={(value) => setOnvoxEditItems((current) => current.map((row, itemIndex) =>
                          itemIndex === index ? {
                            ...row,
                            produto_item: value,
                            quantidade: value === "RAMAIS" || value === "DID"
                              ? (onvoxDidUsaNumero(row.tipo_pedido, value) ? "1" : row.quantidade || "1")
                              : "1",
                            valor_unitario: value === "RAMAIS" || value === "DID" ? row.valor_unitario : "",
                            ddd: value === "DID" ? row.ddd : "",
                            numero: onvoxDidUsaNumero(row.tipo_pedido, value) ? row.numero : "",
                          } : row
                        ))}
                        canManage={false}
                        label="Tipo de produto"
                        controller={optionCatalog}
                      />
                    </Field>

                    {(item.produto_item === "RAMAIS" || item.produto_item === "DID") ? (
                      <>
                        {item.produto_item === "DID" && (
                          <Field label="DDD *">
                            <Input
                              inputMode="numeric"
                              value={item.ddd}
                              onChange={(e) => setOnvoxEditItems((current) => current.map((row, itemIndex) =>
                                itemIndex === index ? { ...row, ddd: somenteDigitosOnvox(e.target.value) } : row
                              ))}
                            />
                          </Field>
                        )}
                        {item.produto_item === "DID" && onvoxDidUsaNumero(item.tipo_pedido, item.produto_item) ? (
                          <Field label="Número *">
                            <Input
                              inputMode="numeric"
                              value={item.numero}
                              onChange={(e) => setOnvoxEditItems((current) => current.map((row, itemIndex) =>
                                itemIndex === index ? { ...row, numero: somenteDigitosOnvox(e.target.value) } : row
                              ))}
                            />
                          </Field>
                        ) : (
                          <Field label={item.produto_item === "DID" ? "Qtd. de DID" : "Qtd. de Ramais"}>
                            <Input type="number" min="1" value={item.quantidade} onChange={(e) => setOnvoxEditItems((current) => current.map((row, itemIndex) => itemIndex === index ? { ...row, quantidade: e.target.value } : row))} />
                          </Field>
                        )}
                        <Field label="Valor unitário">
                          <Input type="number" step="0.01" min="0" value={item.valor_unitario} onChange={(e) => setOnvoxEditItems((current) => current.map((row, itemIndex) => itemIndex === index ? { ...row, valor_unitario: e.target.value } : row))} />
                        </Field>
                        <Field label="Valor total">
                          <Input value={brl(onvoxValorTotalLinha(
                            item.produto_item,
                            onvoxQuantidadePersistida(item.produto_item, item.quantidade, item.tipo_pedido),
                            item.valor_unitario,
                            "",
                          ))} readOnly className="bg-muted/40 font-semibold" />
                        </Field>
                      </>
                    ) : (
                      <Field label="Valor">
                        <Input type="number" step="0.01" min="0" value={item.receita} onChange={(e) => setOnvoxEditItems((current) => current.map((row, itemIndex) => itemIndex === index ? { ...row, receita: e.target.value } : row))} />
                      </Field>
                    )}

                    {["PORTABILIDADE", "PORTABILIDADE PF"].includes(item.tipo_pedido) && (
                      <Field label="Operadora doadora">
                        <Input value={item.operadora_doadora} onChange={(e) => setOnvoxEditItems((current) => current.map((row, itemIndex) => itemIndex === index ? { ...row, operadora_doadora: e.target.value } : row))} />
                      </Field>
                    )}

                    {item.produto_item === "APARELHO" && (
                      <>
                        <Field label="Equipamento / Modelo">
                          <Input value={item.equipamento} onChange={(e) => setOnvoxEditItems((current) => current.map((row, itemIndex) => itemIndex === index ? { ...row, equipamento: e.target.value } : row))} />
                        </Field>
                        <Field label="Qtd. equipamentos">
                          <Input type="number" min="1" value={item.quantidade_equipamentos} onChange={(e) => setOnvoxEditItems((current) => current.map((row, itemIndex) => itemIndex === index ? { ...row, quantidade_equipamentos: e.target.value } : row))} />
                        </Field>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </section>

            <Field label="Observação do pedido">
              <textarea className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={onvoxEditObservacao} onChange={(e) => setOnvoxEditObservacao(e.target.value)} disabled={onvoxEditSaving} />
            </Field>

            <section className="space-y-3 rounded-xl border border-border bg-surface-1/55 p-3">
              <div className="text-sm font-semibold">Representante Legal</div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Nome *"><Input value={onvoxEditRepresentanteNome} onChange={(e) => setOnvoxEditRepresentanteNome(e.target.value)} disabled={onvoxEditSaving} /></Field>
                <Field label="E-mail *"><Input type="email" value={onvoxEditRepresentanteEmail} onChange={(e) => setOnvoxEditRepresentanteEmail(e.target.value)} disabled={onvoxEditSaving} /></Field>
                <Field label="Telefone *"><Input value={onvoxEditRepresentanteTelefone} onChange={(e) => setOnvoxEditRepresentanteTelefone(e.target.value)} disabled={onvoxEditSaving} /></Field>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-border bg-surface-1/55 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Gestor Técnico</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">Opcional</div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={onvoxEditSaving}
                  onClick={() => {
                    setOnvoxEditGestorAtivo((current) => !current);
                    if (onvoxEditGestorAtivo) {
                      setOnvoxEditGestorNome("");
                      setOnvoxEditGestorEmail("");
                      setOnvoxEditGestorTelefone("");
                      setOnvoxEditGestorEmailFaturas("");
                    }
                  }}
                >
                  {onvoxEditGestorAtivo ? "Remover gestor técnico" : "Adicionar gestor técnico"}
                </Button>
              </div>

              {onvoxEditGestorAtivo && (
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Nome *"><Input value={onvoxEditGestorNome} onChange={(e) => setOnvoxEditGestorNome(e.target.value)} disabled={onvoxEditSaving} /></Field>
                  <Field label="E-mail *"><Input type="email" value={onvoxEditGestorEmail} onChange={(e) => setOnvoxEditGestorEmail(e.target.value)} disabled={onvoxEditSaving} /></Field>
                  <Field label="Telefone *"><Input value={onvoxEditGestorTelefone} onChange={(e) => setOnvoxEditGestorTelefone(e.target.value)} disabled={onvoxEditSaving} /></Field>
                  <Field label="E-mail para envio das faturas mensais *"><Input type="email" value={onvoxEditGestorEmailFaturas} onChange={(e) => setOnvoxEditGestorEmailFaturas(e.target.value)} disabled={onvoxEditSaving} /></Field>
                </div>
              )}
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOnvoxEditOpen(false)} disabled={onvoxEditSaving}>Cancelar</Button>
            <Button onClick={() => void saveOnvoxEdit()} disabled={onvoxEditSaving}>
              {onvoxEditSaving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(onvoxFieldEdit)} onOpenChange={(open) => !open && !onvoxFieldSaving && setOnvoxFieldEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{onvoxFieldEdit ? `Editar ${onvoxFieldEdit.label}` : "Editar informação"}</DialogTitle>
            <DialogDescription>Esta alteração é aplicada diretamente aos dados vinculados ao pedido.</DialogDescription>
          </DialogHeader>
          {onvoxFieldEdit && (
            <Field label={onvoxFieldEdit.label}>
              <Input
                value={onvoxFieldEdit.value}
                onChange={(e) => setOnvoxFieldEdit((current) => current ? { ...current, value: e.target.value } : current)}
                disabled={onvoxFieldSaving}
                autoFocus
              />
            </Field>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOnvoxFieldEdit(null)} disabled={onvoxFieldSaving}>Cancelar</Button>
            <Button onClick={() => void saveOnvoxFieldEditor()} disabled={onvoxFieldSaving}>
              {onvoxFieldSaving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={takeEditOpen}
        onOpenChange={(open) => {
          if (!takeEditSaving) setTakeEditOpen(open);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Editar pedido TAKE</DialogTitle>
            <DialogDescription>
              Edite os mesmos dados comerciais utilizados no cadastro do pedido.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <section className="space-y-3 rounded-xl border border-border bg-surface-1/45 p-3">
              <div className="text-sm font-semibold">Pedido Take Flow</div>

              <div className="max-w-sm">
                <Field label="Tipo de API *">
                  <Select
                    value={takeEdit.apiTipo}
                    onValueChange={(value) => setTakeEdit((current) => ({ ...current, apiTipo: value }))}
                    disabled={takeEditSaving}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo de API" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="API OFICIAL">API OFICIAL</SelectItem>
                      <SelectItem value="API NÃO OFICIAL">API NÃO OFICIAL</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <Field label="Receita">
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formatBrlInput(takeEdit.receita)}
                    onChange={(e) => setTakeEdit((current) => ({ ...current, receita: parseBrlInput(e.target.value) }))}
                    placeholder="R$ 0,00"
                    disabled={takeEditSaving}
                  />
                </Field>
                <Field label="Qtd. Conexões">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={takeEdit.conexoes}
                    onChange={(e) => setTakeEdit((current) => ({ ...current, conexoes: somenteDigitosTake(e.target.value) }))}
                    disabled={takeEditSaving}
                  />
                </Field>
                <Field label="Qtd. Usuários">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={takeEdit.usuarios}
                    onChange={(e) => setTakeEdit((current) => ({ ...current, usuarios: somenteDigitosTake(e.target.value) }))}
                    disabled={takeEditSaving}
                  />
                </Field>
                <Field label="Valor implantação">
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formatBrlInput(takeEdit.implantacao)}
                    onChange={(e) => setTakeEdit((current) => ({ ...current, implantacao: parseBrlInput(e.target.value) }))}
                    placeholder="R$ 0,00"
                    disabled={takeEditSaving}
                  />
                </Field>
              </div>

              <Field label="Observação deste pedido">
                <textarea
                  className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={takeEdit.observacao}
                  onChange={(e) => setTakeEdit((current) => ({ ...current, observacao: e.target.value }))}
                  disabled={takeEditSaving}
                />
              </Field>

              <div className="space-y-2 rounded-xl border border-border bg-background/45 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold">Linhas de conexão</div>
                    <div className="text-[10px] text-muted-foreground">DDD e Número aceitam somente números.</div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={takeEditSaving}
                    onClick={() => setTakeEdit((current) => ({
                      ...current,
                      linhas: [...current.linhas, { ddd: "", numero: "" }],
                    }))}
                  >
                    <Plus className="mr-1 size-3.5" /> Adicionar linha
                  </Button>
                </div>

                <div className="grid grid-cols-[90px_minmax(0,1fr)_44px] gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <div>DDD</div>
                  <div>Número</div>
                  <div />
                </div>

                <div className="space-y-2">
                  {takeEdit.linhas.map((linha, index) => (
                    <div key={index} className="grid grid-cols-[90px_minmax(0,1fr)_44px] gap-2">
                      <Input
                        inputMode="numeric"
                        value={linha.ddd}
                        onChange={(e) => setTakeEdit((current) => ({
                          ...current,
                          linhas: current.linhas.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, ddd: somenteDigitosTake(e.target.value) } : row
                          ),
                        }))}
                        disabled={takeEditSaving}
                      />
                      <Input
                        inputMode="numeric"
                        value={linha.numero}
                        onChange={(e) => setTakeEdit((current) => ({
                          ...current,
                          linhas: current.linhas.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, numero: somenteDigitosTake(e.target.value) } : row
                          ),
                        }))}
                        disabled={takeEditSaving}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        disabled={takeEditSaving || takeEdit.linhas.length === 1}
                        onClick={() => setTakeEdit((current) => ({
                          ...current,
                          linhas: current.linhas.filter((_, rowIndex) => rowIndex !== index),
                        }))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-border bg-surface-1/45 p-3">
              <div className="text-sm font-semibold">Representante Legal</div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Nome *">
                  <Input
                    value={takeEdit.representanteNome}
                    onChange={(e) => setTakeEdit((current) => ({ ...current, representanteNome: e.target.value }))}
                    disabled={takeEditSaving}
                  />
                </Field>
                <Field label="E-mail *">
                  <Input
                    type="email"
                    value={takeEdit.representanteEmail}
                    onChange={(e) => setTakeEdit((current) => ({ ...current, representanteEmail: e.target.value }))}
                    disabled={takeEditSaving}
                  />
                </Field>
                <Field label="Telefone *">
                  <Input
                    value={takeEdit.representanteTelefone}
                    onChange={(e) => setTakeEdit((current) => ({ ...current, representanteTelefone: e.target.value }))}
                    disabled={takeEditSaving}
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-border bg-surface-1/45 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Gestor Técnico</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">Opcional</div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={takeEditSaving}
                  onClick={() => setTakeEdit((current) => ({
                    ...current,
                    gestorAtivo: !current.gestorAtivo,
                    ...(current.gestorAtivo ? {
                      gestorNome: "",
                      gestorEmail: "",
                      gestorTelefone: "",
                      gestorEmailFaturas: "",
                    } : {}),
                  }))}
                >
                  {takeEdit.gestorAtivo ? "Remover gestor técnico" : "Adicionar gestor técnico"}
                </Button>
              </div>

              {takeEdit.gestorAtivo && (
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Nome *">
                    <Input value={takeEdit.gestorNome} onChange={(e) => setTakeEdit((current) => ({ ...current, gestorNome: e.target.value }))} disabled={takeEditSaving} />
                  </Field>
                  <Field label="E-mail *">
                    <Input type="email" value={takeEdit.gestorEmail} onChange={(e) => setTakeEdit((current) => ({ ...current, gestorEmail: e.target.value }))} disabled={takeEditSaving} />
                  </Field>
                  <Field label="Telefone *">
                    <Input value={takeEdit.gestorTelefone} onChange={(e) => setTakeEdit((current) => ({ ...current, gestorTelefone: e.target.value }))} disabled={takeEditSaving} />
                  </Field>
                  <Field label="E-mail para envio das faturas mensais *">
                    <Input type="email" value={takeEdit.gestorEmailFaturas} onChange={(e) => setTakeEdit((current) => ({ ...current, gestorEmailFaturas: e.target.value }))} disabled={takeEditSaving} />
                  </Field>
                </div>
              )}
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTakeEditOpen(false)} disabled={takeEditSaving}>Cancelar</Button>
            <Button onClick={() => void saveTakeEdit()} disabled={takeEditSaving}>
              {takeEditSaving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(documentPreview)}
        onOpenChange={(open) => {
          if (!open && documentPreview?.url) {
            URL.revokeObjectURL(documentPreview.url);
            setDocumentPreview(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização do arquivo</DialogTitle>
            <DialogDescription>{documentPreview?.doc.arquivo_nome_original}</DialogDescription>
          </DialogHeader>
          <div className="h-[70vh] overflow-hidden rounded-xl border border-border bg-black/10">
            {documentPreview?.doc.mime_type === "application/pdf" ? (
              <iframe src={documentPreview.url} className="h-full w-full" title={documentPreview.doc.arquivo_nome_original} />
            ) : documentPreview?.doc.mime_type.startsWith("image/") ? (
              <div className="grid h-full place-items-center overflow-auto p-4">
                <img src={documentPreview.url} alt={documentPreview.doc.arquivo_nome_original} className="max-h-full max-w-full object-contain" />
              </div>
            ) : documentPreview ? (
              <div className="grid h-full place-items-center p-6 text-center">
                <div>
                  <FileText className="mx-auto size-10 text-muted-foreground" />
                  <div className="mt-3 text-sm font-semibold">{documentPreview.doc.arquivo_nome_original}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Este formato não possui pré-visualização nativa no navegador. Use Baixar para abrir no aplicativo correspondente.
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => documentPreview && void downloadDocument(documentPreview.doc)}>
              <Download className="mr-2 size-3.5" /> Baixar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={informationEditing}
        onOpenChange={(open) => {
          if (!informationSaving) setInformationEditing(open);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar informações do pedido</DialogTitle>
            <DialogDescription>
              Consultor/Closer, BKO e Admin podem corrigir estes dados. Cada campo alterado fica registrado no histórico com usuário, perfil, data, valor anterior e novo valor.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente">
              <Input
                value={informationDraft.razao_social}
                onChange={(e) => setInformationDraft((current) => ({ ...current, razao_social: e.target.value }))}
                disabled={informationSaving}
              />
            </Field>
            <Field label="CNPJ">
              <Input
                value={informationDraft.cnpj}
                onChange={(e) => setInformationDraft((current) => ({ ...current, cnpj: e.target.value }))}
                disabled={informationSaving}
              />
            </Field>
            <Field label="Contato">
              <Input
                value={informationDraft.contato}
                onChange={(e) => setInformationDraft((current) => ({ ...current, contato: e.target.value }))}
                disabled={informationSaving}
              />
            </Field>
            <Field label="Telefone">
              <Input
                value={informationDraft.telefone}
                onChange={(e) => setInformationDraft((current) => ({ ...current, telefone: e.target.value }))}
                disabled={informationSaving}
              />
            </Field>
            <Field label="E-mail">
              <Input
                type="email"
                value={informationDraft.email}
                onChange={(e) => setInformationDraft((current) => ({ ...current, email: e.target.value }))}
                disabled={informationSaving}
              />
            </Field>
            <Field label="Origem">
              <Input
                value={informationDraft.origem_lead}
                onChange={(e) => setInformationDraft((current) => ({ ...current, origem_lead: e.target.value }))}
                disabled={informationSaving}
              />
            </Field>
            <Field label="Produto">
              <Select
                value={informationDraft.produto}
                onValueChange={(value) => setInformationDraft((current) => ({ ...current, produto: value as Produto }))}
                disabled={informationSaving}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ONVOX">ONVOX</SelectItem>
                  <SelectItem value="TAKE_FLOW">TAKE FLOW</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Criado em">
              <Input value={new Date(pedido.created_at).toLocaleString("pt-BR")} disabled />
            </Field>
          </div>

          <Field label="Observação do Closer">
            <textarea
              value={informationDraft.observacao}
              onChange={(e) => setInformationDraft((current) => ({ ...current, observacao: e.target.value.slice(0, 4000) }))}
              disabled={informationSaving}
              className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Observações comerciais do pedido"
            />
          </Field>

          {informationDraft.produto !== pedido.produto && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Ao trocar o produto, se a etapa atual não existir no novo fluxo, o pedido volta automaticamente para CONTRATO. Essa mudança também será registrada no histórico.
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInformationEditing(false)} disabled={informationSaving}>
              Cancelar
            </Button>
            <Button onClick={() => void saveInformation()} disabled={informationSaving}>
              {informationSaving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingFinalStage !== null}
        onOpenChange={(open) => {
          if (!open) setPendingFinalStage(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar conclusão do pedido?</DialogTitle>
            <DialogDescription>
              {pedido?.produto === "ONVOX"
                ? "Ao mover este pedido para CONCLUÍDO, ele passará a ser contabilizado como finalizado."
                : "Ao mover este pedido para ONBOARDING 3, ele passará a ser contabilizado como finalizado."}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border bg-surface-1 p-3 text-sm">
            <div className="font-semibold">{pedido?.closer_clientes?.razao_social || "Cliente"}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Pedido #{String(pedido?.numero ?? "—").padStart(4, "0")} · {pedido ? productLabel(pedido.produto) : ""}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingFinalStage(null)}>
              Voltar
            </Button>
            <Button
              onClick={() => {
                const nextStage = pendingFinalStage;
                setPendingFinalStage(null);
                if (nextStage) setEtapa(nextStage);
              }}
            >
              Sim, concluir pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function SectionTitle({ title, accent }: { title: string; accent?: string }) {
  return (
    <div className="flex items-center gap-2">
      {accent && <span className="size-2.5 rounded-full" style={{ backgroundColor: accent }} />}
      <div className="text-sm font-semibold">{title}</div>
    </div>
  );
}

function Info({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="size-3" />}{label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function InfoGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface-1/55 p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{title}</div>
      <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium break-words">{value}</div>
    </div>
  );
}

function EditableInfoLine({
  label,
  value,
  canEdit,
  onEdit,
}: {
  label: string;
  value: string;
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="group min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-0.5 font-medium break-words">{value}</div>
        </div>
        {canEdit && (
          <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={onEdit} title={`Editar ${label}`}>
            <Pencil className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
