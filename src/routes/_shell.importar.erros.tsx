import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Download, RefreshCw, CheckCircle2, ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSmartBack } from "@/lib/navigation-memory";

export const Route = createFileRoute("/_shell/importar/erros")({
  component: ErrosPage,
});

interface ErroRow {
  id: string;
  run_id: string | null;
  arquivo: string | null;
  aba: string | null;
  linha: number | null;
  coluna: string | null;
  valor: string | null;
  motivo: string | null;
  status: string;
  created_at: string;
  corrigido_em: string | null;
}

function ErrosPage() {
  const { primaryRole } = useAuth();
  const voltarPaginaAnterior = useSmartBack("/importar");
  const [rows, setRows] = useState<ErroRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState<string>("todos");
  const [arquivoF, setArquivoF] = useState<string>("todos");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("import_erros")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) toast.error("Falha ao carregar erros", { description: error.message });
    setRows((data ?? []) as ErroRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const arquivos = useMemo(
    () => Array.from(new Set(rows.map(r => r.arquivo).filter(Boolean))) as string[],
    [rows],
  );

  const filtrados = useMemo(() => {
    const lc = q.toLowerCase();
    return rows.filter(r => {
      if (statusF !== "todos" && r.status !== statusF) return false;
      if (arquivoF !== "todos" && r.arquivo !== arquivoF) return false;
      if (!q) return true;
      return [r.arquivo, r.aba, r.coluna, r.valor, r.motivo]
        .some(v => v?.toLowerCase().includes(lc));
    });
  }, [rows, q, statusF, arquivoF]);

  async function marcarCorrigido(id: string) {
    const { error } = await supabase
      .from("import_erros")
      .update({ status: "corrigido", corrigido_em: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error("Erro ao atualizar", { description: error.message });
    setRows(rs => rs.map(r => r.id === id ? { ...r, status: "corrigido", corrigido_em: new Date().toISOString() } : r));
    toast.success("Marcado como corrigido");
  }

  function downloadCSV() {
    const headers = ["arquivo","aba","linha","coluna","valor","motivo","status","created_at"];
    const escape = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of filtrados) {
      lines.push(headers.map(h => escape((r as any)[h])).join(","));
    }
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-erros-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV gerado", { description: `${filtrados.length} linhas` });
  }

  if (primaryRole !== "admin" && primaryRole !== "gestor") {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-6 text-sm">
          Acesso restrito a administradores e gestores.
        </div>
      </div>
    );
  }

  const totais = useMemo(() => ({
    total: rows.length,
    abertos: rows.filter(r => r.status === "pendente").length,
    corrigidos: rows.filter(r => r.status === "corrigido").length,
    ignorados: rows.filter(r => r.status === "ignorado").length,
  }), [rows]);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <button type="button" onClick={voltarPaginaAnterior} className="hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="size-3" /> Voltar
            </button>
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="size-6 text-warning" /> Revisar erros de importação
          </h1>
          <p className="text-sm text-muted-foreground">
            {totais.total} no total · {totais.abertos} abertos · {totais.corrigidos} corrigidos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={load}>
            <RefreshCw className="size-3.5" /> Recarregar
          </Button>
          <Button size="sm" className="gap-2" onClick={downloadCSV} disabled={filtrados.length === 0}>
            <Download className="size-3.5" /> Baixar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Total", v: totais.total, cls: "text-foreground" },
          { label: "Abertos", v: totais.abertos, cls: "text-warning" },
          { label: "Corrigidos", v: totais.corrigidos, cls: "text-success" },
          { label: "Ignorados", v: totais.ignorados, cls: "text-muted-foreground" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className={cn("font-display text-2xl font-bold", s.cls)}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar arquivo, coluna, motivo, valor…" className="pl-9 bg-surface-1 border-border" />
        </div>
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger className="w-40 bg-surface-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="corrigido">Corrigidos</SelectItem>
            <SelectItem value="ignorado">Ignorados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={arquivoF} onValueChange={setArquivoF}>
          <SelectTrigger className="w-56 bg-surface-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos arquivos</SelectItem>
            {arquivos.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Arquivo / Aba</th>
                <th className="text-left px-3 py-2">Linha</th>
                <th className="text-left px-3 py-2">Coluna</th>
                <th className="text-left px-3 py-2">Valor</th>
                <th className="text-left px-3 py-2">Motivo</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-xs">Carregando…</td></tr>
              )}
              {!loading && filtrados.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                  Nenhum erro encontrado com esses filtros.
                </td></tr>
              )}
              {filtrados.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-surface-1">
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs truncate max-w-[220px]">{r.arquivo ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground">{r.aba ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.linha ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.coluna ?? "—"}</td>
                  <td className="px-3 py-2 text-xs max-w-[200px] truncate">{r.valor ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.motivo ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={cn(
                      "text-[9px] uppercase",
                      r.status === "pendente" && "border-warning/40 text-warning",
                      r.status === "corrigido" && "border-success/40 text-success",
                      r.status === "ignorado" && "border-border text-muted-foreground",
                    )}>{r.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.status === "pendente" && (
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => marcarCorrigido(r.id)}>
                        <CheckCircle2 className="size-3.5" /> Corrigir
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
