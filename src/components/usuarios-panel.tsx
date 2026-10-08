import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, KeyRound, ShieldCheck, AlertTriangle, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABEL, useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { criarUsuario } from "@/lib/users.functions";

type Role = "admin" | "gestor" | "consultor" | "bko" | "closer" | "telespectador";

const VALID_ROLES: Role[] = ["admin", "gestor", "consultor", "bko", "closer", "telespectador"];

function safePrimaryRole(roles: unknown): Role | null {
  if (!Array.isArray(roles)) return null;
  for (const r of VALID_ROLES) if (roles.includes(r)) return r;
  return null;
}

interface Row {
  id: string;
  email: string;
  nome_completo: string;
  operadora_default: string | null;
  ativo: boolean;
  must_change_password: boolean;
  permissoes: Record<string, boolean>;
  last_login_at: string | null;
  roles: string[];
  is_super_admin: boolean;
  inconsistencias: string[];
}

async function invokeAdminFunction(name: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message || "Não foi possível concluir a operação.";
    try {
      const response = (error as any)?.context as Response | undefined;
      if (response?.clone) {
        const payload = await response.clone().json();
        if (payload?.error) message = String(payload.error);
      }
    } catch {
      // Mantém a mensagem original do SDK.
    }
    throw new Error(message);
  }
  if ((data as any)?.error) throw new Error(String((data as any).error));
  return data as any;
}

async function createUserViaExternalSupabase(payload: {
  nome: string;
  email: string;
  role: Role;
  password: string;
  operadora: string | null;
}) {
  return invokeAdminFunction("admin-create-user", payload);
}

async function resetPasswordViaExternalSupabase(id: string, newPassword: string) {
  return invokeAdminFunction("admin-reset-password", { id, newPassword });
}

