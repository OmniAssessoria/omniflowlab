import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PartePedidoCadastroDialog,
  type PartePedidoCadastro,
  type PartePedidoTipo,
} from "@/components/parte-pedido-cadastro-dialog";
import { tipoPedidoExigeCedente } from "@/lib/cedente-rules";

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

function ordenarCedentes(a: Cedente, b: Cedente) {
  return (a.razao_social || a.nome || a.cnpj_cpf).localeCompare(
    b.razao_social || b.nome || b.cnpj_cpf,
    "pt-BR",
  );
}

function ordenarCessionarios(a: Cessionario, b: Cessionario) {
  return (a.nome || a.cpf).localeCompare(b.nome || b.cpf, "pt-BR");
}

export function CedentesPedidoManager({
  vendaId,
  clienteId,
  tipoPedido: _tipoPedido,
  onChanged,
}: {
  vendaId: string;
  clienteId: string;
  tipoPedido: string | string[] | null | undefined;
  onChanged?: () => void | Promise<void>;
}) {
  const [cedentes, setCedentes] = useState<Cedente[]>([]);
  const [cessionarios, setCessionarios] = useState<Cessionario[]>([]);
  const [cedentesSelecionados, setCedentesSelecionados] = useState<string[]>([]);
  const [cessionariosSelecionados, setCessionariosSelecionados] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const permitePartes = tipoPedidoExigeCedente(_tipoPedido);
  const [cedenteOpen, setCedenteOpen] = useState(false);
  const [cessionarioOpen, setCessionarioOpen] = useState(false);
  const [editarCedente, setEditarCedente] = useState<PartePedidoCadastro | null>(null);
  const [editarCessionario, setEditarCessionario] = useState<PartePedidoCadastro | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const db = supabase as any;

    const [clienteCedentesRes, vendaCedentesRes, clienteCessionariosRes, vendaCessionariosRes] = await Promise.all([
      db
        .from("cliente_cedentes")
        .select("cedente_id,ativo,cedentes(id,cnpj_cpf,razao_social,nome,email,telefone)")
        .eq("cliente_id", clienteId)
        .eq("ativo", true),
      db
        .from("venda_cedentes")
        .select("cedente_id")
        .eq("venda_id", vendaId),
      db
        .from("cliente_cessionarios")
        .select("cessionario_id,ativo,cessionarios(id,cpf,nome,email)")
        .eq("cliente_id", clienteId)
        .eq("ativo", true),
      db
        .from("venda_cessionarios")
        .select("cessionario_id")
        .eq("venda_id", vendaId),
    ]);

    const erro = clienteCedentesRes.error
      || vendaCedentesRes.error
      || clienteCessionariosRes.error
      || vendaCessionariosRes.error;

    if (erro) {
      toast.error("Não foi possível carregar Cedentes/Cessionários", {
        description: erro.message,
      });
    }

    setCedentes(
      (clienteCedentesRes.data ?? [])
        .map((row: any) => row.cedentes)
        .filter(Boolean)
        .sort(ordenarCedentes),
    );
    setCessionarios(
      (clienteCessionariosRes.data ?? [])
        .map((row: any) => row.cessionarios)
        .filter(Boolean)
        .sort(ordenarCessionarios),
    );
    setCedentesSelecionados((vendaCedentesRes.data ?? []).map((row: any) => row.cedente_id));
    setCessionariosSelecionados((vendaCessionariosRes.data ?? []).map((row: any) => row.cessionario_id));
    setLoading(false);
  }, [clienteId, vendaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const cedentesSelecionadosSet = useMemo(() => new Set(cedentesSelecionados), [cedentesSelecionados]);
  const cessionariosSelecionadosSet = useMemo(() => new Set(cessionariosSelecionados), [cessionariosSelecionados]);

  async function toggleParte(tipo: PartePedidoTipo, id: string) {
    const db = supabase as any;
    const isCedente = tipo === "cedente";
    const selecionadosSet = isCedente ? cedentesSelecionadosSet : cessionariosSelecionadosSet;
    const checked = selecionadosSet.has(id);
    const key = `${tipo}:${id}`;
    setSavingKey(key);

    const tabelaVenda = isCedente ? "venda_cedentes" : "venda_cessionarios";
    const campoId = isCedente ? "cedente_id" : "cessionario_id";
    const label = isCedente ? "Cedente" : "Cessionário";

    try {
      if (checked) {
        const { error } = await db
          .from(tabelaVenda)
          .delete()
          .eq("venda_id", vendaId)
          .eq(campoId, id);
        if (error) throw error;

        if (isCedente) setCedentesSelecionados(curr => curr.filter(item => item !== id));
        else setCessionariosSelecionados(curr => curr.filter(item => item !== id));

        toast.success(`${label} removido deste pedido`);
      } else {
        const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
        const { error } = await db
          .from(tabelaVenda)
          .insert({ venda_id: vendaId, [campoId]: id, created_by: userId });
        if (error) throw error;

        if (isCedente) setCedentesSelecionados(curr => [...curr, id]);
        else setCessionariosSelecionados(curr => [...curr, id]);

        toast.success(`${label} incluído neste pedido`);
      }

      await onChanged?.();
    } catch (error: any) {
      toast.error(`Não foi possível alterar o ${label} do pedido`, {
        description: error?.message?.includes("vinculado a uma ou mais linhas")
          ? `Remova este ${label} das linhas antes de retirá-lo do pedido.`
          : error?.message,
      });
    } finally {
      setSavingKey(null);
    }
  }

  async function aposSalvar() {
    await load();
    await onChanged?.();
  }

  function abrirNovo(tipo: PartePedidoTipo) {
    if (tipo === "cedente") {
      setEditarCedente(null);
      setCedenteOpen(true);
    } else {
      setEditarCessionario(null);
      setCessionarioOpen(true);
    }
  }

  function abrirEditarCedente(item: Cedente) {
    setEditarCedente({
      id: item.id,
      tipo: "cedente",
      documento: item.cnpj_cpf,
      razaoSocial: item.razao_social,
      nome: item.nome ?? "",
      email: item.email ?? "",
      telefone: item.telefone ?? "",
    });
    setCedenteOpen(true);
  }

  function abrirEditarCessionario(item: Cessionario) {
    setEditarCessionario({
      id: item.id,
      tipo: "cessionario",
      documento: item.cpf,
      nome: item.nome,
      email: item.email,
    });
    setCessionarioOpen(true);
  }

  function ParteHeader({ tipo, quantidade }: { tipo: PartePedidoTipo; quantidade: number }) {
    const isCedente = tipo === "cedente";
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            {isCedente ? <Building2 className="size-4 text-omni" /> : <UserRound className="size-4 text-omni" />}
            <h4 className="text-sm font-semibold">{isCedente ? "Cedentes" : "Cessionários"}</h4>
            <Badge variant="outline" className="text-[9px]">
              {quantidade} selecionado{quantidade === 1 ? "" : "s"}
            </Badge>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {isCedente
              ? "Pessoa Física ou Jurídica: CPF/CNPJ e dados de contato."
              : "Pessoa Física opcional: CPF, Nome e E-mail."}
          </p>
        </div>

        {permitePartes && (
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => abrirNovo(tipo)}>
            <Plus className="size-3.5" />
            Cadastrar {isCedente ? "Cedente" : "Cessionário"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-surface-1/50 p-4">
        <ParteHeader tipo="cedente" quantidade={cedentesSelecionados.length} />

        {loading ? (
          <div className="mt-4 text-xs text-muted-foreground">Carregando Cedentes...</div>
        ) : cedentes.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
            A empresa ainda não possui Cedentes cadastrados.
          </div>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {cedentes.map(item => {
              const checked = cedentesSelecionadosSet.has(item.id);
              const busy = savingKey === `cedente:${item.id}`;
              return (
                <div
                  key={item.id}
                  className={"flex items-start gap-3 rounded-xl border p-3 " + (checked ? "border-omni/50 bg-omni/5" : "border-border bg-card/50")}
                >
                  <Checkbox
                    checked={checked}
                    disabled={busy || !permitePartes}
                    onCheckedChange={() => void toggleParte("cedente", item.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold">{item.razao_social || item.nome || "Cedente"}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {String(item.cnpj_cpf ?? "").replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ"}: {item.cnpj_cpf}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {[item.nome, item.email, item.telefone].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => abrirEditarCedente(item)}
                      title="Editar Cedente"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    {checked && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => void toggleParte("cedente", item.id)}
                        disabled={busy}
                        title="Remover Cedente deste pedido"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface-1/50 p-4">
        <ParteHeader tipo="cessionario" quantidade={cessionariosSelecionados.length} />

        {loading ? (
          <div className="mt-4 text-xs text-muted-foreground">Carregando Cessionários...</div>
        ) : cessionarios.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
            A empresa ainda não possui Cessionários cadastrados.
          </div>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {cessionarios.map(item => {
              const checked = cessionariosSelecionadosSet.has(item.id);
              const busy = savingKey === `cessionario:${item.id}`;
              return (
                <div
                  key={item.id}
                  className={"flex items-start gap-3 rounded-xl border p-3 " + (checked ? "border-omni/50 bg-omni/5" : "border-border bg-card/50")}
                >
                  <Checkbox
                    checked={checked}
                    disabled={busy || !permitePartes}
                    onCheckedChange={() => void toggleParte("cessionario", item.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold">{item.nome || "Cessionário"}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">CPF: {item.cpf}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground">{item.email}</div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => abrirEditarCessionario(item)}
                      title="Editar Cessionário"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    {checked && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => void toggleParte("cessionario", item.id)}
                        disabled={busy}
                        title="Remover Cessionário deste pedido"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <PartePedidoCadastroDialog
        tipo="cedente"
        open={cedenteOpen}
        onOpenChange={setCedenteOpen}
        clienteId={clienteId}
        vendaId={vendaId}
        editar={editarCedente}
        onSaved={aposSalvar}
      />

      <PartePedidoCadastroDialog
        tipo="cessionario"
        open={cessionarioOpen}
        onOpenChange={setCessionarioOpen}
        clienteId={clienteId}
        vendaId={vendaId}
        editar={editarCessionario}
        onSaved={aposSalvar}
      />
    </div>
  );
}
