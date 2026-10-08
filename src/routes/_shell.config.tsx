import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { STATUS_CLARO, STATUS_VIVO } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Settings2, Workflow, Tag, Users, Clock, Save, ShieldCheck, ScrollText, AlertOctagon, Plus, Trash2, PackageOpen, Tv2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { UsuariosPanel } from "@/components/usuarios-panel";
import { AuditoriaPanel } from "@/components/auditoria-panel";
import { PipelineStructurePanel } from "@/components/pipeline-structure-panel";
import { StatusComercialSlaConfig } from "@/components/status-comercial-sla-config";
import { Switch } from "@/components/ui/switch";
import { useFeatures } from "@/lib/features";
import { useServerFn } from "@tanstack/react-start";
import { setComissoesEnabled } from "@/lib/settings.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CatalogoComercialPanel } from "@/components/catalogo-comercial-panel";
import { TvMetaConfig } from "@/components/tv-meta-config";

export const Route = createFileRoute("/_shell/config")({
  component: ConfigPage,
});

interface SlaRow {
  id: string;
  funil: string;
  etapa_id: string;
  operadora: string | null;
  prazo_horas: number;
  alerta_horas: number;
  criticidade: string;
  ativo: boolean;
}

function ConfigPage() {
  const { primaryRole } = useAuth();
  const isAdmin = primaryRole === "admin";
  const isGestor = primaryRole === "gestor";
  const canManageSla = primaryRole === "admin" || primaryRole === "bko";

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">
          {isGestor ? "Metas do Painel TV" : "Configurações"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isGestor ? "Defina as metas comerciais exibidas no Painel TV." : "Funis, etapas, status, produtos e regras de SLA"}
        </p>
      </div>

      <Tabs defaultValue={isGestor ? "painel-tv" : "estrutura"}>
        <TabsList>
          {!isGestor && (
            <TabsTrigger value="estrutura" id="tab-estrutura"><Workflow className="size-3.5 mr-1.5" />Estrutura</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="status" id="tab-status"><Tag className="size-3.5 mr-1.5" />Status</TabsTrigger>
          )}
          {canManageSla && (
            <>
              <TabsTrigger value="sla" id="tab-sla"><Clock className="size-3.5 mr-1.5" />SLA</TabsTrigger>
              <TabsTrigger value="catalogo" id="tab-catalogo"><PackageOpen className="size-3.5 mr-1.5" />Catálogo</TabsTrigger>
            </>
          )}
          {isGestor && (
            <TabsTrigger value="painel-tv" id="tab-painel-tv"><Tv2 className="size-3.5 mr-1.5" />Painel TV</TabsTrigger>
          )}
          {isAdmin && (<>
            <TabsTrigger value="usuarios" id="tab-usuarios"><ShieldCheck className="size-3.5 mr-1.5" />Usuários</TabsTrigger>
            <TabsTrigger value="sistema" id="tab-sistema"><Settings2 className="size-3.5 mr-1.5" />Sistema</TabsTrigger>
            <TabsTrigger value="erros" id="tab-erros"><AlertOctagon className="size-3.5 mr-1.5" />Erros</TabsTrigger>
            <TabsTrigger value="auditoria" id="tab-auditoria"><ScrollText className="size-3.5 mr-1.5" />Auditoria</TabsTrigger>
          </>)}
        </TabsList>

        {!isGestor && (
          <TabsContent value="estrutura" className="mt-4">
            <PipelineStructurePanel />
          </TabsContent>
        )}

        {isGestor && (
          <TabsContent value="painel-tv" className="mt-4">
            <TvMetaConfig />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="status" className="mt-4">
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <StatusPanel titulo="Status Claro" op="claro" lista={STATUS_CLARO} />
              <StatusPanel titulo="Status Vivo" op="vivo" lista={STATUS_VIVO} />
            </section>
          </TabsContent>
        )}

        {canManageSla && (
          <>
            <TabsContent value="sla" className="mt-4">
              <StatusComercialSlaConfig />
            </TabsContent>
            <TabsContent value="catalogo" className="mt-4">
              <CatalogoComercialPanel />
            </TabsContent>
          </>
        )}

        {isAdmin && (<>
        <TabsContent value="usuarios" className="mt-4">
          <UsuariosPanel />
        </TabsContent>


        <TabsContent value="sistema" className="mt-4">
          <SistemaPanel />
        </TabsContent>

        <TabsContent value="erros" className="mt-4">
          <ErrosCatalogoPanel />
        </TabsContent>

        <TabsContent value="auditoria" className="mt-4">
          <AuditoriaPanel />
        </TabsContent>
        </>)}
      </Tabs>
    </div>
  );
}

