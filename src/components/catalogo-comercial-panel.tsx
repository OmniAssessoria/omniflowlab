import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, PackageOpen, Pencil, Plus, Search, Settings2, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Produto = { id: string; nome: string; operadora: string; ativo: boolean };
type Tipo = { id: string; nome: string; operadora: string; ativo: boolean };
type Plano = { id: string; nome: string; operadora: string; ativo: boolean; produto_id: string | null };
type Oferta = {
  id: string;
  plano_id: string;
  bonus_extra: string | null;
  valor_mes: number;
  origem: string;
  pagina_fonte: number | null;
  ativo: boolean;
};
type QuadroVinculo = {
  operadora: string;
  produto_id: string;
  origem: string;
  tipo_pedido_id: string;
};
type Quadro = {
  key: string;
  origem: string;
  produtoId: string;
  produtoNome: string;
  pagina: number | null;
  ofertas: Oferta[];
};

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CatalogoComercialPanel() {
  const [operadora, setOperadora] = useState<"CLARO" | "VIVO">("CLARO");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [vinculos, setVinculos] = useState<QuadroVinculo[]>([]);
  const [produtoId, setProdutoId] = useState<string>("TODOS");
  const [busca, setBusca] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [quadroEditando, setQuadroEditando] = useState<Quadro | null>(null);
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  const [ofertaEditando, setOfertaEditando] = useState<Oferta | null>(null);
  const [quadroAdicionando, setQuadroAdicionando] = useState<Quadro | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [novoBonus, setNovoBonus] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [editNome, setEditNome] = useState("");
  const [editBonus, setEditBonus] = useState("");
  const [editValor, setEditValor] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [prodRes, tipoRes, planoRes, ofertaRes, vincRes] = await Promise.all([
      supabase.from("produtos_catalogo").select("id,nome,operadora,ativo").eq("operadora", operadora).eq("ativo", true).order("nome"),
      supabase.from("tipos_pedido_catalogo").select("id,nome,operadora,ativo").eq("operadora", operadora).eq("ativo", true).order("nome"),
      (supabase as any).from("planos_catalogo").select("id,nome,operadora,ativo,produto_id").eq("operadora", operadora).order("nome"),
      (supabase as any).from("plano_ofertas_catalogo").select("id,plano_id,bonus_extra,valor_mes,origem,pagina_fonte,ativo").order("valor_mes"),
      (supabase as any).from("plano_quadro_tipo_pedido_vinculos").select("operadora,produto_id,origem,tipo_pedido_id").eq("operadora", operadora),
    ]);
    setProdutos((prodRes.data ?? []) as Produto[]);
    setTipos((tipoRes.data ?? []) as Tipo[]);
    setPlanos((planoRes.data ?? []) as unknown as Plano[]);
    setOfertas((ofertaRes.data ?? []).map((o: any) => ({ ...o, valor_mes: Number(o.valor_mes ?? 0) })) as Oferta[]);
    setVinculos((vincRes.data ?? []) as QuadroVinculo[]);
  }, [operadora]);

  useEffect(() => { void load(); }, [load]);

  const planoMap = useMemo(() => new Map(planos.map(p => [p.id, p])), [planos]);
  const produtoMap = useMemo(() => new Map(produtos.map(p => [p.id, p])), [produtos]);

  const quadros = useMemo(() => {
    const term = busca.trim().toLocaleLowerCase("pt-BR");
    const map = new Map<string, Quadro>();

    for (const oferta of ofertas) {
      const plano = planoMap.get(oferta.plano_id);
      if (!plano || plano.operadora !== operadora || !plano.ativo || !plano.produto_id) continue;
      if (produtoId !== "TODOS" && plano.produto_id !== produtoId) continue;

      const produto = produtoMap.get(plano.produto_id);
      if (!produto) continue;

      if (term) {
        const match = [plano.nome, oferta.origem, oferta.bonus_extra, produto.nome]
          .filter(Boolean)
          .some(value => String(value).toLocaleLowerCase("pt-BR").includes(term));
        if (!match) continue;
      }

      const key = `${plano.produto_id}::${oferta.origem}`;
      const existing = map.get(key) ?? {
        key,
        origem: oferta.origem,
        produtoId: plano.produto_id,
        produtoNome: produto.nome,
        pagina: oferta.pagina_fonte,
        ofertas: [],
      };
      existing.ofertas.push(oferta);
      if (!existing.pagina && oferta.pagina_fonte) existing.pagina = oferta.pagina_fonte;
      map.set(key, existing);
    }

    return Array.from(map.values()).map(q => ({
      ...q,
      ofertas: [...q.ofertas].sort((a, b) => a.valor_mes - b.valor_mes || (planoMap.get(a.plano_id)?.nome ?? "").localeCompare(planoMap.get(b.plano_id)?.nome ?? "", "pt-BR")),
    }));
  }, [ofertas, planoMap, produtoMap, produtoId, busca, operadora]);

  function abrirQuadro(quadro: Quadro) {
    setQuadroEditando(quadro);
    setSelectedTipos(
      vinculos
        .filter(v => v.produto_id === quadro.produtoId && v.origem === quadro.origem)
        .map(v => v.tipo_pedido_id),
    );
  }

  async function salvarQuadro() {
    if (!quadroEditando) return;
    setSaving(true);
    const db = supabase as any;
    const { error: delError } = await db
      .from("plano_quadro_tipo_pedido_vinculos")
      .delete()
      .eq("operadora", operadora)
      .eq("produto_id", quadroEditando.produtoId)
      .eq("origem", quadroEditando.origem);

    if (delError) {
      setSaving(false);
      toast.error("Falha ao atualizar o quadro", { description: delError.message });
      return;
    }

    if (selectedTipos.length) {
      const { error: insError } = await db
        .from("plano_quadro_tipo_pedido_vinculos")
        .insert(selectedTipos.map(tipo_pedido_id => ({
          operadora,
          produto_id: quadroEditando.produtoId,
          origem: quadroEditando.origem,
          tipo_pedido_id,
        })));
      if (insError) {
        setSaving(false);
        toast.error("Falha ao atualizar o quadro", { description: insError.message });
        return;
      }
    }

    await load();
    setSaving(false);
    setQuadroEditando(null);
    toast.success("Quadro atualizado", { description: "A regra vale para todos os planos deste quadro." });
  }

  function abrirEdicaoOferta(oferta: Oferta) {
    const plano = planoMap.get(oferta.plano_id);
    setOfertaEditando(oferta);
    setEditNome(plano?.nome ?? "");
    setEditBonus(oferta.bonus_extra ?? "");
    setEditValor(String(oferta.valor_mes ?? ""));
  }

  async function salvarOferta() {
    if (!ofertaEditando) return;
    const nome = editNome.trim();
    const valor = Number(String(editValor).replace(",", "."));
    if (!nome) return toast.error("Informe o tamanho/nome do plano");
    if (!Number.isFinite(valor) || valor < 0) return toast.error("Informe um valor mensal válido");

    setSaving(true);
    const { error: planoError } = await (supabase as any)
      .from("planos_catalogo")
      .update({ nome })
      .eq("id", ofertaEditando.plano_id)
      .eq("operadora", operadora);

    if (planoError) {
      setSaving(false);
      toast.error("Falha ao editar o plano", { description: planoError.message });
      return;
    }

    const { error: ofertaError } = await (supabase as any)
      .from("plano_ofertas_catalogo")
      .update({
        bonus_extra: editBonus.trim() || null,
        valor_mes: valor,
      })
      .eq("id", ofertaEditando.id);

    if (ofertaError) {
      setSaving(false);
      toast.error("Falha ao editar a oferta", { description: ofertaError.message });
      return;
    }

    await load();
    setSaving(false);
    setOfertaEditando(null);
    toast.success("Plano atualizado");
  }

  async function toggleOferta(oferta: Oferta) {
    const { error } = await (supabase as any)
      .from("plano_ofertas_catalogo")
      .update({ ativo: !oferta.ativo })
      .eq("id", oferta.id);
    if (error) {
      toast.error("Falha ao alterar oferta", { description: error.message });
      return;
    }
    await load();
  }

  function abrirAdicionarPlano(quadro: Quadro) {
    setQuadroAdicionando(quadro);
    setNovoNome("");
    setNovoBonus("");
    setNovoValor("");
  }

  async function adicionarPlanoAoQuadro() {
    if (!quadroAdicionando) return;
    const nome = novoNome.trim();
    const valor = Number(String(novoValor).replace(",", "."));
    if (!nome) return toast.error("Informe o tamanho/nome do plano");
    if (!Number.isFinite(valor) || valor < 0) return toast.error("Informe um valor mensal válido");

    setSaving(true);
    const db = supabase as any;

    const { data: existente, error: lookupError } = await db
      .from("planos_catalogo")
      .select("id,nome,produto_id,ativo")
      .eq("operadora", operadora)
      .ilike("nome", nome)
      .maybeSingle();

    if (lookupError) {
      setSaving(false);
      toast.error("Falha ao localizar plano existente", { description: lookupError.message });
      return;
    }

    let planoId = existente?.id ?? null;

    if (existente && existente.produto_id && existente.produto_id !== quadroAdicionando.produtoId) {
      setSaving(false);
      toast.error("Este plano já pertence a outro produto", {
        description: "Use outro nome/tamanho ou edite o plano existente no produto correto.",
      });
      return;
    }

    if (!planoId) {
      const { data: novoPlano, error: planoError } = await db
        .from("planos_catalogo")
        .insert({
          nome,
          operadora,
          ativo: true,
          produto_id: quadroAdicionando.produtoId,
        })
        .select("id")
        .single();

      if (planoError) {
        setSaving(false);
        toast.error("Falha ao criar plano", { description: planoError.message });
        return;
      }
      planoId = novoPlano.id;
    } else if (existente && (!existente.ativo || !existente.produto_id)) {
      const { error: reactivateError } = await db
        .from("planos_catalogo")
        .update({ ativo: true, produto_id: quadroAdicionando.produtoId })
        .eq("id", planoId);
      if (reactivateError) {
        setSaving(false);
        toast.error("Falha ao reativar plano", { description: reactivateError.message });
        return;
      }
    }

    const { data: ofertaExistente, error: ofertaLookupError } = await db
      .from("plano_ofertas_catalogo")
      .select("id")
      .eq("plano_id", planoId)
      .eq("origem", quadroAdicionando.origem)
      .maybeSingle();

    if (ofertaLookupError) {
      setSaving(false);
      toast.error("Falha ao verificar oferta", { description: ofertaLookupError.message });
      return;
    }

    if (ofertaExistente) {
      setSaving(false);
      toast.error("Este plano já existe neste quadro");
      return;
    }

    const { error: ofertaError } = await db
      .from("plano_ofertas_catalogo")
      .insert({
        plano_id: planoId,
        bonus_extra: novoBonus.trim() || null,
        valor_mes: valor,
        origem: quadroAdicionando.origem,
        pagina_fonte: quadroAdicionando.pagina,
        ativo: true,
      });

    if (ofertaError) {
      setSaving(false);
      toast.error("Falha ao adicionar plano ao quadro", { description: ofertaError.message });
      return;
    }

    await load();
    setSaving(false);
    setQuadroAdicionando(null);
    toast.success("Plano adicionado ao catálogo", {
      description: `${nome} foi incluído em ${quadroAdicionando.origem}.`,
    });
  }

  async function excluirPlanoDoQuadro(oferta: Oferta) {
    const plano = planoMap.get(oferta.plano_id);
    if (!plano) return;

    const confirmado = window.confirm(
      `Excluir “${plano.nome}” deste quadro? Pedidos antigos manterão o plano já gravado.`
    );
    if (!confirmado) return;

    setSaving(true);
    const db = supabase as any;

    const { error: deleteError } = await db
      .from("plano_ofertas_catalogo")
      .delete()
      .eq("id", oferta.id);

    if (deleteError) {
      setSaving(false);
      toast.error("Falha ao excluir plano do quadro", { description: deleteError.message });
      return;
    }

    const { count, error: countError } = await db
      .from("plano_ofertas_catalogo")
      .select("id", { count: "exact", head: true })
      .eq("plano_id", oferta.plano_id);

    if (!countError && (count ?? 0) === 0) {
      await db
        .from("planos_catalogo")
        .update({ ativo: false })
        .eq("id", oferta.plano_id)
        .eq("operadora", operadora);
    }

    await load();
    setSaving(false);
    toast.success("Plano excluído do quadro");
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <PackageOpen className="size-5 text-omni" />
              <h2 className="font-display text-lg font-bold">Catálogo Comercial</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Os planos ficam agrupados por quadro. A regra de exibição é aplicada ao quadro inteiro.
            </p>
          </div>

          <Tabs value={operadora} onValueChange={value => { setOperadora(value as "CLARO" | "VIVO"); setProdutoId("TODOS"); }}>
            <TabsList>
              <TabsTrigger value="CLARO">Claro</TabsTrigger>
              <TabsTrigger value="VIVO">Vivo</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={produtoId === "TODOS" ? "default" : "outline"} onClick={() => setProdutoId("TODOS")}>Todos</Button>
          {produtos.map(produto => (
            <Button key={produto.id} size="sm" variant={produtoId === produto.id ? "default" : "outline"} onClick={() => setProdutoId(produto.id)}>
              {produto.nome}
            </Button>
          ))}

          <div className="relative ml-auto min-w-[260px]">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={busca} onChange={e => setBusca(e.target.value)} className="h-8 pl-8 text-xs" placeholder="Buscar quadro, plano ou bônus..." />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {quadros.map(quadro => {
          const aberto = expanded[quadro.key] ?? true;
          const quadroLinks = vinculos.filter(v => v.produto_id === quadro.produtoId && v.origem === quadro.origem);
          const nomesTipos = quadroLinks.map(v => tipos.find(t => t.id === v.tipo_pedido_id)?.nome).filter(Boolean) as string[];

          return (
            <article key={quadro.key} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-1/70 px-4 py-3">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => setExpanded(curr => ({ ...curr, [quadro.key]: !aberto }))}
                >
                  <div className="grid size-9 place-items-center rounded-xl border border-omni/30 bg-omni/10 text-omni">
                    {aberto ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">{operadora}</Badge>
                      <Badge variant="secondary">{quadro.produtoNome}</Badge>
                      {quadro.pagina && <Badge variant="outline" className="text-[9px]">Pág. {quadro.pagina}</Badge>}
                      <Badge className="text-[9px]">{quadro.ofertas.length} plano(s)</Badge>
                    </div>
                    <h3 className="mt-1 truncate font-display text-base font-bold">{quadro.origem}</h3>
                  </div>
                </button>

                <div className="flex flex-wrap items-center gap-1">
                  {nomesTipos.length === 0 ? (
                    <Badge className="text-[9px]">Todos os tipos</Badge>
                  ) : nomesTipos.slice(0, 3).map(nome => <Badge key={nome} variant="outline" className="text-[9px]">{nome}</Badge>)}
                  {nomesTipos.length > 3 && <Badge variant="outline" className="text-[9px]">+{nomesTipos.length - 3}</Badge>}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => abrirAdicionarPlano(quadro)}>
                    <Plus className="size-3.5" /> Adicionar plano
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => abrirQuadro(quadro)}>
                    <Settings2 className="size-3.5" /> Configurar quadro
                  </Button>
                </div>
              </div>

              {aberto && (
                <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
                  {quadro.ofertas.map(oferta => {
                    const plano = planoMap.get(oferta.plano_id);
                    if (!plano) return null;
                    return (
                      <div key={oferta.id} className={cn("rounded-xl border border-border bg-background/50 p-3", !oferta.ativo && "opacity-50")}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xl font-black">{plano.nome}</div>
                            <div className="mt-1 text-lg font-black text-omni">{money(oferta.valor_mes)}<span className="text-[10px] font-medium text-muted-foreground">/mês</span></div>
                          </div>
                          <Button size="icon" variant="ghost" className="size-8" onClick={() => abrirEdicaoOferta(oferta)} title="Editar plano">
                            <Pencil className="size-3.5" />
                          </Button>
                        </div>

                        <div className="mt-2 min-h-7">
                          {oferta.bonus_extra ? (
                            <Badge className="gap-1 bg-success/10 text-success border border-success/30">
                              <Sparkles className="size-3" /> {oferta.bonus_extra}
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Sem bônus</span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 text-[10px] text-destructive hover:text-destructive"
                            onClick={() => void excluirPlanoDoQuadro(oferta)}
                            disabled={saving}
                          >
                            <Trash2 className="size-3" /> Excluir
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => void toggleOferta(oferta)}>
                            {oferta.ativo ? "Desativar" : "Ativar"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {quadros.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum quadro encontrado neste filtro.
        </div>
      )}

      <Dialog open={!!quadroEditando} onOpenChange={open => !open && setQuadroEditando(null)}>
        <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar quadro inteiro</DialogTitle>
            <DialogDescription>
              {quadroEditando?.origem} · {quadroEditando?.produtoNome}. A seleção abaixo valerá para todos os planos deste quadro.
              Se nenhum tipo for marcado, o quadro ficará disponível para todos.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-omni/25 bg-omni/5 p-3 text-xs">
            <div className="font-bold">{quadroEditando?.ofertas.length ?? 0} plano(s) serão afetados juntos.</div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {tipos.filter(t => t.nome !== "Não informado").map(tipo => {
              const checked = selectedTipos.includes(tipo.id);
              return (
                <label key={tipo.id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors", checked ? "border-omni/50 bg-omni/5" : "border-border")}>
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => setSelectedTipos(curr => checked ? curr.filter(id => id !== tipo.id) : [...curr, tipo.id])}
                  />
                  <span className="text-sm font-medium">{tipo.nome}</span>
                  {checked && <Check className="ml-auto size-4 text-omni" />}
                </label>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuadroEditando(null)}>Cancelar</Button>
            <Button onClick={() => void salvarQuadro()} disabled={saving} className="bg-omni text-black hover:bg-omni/90">
              {saving ? "Salvando..." : "Salvar quadro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!quadroAdicionando} onOpenChange={open => !open && setQuadroAdicionando(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar plano ao quadro</DialogTitle>
            <DialogDescription>
              {quadroAdicionando?.origem} · {quadroAdicionando?.produtoNome}. O novo plano herdará as regras de exibição deste quadro.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Tamanho / nome do plano</Label>
              <Input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Ex.: 35GB" />
            </div>

            <div className="space-y-1.5">
              <Label>Valor/mês</Label>
              <Input value={novoValor} onChange={e => setNovoValor(e.target.value)} inputMode="decimal" placeholder="59,99" />
            </div>

            <div className="space-y-1.5">
              <Label>Bônus</Label>
              <Input value={novoBonus} onChange={e => setNovoBonus(e.target.value)} placeholder="Ex.: BÔNUS EXTRA +10GB" />
              <p className="text-[10px] text-muted-foreground">Deixe vazio quando não houver bônus.</p>
            </div>

            {quadroAdicionando && (
              <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface-1 p-3">
                <Badge variant="outline">{operadora}</Badge>
                <Badge variant="secondary">{quadroAdicionando.produtoNome}</Badge>
                <Badge variant="outline">{quadroAdicionando.origem}</Badge>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuadroAdicionando(null)}>Cancelar</Button>
            <Button
              onClick={() => void adicionarPlanoAoQuadro()}
              disabled={saving || !novoNome.trim() || !novoValor.trim()}
              className="bg-omni text-black hover:bg-omni/90"
            >
              {saving ? "Adicionando..." : "Adicionar plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!ofertaEditando} onOpenChange={open => !open && setOfertaEditando(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar plano</DialogTitle>
            <DialogDescription>
              Admin e BKO podem alterar tamanho/nome, valor mensal e bônus. A origem do quadro é preservada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Tamanho / nome do plano</Label>
              <Input value={editNome} onChange={e => setEditNome(e.target.value)} placeholder="Ex.: 25GB" />
              <p className="text-[10px] text-muted-foreground">Alterar o nome afeta todas as ofertas que usam este mesmo plano-base.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Valor/mês</Label>
              <Input value={editValor} onChange={e => setEditValor(e.target.value)} inputMode="decimal" placeholder="54,99" />
            </div>

            <div className="space-y-1.5">
              <Label>Bônus</Label>
              <Input value={editBonus} onChange={e => setEditBonus(e.target.value)} placeholder="Ex.: BÔNUS EXTRA +15GB" />
              <p className="text-[10px] text-muted-foreground">Deixe vazio quando o plano não tiver bônus.</p>
            </div>

            {ofertaEditando && (
              <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface-1 p-3">
                <Badge variant="outline">{ofertaEditando.origem}</Badge>
                {ofertaEditando.pagina_fonte && <Badge variant="outline">Pág. {ofertaEditando.pagina_fonte}</Badge>}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOfertaEditando(null)}>Cancelar</Button>
            <Button onClick={() => void salvarOferta()} disabled={saving} className="bg-omni text-black hover:bg-omni/90">
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
