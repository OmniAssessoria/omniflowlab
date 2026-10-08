import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Venda, Cliente } from "./mock-data";

const OMNI = "#FACC15";
const DARK = "#0A0A0A";
const MUTED = "#737373";
const CLARO = "#E60000";
const VIVO = "#660099";

type LinhaNota = {
  numero?: string | null;
  ddd?: string | null;
  plano?: string | null;
  produto?: string | null;
  valor_mensal?: number | string | null;
  valorMensal?: number | string | null;
  status?: string | null;
  ordem?: number | null;
  observacao?: string | null;
};

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function clean(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text === "—" || text.toLowerCase() === "null" || text.toLowerCase() === "undefined") return "";
  return text;
}

function info(value: unknown, fallback = "Não informado"): string {
  return clean(value) || fallback;
}

function fmtDate(value: unknown): string {
  const text = clean(value);
  if (!text) return "—";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleDateString("pt-BR");
}

function joinInfo(parts: string[]): string {
  return parts.filter(part => clean(part)).join(" · ");
}

function safeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getLinhasFromVenda(venda: Venda): LinhaNota[] {
  const dynamicVenda = venda as Venda & Record<string, unknown>;
  const candidates = [
    dynamicVenda.linhas,
    dynamicVenda.venda_linhas,
    dynamicVenda.vendaLinhas,
    dynamicVenda.linhasPedido,
    dynamicVenda.itens,
  ];

  const found = candidates.find((candidate): candidate is LinhaNota[] => Array.isArray(candidate) && candidate.length > 0);
  if (found) {
    return found.slice().sort((a, b) => safeNumber(a.ordem) - safeNumber(b.ordem));
  }

  const qtd = Math.max(0, safeNumber(venda.quantidadeLinhas));
  const media = qtd > 0 ? safeNumber(venda.receita) / qtd : 0;

  return Array.from({ length: Math.min(qtd, 30) }).map((_, index) => ({
    numero: null,
    ddd: null,
    plano: `Plano ${venda.operadora} ${venda.produto}`,
    produto: venda.produto,
    valor_mensal: media,
    status: "ativa",
    ordem: index + 1,
  }));
}

function linhaDisplay(linha: LinhaNota, index: number, cliente: Cliente): string {
  const numero = clean(linha.numero);
  const ddd = clean(linha.ddd) || clean(cliente.ddd);
  if (numero && ddd) return `(${ddd}) ${numero}`;
  if (numero) return numero;
  return `Linha ${String(index + 1).padStart(3, "0")} sem número cadastrado`;
}

function planoDisplay(linha: LinhaNota, venda: Venda): string {
  return info(linha.plano, `Plano ${venda.operadora} ${venda.produto}`);
}

function valorLinha(linha: LinhaNota): number {
  return safeNumber(linha.valor_mensal ?? linha.valorMensal);
}

function isLinhaCancelada(linha: LinhaNota): boolean {
  return clean(linha.status).toLowerCase() === "cancelada";
}

function textFit(doc: jsPDF, text: string, x: number, y: number, maxWidth: number) {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines.slice(0, 2), x, y);
}