function SistemaPanel() {
  const { primaryRole } = useAuth();
  const isAdmin = primaryRole === "admin";
  const { comissoesEnabled, comissoesRoles, refresh } = useFeatures();
  const save = useServerFn(setComissoesEnabled);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (modalOpen) {
      setSelectedRoles(comissoesRoles.length > 0 ? comissoesRoles : ["admin"]);
    }
  }, [modalOpen, comissoesRoles]);

  async function handleToggle(v: boolean) {
    if (v) {
      setIsEditing(false);
      setModalOpen(true);
    } else {
      setConfirmOpen(true);
    }
  }

  async function executeSave(enabled: boolean, roles: string[]) {
    setSaving(true);
    try {
      await save({ data: { enabled, roles } });
      await refresh();
      toast.success(enabled ? "Módulo de Comissões ativado" : "Módulo de Comissões desativado");
      setModalOpen(false);
    } catch (e: any) {
      toast.error("Falha", { description: e?.message });
    } finally {
      setSaving(false);
    }
  }

  const roleOptions = [
    { id: "admin", label: "Administrador" },
    { id: "gestor", label: "Gestor" },
    { id: "consultor", label: "Consultor" },
  ];

  const allSelected = roleOptions.every(r => selectedRoles.includes(r.id));

  function toggleRole(roleId: string) {
    setSelectedRoles(prev =>
      prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]
    );
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedRoles([]);
    } else {
      setSelectedRoles(roleOptions.map(r => r.id));
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 max-w-2xl space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Settings2 className="size-4 text-omni" />
          <h2 className="font-display font-semibold">Módulo de Comissões</h2>
          <Badge variant={comissoesEnabled ? "default" : "outline"} className={cn("text-[10px]", !comissoesEnabled && "text-muted-foreground")}>
            {comissoesEnabled ? "Ativo" : "Inativo"}
          </Badge>
        </div>
        {comissoesEnabled && isAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px]"
            onClick={() => {
              setIsEditing(true);
              setModalOpen(true);
            }}
          >
            Editar perfis liberados
          </Button>
        )}
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg bg-surface-1 border border-border p-3">
        <div className="space-y-1">
          <div className="text-sm font-medium">Status do Módulo</div>
          <p className="text-xs text-muted-foreground">
            Quando desativado, o menu e a página de Comissões ficam ocultos para todos os perfis.
            Mesmo desativado, o Administrador pode reativar selecionando os perfis desejados.
          </p>
          {comissoesEnabled && comissoesRoles.length > 0 && (
            <div className="space-y-1 mt-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Perfis com acesso:</div>
              <div className="flex flex-wrap gap-1">
                {comissoesRoles.map(r => (
                  <Badge key={r} variant="secondary" className="text-[9px] uppercase">
                    {roleOptions.find(o => o.id === r)?.label || r}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        <Switch checked={comissoesEnabled} disabled={!isAdmin || saving} onCheckedChange={handleToggle} />
      </div>

      {!isAdmin && <span className="text-[10px] text-muted-foreground italic">Apenas Admin pode editar esta configuração.</span>}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Perfis Liberados" : "Ativar Módulo de Comissões"}</DialogTitle>
            <DialogDescription>
              Selecione para quais perfis a página de Comissões ficará disponível.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-border">
              <Checkbox id="select-all" checked={allSelected} onCheckedChange={toggleAll} />
              <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">Selecionar todos</Label>
            </div>
            <div className="space-y-3">
              {roleOptions.map(role => (
                <div key={role.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`role-${role.id}`}
                    checked={selectedRoles.includes(role.id)}
                    onCheckedChange={() => toggleRole(role.id)}
                  />
                  <Label htmlFor={`role-${role.id}`} className="text-sm cursor-pointer">{role.label}</Label>
                </div>
              ))}
            </div>
            {selectedRoles.length === 0 && (
              <p className="text-[10px] text-destructive mt-2 text-center font-semibold">
                Selecione pelo menos um perfil para ativar o módulo.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button
              className="bg-omni text-black hover:bg-omni/90"
              disabled={selectedRoles.length === 0 || saving}
              onClick={() => executeSave(true, selectedRoles)}
            >
              {saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Ativar módulo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Deseja desativar o Módulo de Comissões para todos os perfis?</DialogTitle>
            <DialogDescription>
              A página de Comissões ficará oculta para Administrador, Gestor e Consultor. Nenhuma meta, comissão ou histórico será apagado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={saving}
              onClick={async () => {
                await executeSave(false, []);
                setConfirmOpen(false);
              }}
            >
              {saving ? "Desativando..." : "Desativar para todos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function SlaConfigPanel() {
  const { primaryRole } = useAuth();
  const podeEditar = primaryRole === "admin" || primaryRole === "gestor";
  const [rows, setRows] = useState<SlaRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from("sla_config").select("*").order("funil").order("etapa_id");
    setRows((data ?? []) as SlaRow[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function salvar(r: SlaRow) {
    const { error } = await supabase.from("sla_config").update({
      prazo_horas: r.prazo_horas, alerta_horas: r.alerta_horas,
      criticidade: r.criticidade, ativo: r.ativo,
    }).eq("id", r.id);
    if (error) { toast.error("Falha", { description: error.message }); return; }
    toast.success("Regra atualizada");
  }

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-surface-1">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-omni" />
          <h2 className="font-display font-semibold">Regras de SLA</h2>
          <Badge variant="outline" className="text-[10px]">{rows.length} ativas</Badge>
        </div>
        {!podeEditar && <span className="text-[10px] text-muted-foreground italic">Apenas Admin e Gestor podem editar</span>}
      </div>
      <div className="overflow-x-auto">
        {loading ? <div className="p-6 text-sm text-muted-foreground">Carregando…</div> : (
          <table className="w-full text-xs">
            <thead className="bg-surface-1 text-muted-foreground uppercase tracking-wider text-[10px]">
              <tr>
                <th className="text-left px-3 py-2">Funil</th>
                <th className="text-left px-3 py-2">Etapa</th>
                <th className="text-left px-3 py-2">Operadora</th>
                <th className="text-left px-3 py-2">Prazo (h)</th>
                <th className="text-left px-3 py-2">Alerta (h)</th>
                <th className="text-left px-3 py-2">Criticidade</th>
                <th className="text-center px-3 py-2">Ativo</th>
                {podeEditar && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id} className="border-t border-border hover:bg-surface-1">
                  <td className="px-3 py-2 capitalize">{r.funil}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.etapa_id}</td>
                  <td className="px-3 py-2">{r.operadora ?? "Todas"}</td>
                  <td className="px-3 py-2">
                    <Input type="number" value={r.prazo_horas} disabled={!podeEditar} className="h-7 w-20"
                      onChange={e => setRows(c => c.map((x,i) => i===idx ? {...x, prazo_horas: +e.target.value}: x))} />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" value={r.alerta_horas} disabled={!podeEditar} className="h-7 w-20"
                      onChange={e => setRows(c => c.map((x,i) => i===idx ? {...x, alerta_horas: +e.target.value}: x))} />
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={cn("text-[9px]",
                      r.criticidade === "alta" ? "bg-destructive/15 text-destructive border-destructive/30" :
                      "bg-warning/15 text-warning border-warning/30")}>{r.criticidade}</Badge>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={r.ativo} disabled={!podeEditar} className="accent-omni"
                      onChange={e => setRows(c => c.map((x,i) => i===idx ? {...x, ativo: e.target.checked}: x))} />
                  </td>
                  {podeEditar && (
                    <td className="px-3 py-2">
                      <Button size="sm" variant="ghost" onClick={() => salvar(r)} className="h-7 gap-1">
                        <Save className="size-3" /> Salvar
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-12 text-center text-muted-foreground italic">Sem regras configuradas.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function StatusPanel({ titulo, op, lista }: { titulo: string; op: "claro" | "vivo"; lista: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold">{titulo}</h3>
        <span className={cn("text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider",
          `bg-[var(--${op})]/15 text-[var(--${op})]`
        )}>{lista.length} status</span>
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-72 overflow-y-auto">
        {lista.map(s => (
          <span key={s} className="text-[10px] px-2 py-1 rounded-md bg-surface-2 border border-border text-muted-foreground hover:text-foreground transition-colors">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

interface ErroCatRow { id: string; nome: string; ativo: boolean }

function ErrosCatalogoPanel() {
  const { primaryRole } = useAuth();
  const podeEditar = primaryRole === "admin";
  const [rows, setRows] = useState<ErroCatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("erros_catalogo").select("*").order("nome");
    setRows((data ?? []) as ErroCatRow[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function criar() {
    const nome = novo.trim();
    if (!nome) return;
    const { error } = await supabase.from("erros_catalogo").insert({ nome });
    if (error) { toast.error("Falha", { description: error.message }); return; }
    toast.success("Erro criado");
    setNovo("");
    load();
  }

  async function salvar(r: ErroCatRow) {
    const { error } = await supabase.from("erros_catalogo")
      .update({ nome: r.nome, ativo: r.ativo }).eq("id", r.id);
    if (error) { toast.error("Falha", { description: error.message }); return; }
    toast.success("Atualizado");
  }

  async function remover(id: string) {
    if (!confirm("Remover este erro do catálogo?")) return;
    const { error } = await supabase.from("erros_catalogo").delete().eq("id", id);
    if (error) { toast.error("Falha", { description: error.message }); return; }
    toast.success("Removido");
    load();
  }

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-surface-1">
        <div className="flex items-center gap-2">
          <AlertOctagon className="size-4 text-omni" />
          <h2 className="font-display font-semibold">Catálogo de Erros</h2>
          <Badge variant="outline" className="text-[10px]">{rows.length}</Badge>
        </div>
        {!podeEditar && <span className="text-[10px] text-muted-foreground italic">Apenas Admin pode editar</span>}
      </div>
      {podeEditar && (
        <div className="px-4 py-3 border-b border-border flex gap-2 items-center bg-surface-1/50">
          <Input value={novo} onChange={e => setNovo(e.target.value)}
            placeholder="Novo erro (ex.: Falta documento)" className="h-8 max-w-md"
            onKeyDown={e => { if (e.key === "Enter") criar(); }} />
          <Button size="sm" className="h-8 gap-1.5" onClick={criar} disabled={!novo.trim()}>
            <Plus className="size-3.5" /> Adicionar
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        {loading ? <div className="p-6 text-sm text-muted-foreground">Carregando…</div> : (
          <table className="w-full text-xs">
            <thead className="bg-surface-1 text-muted-foreground uppercase tracking-wider text-[10px]">
              <tr>
                <th className="text-left px-3 py-2">Nome</th>
                <th className="text-center px-3 py-2 w-24">Ativo</th>
                {podeEditar && <th className="px-3 py-2 w-32"></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id} className="border-t border-border hover:bg-surface-1">
                  <td className="px-3 py-2">
                    <Input value={r.nome} disabled={!podeEditar} className="h-7"
                      onChange={e => setRows(c => c.map((x,i) => i===idx ? {...x, nome: e.target.value}: x))} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={r.ativo} disabled={!podeEditar} className="accent-omni"
                      onChange={e => setRows(c => c.map((x,i) => i===idx ? {...x, ativo: e.target.checked}: x))} />
                  </td>
                  {podeEditar && (
                    <td className="px-3 py-2 flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => salvar(r)} className="h-7 gap-1">
                        <Save className="size-3" /> Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remover(r.id)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                        <Trash2 className="size-3" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={3} className="px-3 py-12 text-center text-muted-foreground italic">Sem erros cadastrados.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
