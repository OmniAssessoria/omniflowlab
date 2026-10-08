import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Beaker, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { landingForRole } from "@/lib/permissions";

export const Route = createFileRoute("/auth/nova-senha")({
  ssr: false,
  component: NovaSenhaPage,
});

function NovaSenhaPage() {
  const navigate = useNavigate();
  const { user, primaryRole, loading } = useAuth();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" />;

  async function handle(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 6) return toast.error("A senha precisa ter no mínimo 6 caracteres.");
    if (senha !== confirma) return toast.error("As senhas não conferem.");

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) return toast.error("Falha ao alterar senha", { description: error.message });

      toast.success("Senha atualizada com sucesso.");
      navigate({ to: landingForRole(primaryRole) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-omni grid place-items-center"><Beaker className="size-5 text-black" /></div>
          <div>
            <div className="font-display font-bold">OMNI Flow Lab</div>
            <div className="text-xs text-muted-foreground">Alterar minha senha</div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-1 p-3">
          <ShieldCheck className="size-4 text-omni shrink-0 mt-0.5" />
          <div className="text-xs">
            Defina uma nova senha para sua conta.
            <div className="text-[11px] text-muted-foreground mt-1">Mínimo de 6 caracteres. Não há exigência de número, letra maiúscula ou símbolo.</div>
          </div>
        </div>

        <form onSubmit={handle} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="s1">Nova senha</Label>
            <Input id="s1" type="password" required value={senha} onChange={e => setSenha(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s2">Confirmar nova senha</Label>
            <Input id="s2" type="password" required value={confirma} onChange={e => setConfirma(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => navigate({ to: landingForRole(primaryRole) })} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy} className="flex-1 bg-omni text-black hover:bg-omni/90 font-semibold">
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Salvar senha"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
