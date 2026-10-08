// Parser definitivo das planilhas Claro 2026 / Vivo 2026.
// Lê todas as abas relevantes (GERAL ATUAL, GERAL ANTERIOR, abas de mês, STATUS PEDIDOS, SELECT)
// e devolve um payload normalizado pronto para upsert em massa no servidor.
import * as XLSX from "xlsx";

export type Operadora = "CLARO" | "VIVO";

const MESES: Record<string, number> = {
  JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, "MARÇO": 3, ABRIL: 4, MAIO: 5, JUNHO: 6,
  JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
};

export interface ParsedVenda {
  arquivo: string;
  aba: string;
  linha: number;
  operadora: Operadora;
  mes_ref: number;
  ano_ref: number;
  numero: string;
  cnpj: string;
  razao_social: string;
  uf: string | null;
  ddd: string | null;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  status: string | null;
  tipo_pedido: string | null;
  produto: string | null;
  quantidade_linhas: number;
  valor: number;
  consultor_nome: string | null;
  bko_nome: string | null;
  data_recebimento: string | null;
  data_preenchimento: string | null;
  data_envio: string | null;
  data_aceite: string | null;
  data_input: string | null;
  data_ativacao: string | null;
  data_portabilidade: string | null;
  data_entrega: string | null;
  status_portabilidade: string | null;
  cotacao: string | null;
  numero_pedido: string | null;
  nota_fiscal: string | null;
  cod_rastreio: string | null;
  serie: string | null;
  equipamentos: string | null;
  observacao: string | null;
  dados_originais: Record<string, unknown>;
  __errors: string[];
}

export interface ParsedCatalogo {
  status: { operadora: Operadora; nome: string; descricao?: string; sla_horas?: number; cor?: string; tipo?: string }[];
  produtos: { operadora: Operadora; nome: string }[];
  tipos: { operadora: Operadora; nome: string }[];
}

export interface ParseInicialResult {
  arquivo: string;
  operadora: Operadora;
  abasLidas: string[];
  vendas: ParsedVenda[];
  catalogo: ParsedCatalogo;
  erros: { aba: string; linha: number; coluna: string; valor: string; motivo: string }[];
}