export function UsuariosPanel() {
  const { primaryRole } = useAuth();
  const createUserServer = useServerFn(criarUsuario);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [senhaTarget, setSenhaTarget] = useState<Row | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setLoadError(null);
    try {
      const [profilesResult, rolesResult, colabsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, nome_completo, operadora_default, ativo, must_change_password, permissoes, last_login_at, is_deleted, deleted_at")
          .or("is_deleted.is.null,is_deleted.eq.false")
          .order("nome_completo"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("colaboradores").select("user_id, funcao, is_deleted"),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (rolesResult.error) throw rolesResult.error;
      if (colabsResult.error) throw colabsResult.error;

      const profiles = profilesResult.data ?? [];
      const roles = rolesResult.data ?? [];
      const colabs = colabsResult.data ?? [];

      setRows(
        profiles
          .filter((p) => !p.deleted_at)
          .map((p) => {
            const explicitRoles = roles.filter((r) => r.user_id === p.id).map((r) => String(r.role));
            const colab = colabs.find((c) => c.user_id === p.id);
            const fallbackRole = colab?.funcao && VALID_ROLES.includes(colab.funcao as Role) ? [String(colab.funcao)] : [];
            const userRoles = explicitRoles.length > 0 ? explicitRoles : fallbackRole;
            const validRoles = userRoles.filter((r) => VALID_ROLES.includes(r as Role));

            return {
              ...p,
              permissoes: (p.permissoes ?? {}) as Record<string, boolean>,
              roles: validRoles,
              is_super_admin: (p.email ?? "").toLowerCase() === "pablomazinesantos@gmail.com",
              inconsistencias: [
                validRoles.length === 0 ? "sem perfil válido" : null,
                !colab || colab.is_deleted ? "sem vínculo na Equipe" : null,
              ].filter(Boolean) as string[],
            } as Row;
          }),
      );
    } catch (e: any) {
      setLoadError(e?.message ?? "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const comInconsistencia = rows.filter((r) => r.inconsistencias.length > 0);

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold flex items-center gap-2">
            <ShieldCheck className="size-4 text-omni" />Usuários e Permissões
          </h2>
          <p className="text-xs text-muted-foreground">
            Cadastre usuários, defina perfis e permissões. Todo usuário criado aqui aparece automaticamente na Equipe.
          </p>
        </div>
        {(primaryRole === "admin" || primaryRole === "gestor") && (
          <Button onClick={() => setCreating(true)} className="bg-omni text-black hover:bg-omni/90">
            <Plus className="size-3.5 mr-1.5" />Novo usuário
          </Button>
        )}
      </div>

      {comInconsistencia.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 p-3 rounded-lg flex items-start gap-3">
          <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-warning">Inconsistências encontradas em alguns usuários.</h4>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {comInconsistencia.slice(0, 8).map((r) => (
                <li key={r.id}>{r.email}: {r.inconsistencias.join(", ")}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="size-4 animate-spin" />Carregando…
        </div>
      ) : loadError ? (
        <div className="py-8 flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="size-5 text-destructive" />
          <p className="text-sm text-muted-foreground">Não foi possível carregar os usuários.</p>
          <p className="text-xs text-muted-foreground max-w-md">{loadError}</p>
          <Button size="sm" variant="outline" onClick={reload}>Tentar novamente</Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-3">Nome</th>
                <th className="text-left py-2 pr-3">E-mail</th>
                <th className="text-left py-2 pr-3">Perfil</th>
                <th className="text-left py-2 pr-3">Operadora</th>
                <th className="text-left py-2 pr-3">Status</th>
                <th className="text-left py-2 pr-3">Último acesso</th>
                <th className="text-right py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const role = safePrimaryRole(r.roles);
                return (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-surface-1/40">
                    <td className="py-2 pr-3 font-medium">
                      {r.nome_completo}
                      {r.is_super_admin && <Badge className="ml-1 bg-omni text-black text-[9px]">SUPER</Badge>}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.email}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline">{role ? ROLE_LABEL[role] : "Perfil não definido"}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-xs">{r.operadora_default ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {r.ativo ? (
                        <Badge className="bg-success/20 text-success border-success/40">Ativo</Badge>
                      ) : (
                        <Badge className="bg-destructive/20 text-destructive border-destructive/40">Inativo</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {r.last_login_at ? new Date(r.last_login_at).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="py-2 text-right space-x-1">
                      {primaryRole === "admin" && (
                        <Button size="sm" variant="ghost" title="Trocar senha" onClick={() => setSenhaTarget(r)}>
                          <KeyRound className="size-3.5" />
                        </Button>
                      )}
                      {primaryRole === "admin" && !r.is_super_admin && (
                        <Button size="sm" variant="ghost" title="Excluir perfil" onClick={() => setDeleting(r)} className="text-destructive">
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <UsuarioDialog
          onClose={() => setCreating(false)}
          onSave={async (payload) => {
            const input = {
              nome: payload.nome.trim(),
              email: payload.email.trim().toLowerCase(),
              role: payload.role,
              password: payload.senha,
              operadora: payload.role === "consultor" ? payload.operadora ?? null : null,
            };
            const res = payload.role === "telespectador"
              ? await createUserServer({ data: input } as any)
              : await createUserViaExternalSupabase(input);

            toast.success(
              res?.reativado
                ? "Usuário reativado e vínculos corrigidos com sucesso."
                : `Usuário criado com sucesso. Perfil: ${ROLE_LABEL[payload.role as Role]}.`,
              res?.aviso ? { description: res.aviso, duration: 9000 } : undefined,
            );

            setCreating(false);
            await reload();
          }}
        />
      )}

      {senhaTarget && (
        <TrocarSenhaModal
          user={senhaTarget}
          onClose={() => setSenhaTarget(null)}
          onDone={() => { setSenhaTarget(null); reload(); }}
        />
      )}

      {deleting && (
        <ExcluirColaboradorModal
          user={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); reload(); }}
        />
      )}
    </section>
  );
}

function TrocarSenhaModal({ user, onClose, onDone }: { user: Row; onClose: () => void; onDone: () => void }) {
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  async function confirmarTroca() {
    if (senha.length < 6) return toast.error("A senha precisa ter no mínimo 6 caracteres.");
    if (senha !== confirmar) return toast.error("As senhas não conferem.");
    setLoading(true);
    try {
      await resetPasswordViaExternalSupabase(user.id, senha);
      toast.success("Senha atualizada com sucesso.");
      onDone();
    } catch (e: any) {
      toast.error("Falha ao trocar senha", { description: e?.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Trocar senha de {user.nome_completo}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">A nova senha precisa ter no mínimo 6 caracteres. Não é obrigatório usar número, letra maiúscula ou símbolo.</p>
          <div className="space-y-1.5">
            <Label>Nova senha</Label>
            <div className="flex gap-2">
              <Input type={show ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} />
              <Button type="button" variant="outline" size="icon" onClick={() => setShow((v) => !v)}>
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Confirmar senha</Label>
            <Input type={show ? "text" : "password"} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button className="bg-omni text-black hover:bg-omni/90" onClick={confirmarTroca} disabled={loading}>
            {loading ? "Salvando…" : "Salvar senha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExcluirColaboradorModal({ user, onClose, onDeleted }: { user: Row; onClose: () => void; onDeleted: () => void }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!reason.trim()) return toast.error("Informe o motivo da exclusão");
    setLoading(true);
    try {
      const res = await invokeAdminFunction("admin-delete-user", { id: user.id, reason: reason.trim() });
      toast.success(res?.message || "Usuário excluído com sucesso");
      onDeleted();
    } catch (e: any) {
      toast.error("Erro ao excluir", { description: e?.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="bg-surface-2 border-border max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="size-5" /> Excluir perfil
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground pt-2">
            Tem certeza que deseja excluir <strong>{user.nome_completo}</strong>?<br /><br />
            O usuário sai de Configurações &gt; Usuários, da Equipe e dos filtros do sistema, e o acesso é bloqueado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4 space-y-2">
          <Label className="text-xs">Motivo da exclusão (obrigatório)</Label>
          <textarea
            className="w-full h-24 rounded-md border border-border bg-surface-1 p-2 text-sm focus:outline-none focus:ring-1 focus:ring-omni"
            placeholder="Desligamento, erro de cadastro, etc..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading} className="bg-surface-3 border-border" onClick={onClose}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading || !reason.trim()} className="font-semibold">
            {loading ? "Excluindo..." : "Confirmar exclusão"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function UsuarioDialog({ onClose, onSave }: { onClose: () => void; onSave: (p: any) => Promise<void> | void }) {
  const { primaryRole } = useAuth();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("consultor");
  const [operadora, setOperadora] = useState<string>("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
        {error && (
          <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive break-words">
            <div className="font-semibold">Não foi possível criar o usuário.</div>
            <div className="mt-1">{error}</div>
          </div>
        )}
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nome completo</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Senha inicial</Label>
            <div className="flex gap-2">
              <Input type={showSenha ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowSenha((v) => !v)} aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}>
                {showSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Mínimo de 6 caracteres. A senha cadastrada já será válida para o primeiro acesso.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Confirmar senha</Label>
            <Input type={showSenha ? "text" : "password"} value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Perfil</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {primaryRole === "admin" && (
                    <>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="gestor">Gestor</SelectItem>
                      <SelectItem value="bko">BKO</SelectItem>
                      <SelectItem value="consultor">Consultor</SelectItem>
                      <SelectItem value="closer">Closer</SelectItem>
                      <SelectItem value="telespectador">Telespectador</SelectItem>
                    </>
                  )}
                  {primaryRole === "gestor" && <SelectItem value="consultor">Consultor</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            {role === "consultor" && (
              <div className="space-y-1.5">
                <Label>Operadora vinculada</Label>
                <Select value={operadora || ""} onValueChange={(v) => setOperadora(v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLARO">Claro</SelectItem>
                    <SelectItem value="VIVO">Vivo</SelectItem>
                    <SelectItem value="AMBAS">Ambas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            className="bg-omni text-black hover:bg-omni/90"
            disabled={saving}
            onClick={async () => {
              setError(null);
              if (nome.trim().length < 3) return toast.error("Informe o nome completo.");
              if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return toast.error("Informe um e-mail válido.");
              if (!senha.trim()) return toast.error("Informe uma senha inicial.");
              if (senha.length < 6) return toast.error("A senha precisa ter no mínimo 6 caracteres.");
              if (senha !== confirmarSenha) return toast.error("As senhas não conferem.");
              if (role === "consultor" && !operadora) return toast.error("Informe a operadora vinculada para o Consultor.");
              setSaving(true);
              try {
                await onSave({ nome, email, role, operadora: role === "consultor" ? operadora : null, senha });
              } catch (e: any) {
                const message = e?.message || "Não foi possível criar o usuário.";
                setError(message);
                toast.error("Não foi possível criar o usuário.", { description: message });
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
