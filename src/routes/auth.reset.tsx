import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Beaker, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/reset")({
  ssr: false,
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase processa o hash automaticamente; só liberamos o form se houver sessão
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setReady(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handle(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 8) return toast.error("Mínimo de 8 caracteres");
    if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha))
      return toast.error("Inclua letra e número");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setBusy(false);
    if (error) return toast.error("Falha", { description: error.message });
    toast.success("Senha redefinida");
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-8">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-omni grid place-items-center"><Beaker className="size-5 text-black" /></div>
          <div className="font-display font-bold">Redefinir senha</div>
        </div>
        {!ready ? (
          <p className="text-sm text-muted-foreground">Link inválido ou expirado. Solicite um novo na tela de login.</p>
        ) : (
          <form onSubmit={handle} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="s">Nova senha</Label>
              <Input id="s" type="password" required value={senha} onChange={e => setSenha(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-omni text-black hover:bg-omni/90 font-semibold">
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Salvar"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
