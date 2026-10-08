import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { parseInicial, classifyFunil, normalizeColabKey, type ParseInicialResult } from "@/lib/import-inicial-parser";
import { gravarImportacaoInicial } from "@/lib/import-inicial.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, ShieldX, Database, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_shell/importar/inicial")({
  component: ImportInicialPage,
});

function ImportInicialPage() {
  const { primaryRole } = useAuth();
  const grava = useServerFn(gravarImportacaoInicial);
  const [files, setFiles] = useState<File[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseds, setParseds] = useState<ParseInicialResult[]>([]);
  const [gravando, setGravando] = useState(false);
  const [resultado, setResultado] = useState<{ runId: string; totais: Record<string, any> } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFiles = useCallback(async (fs: File[]) => {
    if (fs.length === 0) return;
    setFiles(fs);
    setParseds([]);
    setResultado(null);
    setParsing(true);
    try {
      const parsed = await Promise.all(fs.map(parseInicial));
      setParseds(parsed);
      toast.success(`Planilhas analisadas`, {
        description: parsed.map(p => `${p.operadora}: ${p.vendas.length} vendas em ${p.abasLidas.length} abas`).join(" · "),
      });
    } catch (e: unknown) {
      toast.error("Falha ao ler planilhas", { description: e instanceof Error ? e.message : "erro" });
    } finally {
      setParsing(false);
    }
  }, []);

  const consolidado = useMemo(() => {
    if (parseds.length === 0) return null;
    const allVendas = parseds.flatMap(p => p.vendas);
    const clientesMap = new Map<string, any>();
    const colabMap = new Map<string, any>();
    const catalogo = { status: [] as any[], produtos: [] as any[], tipos: [] as any[] };
    const erros: any[] = [];

    for (const p of parseds) {
      catalogo.status.push(...p.catalogo.status);
      catalogo.produtos.push(...p.catalogo.produtos);
      catalogo.tipos.push(...p.catalogo.tipos);
      erros.push(...p.erros.map(e => ({ ...e, arquivo: p.arquivo })));

      for (const v of p.vendas) {
        const k = v.cnpj || `_${v.razao_social}|${v.uf ?? ""}|${v.ddd ?? ""}`;
        if (!clientesMap.has(k)) {
          clientesMap.set(k, {
            cnpj: v.cnpj, razao_social: v.razao_social, uf: v.uf, ddd: v.ddd,
            contato: v.contato, telefone: v.telefone, email: v.email,
            operadora: v.operadora,
          });
        }
        for (const nome of [v.consultor_nome, v.bko_nome]) {
          if (!nome) continue;
          const nk = normalizeColabKey(nome);
          if (!colabMap.has(nk)) {
            colabMap.set(nk, {
              nome_normalizado: nk, nome_exibicao: nome.trim(),
              funcao: nome === v.bko_nome ? "bko" : "consultor",
              operadora: v.operadora,
            });
          }
        }
      }
    }

    return {
      clientes: Array.from(clientesMap.values()),
      colaboradores: Array.from(colabMap.values()),
      catalogo,
      vendas: allVendas,
      erros,
    };
  }, [parseds]);

  async function confirmar() {
    if (!consolidado) return;
    setGravando(true);
    try {
      const vendasPayload = consolidado.vendas.map(v => {
        const cls = classifyFunil(v.status);
        return {
          arquivo: v.arquivo, aba: v.aba, linha: v.linha,
          operadora: v.operadora, mes_ref: v.mes_ref, ano_ref: v.ano_ref,
          numero: v.numero, cnpj: v.cnpj, razao_social: v.razao_social,
          uf: v.uf, ddd: v.ddd, contato: v.contato, telefone: v.telefone, email: v.email,
          status: v.status, tipo_pedido: v.tipo_pedido, produto: v.produto,
          quantidade_linhas: v.quantidade_linhas, valor: v.valor,
          consultor_nome: v.consultor_nome, bko_nome: v.bko_nome,
          data_recebimento: v.data_recebimento, data_preenchimento: v.data_preenchimento,
          data_envio: v.data_envio, data_aceite: v.data_aceite, data_input: v.data_input,
          data_ativacao: v.data_ativacao, data_portabilidade: v.data_portabilidade,
          data_entrega: v.data_entrega, status_portabilidade: v.status_portabilidade,
          cotacao: v.cotacao, numero_pedido: v.numero_pedido, nota_fiscal: v.nota_fiscal,
          cod_rastreio: v.cod_rastreio, serie: v.serie, equipamentos: v.equipamentos,
          observacao: v.observacao, dados_originais: v.dados_originais,
          funil: cls.funil, etapa_id: cls.etapa_id,
        };
      });
      const res = await grava({ data: {
        arquivos: parseds.map(p => `${p.arquivo} (${p.operadora})`),
        clientes: consolidado.clientes,
        colaboradores: consolidado.colaboradores,
        catalogo: consolidado.catalogo,
        vendas: vendasPayload,
        erros: consolidado.erros,
      }});
      setResultado(res);
      toast.success("Importação concluída", { description: `${res.totais.vendas_gravadas} vendas gravadas` });
    } catch (e: unknown) {
      toast.error("Falha ao gravar", { description: e instanceof Error ? e.message : "erro" });
    } finally {
      setGravando(false);
    }
  }

  if (primaryRole !== "admin") {
    return (
      <div className="p-6">
        <Card className="max-w-xl bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3"><ShieldX className="size-6 text-destructive" /><CardTitle>Sem permissão</CardTitle></div>
            <CardDescription>Apenas o administrador pode executar a importação inicial.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (resultado) {
    const t = resultado.totais;
    return (
      <div className="p-4 sm:p-6 space-y-4 max-w-4xl">
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-7 text-success" />
              <div>
                <CardTitle>Importação concluída</CardTitle>
                <CardDescription>O sistema agora opera com base no banco de dados — as planilhas não são mais necessárias.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Vendas gravadas" value={t.vendas_gravadas} accent="text-success" />
            <Stat label="Clientes" value={t.clientes} />
            <Stat label="Colaboradores" value={t.colaboradores} />
            <Stat label="Status (catálogo)" value={t.catalogo_status} />
            <Stat label="Produtos" value={t.catalogo_produtos} />
            <Stat label="Tipos de pedido" value={t.catalogo_tipos} />
            <Stat label="Duplicadas (upsert)" value={t.vendas_duplicadas} accent="text-warning" />
            <Stat label="Erros" value={t.erros} accent={t.erros > 0 ? "text-destructive" : ""} />
          </CardContent>
        </Card>
        <div className="flex gap-2 flex-wrap">
          <Button asChild><Link to="/dashboard">Abrir Dashboard <ArrowRight className="size-4 ml-1" /></Link></Button>
          <Button asChild variant="outline"><Link to="/pipeline">Abrir Pipeline</Link></Button>
          <Button asChild variant="outline"><Link to="/clientes">Ver Clientes</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
          <Database className="size-6 text-omni" /> Importação Inicial das Planilhas
        </h1>
        <p className="text-sm text-muted-foreground">
          Envie <b>Claro 2026.xlsx</b> e <b>Vivo 2026.xlsx</b>. O sistema lê todas as abas relevantes
          (GERAL ATUAL, GERAL ANTERIOR, meses, STATUS PEDIDOS, SELECT), cria a base de clientes,
          colaboradores, catálogos e migra vendas + histórico para o banco. Após confirmar, as planilhas
          não são mais necessárias.
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardContent
          className={cn("p-8 border-2 border-dashed rounded-xl text-center cursor-pointer", "border-border/60 hover:border-omni/60")}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); onFiles(Array.from(e.dataTransfer.files)); }}
        >
          <input
            ref={inputRef} type="file" accept=".xlsx" multiple className="hidden"
            onChange={e => onFiles(Array.from(e.target.files ?? []))}
          />
          {parsing ? (
            <div className="flex flex-col items-center gap-2"><Loader2 className="size-10 text-omni animate-spin" /><p>Lendo planilhas…</p></div>
          ) : files.length > 0 ? (
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet className="size-10 text-success" />
              {files.map(f => <p key={f.name} className="font-semibold">{f.name} <span className="text-xs text-muted-foreground">({(f.size/1024).toFixed(0)} KB)</span></p>)}
              <p className="text-xs text-muted-foreground">Clique para trocar</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <UploadCloud className="size-10 text-omni" />
              <p className="font-semibold">Arraste as 2 planilhas aqui ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground">Claro 2026.xlsx + Vivo 2026.xlsx</p>
            </div>
          )}
        </CardContent>
      </Card>

      {consolidado && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Vendas detectadas" value={consolidado.vendas.length} accent="text-foreground" />
            <Stat label="Clientes únicos" value={consolidado.clientes.length} accent="text-success" />
            <Stat label="Colaboradores" value={consolidado.colaboradores.length} accent="text-omni" />
            <Stat label="Erros / avisos" value={consolidado.erros.length} accent={consolidado.erros.length > 0 ? "text-warning" : ""} />
            <Stat label="Status (catálogo)" value={dedup(consolidado.catalogo.status).length} />
            <Stat label="Produtos" value={dedup(consolidado.catalogo.produtos).length} />
            <Stat label="Tipos de pedido" value={dedup(consolidado.catalogo.tipos).length} />
            <Stat label="Abas processadas" value={parseds.reduce((s, p) => s + p.abasLidas.length, 0)} />
          </div>

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">Abas lidas por planilha</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {parseds.map(p => (
                <div key={p.arquivo} className="flex flex-wrap gap-2 items-center">
                  <Badge className={cn(
                    p.operadora === "CLARO" ? "bg-[var(--claro)]/15 text-[var(--claro)] border-[var(--claro)]/30" : "bg-[var(--vivo)]/15 text-[var(--vivo)] border-[var(--vivo)]/30",
                  )}>{p.operadora}</Badge>
                  <span className="text-sm font-medium">{p.arquivo}</span>
                  {p.abasLidas.map(a => <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>)}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="sticky bottom-4 flex justify-end gap-2 bg-background/80 backdrop-blur p-2 rounded-xl">
            <Button variant="outline" onClick={() => { setFiles([]); setParseds([]); }}>Cancelar</Button>
            <Button onClick={confirmar} disabled={gravando} className="bg-omni text-black hover:bg-omni/90 font-semibold">
              {gravando
                ? <><Loader2 className="size-4 mr-2 animate-spin" /> Gravando no banco…</>
                : <><CheckCircle2 className="size-4 mr-2" /> Confirmar importação ({consolidado.vendas.length} vendas)</>
              }
            </Button>
          </div>

          {consolidado.erros.length > 0 && (
            <Card className="bg-card border-warning/40">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="size-4 text-warning" /> Avisos detectados</CardTitle></CardHeader>
              <CardContent className="max-h-64 overflow-auto text-xs font-mono space-y-1">
                {consolidado.erros.slice(0, 50).map((e, i) => (
                  <div key={i}>[{e.arquivo} · {e.aba} L{e.linha}] {e.coluna}: {e.motivo} ({e.valor || "—"})</div>
                ))}
                {consolidado.erros.length > 50 && <div>…+{consolidado.erros.length - 50} avisos.</div>}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent = "text-foreground" }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-display font-bold mt-1", accent)}>{value}</div>
    </div>
  );
}
function dedup<T extends { operadora: string; nome: string }>(arr: T[]): T[] {
  const m = new Map<string, T>();
  for (const x of arr) m.set(`${x.operadora}|${x.nome.toUpperCase()}`, x);
  return Array.from(m.values());
}
