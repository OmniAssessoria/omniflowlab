import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  defaultPermissionState,
  modulesForRole,
  type IndividualPermissionRole,
} from "@/lib/permission-matrix";
import { supabase } from "@/integrations/supabase/client";

type PermissionUser = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  role: IndividualPermissionRole;
};

export function PermissionsDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [user, setUser] = useState<PermissionUser | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [savedPermissions, setSavedPermissions] = useState<Record<string, boolean>>({});
  const [activeModuleId, setActiveModuleId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const modules = useMemo(
    () => user ? modulesForRole(user.role) : [],
    [user],
  );

  const activeModule = useMemo(
    () => modules.find(module => module.id === activeModuleId) ?? modules[0] ?? null,
    [modules, activeModuleId],
  );

  const dirty = useMemo(() => {
    const keys = new Set([...Object.keys(savedPermissions), ...Object.keys(permissions)]);
    for (const key of keys) {
      if (Boolean(savedPermissions[key]) !== Boolean(permissions[key])) return true;
    }
    return false;
  }, [permissions, savedPermissions]);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;

    setLoading(true);
    void (async () => {
      const { data, error } = await (supabase as any).rpc("get_individual_permission_config", {
        p_user_id: userId,
      });
      if (error) throw error;
      if (!data?.user) throw new Error("Configuração de permissões não encontrada.");

      const nextUser = data.user as PermissionUser;
      const defaults = defaultPermissionState(nextUser.role);
      const stored = (data.permissions ?? {}) as Record<string, boolean>;
      const effective = { ...defaults };

      for (const key of Object.keys(defaults)) {
        if (typeof stored[key] === "boolean") effective[key] = stored[key];
      }

      if (cancelled) return;
      setUser(nextUser);
      setPermissions(effective);
      setSavedPermissions(effective);
      const first = modulesForRole(nextUser.role)[0];
      setActiveModuleId(first?.id ?? "");
    })()
      .catch((error: any) => {
        if (!cancelled) {
          toast.error("Não foi possível abrir as permissões", {
            description: error?.message || "Falha ao carregar a configuração.",
          });
          onOpenChange(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, userId, onOpenChange]);

  function requestClose() {
    if (saving) return;
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(false);
  }

  async function handleSave() {
    if (!userId || !user || saving) return;
    setSaving(true);
    try {
      const { data, error } = await (supabase as any).rpc("save_individual_permission_config", {
        p_user_id: userId,
        p_permissions: permissions,
        p_previous_effective: savedPermissions,
      });
      if (error) throw error;

      const changes = Number(data ?? 0);
      setSavedPermissions({ ...permissions });
      toast.success("Configuração de permissões salva", {
        description: changes
          ? `${changes} alteração(ões) registrada(s) na auditoria.`
          : "Nenhuma alteração pendente.",
      });
    } catch (error: any) {
      toast.error("Não foi possível salvar as permissões", {
        description: error?.message || "Falha ao salvar a configuração.",
      });
    } finally {
      setSaving(false);
    }
  }

  function moduleCount(moduleId: string) {
    const module = modules.find(item => item.id === moduleId);
    if (!module) return { enabled: 0, total: 0 };
    const items = module.groups.flatMap(group => group.items);
    return {
      enabled: items.filter(item => permissions[item.key]).length,
      total: items.length,
    };
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={next => {
          if (!next) requestClose();
          else onOpenChange(true);
        }}
      >
        <DialogContent
          className="flex h-[88vh] w-[92vw] max-w-[1500px] flex-col overflow-hidden p-0"
          onEscapeKeyDown={event => {
            if (dirty) {
              event.preventDefault();
              setDiscardOpen(true);
            }
          }}
          onPointerDownOutside={event => {
            if (dirty) event.preventDefault();
          }}
        >
          <DialogHeader className="shrink-0 border-b border-border bg-background px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3 pr-7">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <ShieldCheck className="size-5 text-omni" />
                  Permissões individuais
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Configuração individual por usuário. Esta tela não substitui regras condicionais, ownership, operadora, produto, status ou etapa.
                </DialogDescription>
              </div>
              {user && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="capitalize">
                    {user.role}
                  </Badge>
                  <Badge className={user.ativo ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}>
                    {user.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              )}
            </div>

            <div className="mt-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-[10px] text-muted-foreground">
              <strong className="text-warning">Camada de configuração:</strong>{" "}
              os valores desta tela são armazenados individualmente e auditados, mas não substituem nem alteram as autorizações atuais do sistema enquanto a camada de enforcement não for ativada.
            </div>

            {user && (
              <div className="mt-3 grid gap-2 rounded-xl border border-border bg-surface-1 p-3 text-xs sm:grid-cols-3">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Usuário</div>
                  <div className="mt-0.5 font-semibold">{user.nome || "—"}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Perfil</div>
                  <div className="mt-0.5 font-semibold capitalize">{user.role}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">E-mail</div>
                  <div className="mt-0.5 truncate font-medium">{user.email || "—"}</div>
                </div>
              </div>
            )}
          </DialogHeader>

          <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)]">
            <aside className="min-h-0 border-r border-border bg-surface-1/50">
              <ScrollArea className="h-full">
                <div className="space-y-1 p-2">
                  {modules.map(module => {
                    const count = moduleCount(module.id);
                    const active = activeModule?.id === module.id;
                    return (
                      <button
                        key={module.id}
                        type="button"
                        onClick={() => setActiveModuleId(module.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                          active
                            ? "border-omni/45 bg-omni/10 text-foreground"
                            : "border-transparent text-muted-foreground hover:border-border hover:bg-background",
                        )}
                      >
                        <span className="min-w-0 truncate font-medium">{module.label}</span>
                        <span className={cn(
                          "shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[9px]",
                          active ? "bg-omni/15 text-omni" : "bg-background text-muted-foreground",
                        )}>
                          {count.enabled}/{count.total}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </aside>

            <main className="min-h-0 bg-background">
              <ScrollArea className="h-full">
                <div className="p-5">
                  {loading && (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      Carregando configuração individual…
                    </div>
                  )}

                  {!loading && activeModule && (
                    <>
                      <div className="mb-4">
                        <h3 className="font-display text-xl font-bold">{activeModule.label}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Alterações ficam pendentes até clicar em Salvar alterações.
                        </p>
                      </div>

                      <Accordion
                        type="multiple"
                        defaultValue={activeModule.groups.map(group => group.id)}
                        className="space-y-2"
                        key={activeModule.id}
                      >
                        {activeModule.groups.map(group => (
                          <AccordionItem
                            key={group.id}
                            value={group.id}
                            className="rounded-xl border border-border bg-card px-4"
                          >
                            <AccordionTrigger className="py-3 hover:no-underline">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{group.label}</span>
                                <Badge variant="outline" className="h-5 text-[9px]">
                                  {group.items.filter(item => permissions[item.key]).length}/{group.items.length}
                                </Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-3">
                              <div className="divide-y divide-border/70">
                                {group.items.map(item => {
                                  const enabled = Boolean(permissions[item.key]);
                                  return (
                                    <div
                                      key={item.key}
                                      className={cn(
                                        "flex gap-4 py-3",
                                        item.critical && "rounded-lg bg-destructive/[0.035] px-2",
                                      )}
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-sm font-medium">{item.label}</span>
                                          {item.critical && (
                                            <Badge variant="outline" className="border-warning/40 text-[8px] text-warning">
                                              AÇÃO CRÍTICA
                                            </Badge>
                                          )}
                                          {item.conditional && (
                                            <Badge variant="outline" className="text-[8px]">
                                              CONDICIONAL
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                                          {item.key}
                                        </div>
                                        {(item.description || item.critical) && (
                                          <div className="mt-1 flex items-start gap-1.5 text-[10px] text-muted-foreground">
                                            {item.critical && <AlertTriangle className="mt-0.5 size-3 shrink-0 text-warning" />}
                                            <span>
                                              {item.description
                                                ?? "Ação crítica: continua sujeita às regras de segurança, ownership, status e demais restrições atuais."}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex w-[150px] shrink-0 items-center justify-end gap-2">
                                        <div className={cn(
                                          "inline-flex min-w-[82px] items-center justify-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold uppercase",
                                          enabled
                                            ? "border-success/35 bg-success/10 text-success"
                                            : "border-destructive/35 bg-destructive/10 text-destructive",
                                        )}>
                                          {enabled
                                            ? <CheckCircle2 className="size-3" />
                                            : <XCircle className="size-3" />}
                                          {enabled ? "Ligado" : "Desligado"}
                                        </div>
                                        <Switch
                                          checked={enabled}
                                          onCheckedChange={checked => setPermissions(current => ({
                                            ...current,
                                            [item.key]: checked,
                                          }))}
                                          className="data-[state=checked]:bg-success data-[state=unchecked]:bg-destructive"
                                          aria-label={`${item.label}: ${enabled ? "Ligado" : "Desligado"}`}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </>
                  )}
                </div>
              </ScrollArea>
            </main>
          </div>

          <DialogFooter className="shrink-0 border-t border-border bg-background px-5 py-3 sm:justify-between">
            <div className="text-[10px] text-muted-foreground">
              {dirty
                ? "Existem alterações ainda não salvas."
                : "Nenhuma alteração pendente."}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={requestClose} disabled={saving}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={!dirty || saving || loading}
                className="bg-omni font-semibold text-black hover:bg-omni-glow"
              >
                {saving ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações não salvas?</AlertDialogTitle>
            <AlertDialogDescription>
              As alterações feitas neste modal ainda não foram salvas e serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setDiscardOpen(false);
                setPermissions({ ...savedPermissions });
                onOpenChange(false);
              }}
            >
              Descartar alterações
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