// ----------------- helpers de normalização -----------------

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function norm(s: unknown): string {
  if (s == null) return "";
  return String(s).replace(/\s+/g, " ").trim();
}
function key(s: unknown): string {
  return stripAccents(norm(s)).toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function digits(s: unknown): string {
  return norm(s).replace(/\D/g, "");
}
function parseNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = String(v).replace(/[R$\s.]/g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : 0;
}
function parseDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    const t = v.getTime();
    if (!isFinite(t)) return null;
    const y = v.getFullYear();
    if (y < 2000 || y > 2035) return null;
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number") {
    // Excel serial: válido para datas entre 2000 e 2035 → 36526..49674
    if (v < 36000 || v > 50000) return null;
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y.toString().padStart(4, "0")}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = norm(v);
  if (!s || /^#(N\/A|REF|VALUE|NAME|DIV)/i.test(s)) return null;
  // ISO ou yyyy-mm-dd
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(s);
  if (iso) return s.slice(0, 10);
  // dd/mm/yyyy
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
  if (br) {
    let y = Number(br[3]); if (y < 100) y += 2000;
    return `${y.toString().padStart(4, "0")}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  return null;
}
function isErrValue(v: unknown): boolean {
  if (v == null) return false;
  const s = String(v).trim();
  return /^#(N\/A|REF!|VALUE!|NAME\?|DIV\/0!)/i.test(s);
}

// Normaliza valores que devem virar opção de catálogo (tipo de pedido, produto).
// Trata "-", vazio e nulos como "Não informado".
function normCatalogoValor(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  if (!s || /^-+$/.test(s)) return "Não informado";
  return s;
}

// Dicionário tolerante: lê o cabeçalho de cada aba e devolve um mapa coluna -> índice.
const ALIASES: Record<string, RegExp[]> = {
  consultor: [/^CONSULTOR$/, /^VENDEDOR$/, /^EXECUTIVO$/],
  bko: [/^BKO$/, /^BACKOFFICE$/],
  data_recebimento: [/^DATADERECEB/],
  data_preenchimento: [/^DATADEPREENCHIMENTO/],
  data_envio: [/^DATADEENVIO/],
  data_aceite: [/^DATADEACEITE/],
  data_input: [/^DATADEINPUT/],
  data_ativacao: [/^DATADEATIVACAO/, /^DATAATIVACAO/],
  data_portabilidade: [/^DATAPORTABILIDADE/, /^DATADEPORTABILIDADE/],
  data_entrega: [/^DATAENTREGA/, /^DATADEENTREGA/],
  cnpj: [/^CNPJ/, /^CPF$/, /^DOCUMENTO$/, /^CNPJCPF$/],
  razao_social: [/^RAZAOSOCIAL$/, /^CLIENTE$/, /^EMPRESA$/],
  uf: [/^UF$/, /^ESTADO$/],
  ddd: [/^DDD$/],
  tipo_pedido: [/^TIPODEPEDIDO$/, /^TIPO$/],
  produto: [/^PRODUTOS?$/, /^PLANO$/, /^SERVICO$/],
  quantidade_linhas: [/^QUANT?LINHAS$/, /^QUANTIDADELINHAS$/, /^QTDLINHAS$/, /^LINHAS$/],
  valor: [/^RECEITA$/, /^VALOR$/, /^MENSALIDADE$/, /^TOTAL$/],
  status: [/^STATUS$/, /^SITUACAO$/],
  observacao: [/^OBSERVACAO$/, /^OBS$/, /^COMENTARIO$/],
  status_portabilidade: [/^STATUSPORTABILIDADE/],
  cotacao: [/^COTACAO/, /^COTACAONDOPEDIDONDAORDEM/],
  numero_pedido: [/^NUMERODOPEDIDO$/, /^NPEDIDO$/, /^NDOPEDIDO$/],
  nota_fiscal: [/^NOTAFISCAL/, /^NF$/, /^NOTAFISCALCODRASTREIO/],
  cod_rastreio: [/^CODRASTREIO$/, /^CODIGORASTREIO$/],
  serie: [/^SERIE$/],
  equipamentos: [/^CHIPESIMEOUAPARELHOSMODELOSEQUANTIDADES$/, /^CHIPESIMEAPARELHOS/, /^EQUIPAMENTOS$/, /^APARELHOS$/],
  email: [/^EMAIL$/, /^EMAILDOCLIENTE$/],
  telefone: [/^TELEFONE$/, /^CELULAR$/, /^FONE$/],
  contato: [/^CONTATO$/, /^RESPONSAVEL$/],
  numero: [/^NPEDIDO$/, /^NDOPEDIDO$/, /^PROTOCOLO$/, /^PEDIDO$/],
  sla: [/^SLA$/],
  ultima_alteracao: [/^ULTIMAALTERACAO$/],
};

function buildHeaderMap(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    const k = key(h);
    if (!k) return;
    for (const [field, regs] of Object.entries(ALIASES)) {
      if (map[field] !== undefined) continue;
      if (regs.some(r => r.test(k))) {
        map[field] = i;
      }
    }
  });
  return map;
}

function findHeaderRow(rows: unknown[][]): number {
  // Procura a linha com "SLA" + "CONSULTOR" + "BKO" ou "RAZAO SOCIAL"+"CNPJ"
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const ks = rows[i].map(key);
    const has = (...t: string[]) => t.every(x => ks.some(k => k === x));
    if (has("CONSULTOR", "BKO") || has("RAZAOSOCIAL", "CNPJCPF") || has("RAZAOSOCIAL", "CNPJ")) {
      return i;
    }
  }
  return -1;
}

function abaParaMesAno(aba: string, anoPadrao: number): { mes: number; ano: number } | null {
  const k = key(aba);
  // "DEZEMBRO 2025" → mes 12 / 2025
  const matchAno = /^([A-Z]+)(\d{4})$/.exec(k) || /^([A-Z]+)(20\d{2})$/.exec(k);
  if (matchAno) {
    const m = MESES[matchAno[1]];
    if (m) return { mes: m, ano: Number(matchAno[2]) };
  }
  const m = MESES[k];
  if (m) return { mes: m, ano: anoPadrao };
  return null;
}

// ----------------- parser principal -----------------

export async function parseInicial(file: File): Promise<ParseInicialResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const filename = file.name;
  const operadora: Operadora = /vivo/i.test(filename) ? "VIVO" : "CLARO";

  const result: ParseInicialResult = {
    arquivo: filename,
    operadora,
    abasLidas: [],
    vendas: [],
    catalogo: { status: [], produtos: [], tipos: [] },
    erros: [],
  };

  const anoPadrao = 2026;
  const statusSet = new Set<string>();
  const produtoSet = new Set<string>();
  const tipoSet = new Set<string>();

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false, blankrows: false }) as unknown[][];
    if (rows.length === 0) continue;

    // Catálogos separados
    if (/STATUS\s*PEDIDOS/i.test(sheetName)) {
      // Tenta detectar coluna "STATUS" / "SLA" / "DIAS"
      const hRow = rows.find(r => r.some(c => key(c) === "STATUS")) ?? rows[0];
      const hIdx = rows.indexOf(hRow);
      const mapH: Record<string, number> = {};
      hRow.forEach((c, i) => {
        const k = key(c);
        if (k === "STATUS") mapH.nome = i;
        else if (k === "DESCRICAO") mapH.descricao = i;
        else if (k === "SLA" || k === "DIAS" || k === "PRAZO") mapH.sla = i;
        else if (k === "COR") mapH.cor = i;
        else if (k === "TIPO") mapH.tipo = i;
      });
      for (let i = hIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        const nome = norm(r[mapH.nome ?? 0]);
        if (!nome || nome === "-") continue;
        const sla = parseNumber(r[mapH.sla ?? -1]);
        result.catalogo.status.push({
          operadora,
          nome,
          descricao: norm(r[mapH.descricao ?? -1]) || undefined,
          sla_horas: sla > 0 ? Math.round(sla * 24) : undefined,
          cor: norm(r[mapH.cor ?? -1]) || undefined,
          tipo: norm(r[mapH.tipo ?? -1]) || undefined,
        });
      }
      result.abasLidas.push(sheetName);
      continue;
    }
    if (/^SELECT$/i.test(sheetName)) {
      // SELECT é livre: percorre todas as colunas e extrai vocabulários
      const header = rows[0] ?? [];
      for (let c = 0; c < header.length; c++) {
        const colKey = key(header[c]);
        const target =
          /STATUS/.test(colKey) ? "status" :
          /PRODUTO|PLANO/.test(colKey) ? "produtos" :
          /TIPODE?PEDIDO|TIPO$/.test(colKey) ? "tipos" : null;
        if (!target) continue;
        for (let i = 1; i < rows.length; i++) {
          const v = norm(rows[i][c]);
          if (!v) continue;
          if (target === "status") statusSet.add(v);
          if (target === "produtos") produtoSet.add(v);
          if (target === "tipos") tipoSet.add(v);
        }
      }
      result.abasLidas.push(sheetName);
      continue;
    }

    // Ignora abas redundantes ou auxiliares
    if (/^(CONFIG\.?|GERAL|ATUAL|ANTERIOR)$/i.test(sheetName)) continue;

    // Define mes/ano da aba
    let mesRef: number;
    let anoRef: number;
    if (/GERAL\s*ATUAL/i.test(sheetName)) {
      const now = new Date();
      mesRef = now.getMonth() + 1;
      anoRef = now.getFullYear();
    } else if (/GERAL\s*ANTERIOR/i.test(sheetName)) {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      mesRef = prev.getMonth() + 1;
      anoRef = prev.getFullYear();
    } else {
      const ma = abaParaMesAno(sheetName, anoPadrao);
      if (!ma) continue;
      mesRef = ma.mes;
      anoRef = ma.ano;
    }

    const hIdx = findHeaderRow(rows);
    if (hIdx < 0) continue;
    const header = rows[hIdx];
    const map = buildHeaderMap(header);
    if (map.razao_social === undefined && map.cnpj === undefined) continue;

    for (let i = hIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every(c => c == null || c === "")) continue;

      const getStr = (k: string): string | null => {
        const idx = map[k];
        if (idx === undefined) return null;
        const v = r[idx];
        if (isErrValue(v)) return null;
        const s = norm(v);
        return s || null;
      };
      const getNum = (k: string): number => {
        const idx = map[k];
        if (idx === undefined) return 0;
        if (isErrValue(r[idx])) return 0;
        return parseNumber(r[idx]);
      };
      const getDate = (k: string): string | null => {
        const idx = map[k];
        if (idx === undefined) return null;
        return parseDate(r[idx]);
      };

      const razao = getStr("razao_social");
      const cnpjRaw = getStr("cnpj");
      const cnpj = cnpjRaw ? cnpjRaw.trim() : "";

      // descarta lixo (linha de cabeçalho repetido, "- não usar", etc.)
      const filhoLinha = norm(r[map.consultor ?? -1]);
      if (filhoLinha.startsWith("- não usar") || filhoLinha === "-") continue;
      if (!razao || /^-+$/.test(razao)) continue;

      const errors: string[] = [];

      const status = getStr("status");
      const produtoRaw = getStr("produto");
      const tipoRaw = getStr("tipo_pedido");
      const produto = normCatalogoValor(produtoRaw);
      const tipo = normCatalogoValor(tipoRaw);
      if (status) statusSet.add(status);
      if (produto) produtoSet.add(produto);
      if (tipo) tipoSet.add(tipo);

      const numero =
        getStr("numero") ||
        getStr("cotacao") ||
        getStr("numero_pedido") ||
        `${sheetName.slice(0, 3).toUpperCase()}-${i + 1}`;

      const dadosOriginais: Record<string, unknown> = {};
      header.forEach((h, idx) => {
        const k = norm(h);
        if (!k) return;
        const v = r[idx];
        if (v != null && v !== "" && !isErrValue(v)) {
          dadosOriginais[k] = v instanceof Date ? v.toISOString() : v;
        }
      });

      result.vendas.push({
        arquivo: filename,
        aba: sheetName,
        linha: i + 1,
        operadora,
        mes_ref: mesRef,
        ano_ref: anoRef,
        numero,
        cnpj,
        razao_social: razao,
        uf: getStr("uf")?.toUpperCase().slice(0, 2) ?? null,
        ddd: getStr("ddd"),
        contato: getStr("contato"),
        telefone: getStr("telefone"),
        email: getStr("email"),
        status,
        tipo_pedido: tipo,
        produto,
        quantidade_linhas: Math.round(getNum("quantidade_linhas")),
        valor: getNum("valor"),
        consultor_nome: getStr("consultor"),
        bko_nome: getStr("bko"),
        data_recebimento: getDate("data_recebimento"),
        data_preenchimento: getDate("data_preenchimento"),
        data_envio: getDate("data_envio"),
        data_aceite: getDate("data_aceite"),
        data_input: getDate("data_input"),
        data_ativacao: getDate("data_ativacao"),
        data_portabilidade: getDate("data_portabilidade"),
        data_entrega: getDate("data_entrega"),
        status_portabilidade: getStr("status_portabilidade"),
        cotacao: getStr("cotacao"),
        numero_pedido: getStr("numero_pedido"),
        nota_fiscal: getStr("nota_fiscal"),
        cod_rastreio: getStr("cod_rastreio"),
        serie: getStr("serie"),
        equipamentos: getStr("equipamentos"),
        observacao: getStr("observacao"),
        dados_originais: dadosOriginais,
        __errors: errors,
      });

      if (errors.length > 0) {
        for (const e of errors) {
          result.erros.push({ aba: sheetName, linha: i + 1, coluna: "CNPJ/CPF", valor: cnpjRaw ?? "", motivo: e });
        }
      }
    }
    result.abasLidas.push(sheetName);
  }

  // Materializa catálogos coletados
  statusSet.forEach(nome => {
    if (!result.catalogo.status.find(s => s.nome.toUpperCase() === nome.toUpperCase())) {
      result.catalogo.status.push({ operadora, nome });
    }
  });
  produtoSet.forEach(nome => result.catalogo.produtos.push({ operadora, nome }));
  tipoSet.forEach(nome => result.catalogo.tipos.push({ operadora, nome }));

  return result;
}

// ----------------- classificação de funil/etapa -----------------

export type Funil = "prospeccao" | "followup" | "assinatura" | "suporte";

export function classifyFunil(status: string | null): { funil: Funil; etapa_id: string; terminal: boolean } {
  const s = (status ?? "").toLowerCase();
  const terminal = /(cancel|reprov|negad|conclu|finaliz|inativ)/.test(s);
  if (/(suport|logist|entreg|portab|instala|tratativ|retorno)/.test(s))
    return { funil: "suporte", etapa_id: "triagem", terminal };
  if (/(assin|biometr|contrato|aceit|ativa|reenvio)/.test(s))
    return { funil: "assinatura", etapa_id: "assinatura_pendente", terminal };
  if (/(propost|negoc|follow|carteir|preench|retorno)/.test(s))
    return { funil: "followup", etapa_id: "negociacao", terminal };
  if (/(novo|prospec|qualif|cotac|aguard|fila|analise|conferenc|pendent)/.test(s))
    return { funil: "prospeccao", etapa_id: "qualificacao", terminal };
  return { funil: "prospeccao", etapa_id: "aguardando_classificacao", terminal };
}

export function normalizeColabKey(nome: string): string {
  return stripAccents(norm(nome)).toLowerCase().replace(/\s+/g, " ");
}
