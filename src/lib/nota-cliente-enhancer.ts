import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchPedidoNotaLive,
  formatPedidoBrl,
  formatPedidoNotaText,
  getVendaIdFromLocation,
  type PedidoNotaLive,
} from "@/lib/pedido-nota-live";
import { gerarNotaLivePDF } from "@/lib/pdf-nota-live";

const NOTA_MARK = "OMNI FLOW LAB";
const PDF_BUTTONS = new Set(["Nota PDF", "Gerar PDF", "PDF preview", "Pré-visualizar"]);

let cachedModel: PedidoNotaLive | null = null;
let cachedText = "";
let cachedVendaId: string | null = null;
let loading: Promise<PedidoNotaLive | null> | null = null;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let subscribedVendaId: string | null = null;
let refreshTimer: number | null = null;

function isManualMode(): boolean {
  return Array.from(document.querySelectorAll(".rounded-xl.border")).some(card => {
    const text = card.textContent || "";
    return text.includes("Nota do Pedido") && /\bManual\b/.test(text);
  });
}

function findNotaBlocks(): HTMLPreElement[] {
  return Array.from(document.querySelectorAll("pre")).filter((pre): pre is HTMLPreElement => {
    if (pre.dataset.omniNotaLive === "true") return true;
    const text = pre.textContent || "";
    return text.includes(NOTA_MARK) && text.includes("NOTA DO PEDIDO");
  });
}

async function loadLiveModel(force = false): Promise<PedidoNotaLive | null> {
  const vendaId = getVendaIdFromLocation();
  if (!vendaId) return null;

  if (!force && cachedModel && cachedVendaId === vendaId) return cachedModel;
  if (!force && loading && cachedVendaId === vendaId) return loading;

  cachedVendaId = vendaId;
  loading = fetchPedidoNotaLive(vendaId)
    .then(model => {
      cachedModel = model;
      cachedText = formatPedidoNotaText(model);
      return model;
    })
    .catch(error => {
      console.error("[Nota do Pedido] Falha ao sincronizar dados ao vivo", error);
      return null;
    })
    .finally(() => {
      loading = null;
    });

  return loading;
}

function createMetric(label: string, value: string): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "rounded-lg border border-border bg-surface-1 px-3 py-2 min-w-0";

  const title = document.createElement("div");
  title.className = "text-[9px] uppercase tracking-wider text-muted-foreground";
  title.textContent = label;

  const content = document.createElement("div");
  content.className = "mt-0.5 text-xs font-semibold text-foreground truncate";
  content.title = value;
  content.textContent = value;

  card.append(title, content);
  return card;
}

function renderLiveSummary(pre: HTMLPreElement, model: PedidoNotaLive): void {
  const parent = pre.parentElement;
  if (!parent) return;

  let summary = parent.querySelector<HTMLElement>("[data-omni-live-note-summary]");
  if (!summary) {
    summary = document.createElement("div");
    summary.setAttribute("data-omni-live-note-summary", "true");
    summary.className = "mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4";
    parent.insertBefore(summary, pre);
  }

  const signature = [
    model.numero,
    model.etapa,
    model.statusComercial,
    model.quantidadeLinhas,
    model.valorLinhas,
  ].join("|");
  if (summary.dataset.signature === signature) return;

  summary.dataset.signature = signature;
  summary.replaceChildren(
    createMetric("Pedido", model.numero),
    createMetric("Etapa / Status", `${model.etapa} · ${model.statusComercial}`),
    createMetric("Linhas ativas", String(model.quantidadeLinhas)),
    createMetric("Valor mensal", formatPedidoBrl(model.valorLinhas)),
  );
}

async function enhanceNota(force = false): Promise<void> {
  if (isManualMode()) return;
  const blocks = findNotaBlocks();
  if (!blocks.length) return;

  const model = await loadLiveModel(force);
  if (!model || !cachedText) return;

  blocks.forEach(pre => {
    if (pre.textContent !== cachedText) pre.textContent = cachedText;
    pre.dataset.omniNotaLive = "true";
    pre.dataset.omniNotaVendaId = model.id;
    renderLiveSummary(pre, model);
  });
}

