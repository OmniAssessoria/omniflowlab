import { supabase } from "@/integrations/supabase/client";
import { supportsBiometria } from "@/lib/biometria-operadora";

export type PedidoNotaDoador = {
  nome: string;
  email: string;
  telefone: string;
  operadora: string;
};

export type PedidoNotaLinha = {
  id: string;
  ordem: number;
  ddd: string;
  numero: string;
  iccid: string;
  produto: string;
  tipoProduto: string;
  plano: string;
  status: string;
  dataAtivacao: string | null;
  valorMensal: number;
  observacao: string;
  bonusPlano: string;
  possuiBonus: boolean;
  bonusGb: number | null;
  doadores: PedidoNotaDoador[];
};

export type PedidoNotaObservacao = {
  texto: string;
  autor: string;
  perfil: string;
  tag: string;
  criadoEm: string | null;
};

export type PedidoNotaDocumento = {
  titulo: string;
  arquivo: string;
  enviadoPor: string;
  criadoEm: string | null;
};

export type PedidoNotaLive = {
  id: string;
  numero: string;
  operadora: string;
  funil: string;
  etapa: string;
  status: string;
  statusComercial: string;
  statusPedido: string;
  statusPedidoObs: string;
  consultor: string;
  bko: string;
  mesRef: number | null;
  anoRef: number | null;
  cliente: {
    razaoSocial: string;
    cnpjCpf: string;
    contato: string;
    telefone: string;
    email: string;
    uf: string;
    ddd: string;
    observacao: string;
  };
  linhas: PedidoNotaLinha[];
  quantidadeLinhas: number;
  valorLinhas: number;
  valorPedido: number;
  operacao: {
    sla: string;
    prioridade: string;
    biometria: string | null;
    portabilidade: string;
    proximaAcao: string;
    proximaAcaoData: string | null;
    viabilidadeFixa: string;
    cotacao: string;
    notaFiscal: string;
    codigoRastreio: string;
    equipamentos: string;
    observacao: string;
    temErro: boolean;
    concluidoEm: string | null;
    ativado100Em: string | null;
  };
  datas: {
    recebimento: string | null;
    preenchimento: string | null;
    envio: string | null;
    aceite: string | null;
    input: string | null;
    ativacao: string | null;
    portabilidade: string | null;
    entrega: string | null;
    atualizadoEm: string | null;
    ultimaAlteracaoPor: string;
  };
  observacoes: PedidoNotaObservacao[];
  documentos: PedidoNotaDocumento[];
};

function clean(value: unknown, fallback = "—"): string {
  const text = String(value ?? "").trim();
  if (!text || text.toLowerCase() === "null" || text.toLowerCase() === "undefined") return fallback;
  return text;
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatPedidoBrl(value: unknown): string {
  return numberValue(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatPedidoDate(value: unknown, includeTime = false): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  const date = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw);
  if (Number.isNaN(date.getTime())) return raw;
  return includeTime ? date.toLocaleString("pt-BR") : date.toLocaleDateString("pt-BR");
}

function humanize(value: unknown): string {
  const raw = clean(value, "");
  if (!raw) return "—";
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bBko\b/g, "BKO")
    .replace(/\bSla\b/g, "SLA")
    .replace(/\bPj\b/g, "PJ")
    .replace(/\bPf\b/g, "PF");
}

