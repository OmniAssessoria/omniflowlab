// Parser da aba GERAL ATUAL das planilhas Claro 2026 / Vivo 2026.
import * as XLSX from "xlsx";

export type Operadora = "CLARO" | "VIVO";

export interface ParsedRow {
  numero: string;
  cliente_razao_social: string;
  cliente_cnpj: string;
  cliente_contato: string | null;
  cliente_telefone: string | null;
  cliente_email: string | null;
  cliente_uf: string | null;
  status: string | null;
  tipo_pedido: string | null;
  produto: string | null;
  quantidade_linhas: number;
  valor: number;
  etapa_id: string;
  funil: "prospeccao" | "followup" | "assinatura" | "suporte";
  consultor_nome: string | null;
  observacao: string | null;
  __rowIndex: number;
  __errors: string[];
}

export interface ParseResult {
  operadora: Operadora;
  abaUsada: string;
  rows: ParsedRow[];
  totalLinhas: number;
  totalErros: number;
}

// Heurísticas de detecção
const TARGET_SHEET = /geral\s*atual/i;

function pickSheetName(wb: XLSX.WorkBook): string {
  const match = wb.SheetNames.find(n => TARGET_SHEET.test(n));
  return match || wb.SheetNames[0];
}

function detectOperadora(filename: string, sample: Record<string, unknown>[]): Operadora {
  const f = filename.toLowerCase();
  if (f.includes("claro")) return "CLARO";
  if (f.includes("vivo")) return "VIVO";
  // Heurística: olha valores nos primeiros registros
  const flat = JSON.stringify(sample.slice(0, 20)).toLowerCase();
  if (flat.includes("vivo")) return "VIVO";
  return "CLARO";
}

function norm(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function normCat(v: string): string {
  const s = v.trim();
  if (!s || /^-+$/.test(s)) return "Não informado";
  return s;
}

function findKey(row: Record<string, unknown>, ...patterns: RegExp[]): string | null {
  for (const k of Object.keys(row)) {
    for (const p of patterns) if (p.test(k)) return k;
  }
  return null;
}

function digits(v: unknown): string {
  return norm(v).replace(/\D/g, "");
}

function parseValor(v: unknown): number {
  if (typeof v === "number") return v;
  const s = norm(v).replace(/[R$\s.]/g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function inferFunilEtapa(status: string): { funil: ParsedRow["funil"]; etapa_id: string } {
  const s = status.toLowerCase();
  if (/prospec|novo|cota[cç]/.test(s)) return { funil: "prospeccao", etapa_id: "qualificacao" };
  if (/follow|negocia|propost/.test(s)) return { funil: "followup", etapa_id: "negociacao" };
  if (/assin|contrato|biometr|aceit|ativa/.test(s)) return { funil: "assinatura", etapa_id: "assinatura_pendente" };
  if (/suport|chamado|problema|erro/.test(s)) return { funil: "suporte", etapa_id: "triagem" };
  return { funil: "prospeccao", etapa_id: "qualificacao" };
}

export async function parseXlsx(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = pickSheetName(wb);
  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  const operadora = detectOperadora(file.name, raw);

  const rows: ParsedRow[] = raw.map((r, idx) => {
    const errors: string[] = [];

    const kNumero = findKey(r, /n[°ºo]?\s*pedido/i, /pedido/i, /protocolo/i, /^n[°ºo]$/i);
    const kRazao = findKey(r, /raz[aã]o/i, /cliente/i, /empresa/i);
    const kCnpj = findKey(r, /cnpj/i, /cpf/i, /documento/i);
    const kContato = findKey(r, /contato/i, /respons/i);
    const kTel = findKey(r, /telefone/i, /celular/i, /fone/i);
    const kEmail = findKey(r, /e-?mail/i);
    const kUf = findKey(r, /^uf$/i, /estado/i);
    const kStatus = findKey(r, /status/i, /situa[cç][aã]o/i, /etapa/i);
    const kTipo = findKey(r, /tipo.*pedido/i, /tipo$/i);
    const kProd = findKey(r, /produto/i, /plano/i, /servi[cç]o/i);
    const kQtd = findKey(r, /qtde?.*linhas/i, /linhas/i, /quantidade/i);
    const kValor = findKey(r, /valor/i, /receita/i, /mensalidade/i, /total/i);
    const kConsultor = findKey(r, /consultor/i, /vendedor/i, /executivo/i);
    const kObs = findKey(r, /observ/i, /coment/i, /nota/i);

    const numero = kNumero ? norm(r[kNumero]) : `IMP-${idx + 1}`;
    const razao = kRazao ? norm(r[kRazao]) : "";
    const cnpj = kCnpj ? norm(r[kCnpj]) : "";
    const status = kStatus ? norm(r[kStatus]) : "";

    if (!razao) errors.push("razão social vazia");
    if (!cnpj) errors.push("CNPJ/CPF vazio");

    const { funil, etapa_id } = inferFunilEtapa(status);

    return {
      numero: numero || `IMP-${idx + 1}`,
      cliente_razao_social: razao || "(sem razão)",
      cliente_cnpj: cnpj,
      cliente_contato: kContato ? norm(r[kContato]) || null : null,
      cliente_telefone: kTel ? norm(r[kTel]) || null : null,
      cliente_email: kEmail ? norm(r[kEmail]) || null : null,
      cliente_uf: kUf ? norm(r[kUf]).toUpperCase().slice(0, 2) || null : null,
      status: status || null,
      tipo_pedido: normCat(kTipo ? norm(r[kTipo]) : ""),
      produto: normCat(kProd ? norm(r[kProd]) : ""),
      quantidade_linhas: kQtd ? Number(digits(r[kQtd])) || 0 : 0,
      valor: kValor ? parseValor(r[kValor]) : 0,
      etapa_id,
      funil,
      consultor_nome: kConsultor ? norm(r[kConsultor]) || null : null,
      observacao: kObs ? norm(r[kObs]) || null : null,
      __rowIndex: idx + 2, // +2 = header + 1-indexado
      __errors: errors,
    };
  });

  return {
    operadora,
    abaUsada: sheetName,
    rows,
    totalLinhas: rows.length,
    totalErros: rows.filter(r => r.__errors.length > 0).length,
  };
}