export function gerarNotaPDF(venda: Venda, cliente: Cliente, consultor?: string, etapaNome?: string, linhasArg?: LinhaNota[]): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const opCor = venda.operadora === "CLARO" ? CLARO : VIVO;

  const linhas = (linhasArg !== undefined ? linhasArg : getLinhasFromVenda(venda)).slice(0, 60);
  const linhasAtivas = linhas.filter(linha => !isLinhaCancelada(linha));
  const somaLinhas = linhasAtivas.reduce((sum, linha) => sum + valorLinha(linha), 0);
  const subtotal = somaLinhas > 0 ? somaLinhas : safeNumber(venda.receita);
  const totalLinhas = linhasAtivas.length || safeNumber(venda.quantidadeLinhas);

  // Cabeçalho - faixa preta + acento amarelo
  doc.setFillColor(DARK);
  doc.rect(0, 0, W, 90, "F");
  doc.setFillColor(OMNI);
  doc.rect(0, 86, W, 4, "F");

  // Logo "OMNI Flow Lab"
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("OMNI", 40, 42);
  doc.setTextColor(OMNI);
  doc.text("Flow Lab", 105, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor("#999");
  doc.text("Pipeline inteligente · OMNI Assessoria", 40, 60);

  // Bloco do pedido (direita)
  doc.setFontSize(9);
  doc.setTextColor("#FFFFFF");
  doc.text("NOTA DO PEDIDO", W - 40, 30, { align: "right" });
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(info(venda.numero, "Sem número"), W - 40, 50, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleDateString("pt-BR"), W - 40, 68, { align: "right" });

  // Tag operadora
  doc.setFillColor(opCor);
  doc.roundedRect(W - 110, 100, 70, 22, 4, 4, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(info(venda.operadora, "—"), W - 75, 115, { align: "center" });

  // Bloco Cliente
  doc.setTextColor(DARK);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE", 40, 120);
  doc.setDrawColor(OMNI);
  doc.setLineWidth(1.5);
  doc.line(40, 124, 100, 124);

  doc.setFontSize(13);
  textFit(doc, info(cliente.razaoSocial, "Cliente não informado"), 40, 145, W - 170);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);

  doc.text(`CNPJ/CPF: ${info(cliente.cnpj)}`, 40, 162);
  doc.text(joinInfo([`UF: ${info(cliente.uf)}`, `DDD: ${info(cliente.ddd)}`]), 40, 176);
  doc.text(joinInfo([`Contato: ${info(cliente.contato)}`, `Telefone: ${info(cliente.telefone)}`, `E-mail: ${info(cliente.email)}`]), 40, 190);

  // Bloco Detalhes do Pedido
  doc.setTextColor(DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("DETALHES DO PEDIDO", 40, 224);
  doc.setLineWidth(1.5);
  doc.line(40, 228, 200, 228);

  const detailY = 244;
  const colW = (W - 80) / 4;
  const cells = [
    ["Tipo", info(venda.tipoPedido)],
    ["Produto", info(venda.produto)],
    ["Etapa", info(etapaNome)],
    ["Mês ref.", `${String(venda.mesRef || "").padStart(2, "0")}/${info(venda.anoRef)}`],
  ];
  cells.forEach(([k, v], i) => {
    const x = 40 + i * colW;
    doc.setFillColor("#F5F5F5");
    doc.roundedRect(x, detailY, colW - 10, 50, 4, 4, "F");
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    doc.setFont("helvetica", "normal");
    doc.text(k.toUpperCase(), x + 10, detailY + 16);
    doc.setFontSize(10);
    doc.setTextColor(DARK);
    doc.setFont("helvetica", "bold");
    textFit(doc, String(v), x + 10, detailY + 34, colW - 30);
  });

  // Resumo operacional para a pré-visualização refletir o pedido atual.
  const operacionalY = 312;
  doc.setTextColor(DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("OPERACIONAL", 40, operacionalY);
  doc.setLineWidth(1.5);
  doc.line(40, operacionalY + 4, 125, operacionalY + 4);

  const operationalRows = [
    ["Status do pedido", info(venda.statusPedido, info(venda.status, "—")), "Status comercial", info(venda.statusComercialNome, "—")],
    ["Biometria", info(venda.statusBiometria, "—"), "Recebimento", fmtDate(venda.dataRecebimento)],
    ["Preenchimento", fmtDate(venda.dataPreenchimento), "Envio", fmtDate(venda.dataEnvio)],
    ["Aceite", fmtDate(venda.dataAceite), "Input", fmtDate(venda.dataInput)],
    ["Ativação", fmtDate(venda.dataAtivacao), "Portabilidade", fmtDate(venda.dataPortabilidade)],
    ["Entrega/Instalação", fmtDate(venda.dataEntrega), "Última alteração", fmtDate(venda.atualizadoEm)],
  ];

  autoTable(doc, {
    startY: operacionalY + 12,
    body: operationalRows,
    theme: "plain",
    bodyStyles: { fontSize: 8.5, textColor: "#333", cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", textColor: MUTED, cellWidth: 92 },
      1: { cellWidth: 145 },
      2: { fontStyle: "bold", textColor: MUTED, cellWidth: 92 },
      3: { cellWidth: 145 },
    },
    margin: { left: 40, right: 40 },
    didParseCell: (data) => {
      if (data.row.index % 2 === 0) data.cell.styles.fillColor = "#FAFAFA";
    },
  });

  let linhasStartY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;

  const rows = linhas.map((linha, i) => {
    const status = clean(linha.status);
    const statusLabel = status && status !== "ativa" ? ` (${status})` : "";
    return [
      String(i + 1).padStart(3, "0"),
      linhaDisplay(linha, i, cliente),
      `${planoDisplay(linha, venda)}${statusLabel}`,
      brl(valorLinha(linha)),
    ];
  });

  autoTable(doc, {
    startY: linhasStartY,
    head: [["#", "Linha", "Plano", "Valor mensal"]],
    body: rows.length > 0 ? rows : [["—", "Nenhuma linha cadastrada", "Revise a aba Linhas antes de enviar", brl(subtotal)]],
    theme: "grid",
    headStyles: { fillColor: DARK, textColor: "#FFFFFF", fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: "#222" },
    alternateRowStyles: { fillColor: "#FAFAFA" },
    columnStyles: { 0: { halign: "center", cellWidth: 40 }, 3: { halign: "right", cellWidth: 90 } },
    margin: { left: 40, right: 40 },
  });

  let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;

  if (finalY + 95 > pageH - 80) {
    doc.addPage();
    finalY = 60;
  }

  // Totais
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(DARK);
  doc.text(`Subtotal: ${brl(subtotal)}`, W - 40, finalY, { align: "right" });
  doc.text(`Linhas consideradas: ${totalLinhas}`, W - 40, finalY + 16, { align: "right" });

  doc.setFillColor(OMNI);
  doc.roundedRect(W - 230, finalY + 28, 190, 36, 6, 6, "F");
  doc.setTextColor(DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL MENSAL", W - 215, finalY + 46);
  doc.setFontSize(16);
  doc.text(brl(subtotal), W - 50, finalY + 52, { align: "right" });

  if (linhasArg === undefined && linhas.some(linha => !clean(linha.numero))) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    doc.text("Observação: linhas sem número usam dados consolidados do pedido. Revise a aba Linhas para detalhamento completo.", 40, finalY + 86);
  }

  // Rodapé
  const footerY = doc.internal.pageSize.getHeight();
  doc.setDrawColor("#DDD");
  doc.setLineWidth(0.5);
  doc.line(40, footerY - 80, W - 40, footerY - 80);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text(`Consultor responsável: ${consultor ?? "—"}`, 40, footerY - 60);
  doc.text(`Documento gerado em ${new Date().toLocaleString("pt-BR")}`, 40, footerY - 46);
  doc.text("OMNI Assessoria · OMNI Flow Lab", 40, footerY - 32);
  doc.setTextColor(DARK);
  doc.setFont("helvetica", "bold");
  doc.text("Validade: 7 dias", W - 40, footerY - 32, { align: "right" });

  return doc;
}