function shouldInterceptPdfButton(button: HTMLButtonElement): { intercept: boolean; preview: boolean } {
  const label = (button.textContent || "").trim().replace(/\s+/g, " ");
  if (!PDF_BUTTONS.has(label)) return { intercept: false, preview: false };

  if (label === "Pré-visualizar") {
    const noteCard = button.closest(".rounded-xl.border");
    if (noteCard?.textContent?.includes("Nota do Pedido")) {
      return { intercept: false, preview: false };
    }
  }

  return {
    intercept: true,
    preview: label === "PDF preview" || label === "Pré-visualizar",
  };
}

async function runLivePdf(preview: boolean): Promise<void> {
  const model = await loadLiveModel(true);
  if (!model) {
    toast.error("Não foi possível carregar os dados atuais do pedido para o PDF.");
    return;
  }

  const doc = gerarNotaLivePDF(model);
  if (preview) {
    window.open(doc.output("bloburl"), "_blank", "noopener,noreferrer");
    return;
  }

  doc.save(`OMNI-${model.numero}.pdf`);
  toast.success("Nota PDF gerada com os dados atuais do pedido");
}

function installActionInterceptors(): void {
  document.addEventListener(
    "click",
    event => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button") as HTMLButtonElement | null;
      if (!button) return;

      const pdfAction = shouldInterceptPdfButton(button);
      if (pdfAction.intercept) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void runLivePdf(pdfAction.preview);
        return;
      }

      const label = (button.textContent || "").trim().toLowerCase();
      if (!label.includes("copiar") || isManualMode()) return;
      const card = button.closest(".rounded-xl.border");
      if (!card?.textContent?.includes("Nota do Pedido")) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void (async () => {
        const model = await loadLiveModel(true);
        if (!model) return;
        const text = formatPedidoNotaText(model);
        await navigator.clipboard?.writeText(text);
        toast.success("Nota atual copiada");
      })();
    },
    true,
  );
}

function queueRefresh(force = false): void {
  if (refreshTimer != null) window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null;
    if (force) {
      cachedModel = null;
      cachedText = "";
    }
    void enhanceNota(force);
  }, force ? 100 : 0);
}

function teardownRealtime(): void {
  if (realtimeChannel) {
    void supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  subscribedVendaId = null;
}

function ensureRealtimeSubscription(): void {
  const vendaId = getVendaIdFromLocation();
  if (!vendaId) {
    teardownRealtime();
    return;
  }
  if (subscribedVendaId === vendaId && realtimeChannel) return;

  teardownRealtime();
  subscribedVendaId = vendaId;

  const invalidate = () => queueRefresh(true);
  const onDoadorChange = (payload: any) => {
    const linhaId = payload?.new?.linha_id ?? payload?.old?.linha_id;
    if (!linhaId || cachedModel?.linhas.some(linha => linha.id === linhaId)) invalidate();
  };

  realtimeChannel = supabase
    .channel(`nota-pedido-live-${vendaId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "vendas", filter: `id=eq.${vendaId}` }, invalidate)
    .on("postgres_changes", { event: "*", schema: "public", table: "venda_linhas", filter: `venda_id=eq.${vendaId}` }, invalidate)
    .on("postgres_changes", { event: "*", schema: "public", table: "venda_observacoes", filter: `venda_id=eq.${vendaId}` }, invalidate)
    .on("postgres_changes", { event: "*", schema: "public", table: "venda_documentos", filter: `venda_id=eq.${vendaId}` }, invalidate)
    .on("postgres_changes", { event: "*", schema: "public", table: "venda_linha_doadores" }, onDoadorChange)
    .subscribe();
}

export function installNotaClienteEnhancer(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const win = window as typeof window & { __omniNotaClienteEnhancerInstalled?: boolean };
  if (win.__omniNotaClienteEnhancerInstalled) return;
  win.__omniNotaClienteEnhancerInstalled = true;

  installActionInterceptors();

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      const vendaId = getVendaIdFromLocation();
      if (vendaId !== cachedVendaId) {
        cachedModel = null;
        cachedText = "";
        cachedVendaId = vendaId;
      }
      ensureRealtimeSubscription();
      if (document.body?.innerText.includes("Nota do Pedido")) void enhanceNota(false);
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  window.addEventListener("popstate", schedule);
  window.addEventListener("load", schedule);
  setTimeout(schedule, 0);
}
