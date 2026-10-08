import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type OfertaGerenciavel = {
  id: string;
  plano_id: string;
  plano_nome: string;
  bonus_extra: string | null;
  valor_mes: number;
  origem: string;
  pagina_fonte: number | null;
  produto_id: string | null;
};

function brl(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatBrlInput(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseBrlInput(value: string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits) / 100;
}

export function PlanoManagerDialog({
  open,
  onOpenChange,
  operadora,
  produto,
  produtoId,
  onChanged,
  variant = "default",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operadora: string;
  produto: string | null;
  produtoId: string | null;
  onChanged: () => void | Promise<void>;
  variant?: "default" | "passaporte" | "aparelho";
}) {
  const isPassaporte = variant === "passaporte";
  const isAparelho = variant === "aparelho";
  const isSimpleCatalog = isPassaporte || isAparelho;
  const [ofertas, setOfertas] = useState<OfertaGerenciavel[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [newValor, setNewValor] = useState("");
  const [newBonus, setNewBonus] = useState("");
  const [newOrigem, setNewOrigem] = useState("");
  const [newPagina, setNewPagina] = useState("");

  const [editingOfertaId, setEditingOfertaId] = useState<string | null>(null);
  const [editingPlanoId, setEditingPlanoId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingValor, setEditingValor] = useState("");
  const [editingBonus, setEditingBonus] = useState("");
  const [editingOrigem, setEditingOrigem] = useState("");
  const [editingPagina, setEditingPagina] = useState("");

  async function carregar() {
    if (!open || !produtoId) {
      setOfertas([]);
      return;
    }

    setLoading(true);
    const db = supabase as any;
    const [planosRes, ofertasRes] = await Promise.all([
      db.from("planos_catalogo")
        .select("id,nome,produto_id,operadora,ativo")
        .eq("operadora", operadora)
        .eq("produto_id", produtoId)
        .eq("ativo", true),
      db.from("plano_ofertas_catalogo")
        .select("id,plano_id,bonus_extra,valor_mes,origem,pagina_fonte,ativo")
        .eq("ativo", true),
    ]);

    setLoading(false);

    if (planosRes.error) {
      toast.error("Não foi possível carregar os Planos", { description: planosRes.error.message });
      return;
    }
    if (ofertasRes.error) {
      toast.error("Não foi possível carregar as ofertas dos Planos", { description: ofertasRes.error.message });
      return;
    }

    const plans = new Map<string, any>((planosRes.data ?? []).map((item: any) => [item.id, item]));
    const rows = (ofertasRes.data ?? [])
      .map((oferta: any) => {
        const plano = plans.get(oferta.plano_id);
        if (!plano) return null;
        return {
          id: oferta.id,
          plano_id: plano.id,
          plano_nome: plano.nome,
          bonus_extra: oferta.bonus_extra ?? null,
          valor_mes: Number(oferta.valor_mes ?? 0),
          origem: oferta.origem ?? "",
          pagina_fonte: oferta.pagina_fonte ?? null,
          produto_id: plano.produto_id,
        } as OfertaGerenciavel;
      })
      .filter(Boolean)
      .sort((a: OfertaGerenciavel, b: OfertaGerenciavel) =>
        a.valor_mes - b.valor_mes || a.plano_nome.localeCompare(b.plano_nome, "pt-BR")
      );

    setOfertas(rows);
  }

  useEffect(() => {
    void carregar();
  }, [open, produtoId, operadora]);

  useEffect(() => {
    if (!open || newOrigem.trim()) return;
    setNewOrigem([operadora, produto].filter(Boolean).join(" ").trim());
  }, [open, operadora, produto, newOrigem]);

  const resumo = useMemo(
    () => [operadora, produto].filter(Boolean).join(" · "),
    [operadora, produto],
  );

  function resetNew() {
    setNewName("");
    setNewValor("");
    setNewBonus("");
    setNewPagina("");
    setNewOrigem([operadora, produto].filter(Boolean).join(" ").trim());
  }

  function closeEditing() {
    setEditingOfertaId(null);
    setEditingPlanoId(null);
    setEditingName("");
    setEditingValor("");
    setEditingBonus("");
    setEditingOrigem("");
    setEditingPagina("");
  }

  async function criarPlano() {
    const nome = newName.trim();
    const origem = isPassaporte
      ? [operadora, produto, "PASSAPORTE"].filter(Boolean).join(" ").trim()
      : isAparelho
        ? [operadora, produto, "CATALOGO"].filter(Boolean).join(" ").trim()
        : newOrigem.trim();
    const valor = isAparelho ? 0 : parseBrlInput(newValor);
    const pagina = isSimpleCatalog ? null : (newPagina.trim() ? Number(newPagina) : null);

    if (!produtoId) return toast.error("Selecione o Produto da linha antes de criar um Plano.");
    if (!nome) return toast.error(isAparelho ? "Informe o nome do aparelho." : "Informe o nome do Plano.");
    if (!origem) return toast.error("Informe a origem/quadro do Plano.");
    if (!isAparelho && (!newValor.trim() || valor < 0)) return toast.error("Informe um valor mensal válido.");
    if (pagina !== null && (!Number.isInteger(pagina) || pagina < 0)) {
      return toast.error("Página-fonte inválida.");
    }

    setBusy(true);
    try {
      const db = supabase as any;
      const { data: plano, error: planoError } = await db
        .from("planos_catalogo")
        .insert({
          nome,
          operadora,
          ativo: true,
          produto_id: produtoId,
          bonus_extra: isSimpleCatalog ? null : (newBonus.trim() || null),
          valor_mes: valor,
          origem,
          pagina_fonte: pagina,
        })
        .select("id")
        .single();

      if (planoError) throw planoError;

      const { error: ofertaError } = await db
        .from("plano_ofertas_catalogo")
        .insert({
          plano_id: plano.id,
          bonus_extra: isSimpleCatalog ? null : (newBonus.trim() || null),
          valor_mes: valor,
          origem,
          pagina_fonte: pagina,
          ativo: true,
        });

      if (ofertaError) {
        await db.from("planos_catalogo").delete().eq("id", plano.id);
        throw ofertaError;
      }

      resetNew();
      await carregar();
      await onChanged();
      toast.success(isAparelho ? "Aparelho adicionado" : "Plano adicionado", {
        description: nome + " disponível para " + resumo + ".",
      });
    } catch (error: any) {
      toast.error("Não foi possível adicionar o Plano", { description: error?.message });
    } finally {
      setBusy(false);
    }
  }

  async function salvarEdicao() {
    if (!editingOfertaId || !editingPlanoId) return;

    const nome = editingName.trim();
    const valor = isAparelho ? 0 : parseBrlInput(editingValor);
    const pagina = isSimpleCatalog ? null : (editingPagina.trim() ? Number(editingPagina) : null);

    if (!nome) return toast.error(isAparelho ? "Informe o nome do aparelho." : "Informe o nome do Plano.");
    if (!isAparelho && (!editingValor.trim() || valor < 0)) return toast.error("Informe um valor mensal válido.");
    if (pagina !== null && (!Number.isInteger(pagina) || pagina < 0)) {
      return toast.error("Página-fonte inválida.");
    }

    setBusy(true);
    try {
      const db = supabase as any;
      const [{ error: planoError }, { error: ofertaError }] = await Promise.all([
        db.from("planos_catalogo")
          .update({
            nome,
            bonus_extra: isSimpleCatalog ? null : (editingBonus.trim() || null),
            valor_mes: valor,
            pagina_fonte: pagina,
          })
          .eq("id", editingPlanoId)
          .eq("operadora", operadora),
        db.from("plano_ofertas_catalogo")
          .update({
            bonus_extra: isSimpleCatalog ? null : (editingBonus.trim() || null),
            valor_mes: valor,
            pagina_fonte: pagina,
          })
          .eq("id", editingOfertaId),
      ]);

      if (planoError) throw planoError;
      if (ofertaError) throw ofertaError;

      closeEditing();
      await carregar();
      await onChanged();
      toast.success(isAparelho ? "Aparelho atualizado" : "Plano atualizado");
    } catch (error: any) {
      toast.error("Não foi possível editar o Plano", { description: error?.message });
    } finally {
      setBusy(false);
    }
  }

  async function desativarPlano(oferta: OfertaGerenciavel) {
    if (!window.confirm(
      "Remover “" + oferta.plano_nome + "” das opções de " + operadora + "? Pedidos antigos manterão o plano já gravado."
    )) return;

    setBusy(true);
    try {
      const db = supabase as any;

      const { error: ofertaError } = await db
        .from("plano_ofertas_catalogo")
        .update({ ativo: false })
        .eq("id", oferta.id);
      if (ofertaError) throw ofertaError;

      const { data: restantes, error: restantesError } = await db
        .from("plano_ofertas_catalogo")
        .select("id")
        .eq("plano_id", oferta.plano_id)
        .eq("ativo", true)
        .limit(1);

      if (restantesError) throw restantesError;

      if ((restantes ?? []).length === 0) {
        const { error: planoError } = await db
          .from("planos_catalogo")
          .update({ ativo: false })
          .eq("id", oferta.plano_id)
          .eq("operadora", operadora);
        if (planoError) throw planoError;
      }

      await carregar();
      await onChanged();
      toast.success(isAparelho ? "Aparelho removido das opções" : "Plano removido das opções");
    } catch (error: any) {
      toast.error("Não foi possível remover o Plano", { description: error?.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,860px)] max-w-[860px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isPassaporte ? "Gerenciar Plano do Passaporte" : isAparelho ? "Gerenciar Aparelhos" : "Gerenciar Plano"}</DialogTitle>
          <DialogDescription>
            {isPassaporte
              ? `Cadastre as franquias em GB e o valor de cada opção para ${resumo || operadora}. O histórico das linhas já salvas é preservado.`
              : isAparelho
                ? `Cadastre somente o nome do aparelho. O valor da venda é informado manualmente na linha pelo consultor.`
                : `Catálogo de ${resumo || operadora}. Admin, BKO e Gestor podem criar, editar ou remover opções. Pedidos antigos mantêm os dados já gravados.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-surface-1/40 p-3 space-y-3">
            <div className="text-xs font-bold">{isPassaporte ? "Nova franquia do Passaporte" : isAparelho ? "Novo Aparelho" : "Novo Plano"}</div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[10px]">{isPassaporte ? "Gigas *" : isAparelho ? "Nome do aparelho *" : "Nome *"}</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={isPassaporte ? "Ex.: 5 GB" : isAparelho ? "Ex.: iPhone 16 Pro 256GB" : "Ex.: 500 MEGA"} />
              </div>

              {!isAparelho && (
                <div className="space-y-1.5">
                  <Label className="text-[10px]">Valor/mês *</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={newValor}
                    onChange={e => setNewValor(e.target.value ? formatBrlInput(parseBrlInput(e.target.value)) : "")}
                    placeholder="R$ 0,00"
                    className="font-mono"
                  />
                </div>
              )}

              {!isSimpleCatalog && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-[10px]">Bônus extra</Label>
                    <Input value={newBonus} onChange={e => setNewBonus(e.target.value)} placeholder="Opcional" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px]">Origem / quadro *</Label>
                    <Input value={newOrigem} onChange={e => setNewOrigem(e.target.value)} placeholder={operadora + " " + (produto ?? "PLANO")} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px]">Página-fonte</Label>
                    <Input type="number" min="0" step="1" value={newPagina} onChange={e => setNewPagina(e.target.value)} placeholder="Opcional" />
                  </div>
                </>
              )}

              <div className="flex items-end">
                <Button type="button" className="w-full gap-1.5" onClick={() => void criarPlano()} disabled={busy || !produtoId}>
                  <Plus className="size-4" /> {isAparelho ? "Adicionar Aparelho" : "Adicionar Plano"}
                </Button>
              </div>
            </div>

            <p className="text-[9px] text-muted-foreground">
              {isPassaporte
                ? "Informe somente a franquia (ex.: 5 GB) e o valor. O plano fica vinculado automaticamente ao Passaporte selecionado."
                : isAparelho
                  ? "Informe somente o nome do aparelho. O valor é preenchido manualmente na linha; parcelas e valor total ficam na observação do aparelho."
                  : "O Produto é vinculado automaticamente ao Produto atual da linha. O cadastro grava o Plano e sua oferta correspondente."}
            </p>
          </section>

          <section className="space-y-2">
            <div className="text-xs font-bold">{isPassaporte ? "Franquias cadastradas" : isAparelho ? "Aparelhos cadastrados" : "Planos cadastrados"}</div>

            {loading && (
              <div className="rounded-lg border border-border p-4 text-center text-xs text-muted-foreground">
                Carregando Planos...
              </div>
            )}

            {!loading && ofertas.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
                {isAparelho ? "Nenhum aparelho cadastrado para" : "Nenhum Plano ativo para"} {resumo || operadora}.
              </div>
            )}

            {ofertas.map(oferta => (
              <div key={oferta.id} className="rounded-lg border border-border bg-surface-1 p-3">
                {editingOfertaId === oferta.id ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-[10px]">{isPassaporte ? "Gigas" : isAparelho ? "Nome do aparelho" : "Nome"}</Label>
                      <Input value={editingName} onChange={e => setEditingName(e.target.value)} />
                    </div>

                    {!isAparelho && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px]">Valor/mês</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={editingValor}
                          onChange={e => setEditingValor(e.target.value ? formatBrlInput(parseBrlInput(e.target.value)) : "")}
                          className="font-mono"
                        />
                      </div>
                    )}

                    {!isSimpleCatalog && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-[10px]">Bônus extra</Label>
                          <Input value={editingBonus} onChange={e => setEditingBonus(e.target.value)} />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[10px]">Origem / quadro</Label>
                          <Input value={editingOrigem} disabled title="A origem é mantida para preservar vínculos de quadro já configurados." />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[10px]">Página-fonte</Label>
                          <Input type="number" min="0" step="1" value={editingPagina} onChange={e => setEditingPagina(e.target.value)} />
                        </div>
                      </>
                    )}

                    <div className="flex items-end gap-2">
                      <Button type="button" className="flex-1 gap-1.5" onClick={() => void salvarEdicao()} disabled={busy}>
                        <Save className="size-4" /> Salvar
                      </Button>
                      <Button type="button" variant="outline" size="icon" onClick={closeEditing} disabled={busy} title="Cancelar">
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold text-sm">{oferta.plano_nome}</span>
                        {!isAparelho && (
                          <span className="font-black text-[var(--omni)]">{brl(oferta.valor_mes)}/mês</span>
                        )}
                      </div>

                      {!isSimpleCatalog && (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                          <span>Origem: {oferta.origem}</span>
                          {oferta.bonus_extra && <span>Bônus: {oferta.bonus_extra}</span>}
                          {oferta.pagina_fonte !== null && <span>Página: {oferta.pagina_fonte}</span>}
                        </div>
                      )}
                    </div>

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      disabled={busy}
                      title="Editar Plano"
                      onClick={() => {
                        setEditingOfertaId(oferta.id);
                        setEditingPlanoId(oferta.plano_id);
                        setEditingName(oferta.plano_nome);
                        setEditingValor(isAparelho ? "" : formatBrlInput(oferta.valor_mes));
                        setEditingBonus(oferta.bonus_extra ?? "");
                        setEditingOrigem(oferta.origem);
                        setEditingPagina(oferta.pagina_fonte === null ? "" : String(oferta.pagina_fonte));
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8 text-destructive hover:bg-destructive/10"
                      disabled={busy}
                      title="Remover Plano"
                      onClick={() => void desativarPlano(oferta)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
