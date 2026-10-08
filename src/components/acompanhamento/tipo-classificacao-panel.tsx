import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  deleteTipoVinculo,
  saveTipoVinculo,
} from "@/lib/acompanhamento.functions";
import type {
  AcompanhamentoGrupo,
  TipoPedidoCatalogo,
  TipoPedidoVinculo,
} from "@/lib/acompanhamento.types";

const CONTEXT_LABEL: Record<string, string> = {
  processo_claro: "Vendas em Processo · Claro",
  processo_vivo: "Vendas em Processo · Vivo",
  total_geral: "Total Geral",
  meta_semanal: "Meta Semanal",
  status_operacional: "Quadros por Status",
};

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR");
}

export function TipoClassificacaoPanel({
  tipos,
  grupos,
  vinculos,
  onChanged,
}: {
  tipos: TipoPedidoCatalogo[];
  grupos: AcompanhamentoGrupo[];
  vinculos: TipoPedidoVinculo[];
  onChanged: () => void | Promise<void>;
}) {
  const save = useServerFn(saveTipoVinculo);
  const remove = useServerFn(deleteTipoVinculo);
  const contexts = useMemo(
    () => Array.from(new Set(grupos.map(group => group.contexto))),
    [grupos],
  );
  const [contexto, setContexto] = useState(contexts[0] ?? "total_geral");
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const selectionKey = (tipoId: string) => `${contexto}:${tipoId}`;

  const contextGroups = useMemo(
    () => grupos.filter(group => group.contexto === contexto).sort((a, b) => a.ordem - b.ordem),
    [grupos, contexto],
  );
  const groupIds = useMemo(() => new Set(contextGroups.map(group => group.id)), [contextGroups]);

  const visibleTypes = useMemo(() => tipos.filter(tipo => {
    if (contexto === "processo_claro") return tipo.operadora === "CLARO";
    if (contexto === "processo_vivo") return tipo.operadora === "VIVO";
    return true;
  }), [tipos, contexto]);

  const currentFor = (tipoId: string) =>
    vinculos.find(vinculo => vinculo.tipo_pedido_id === tipoId && groupIds.has(vinculo.grupo_id));

  const pending = visibleTypes.filter(tipo => !currentFor(tipo.id)).length;

  async function classify(tipo: TipoPedidoCatalogo) {
    const current = currentFor(tipo.id);
    const groupId = selection[selectionKey(tipo.id)] ?? current?.grupo_id ?? "";
    if (!groupId) {
      toast.error("Escolha um grupo antes de classificar.");
      return;
    }
    setBusy(tipo.id);
    try {
      await save({ data: { tipoPedidoId: tipo.id, grupoId: groupId } } as any);
      toast.success(current ? "Vínculo atualizado" : "Tipo classificado", {
        description: `${tipo.nome} agora possui classificação neste contexto.`,
      });
      await onChanged();
    } catch (error: any) {
      toast.error("Não foi possível classificar", { description: error?.message });
    } finally {
      setBusy(null);
    }
  }

  async function removeLink(vinculo: TipoPedidoVinculo) {
    setBusy(vinculo.tipo_pedido_id);
    try {
      await remove({ data: { id: vinculo.id } } as any);
      toast.success("Classificação removida", { description: "O tipo voltou para Não classificados." });
      await onChanged();
    } catch (error: any) {
      toast.error("Não foi possível remover", { description: error?.message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold">Classificação dos tipos de pedido</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            O BKO continua criando os tipos no catálogo. A gestão define aqui em qual grupo cada tipo entra.
          </p>
        </div>
        <Badge
          variant="outline"
          className={pending ? "border-warning/50 bg-warning/10 text-warning" : "border-success/40 bg-success/10 text-success"}
        >
          {pending ? <AlertTriangle className="mr-1 size-3" /> : <CheckCircle2 className="mr-1 size-3" />}
          {pending} Não classificados
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {contexts.map(item => (
          <button
            key={item}
            type="button"
            onClick={() => setContexto(item)}
            className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
              contexto === item
                ? "border-omni/60 bg-omni/10 text-omni"
                : "border-border bg-surface-1 text-muted-foreground hover:text-foreground"
            }`}
          >
            {CONTEXT_LABEL[item] ?? item}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="grid grid-cols-[minmax(180px,1.4fr)_100px_minmax(180px,1fr)_auto] gap-3 border-b border-border bg-surface-2 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          <span>Tipo do sistema</span>
          <span>Operadora</span>
          <span>Grupo neste contexto</span>
          <span className="text-right">Ação</span>
        </div>
        <div className="max-h-[440px] divide-y divide-border overflow-y-auto">
          {visibleTypes.map(tipo => {
            const current = currentFor(tipo.id);
            const currentGroup = current ? contextGroups.find(group => group.id === current.grupo_id) : null;
            const selected = selection[selectionKey(tipo.id)] ?? current?.grupo_id ?? "";
            const groupsForType = contextGroups.filter(group => !group.operadora || group.operadora === tipo.operadora);

            return (
              <div
                key={tipo.id}
                className={`grid grid-cols-[minmax(180px,1.4fr)_100px_minmax(180px,1fr)_auto] items-center gap-3 px-4 py-3 ${
                  current ? "bg-card" : "bg-warning/[0.035]"
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{tipo.nome}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    Contexto: {CONTEXT_LABEL[contexto] ?? contexto}
                    {current?.updated_at ? ` · auditado em ${formatDate(current.updated_at)}` : ""}
                    {current?.classificado_por ? ` · usuário ${current.classificado_por.slice(0, 8)}` : ""}
                  </div>
                </div>
                <Badge variant="outline" className="w-fit text-[9px]">{tipo.operadora}</Badge>
                <select
                  value={selected}
                  onChange={event => setSelection(value => ({ ...value, [selectionKey(tipo.id)]: event.target.value }))}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-omni/60"
                >
                  <option value="">Selecionar grupo…</option>
                  {groupsForType.map(group => (
                    <option key={group.id} value={group.id}>{group.nome}</option>
                  ))}
                </select>
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant={current ? "outline" : "default"}
                    disabled={busy === tipo.id || !selected}
                    onClick={() => classify(tipo)}
                    className="h-8 gap-1 text-[10px]"
                  >
                    <Link2 className="size-3" />
                    {current ? "Alterar vínculo" : "Classificar"}
                  </Button>
                  {current && (
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busy === tipo.id}
                      onClick={() => removeLink(current)}
                      title="Remover classificação"
                      className="size-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {visibleTypes.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              Nenhum tipo de pedido ativo para este contexto.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
