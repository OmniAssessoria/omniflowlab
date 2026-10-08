import { useEffect, useMemo, useState } from "react";
import { Search, Settings2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PlanoManagerDialog } from "@/components/plano-manager-dialog";
import { normalizeLinhaLabel } from "@/lib/linha-campos-regras";

type OfertaPlano = {
  id: string;
  plano_id: string;
  bonus_extra: string | null;
  valor_mes: number;
  origem: string;
  pagina_fonte: number | null;
  plano_nome: string;
  produto_id: string | null;
};

type VinculoQuadro = { operadora: string; produto_id: string; origem: string; tipo_pedido_id: string };

function brl(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const GERENCIAR = "__gerenciar_planos__";

export function PlanoOfertaSelect({
  operadora,
  produto,
  tipoProduto,
  value,
  currentPlano,
  produtoIdOverride,
  canManage = false,
  disabled,
  compact = false,
  onSelect,
  variant = "default",
}: {
  operadora: string;
  produto: string | null;
  tipoProduto: string | null;
  value: string | null;
  currentPlano?: string | null;
  produtoIdOverride?: string | null;
  canManage?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onSelect: (oferta: OfertaPlano | null) => void;
  variant?: "default" | "passaporte" | "aparelho";
}) {
  const [ofertas, setOfertas] = useState<OfertaPlano[]>([]);
  const [vinculos, setVinculos] = useState<VinculoQuadro[]>([]);
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const db = supabase as any;
      const [prodRes, tipoRes, planoRes, ofertaRes, vincRes] = await Promise.all([
        produto
          ? db.from("produtos_catalogo").select("id,nome").eq("operadora", operadora).eq("ativo", true)
          : Promise.resolve({ data: [] }),
        tipoProduto
          ? db.from("tipos_pedido_catalogo").select("id,nome").eq("operadora", operadora).eq("ativo", true)
          : Promise.resolve({ data: [] }),
        db.from("planos_catalogo").select("id,nome,produto_id,operadora,ativo").eq("operadora", operadora).eq("ativo", true),
        db.from("plano_ofertas_catalogo").select("id,plano_id,bonus_extra,valor_mes,origem,pagina_fonte,ativo").eq("ativo", true),
        db.from("plano_quadro_tipo_pedido_vinculos").select("operadora,produto_id,origem,tipo_pedido_id").eq("operadora", operadora),
      ]);
      if (!active) return;

      const plans = new Map<string, any>((planoRes.data ?? []).map((p: any) => [p.id, p]));
      const rows: OfertaPlano[] = (ofertaRes.data ?? [])
        .map((o: any) => {
          const p = plans.get(o.plano_id);
          if (!p) return null;
          return {
            id: o.id,
            plano_id: o.plano_id,
            bonus_extra: o.bonus_extra,
            valor_mes: Number(o.valor_mes ?? 0),
            origem: o.origem,
            pagina_fonte: o.pagina_fonte,
            plano_nome: p.nome,
            produto_id: p.produto_id,
          } as OfertaPlano;
        })
        .filter(Boolean) as OfertaPlano[];

      const produtoEncontrado = (prodRes.data ?? []).find((item: any) =>
        normalizeLinhaLabel(item.nome) === normalizeLinhaLabel(produto)
      ) ?? null;
      const tipoEncontrado = (tipoRes.data ?? []).find((item: any) =>
        normalizeLinhaLabel(item.nome) === normalizeLinhaLabel(tipoProduto)
      ) ?? null;

      setProdutoId(produtoIdOverride ?? produtoEncontrado?.id ?? null);
      setTipoId(tipoEncontrado?.id ?? null);
      setOfertas(rows);
      setVinculos((vincRes.data ?? []) as VinculoQuadro[]);
    })();
    return () => { active = false; };
  }, [operadora, produto, tipoProduto, produtoIdOverride, refreshKey]);

  const visiveis = useMemo(() => {
    return ofertas
      .filter(oferta => {
        if (produtoId && oferta.produto_id !== produtoId) return false;
        const links = vinculos.filter(v =>
          v.produto_id === oferta.produto_id &&
          v.origem === oferta.origem
        );
        if (links.length === 0) return true;
        if (!tipoId) return false;
        return links.some(v => v.tipo_pedido_id === tipoId);
      })
      .sort((a, b) => a.valor_mes - b.valor_mes || a.plano_nome.localeCompare(b.plano_nome, "pt-BR"));
  }, [ofertas, vinculos, produtoId, tipoId]);

  const visiveisFiltrados = useMemo(() => {
    const termo = searchTerm
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLocaleLowerCase("pt-BR");

    if (!termo) return visiveis;

    return visiveis.filter(oferta =>
      [oferta.plano_nome, oferta.origem, oferta.bonus_extra]
        .filter(Boolean)
        .some(value =>
          String(value)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("pt-BR")
            .includes(termo),
        ),
    );
  }, [visiveis, searchTerm]);


  const legacyValue = !value && currentPlano && currentPlano !== "Não informado" ? "__legacy__" : null;

  return (
    <div>
      <Select
        value={value || legacyValue || "__nenhum__"}
        disabled={disabled || !produto || produto === "Não informado"}
        onOpenChange={open => {
          if (!open) {
            setSearchOpen(false);
            setSearchTerm("");
          }
        }}
        onValueChange={next => {
          if (next === GERENCIAR) {
            setManageOpen(true);
            return;
          }
          if (next === "__legacy__") return;
          if (next === "__nenhum__") onSelect(null);
          else onSelect(ofertas.find(o => o.id === next) ?? null);
        }}
      >
        <SelectTrigger className={compact ? "h-7 text-[10px]" : "h-9 text-xs"}>
          <SelectValue placeholder={produto && produto !== "Não informado" ? "Escolher plano" : "Selecione o produto primeiro"} />
        </SelectTrigger>
        <SelectContent className="max-h-[420px]">
          <div
            className="sticky top-0 z-20 border-b border-border bg-popover p-1.5"
            onKeyDown={event => event.stopPropagation()}
          >
            {searchOpen ? (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder={variant === "aparelho" ? "Pesquisar aparelho..." : "Pesquisar plano..."}
                  className="h-8 pl-8 pr-8 text-xs"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                    title="Limpar pesquisa"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Search className="size-3.5" />
                {variant === "aparelho" ? "Pesquisar aparelho" : "Pesquisar plano"}
              </button>
            )}
          </div>

          <SelectItem value="__nenhum__">Não informado</SelectItem>
          {legacyValue && (
            <SelectItem value="__legacy__" disabled>{currentPlano}</SelectItem>
          )}
          {visiveisFiltrados.map(oferta => (
            <SelectItem key={oferta.id} value={oferta.id} className="py-2">
              <div className="flex min-w-[320px] items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold">{oferta.plano_nome}</div>
                  {variant === "default" && <div className="text-[10px] text-muted-foreground">{oferta.origem}</div>}
                </div>
                <div className="text-right">
                  {variant !== "aparelho" && (
                    <div className="font-black text-[var(--omni)]">{brl(oferta.valor_mes)}</div>
                  )}
                  {oferta.bonus_extra && <div className="text-[9px] font-bold text-success">{oferta.bonus_extra}</div>}
                </div>
              </div>
            </SelectItem>
          ))}
          {searchTerm.trim() && visiveisFiltrados.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              Nenhum resultado encontrado.
            </div>
          )}

          {canManage && produtoId && (
            <SelectItem value={GERENCIAR} className="font-semibold text-[var(--omni)]">
              <span className="inline-flex items-center gap-2">
                <Settings2 className="size-3.5" /> {variant === "passaporte" ? "Gerenciar Planos do Passaporte" : variant === "aparelho" ? "Gerenciar Aparelhos" : "Gerenciar Plano"}
              </span>
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      <PlanoManagerDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        operadora={operadora}
        produto={produto}
        produtoId={produtoId}
        onChanged={() => setRefreshKey(key => key + 1)}
        variant={variant}
      />
    </div>
  );
}
