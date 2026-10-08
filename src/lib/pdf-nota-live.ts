import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  formatPedidoBrl,
  getPedidoNotaLinhaBonusLabels,
  getPedidoNotaLineSummary,
  type PedidoNotaLive,
} from "@/lib/pedido-nota-live";

const OMNI = "#FACC15";
const DARK = "#0A0A0A";
const MUTED = "#6B7280";
const SOFT = "#F4F4F5";
const CLARO = "#E60000";
const VIVO = "#660099";

function clean(value: unknown, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function lineLabel(ddd: string, numero: string) {
  if (ddd && numero) return `(${ddd}) ${numero}`;
  if (numero) return numero;
  return "Sem número";
}

function sectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setTextColor(DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(title, 40, y);
  doc.setDrawColor(OMNI);
  doc.setLineWidth(1.2);
  doc.line(40, y + 4, 150, y + 4);
}

export function gerarNotaLivePDF(model: PedidoNotaLive): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const operatorColor = model.operadora === "CLARO" ? CLARO : VIVO;
  const { tiposPedidoLabel, produtosLabel } = getPedidoNotaLineSummary(model);

  doc.setFillColor(DARK);
  doc.rect(0, 0, W, 78, "F");
  doc.setFillColor(OMNI);
  doc.rect(0, 74, W, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor("#FFFFFF");
  doc.text("OMNI", 40, 34);
  doc.setTextColor(OMNI);
  doc.text("Flow Lab", 100, 34);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor("#D4D4D8");
  doc.text("Nota do Pedido", 40, 51);

  doc.setFillColor(operatorColor);
  doc.roundedRect(W - 105, 24, 65, 24, 4, 4, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(clean(model.operadora), W - 72.5, 40, { align: "center" });

  let y = 105;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text("TIPOS DE PEDIDO", 40, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(DARK);
  const tiposLines = doc.splitTextToSize(tiposPedidoLabel, W - 210);
  doc.text(tiposLines, 150, y);
  y += Math.max(18, tiposLines.length * 11);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(MUTED);
  doc.text("PRODUTOS", 40, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(DARK);
  const produtosLines = doc.splitTextToSize(produtosLabel, W - 210);
  doc.text(produtosLines, 150, y);
  y += Math.max(26, produtosLines.length * 11 + 8);

  sectionTitle(doc, "CLIENTE", y);
  y += 22;

  const clienteRows = [
    ["Razão Social", clean(model.cliente.razaoSocial)],
    ["CNPJ/CPF", clean(model.cliente.cnpjCpf)],
    ["Contato", clean(model.cliente.contato)],
    ["Telefone", clean(model.cliente.telefone)],
    ["E-mail", clean(model.cliente.email)],
    ["DDD", `${clean(model.cliente.uf)} / ${clean(model.cliente.ddd)}`],
  ];

  autoTable(doc, {
    startY: y,
    body: clienteRows,
    theme: "plain",
    bodyStyles: { fontSize: 8.5, textColor: "#222222", cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: "bold", textColor: MUTED, cellWidth: 85 },
      1: { cellWidth: W - 165 },
    },
    alternateRowStyles: { fillColor: SOFT },
    margin: { left: 40, right: 40 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
  sectionTitle(doc, "LINHAS", y);
  y += 12;

  const rows = model.linhas.map((linha, index) => {
    const bonusLabels = getPedidoNotaLinhaBonusLabels(linha);
    const bonus = bonusLabels.length ? bonusLabels.join(" · ") : "—";
    return [
      String(index + 1).padStart(2, "0"),
      lineLabel(linha.ddd, linha.numero),
      linha.produto,
      linha.tipoProduto,
      `${linha.plano}\n${bonus}`,
      formatPedidoBrl(linha.valorMensal),
      linha.status,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["#", "Linha", "Produto", "Tipo de pedido", "Plano / Bônus", "Valor", "Status"]],
    body: rows.length
      ? rows
      : [["—", "Nenhuma linha cadastrada", "—", "—", "—", formatPedidoBrl(0), "—"]],
    theme: "grid",
    headStyles: { fillColor: DARK, textColor: "#FFFFFF", fontSize: 7.2 },
    bodyStyles: { fontSize: 7.2, textColor: "#222222", valign: "middle" },
    alternateRowStyles: { fillColor: "#FAFAFA" },
    columnStyles: {
      0: { halign: "center", cellWidth: 25 },
      1: { cellWidth: 78 },
      2: { cellWidth: 65 },
      3: { cellWidth: 95 },
      5: { halign: "right", cellWidth: 58 },
      6: { cellWidth: 45 },
    },
    margin: { left: 40, right: 40 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  if (y + 70 > pageH - 55) {
    doc.addPage();
    y = 60;
  }

  sectionTitle(doc, "VALORES", y);
  y += 24;

  doc.setFillColor(SOFT);
  doc.roundedRect(W - 270, y - 15, 230, 42, 5, 5, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text("Valor registrado no pedido", W - 255, y + 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(DARK);
  doc.text(formatPedidoBrl(model.valorPedido), W - 55, y + 7, { align: "right" });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const footerY = doc.internal.pageSize.getHeight();
    doc.setDrawColor("#E4E4E7");
    doc.line(40, footerY - 42, W - 40, footerY - 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED);
    doc.text("OMNI Assessoria · OMNI Flow Lab", 40, footerY - 27);
    doc.text(`Página ${page}/${pageCount}`, W - 40, footerY - 27, { align: "right" });
  }

  return doc;
}
