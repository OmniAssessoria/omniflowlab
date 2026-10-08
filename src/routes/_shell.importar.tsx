import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useOmni } from "@/lib/omni-store";
import { parseXlsx, type ParseResult, type ParsedRow, type Operadora } from "@/lib/xlsx-parser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Copy as CopyIcon,
  ShieldX, Loader2, Trash2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_shell/importar")({
  component: ImportarPage,
});

type RowStatus = "novo" | "duplicado" | "erro";

interface PreviewRow extends ParsedRow {
  __status: RowStatus;
}

function ImportarPage() {
  const { primaryRole, user } = useAuth();
  const { mesRef, anoRef } = useOmni();
  const canImport = primaryRole === "admin" || primaryRole === "gestor";

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [page, setPage] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const novos = preview.filter(r => r.__status === "novo").length;
  const dups = preview.filter(r => r.__status === "duplicado").length;
  const erros = preview.filter(r => r.__status === "erro").length;

  const handleFile = useCallback(async (f: File) => {
    setFile(f); setResult(null); setPreview([]); setPage(0);
    setParsing(true);
    try {
      const res = await parseXlsx(f);

      // Cruza com banco para detecção de duplicidade
      const cnpjs = Array.from(new Set(res.rows.map(r => r.cliente_cnpj).filter(Boolean)));
      let existentes = new Set<string>();
      if (cnpjs.length > 0) {
        const { data } = await supabase
          .from("vendas")
          .select("cliente_cnpj, numero")
          .eq("operadora", res.operadora)
          .eq("mes_ref", mesRef)
          .eq("ano_ref", anoRef)
          .in("cliente_cnpj", cnpjs);
        existentes = new Set((data ?? []).map(d => `${d.cliente_cnpj}|${d.numero}`));
      }

      const prev: PreviewRow[] = res.rows.map(r => {
        let status: RowStatus = "novo";
        if (r.__errors.length > 0) status = "erro";
        else if (existentes.has(`${r.cliente_cnpj}|${r.numero}`)) status = "duplicado";
        return { ...r, __status: status };
      });

      setResult(res);
      setPreview(prev);
      toast.success(`Planilha analisada: ${res.operadora} · aba "${res.abaUsada}"`, {
        description: `${res.totalLinhas} linhas detectadas.`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      toast.error("Falha ao ler planilha", { description: msg });
    } finally {
      setParsing(false);
    }
  }, [mesRef, anoRef]);

  async function handleImport() {
    if (!result || !file || !user) return;
    const toInsert = preview.filter(r => r.__status === "novo");
    if (toInsert.length === 0) {
      toast.info("Nada para importar."); return;
    }
    setImporting(true);
    try {
      const payload = toInsert.map(r => ({
        numero: r.numero,
        operadora: result.operadora,
        mes_ref: mesRef,
        ano_ref: anoRef,
        cliente_razao_social: r.cliente_razao_social,
        cliente_cnpj: r.cliente_cnpj,
        cliente_contato: r.cliente_contato,
        cliente_telefone: r.cliente_telefone,
        cliente_email: r.cliente_email,
        cliente_uf: r.cliente_uf,
        status: r.status,
        tipo_pedido: r.tipo_pedido,
        produto: r.produto,
        quantidade_linhas: r.quantidade_linhas,
        valor: r.valor,
        funil: r.funil,
        etapa_id: r.etapa_id,
        consultor_nome: r.consultor_nome,
        observacao: r.observacao,
        created_by: user.id,
      }));

      const { error } = await supabase.from("vendas").insert(payload);
      if (error) throw error;

      await supabase.from("import_logs").insert({
        arquivo: file.name,
        operadora: result.operadora,
        mes_ref: mesRef,
        ano_ref: anoRef,
        total_linhas: result.totalLinhas,
        total_inseridas: toInsert.length,
        total_duplicadas: dups,
        total_erros: erros,
        importado_por: user.id,
      });

      toast.success(`${toInsert.length} vendas importadas`, {
        description: `${dups} duplicadas ignoradas · ${erros} com erro.`,
      });
      setFile(null); setResult(null); setPreview([]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      toast.error("Falha ao importar", { description: msg });
    } finally {
      setImporting(false);
    }
  }

  const pageRows = useMemo(() => preview.slice(page * 50, page * 50 + 50), [preview, page]);
  const totalPages = Math.max(1, Math.ceil(preview.length / 50));

  if (!canImport) {
    return (
      <div className="p-6">
        <Card className="bg-card border-border max-w-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldX className="size-6 text-destructive" />
              <CardTitle>Sem permissão</CardTitle>
            </div>
            <CardDescription>
              Apenas <b>Administrador</b> e <b>Gestor</b> podem importar planilhas.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Importar Planilha (mensal)</h1>
        <p className="text-sm text-muted-foreground">
          Envie <span className="font-semibold text-omni">Claro 2026.xlsx</span> ou <span className="font-semibold text-omni">Vivo 2026.xlsx</span> — o sistema lê automaticamente a aba <code className="text-xs bg-surface-1 px-1.5 py-0.5 rounded">GERAL ATUAL</code>, detecta duplicidades e prepara para o pipeline.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Importando para mês <b className="text-foreground">{mesRef}/{anoRef}</b>.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <a href="/importar/inicial" className="rounded-lg border border-omni/30 bg-omni/5 px-3 py-2 hover:bg-omni/10">
            🗂 Carga inicial completa (clientes + colaboradores + catálogos)
          </a>
          <a href="/importar/erros" className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 hover:bg-warning/10">
            ⚠ Revisar erros de importação
          </a>
        </div>
      </div>

      {/* Dropzone */}
      <Card className="bg-card border-border">
        <CardContent
          className={cn(
            "p-8 border-2 border-dashed rounded-xl text-center transition-colors",
            "border-border/60 hover:border-omni/60 cursor-pointer"
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); }}
          onDrop={e => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {parsing ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="size-10 text-omni animate-spin" />
              <p>Lendo planilha…</p>
            </div>
          ) : file ? (
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet className="size-10 text-success" />
              <p className="font-semibold">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB · clique para trocar
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <UploadCloud className="size-10 text-omni" />
              <p className="font-semibold">Arraste a planilha aqui ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground">.xlsx até 20MB · aba GERAL ATUAL</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo */}
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total de linhas" value={result.totalLinhas} accent="text-foreground" />
          <StatCard label="Novas (serão importadas)" value={novos} accent="text-success" />
          <StatCard label="Duplicadas (ignoradas)" value={dups} accent="text-warning" />
          <StatCard label="Com erro" value={erros} accent="text-destructive" />
        </div>
      )}

      {/* Preview */}
      {result && preview.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Pré-visualização</CardTitle>
              <CardDescription>
                Operadora: <Badge variant="outline" className={cn(
                  result.operadora === "CLARO" ? "border-[var(--claro)]/40 text-[var(--claro)]" : "border-[var(--vivo)]/40 text-[var(--vivo)]"
                )}>{result.operadora}</Badge> · aba "{result.abaUsada}" · pág. {page + 1} / {totalPages}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>›</Button>
              <Button variant="ghost" size="sm" onClick={() => { setFile(null); setResult(null); setPreview([]); }}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Funil</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map(r => (
                  <TableRow key={r.__rowIndex}>
                    <TableCell className="text-xs text-muted-foreground">{r.__rowIndex}</TableCell>
                    <TableCell>{renderStatusBadge(r.__status, r.__errors)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.numero}</TableCell>
                    <TableCell className="font-medium">{r.cliente_razao_social}</TableCell>
                    <TableCell className="font-mono text-xs">{r.cliente_cnpj || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] uppercase">{r.funil}</Badge></TableCell>
                    <TableCell className="text-right font-mono">
                      {r.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Ação */}
      {result && novos > 0 && (
        <div className="flex justify-end gap-2 sticky bottom-4">
          <Button
            onClick={handleImport}
            disabled={importing}
            className="bg-omni text-black hover:bg-omni/90 font-semibold shadow-[0_8px_24px_-8px_var(--omni)]"
          >
            {importing
              ? <><Loader2 className="size-4 mr-2 animate-spin" /> Importando…</>
              : <><CheckCircle2 className="size-4 mr-2" /> Importar {novos} venda{novos > 1 ? "s" : ""}</>
            }
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-3xl font-display font-bold mt-1", accent)}>{value}</div>
    </div>
  );
}

function renderStatusBadge(s: RowStatus, errors: string[]) {
  if (s === "erro") return (
    <Badge className="bg-destructive/15 text-destructive border-destructive/30" title={errors.join("; ")}>
      <AlertTriangle className="size-3 mr-1" /> erro
    </Badge>
  );
  if (s === "duplicado") return (
    <Badge className="bg-warning/15 text-warning border-warning/30">
      <CopyIcon className="size-3 mr-1" /> duplicado
    </Badge>
  );
  return (
    <Badge className="bg-success/15 text-success border-success/30">
      <CheckCircle2 className="size-3 mr-1" /> novo
    </Badge>
  );
}
