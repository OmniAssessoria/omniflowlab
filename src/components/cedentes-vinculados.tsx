import { useCallback, useEffect, useState } from "react";
import { Building2, Mail, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

type Cedente = {
  id: string;
  cnpj_cpf: string;
  razao_social: string | null;
  nome: string | null;
  email: string | null;
  telefone: string | null;
};

type Cessionario = {
  id: string;
  cpf: string;
  nome: string;
  email: string;
};

export function CedentesVinculados({ clienteId }: { clienteId: string }) {
  const [cedentes, setCedentes] = useState<Cedente[]>([]);
  const [cessionarios, setCessionarios] = useState<Cessionario[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const db = supabase as any;
    const [cedentesRes, cessionariosRes] = await Promise.all([
      db
        .from("cliente_cedentes")
        .select("cedente_id, ativo, cedentes(id,cnpj_cpf,razao_social,nome,email,telefone)")
        .eq("cliente_id", clienteId)
        .eq("ativo", true),
      db
        .from("cliente_cessionarios")
        .select("cessionario_id, ativo, cessionarios(id,cpf,nome,email)")
        .eq("cliente_id", clienteId)
        .eq("ativo", true),
    ]);

    if (cedentesRes.error || cessionariosRes.error) {
      console.error("[Cedentes/Cessionários CRM]", cedentesRes.error || cessionariosRes.error);
    }

    setCedentes(
      (cedentesRes.data ?? [])
        .map((row: any) => row.cedentes)
        .filter(Boolean)
        .sort((a: Cedente, b: Cedente) =>
          (a.razao_social || a.nome || a.cnpj_cpf).localeCompare(b.razao_social || b.nome || b.cnpj_cpf, "pt-BR"),
        ),
    );
    setCessionarios(
      (cessionariosRes.data ?? [])
        .map((row: any) => row.cessionarios)
        .filter(Boolean)
        .sort((a: Cessionario, b: Cessionario) => (a.nome || a.cpf).localeCompare(b.nome || b.cpf, "pt-BR")),
    );
    setLoading(false);
  }, [clienteId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-omni" />
          <span className="text-sm font-semibold">Cedentes e Cessionários vinculados</span>
        </div>
        <div className="flex gap-1.5">
          <Badge variant="outline" className="text-[9px]">Cedentes: {cedentes.length}</Badge>
          <Badge variant="outline" className="text-[9px]">Cessionários: {cessionarios.length}</Badge>
        </div>
      </div>

      {loading ? (
        <div className="p-5 text-xs text-muted-foreground">Carregando Cedentes e Cessionários...</div>
      ) : cedentes.length === 0 && cessionarios.length === 0 ? (
        <div className="p-5 text-xs text-muted-foreground">
          Nenhum Cedente ou Cessionário vinculado. O cadastro é feito dentro de um pedido da empresa.
        </div>
      ) : (
        <div className="space-y-4 p-3">
          {cedentes.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Building2 className="size-3.5" /> Cedentes
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {cedentes.map(item => (
                  <article key={item.id} className="rounded-xl border border-border bg-surface-1/60 p-3">
                    <div className="font-semibold">{item.razao_social || item.nome || "Cedente"}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {String(item.cnpj_cpf ?? "").replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ"}: {item.cnpj_cpf}
                    </div>
                    <div className="mt-3 space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <UserRound className="size-3.5 text-muted-foreground" />
                        <span>{item.nome || "Nome não informado"}</span>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{item.email || "E-mail não informado"}</span>
                      </div>
                      {item.telefone && (
                        <div className="text-[11px] text-muted-foreground">Telefone: {item.telefone}</div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {cessionarios.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <UserRound className="size-3.5" /> Cessionários
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {cessionarios.map(item => (
                  <article key={item.id} className="rounded-xl border border-border bg-surface-1/60 p-3">
                    <div className="font-semibold">{item.nome || "Cessionário"}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">CPF: {item.cpf}</div>
                    <div className="mt-3 flex min-w-0 items-center gap-2 text-xs">
                      <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{item.email || "E-mail não informado"}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