export function getVendaIdFromLocation(pathname?: string): string | null {
  const source = pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  const match = source.match(/\/vendas\/([^/?#]+)/i);
  if (!match || !match[1] || match[1] === "nova") return null;
  return decodeURIComponent(match[1]);
}

export async function fetchPedidoNotaLive(vendaId: string): Promise<PedidoNotaLive> {
  const db = supabase as any;
  const { data: venda, error: vendaError } = await db
    .from("vendas")
    .select("*")
    .eq("id", vendaId)
    .maybeSingle();

  if (vendaError) throw vendaError;
  if (!venda) throw new Error("Pedido não encontrado para gerar a Nota do Pedido.");

  const [clienteRes, linhasRes, observacoesRes, documentosRes, funilRes, etapaRes] = await Promise.all([
    venda.cliente_id
      ? db.from("clientes").select("*").eq("id", venda.cliente_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db.from("venda_linhas").select("*").eq("venda_id", vendaId).order("ordem", { ascending: true }).order("created_at", { ascending: true }),
    db.from("venda_observacoes").select("texto, autor_nome, autor_perfil, tag_nome_snapshot, created_at").eq("venda_id", vendaId).order("created_at", { ascending: false }).limit(10),
    db.from("venda_documentos").select("titulo, arquivo_nome_original, created_by_nome, created_at, deleted_at").eq("venda_id", vendaId).is("deleted_at", null).order("created_at", { ascending: false }).limit(20),
    venda.funil
      ? db.from("pipeline_funis").select("nome").eq("id", venda.funil).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    venda.etapa_id
      ? db.from("pipeline_etapas").select("nome").eq("id", venda.etapa_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const cliente = clienteRes?.data ?? null;
  const linhasRaw = Array.isArray(linhasRes?.data) ? linhasRes.data : [];
  const linhaIds = linhasRaw.map((linha: any) => linha.id).filter(Boolean);
  const ofertaIds = Array.from(new Set(linhasRaw.map((linha: any) => linha.plano_oferta_id).filter(Boolean)));
  const planoIds = Array.from(new Set(linhasRaw.map((linha: any) => linha.plano_catalogo_id).filter(Boolean)));

  const [ofertasBonusRes, planosBonusRes] = await Promise.all([
    ofertaIds.length > 0
      ? db.from("plano_ofertas_catalogo").select("id, bonus_extra").in("id", ofertaIds)
      : Promise.resolve({ data: [], error: null }),
    planoIds.length > 0
      ? db.from("planos_catalogo").select("id, bonus_extra").in("id", planoIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const bonusOfertaPorId = new Map<string, string>(
    (Array.isArray(ofertasBonusRes?.data) ? ofertasBonusRes.data : [])
      .map((item: any) => [item.id, clean(item.bonus_extra, "")]),
  );
  const bonusPlanoPorId = new Map<string, string>(
    (Array.isArray(planosBonusRes?.data) ? planosBonusRes.data : [])
      .map((item: any) => [item.id, clean(item.bonus_extra, "")]),
  );

  let doadoresRaw: any[] = [];
  if (linhaIds.length > 0) {
    const { data } = await db
      .from("venda_linha_doadores")
      .select("linha_id, nome_completo, email, telefone, operadora")
      .in("linha_id", linhaIds)
      .order("created_at", { ascending: true });
    doadoresRaw = Array.isArray(data) ? data : [];
  }

  const doadoresPorLinha = new Map<string, PedidoNotaDoador[]>();
  doadoresRaw.forEach((doador: any) => {
    const list = doadoresPorLinha.get(doador.linha_id) ?? [];
    list.push({
      nome: clean(doador.nome_completo),
      email: clean(doador.email),
      telefone: clean(doador.telefone),
      operadora: clean(doador.operadora),
    });
    doadoresPorLinha.set(doador.linha_id, list);
  });

  const linhas: PedidoNotaLinha[] = linhasRaw.map((linha: any, index: number) => ({
    id: linha.id,
    ordem: Number(linha.ordem ?? index),
    ddd: clean(linha.ddd, ""),
    numero: clean(linha.numero, ""),
    iccid: clean(linha.iccid, ""),
    produto: clean(linha.produto),
    tipoProduto: clean(linha.tipo_produto),
    plano: clean(linha.plano),
    status: humanize(linha.status),
    dataAtivacao: linha.data_ativacao ?? null,
    valorMensal: numberValue(linha.valor_mensal),
    observacao: clean(linha.observacao, ""),
    bonusPlano: clean(
      bonusOfertaPorId.get(linha.plano_oferta_id)
        || bonusPlanoPorId.get(linha.plano_catalogo_id),
      "",
    ),
    possuiBonus: linha.possui_bonus === true,
    bonusGb: linha.bonus_gb == null ? null : Number(linha.bonus_gb),
    doadores: doadoresPorLinha.get(linha.id) ?? [],
  }));

  const linhasAtivas = linhas.filter(linha => linha.status.toLowerCase() !== "cancelada");
  const valorLinhas = linhasAtivas.reduce((sum, linha) => sum + linha.valorMensal, 0);
  const observacoes = (Array.isArray(observacoesRes?.data) ? observacoesRes.data : []).map((obs: any) => ({
    texto: clean(obs.texto),
    autor: clean(obs.autor_nome, "Sistema"),
    perfil: clean(obs.autor_perfil, ""),
    tag: clean(obs.tag_nome_snapshot, ""),
    criadoEm: obs.created_at ?? null,
  }));
  const documentos = (Array.isArray(documentosRes?.data) ? documentosRes.data : []).map((doc: any) => ({
    titulo: clean(doc.titulo, clean(doc.arquivo_nome_original)),
    arquivo: clean(doc.arquivo_nome_original),
    enviadoPor: clean(doc.created_by_nome, "Sistema"),
    criadoEm: doc.created_at ?? null,
  }));

  return {
    id: venda.id,
    numero: clean(venda.numero ?? venda.numero_pedido),
    operadora: clean(venda.operadora),
    funil: clean(funilRes?.data?.nome, humanize(venda.funil)),
    etapa: clean(etapaRes?.data?.nome, humanize(venda.etapa_id)),
    status: humanize(venda.status),
    statusComercial: clean(venda.status_comercial_nome, "Não definido"),
    statusPedido: humanize(venda.status_pedido),
    statusPedidoObs: clean(venda.status_pedido_obs, ""),
    consultor: clean(venda.consultor_nome, "Não informado"),
    bko: clean(venda.bko_nome, "Não atribuído"),
    mesRef: venda.mes_ref == null ? null : Number(venda.mes_ref),
    anoRef: venda.ano_ref == null ? null : Number(venda.ano_ref),
    cliente: {
      razaoSocial: clean(cliente?.razao_social ?? venda.cliente_razao_social),
      cnpjCpf: clean(cliente?.cnpj_cpf ?? venda.cliente_cnpj),
      contato: clean(cliente?.contato ?? venda.cliente_contato),
      telefone: clean(cliente?.telefone ?? venda.cliente_telefone),
      email: clean(cliente?.email ?? venda.cliente_email),
      uf: clean(cliente?.uf ?? venda.cliente_uf),
      ddd: clean(cliente?.ddd ?? venda.ddd),
      observacao: clean(cliente?.observacao, ""),
    },
    linhas,
    quantidadeLinhas: linhasAtivas.length,
    valorLinhas,
    valorPedido: numberValue(venda.valor),
    operacao: {
      sla: humanize(venda.sla_status_calc ?? venda.sla_status),
      prioridade: humanize(venda.prioridade),
      biometria: supportsBiometria(venda.operadora) ? humanize(venda.status_biometria) : null,
      portabilidade: humanize(venda.status_portabilidade),
      proximaAcao: clean(venda.proxima_acao),
      proximaAcaoData: venda.proxima_acao_data ?? null,
      viabilidadeFixa: clean(venda.viabilidade_fixa),
      cotacao: clean(venda.cotacao),
      notaFiscal: clean(venda.nota_fiscal),
      codigoRastreio: clean(venda.cod_rastreio),
      equipamentos: clean(venda.equipamentos),
      observacao: clean(venda.observacao, ""),
      temErro: venda.tem_erro === true,
      concluidoEm: venda.concluido_em ?? null,
      ativado100Em: venda.ativado_100_em ?? null,
    },
    datas: {
      recebimento: venda.data_recebimento ?? null,
      preenchimento: venda.data_preenchimento ?? null,
      envio: venda.data_envio ?? null,
      aceite: venda.data_aceite ?? null,
      input: venda.data_input ?? null,
      ativacao: venda.data_ativacao ?? null,
      portabilidade: venda.data_portabilidade ?? null,
      entrega: venda.data_entrega ?? null,
      atualizadoEm: venda.updated_at ?? null,
      ultimaAlteracaoPor: clean(venda.status_pedido_user_nome, "Sistema"),
    },
    observacoes,
    documentos,
  };
}

function linhaNumero(linha: PedidoNotaLinha): string {
  const ddd = linha.ddd ? `(${linha.ddd}) ` : "";
  return `${ddd}${linha.numero || "Sem número"}`;
}

function uniquePedidoLineValues(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach(value => {
    const text = clean(value, "");
    if (!text || text === "—") return;
    const key = text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleUpperCase("pt-BR");
    if (seen.has(key)) return;
    seen.add(key);
    result.push(text);
  });

  return result;
}

export function getPedidoNotaLineSummary(model: PedidoNotaLive) {
  const tiposPedido = uniquePedidoLineValues(model.linhas.map(linha => linha.tipoProduto));
  const produtos = uniquePedidoLineValues(model.linhas.map(linha => linha.produto));

  return {
    tiposPedido,
    produtos,
    tiposPedidoLabel: tiposPedido.join(" | ") || "—",
    produtosLabel: produtos.join(" | ") || "—",
  };
}

export function getPedidoNotaLinhaBonusLabels(linha: PedidoNotaLinha): string[] {
  const labels: string[] = [];
  const planoBonus = clean(linha.bonusPlano, "");
  if (planoBonus) labels.push(planoBonus);

  if (linha.possuiBonus && linha.bonusGb) {
    const manual = `Bônus ${linha.bonusGb} GB`;
    const manualKey = normalizedBonusKey(manual);
    if (!labels.some(label => normalizedBonusKey(label) === manualKey)) {
      labels.push(manual);
    }
  }

  return labels;
}

function normalizedBonusKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .replace(/[^A-Z0-9]/g, "");
}

export function formatPedidoNotaText(model: PedidoNotaLive): string {
  const { tiposPedidoLabel, produtosLabel } = getPedidoNotaLineSummary(model);

  const linhas = model.linhas.length
    ? model.linhas.map((linha, index) => {
        const bonusLabels = getPedidoNotaLinhaBonusLabels(linha);
        const bonus = bonusLabels.length ? ` · ${bonusLabels.join(" · ")}` : "";
        return `  ${String(index + 1).padStart(2, "0")}. ${linhaNumero(linha)} · ${linha.produto} · ${linha.tipoProduto} · ${linha.plano}${bonus} · ${formatPedidoBrl(linha.valorMensal)} · ${linha.status}`;
      }).join("\n")
    : "  Nenhuma linha cadastrada.";

  return `Tipos de pedido: ${tiposPedidoLabel}
Produtos: ${produtosLabel}
Operadora: ${model.operadora}

CLIENTE
Razão Social: ${model.cliente.razaoSocial}
CNPJ/CPF: ${model.cliente.cnpjCpf}
Contato: ${model.cliente.contato}
Telefone: ${model.cliente.telefone}
E-mail: ${model.cliente.email}
DDD: ${model.cliente.uf} / ${model.cliente.ddd}

LINHAS
${linhas}

VALORES
Valor registrado no pedido: ${formatPedidoBrl(model.valorPedido)}`;
}
