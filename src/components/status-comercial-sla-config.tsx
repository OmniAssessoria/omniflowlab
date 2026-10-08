import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  creationTargets,
  normalizeStatusCommercialName,
  parseStatusCommercialSla,
  type StatusCommercialCreationScope,
  type StatusCommercialOperator,
} from "@/lib/status-comercial-management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SlaConfigFilter } from "@/lib/status-sla";

interface StatusRelationRow {
  status_id: string;
  operadora: StatusCommercialOperator;
  nome: string;
  sla_horas: number | null;
  ativo: boolean;
  is_final: boolean;
  ordem: number;
}

interface EditState {
  row: StatusRelationRow;
  nome: string;
  sla: string;
}

function relationKey(row: Pick<StatusRelationRow, "status_id" | "operadora">) {
  return `${row.status_id}:${row.operadora}`;
}

export function StatusComercialSlaConfig() {
  const { roles } = useAuth();
  const canManage = roles.includes("admin") || roles.includes("bko");

  const [rows, setRows] = useState<StatusRelationRow[]>([]);
  const [filtro, setFiltro] = useState<SlaConfigFilter>("CLARO");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSla, setNewSla] = useState("");
  const [newScope, setNewScope] = useState<StatusCommercialCreationScope>("CLARO");

  const [editing, setEditing] = useState<EditState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StatusRelationRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("status_comercial_operadoras")
        .select("status_id, operadora, nome, sla_horas, ativo, is_final, status_comercial_catalogo!inner(id, ordem, ativo)")
        .eq("status_comercial_catalogo.ativo", true);

      if (error) throw error;

      const mapped = (data ?? []).map((row: any) => ({
        status_id: row.status_id,
        operadora: row.operadora as StatusCommercialOperator,
        nome: row.nome,
        sla_horas: row.sla_horas ?? null,
        ativo: Boolean(row.ativo),
        is_final: Boolean(row.is_final),
        ordem: Number(row.status_comercial_catalogo?.ordem ?? 0),
      })) as StatusRelationRow[];

      mapped.sort((a, b) =>
        a.operadora.localeCompare(b.operadora)
        || a.ordem - b.ordem
        || a.nome.localeCompare(b.nome, "pt-BR"),
      );

      setRows(mapped);
    } catch (error: any) {
      toast.error("Não foi possível carregar os Status Comerciais", {
        description: error?.message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const claro = rows.filter(row => row.operadora === "CLARO" && row.ativo).length;
    const vivo = rows.filter(row => row.operadora === "VIVO" && row.ativo).length;
    return { claro, vivo, ambas: claro + vivo };
  }, [rows]);

  const filtered = useMemo(() => {
    const query = busca.trim().toLocaleLowerCase("pt-BR");
    return rows.filter(row => {
      if (filtro !== "AMBAS" && row.operadora !== filtro) return false;
      if (!query) return true;
      return row.nome.toLocaleLowerCase("pt-BR").includes(query);
    });
  }, [rows, filtro, busca]);

  function openCreate() {
    setNewName("");
    setNewSla("");
    setNewScope(filtro === "AMBAS" ? "AMBAS" : filtro);
    setCreateOpen(true);
  }

  async function createStatus() {
    if (!canManage || savingKey) return;

    const nome = normalizeStatusCommercialName(newName);
    const sla = parseStatusCommercialSla(newSla);

    if (!nome) {
      toast.error("Informe o nome do Status Comercial.");
      return;
    }
    if (sla === undefined) {
      toast.error("Informe o SLA em horas inteiras ou deixe vazio para Sem SLA.");
      return;
    }

    setSavingKey("create");
    try {
      const { error } = await (supabase as any).rpc("criar_status_comercial", {
        p_nome: nome,
        p_operadoras: creationTargets(newScope),
        p_sla_horas: sla,
      });
      if (error) throw error;

      toast.success("Status Comercial criado", {
        description: `${nome} · ${newScope === "AMBAS" ? "CLARO e VIVO" : newScope} · ${sla == null ? "Sem SLA" : `${sla}h`}`,
      });
      setCreateOpen(false);
      await load();
    } catch (error: any) {
      toast.error("Não foi possível criar o Status Comercial", {
        description: error?.message,
      });
    } finally {
      setSavingKey(null);
    }
  }

  function openEdit(row: StatusRelationRow) {
    if (!canManage) return;
    setEditing({
      row,
      nome: row.nome,
      sla: row.sla_horas == null ? "" : String(row.sla_horas),
    });
  }

  async function saveEdit() {
    if (!canManage || !editing || savingKey) return;

    const nome = normalizeStatusCommercialName(editing.nome);
    const sla = parseStatusCommercialSla(editing.sla);
    if (!nome) {
      toast.error("Informe o nome do Status Comercial.");
      return;
    }
    if (sla === undefined) {
      toast.error("Informe o SLA em horas inteiras ou deixe vazio para Sem SLA.");
      return;
    }

    const key = relationKey(editing.row);
    setSavingKey(key);
    try {
      const { error } = await (supabase as any).rpc("atualizar_status_comercial", {
        p_status_id: editing.row.status_id,
        p_operadora: editing.row.operadora,
        p_nome: nome,
        p_sla_horas: sla,
        p_ativo: editing.row.ativo,
      });
      if (error) throw error;

      toast.success("Status Comercial atualizado", {
        description: `${editing.row.operadora} · ${nome} · ${sla == null ? "Sem SLA" : `${sla}h`}`,
      });
      setEditing(null);
      await load();
    } catch (error: any) {
      toast.error("Não foi possível atualizar o Status Comercial", {
        description: error?.message,
      });
    } finally {
      setSavingKey(null);
    }
  }

  async function setActive(row: StatusRelationRow, ativo: boolean) {
    if (!canManage || savingKey) return;
    if (row.is_final && !ativo) {
      toast.error("Status finalizador não pode ser desativado", {
        description: "Renomear e alterar o SLA é permitido, mas o marcador final precisa continuar disponível.",
      });
      return;
    }
    const key = relationKey(row);
    setSavingKey(key);
    try {
      const { error } = await (supabase as any).rpc("atualizar_status_comercial", {
        p_status_id: row.status_id,
        p_operadora: row.operadora,
        p_nome: row.nome,
        p_sla_horas: row.sla_horas,
        p_ativo: ativo,
      });
      if (error) throw error;

      toast.success(ativo ? "Status Comercial ativado" : "Status Comercial desativado", {
        description: `${row.nome} · ${row.operadora}`,
      });
      await load();
    } catch (error: any) {
      toast.error("Não foi possível alterar o Status Comercial", {
        description: error?.message,
      });
    } finally {
      setSavingKey(null);
    }
  }

  async function deleteStatus() {
    if (!canManage || !deleteTarget || savingKey) return;
    const target = deleteTarget;
    if (target.is_final) {
      toast.error("Status finalizador não pode ser excluído", {
        description: "Ele pode ser renomeado e ter o SLA alterado, mas precisa permanecer disponível para concluir a venda.",
      });
      return;
    }
    const key = relationKey(target);
    setSavingKey(key);

    try {
      const { error } = await (supabase as any).rpc("excluir_status_comercial", {
        p_status_id: target.status_id,
        p_operadora: target.operadora,
      });
      if (error) throw error;

      toast.success("Status Comercial excluído", {
        description: `${target.nome} foi retirado das novas seleções da ${target.operadora}. O histórico dos pedidos foi preservado.`,
      });
      setDeleteTarget(null);
      await load();
    } catch (error: any) {
      toast.error("Não foi possível excluir o Status Comercial", {
        description: error?.message,
      });
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border bg-surface-1 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock3 className="size-4 text-omni" />
              <h2 className="font-display font-semibold">SLA por Status Comercial</h2>
              <Badge variant="outline" className="text-[10px]">{rows.length} vínculos</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Admin e BKO podem criar, renomear, ativar, desativar ou excluir Status Comercial e definir o SLA de cada operadora.
              O histórico dos pedidos não é reescrito.
            </p>
          </div>

          {canManage && (
            <Button type="button" className="gap-2" onClick={openCreate}>
              <Plus className="size-4" />
              Novo Status Comercial
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs value={filtro} onValueChange={value => setFiltro(value as SlaConfigFilter)}>
            <TabsList>
              <TabsTrigger value="CLARO">CLARO · {counts.claro} ativos</TabsTrigger>
              <TabsTrigger value="VIVO">VIVO · {counts.vivo} ativos</TabsTrigger>
              <TabsTrigger value="AMBAS">Ambas · {counts.ambas} ativos</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={event => setBusca(event.target.value)}
              placeholder="Buscar Status Comercial…"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-6 text-sm text-muted-foreground">Carregando Status Comerciais…</div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          Nenhum Status Comercial encontrado neste filtro.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-xs">
            <thead className="bg-muted/15 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Status Comercial</th>
                {filtro === "AMBAS" && <th className="px-3 py-2 text-left">Operadora</th>}
                <th className="px-3 py-2 text-center">Ativo</th>
                <th className="px-3 py-2 text-left">SLA</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map(row => {
                const key = relationKey(row);
                const busy = savingKey === key;
                return (
                  <tr key={key} className="hover:bg-muted/10">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{row.nome}</span>
                        {row.is_final && (
                          <Badge variant="outline" className="border-success/35 bg-success/10 text-[9px] text-success">
                            Finalizador
                          </Badge>
                        )}
                      </div>
                    </td>
                    {filtro === "AMBAS" && (
                      <td className="px-3 py-3">
                        <Badge variant="outline" className="text-[9px]">{row.operadora}</Badge>
                      </td>
                    )}
                    <td className="px-3 py-3 text-center">
                      <Switch
                        checked={row.ativo}
                        disabled={!canManage || busy || row.is_final}
                        title={row.is_final ? "Status finalizador não pode ser desativado" : undefined}
                        onCheckedChange={value => void setActive(row, value)}
                      />
                    </td>
                    <td className="px-3 py-3 font-medium">
                      {row.sla_horas == null ? "Sem SLA" : `${row.sla_horas}h`}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        {canManage && (
                          <>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              title="Editar Status Comercial e SLA"
                              disabled={busy}
                              onClick={() => openEdit(row)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              title={row.is_final ? "Status finalizador não pode ser excluído" : "Excluir Status Comercial"}
                              disabled={busy || row.is_final}
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Status Comercial</DialogTitle>
            <DialogDescription>
              Crie o status já vinculado à operadora e ao SLA desejado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="novo-status-nome">Nome do Status Comercial</Label>
              <Input
                id="novo-status-nome"
                value={newName}
                onChange={event => setNewName(event.target.value)}
                placeholder="Ex.: AGUARDANDO DOCUMENTAÇÃO"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="novo-status-operadora">Operadora</Label>
              <select
                id="novo-status-operadora"
                value={newScope}
                onChange={event => setNewScope(event.target.value as StatusCommercialCreationScope)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="CLARO">CLARO</option>
                <option value="VIVO">VIVO</option>
                <option value="AMBAS">Ambas</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="novo-status-sla">SLA em horas</Label>
              <Input
                id="novo-status-sla"
                type="number"
                min={1}
                step={1}
                value={newSla}
                onChange={event => setNewSla(event.target.value)}
                placeholder="Sem SLA"
              />
              <p className="text-[10px] text-muted-foreground">
                Deixe vazio quando o Status Comercial não tiver prazo.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={savingKey === "create"}>
              Cancelar
            </Button>
            <Button onClick={() => void createStatus()} disabled={savingKey === "create"}>
              {savingKey === "create" ? "Criando…" : "Criar Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={open => !open && !savingKey && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Status Comercial</DialogTitle>
            <DialogDescription>
              {editing ? `Alteração exclusiva da ${editing.row.operadora}. A outra operadora não será modificada.` : ""}
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{editing.row.operadora}</Badge>
                {editing.row.is_final && (
                  <Badge variant="outline" className="border-success/35 bg-success/10 text-success">
                    Finalizador
                  </Badge>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editar-status-nome">Nome do Status Comercial</Label>
                <Input
                  id="editar-status-nome"
                  value={editing.nome}
                  onChange={event => setEditing(current => current ? { ...current, nome: event.target.value } : current)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editar-status-sla">SLA em horas</Label>
                <Input
                  id="editar-status-sla"
                  type="number"
                  min={1}
                  step={1}
                  value={editing.sla}
                  onChange={event => setEditing(current => current ? { ...current, sla: event.target.value } : current)}
                  placeholder="Sem SLA"
                />
                <p className="text-[10px] text-muted-foreground">
                  Deixe vazio para Sem SLA. O marcador Finalizador não é alterado ao renomear o status.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={Boolean(savingKey)}>
              Cancelar
            </Button>
            <Button onClick={() => void saveEdit()} disabled={!editing || Boolean(savingKey)}>
              {savingKey ? "Salvando…" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={open => !open && !savingKey && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Status Comercial?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.nome} será retirado das novas seleções da ${deleteTarget.operadora}. Pedidos e históricos já registrados permanecerão intactos.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(savingKey)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!deleteTarget || Boolean(savingKey)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void deleteStatus()}
            >
              Excluir Status Comercial
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
