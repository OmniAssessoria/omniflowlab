import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Gift, Plus, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BonusVivoSelect } from "@/components/bonus-vivo-select";
import { PartePedidoCadastroDialog, type PartePedidoCadastro } from "@/components/parte-pedido-cadastro-dialog";
import {
  podeAdicionarBonusTipoProduto,
  podeAdicionarDoadorTipoProduto,
  deveExibirDoadorTipoProduto,
} from "@/lib/tipo-produto-regras";

type Cedente = {
  id: string;
  cnpj_cpf: string;
  razao_social: string | null;
  nome: string | null;
  email: string | null;
};

type Cessionario = {
  id: string;
  cpf: string;
  nome: string;
  email: string;
};

type VinculoParte =
  | { tipo: "cedente"; id: string }
  | { tipo: "cessionario"; id: string }
  | null;

export function LinhaOperationalExtras({
  vendaId,
  clienteId,
  linhaId,
  operadora,
  possuiBonus,
  bonusGb,
  canEdit,
  canManageBonusCatalog,
  permiteBonus,
  permiteDoador,
  onChanged,
}: {
  vendaId: string;
  clienteId: string;
  linhaId: string;
  operadora: string;
  possuiBonus?: boolean | null;
  bonusGb?: number | null;
  canEdit: boolean;
  canManageBonusCatalog: boolean;
  permiteBonus: boolean;
  permiteDoador: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [cedentes, setCedentes] = useState<Cedente[]>([]);
  const [cessionarios, setCessionarios] = useState<Cessionario[]>([]);
  const [vinculo, setVinculo] = useState<VinculoParte>(null);
  const [cedenteCadastroOpen, setCedenteCadastroOpen] = useState(false);
  const [cessionarioCadastroOpen, setCessionarioCadastroOpen] = useState(false);

  const regraTipo = {
    operadora,
    permite_bonus: permiteBonus,
    permite_doador: permiteDoador,
  };

  const podeAdicionarBonus = podeAdicionarBonusTipoProduto(regraTipo);
  const podeAdicionarDoador = podeAdicionarDoadorTipoProduto(regraTipo);
  const mostraDoador = deveExibirDoadorTipoProduto(regraTipo, Boolean(vinculo));
  const mostraBonus = operadora === "VIVO" && Boolean(permiteBonus);
  const temExtras = mostraBonus || mostraDoador;

  const parteAtual = useMemo(() => {
    if (!vinculo) return null;
    if (vinculo.tipo === "cedente") {
      const item = cedentes.find(cedente => cedente.id === vinculo.id);
      return item ? {
        tipo: "Cedente" as const,
        nome: item.razao_social || item.nome || "Cedente",
        documento: item.cnpj_cpf,
        detalhe: [item.nome, item.email].filter(Boolean).join(" · "),
      } : null;
    }

    const item = cessionarios.find(cessionario => cessionario.id === vinculo.id);
    return item ? {
      tipo: "Cessionário" as const,
      nome: item.nome || "Cessionário",
      documento: item.cpf,
      detalhe: item.email,
    } : null;
  }, [cedentes, cessionarios, vinculo]);

  const carregarPartes = useCallback(async () => {
    const db = supabase as any;
    const [cedentesRes, cessionariosRes, cedenteLinhaRes, cessionarioLinhaRes] = await Promise.all([
      db
        .from("venda_cedentes")
        .select("cedente_id, cedentes(id,cnpj_cpf,razao_social,nome,email)")
        .eq("venda_id", vendaId),
      db
        .from("venda_cessionarios")
        .select("cessionario_id, cessionarios(id,cpf,nome,email)")
        .eq("venda_id", vendaId),
      db
        .from("venda_linha_doadores")
        .select("cedente_id")
        .eq("linha_id", linhaId)
        .maybeSingle(),
      db
        .from("venda_linha_cessionarios")
        .select("cessionario_id")
        .eq("linha_id", linhaId)
        .maybeSingle(),
    ]);

    const erro = cedentesRes.error || cessionariosRes.error || cedenteLinhaRes.error || cessionarioLinhaRes.error;
    if (erro) {
      toast.error("Não foi possível carregar Cedente/Cessionário da linha", { description: erro.message });
      return;
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

    if (cedenteLinhaRes.data?.cedente_id) {
      setVinculo({ tipo: "cedente", id: cedenteLinhaRes.data.cedente_id });
    } else if (cessionarioLinhaRes.data?.cessionario_id) {
      setVinculo({ tipo: "cessionario", id: cessionarioLinhaRes.data.cessionario_id });
    } else {
      setVinculo(null);
    }
  }, [linhaId, vendaId]);

  useEffect(() => {
    void carregarPartes();
  }, [carregarPartes]);

  if (!temExtras) return null;

  async function selecionarParte(value: string) {
    if (!canEdit || busy) return;
    setBusy(true);

    let tipo = "sem_vinculo";
    let parteId: string | null = null;

    if (value !== "__sem_vinculo__") {
      const [prefixo, id] = value.split(":", 2);
      tipo = prefixo;
      parteId = id || null;
    }

    const { error } = await (supabase as any).rpc("definir_parte_linha", {
      p_linha_id: linhaId,
      p_tipo: tipo,
      p_parte_id: parteId,
    });

    setBusy(false);
    if (error) {
      toast.error("Não foi possível alterar o vínculo da linha", { description: error.message });
      return;
    }

    if (tipo === "cedente" && parteId) {
      setVinculo({ tipo: "cedente", id: parteId });
      toast.success("Cedente vinculado à linha");
    } else if (tipo === "cessionario" && parteId) {
      setVinculo({ tipo: "cessionario", id: parteId });
      toast.success("Cessionário vinculado à linha");
    } else {
      setVinculo(null);
      toast.success("Vínculo removido da linha");
    }

    await onChanged();
  }

  async function cadastrarEVincular(item: PartePedidoCadastro) {
    const { error } = await (supabase as any).rpc("definir_parte_linha", {
      p_linha_id: linhaId,
      p_tipo: item.tipo,
      p_parte_id: item.id,
    });

    if (error) {
      toast.error("Cadastro salvo, mas não foi possível vincular à linha", {
        description: error.message,
      });
      await carregarPartes();
      return;
    }

    setVinculo({ tipo: item.tipo, id: item.id });
    await carregarPartes();
    await onChanged();
    toast.success(item.tipo === "cedente"
      ? "Cedente cadastrado e vinculado à linha"
      : "Cessionário cadastrado e vinculado à linha");
  }

  const valorVinculo = vinculo ? `${vinculo.tipo}:${vinculo.id}` : "__sem_vinculo__";

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {mostraDoador && (
        <section className="rounded-md border border-border/70 bg-card/60 p-2 space-y-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-semibold text-[10px]">
                <Users className="size-3.5 text-omni" /> Cedente / Cessionário
              </div>
              {parteAtual && <Badge variant="outline" className="text-[9px]">{parteAtual.tipo}</Badge>}
            </div>

            {canEdit && podeAdicionarDoador && (
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-[9px]"
                  onClick={() => setCedenteCadastroOpen(true)}
                >
                  <Building2 className="size-3" /> <Plus className="size-3" /> Cedente
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-[9px]"
                  onClick={() => setCessionarioCadastroOpen(true)}
                >
                  <UserRound className="size-3" /> <Plus className="size-3" /> Cessionário
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-[9px]">Vínculo da linha</Label>
            <Select
              value={valorVinculo}
              onValueChange={value => void selecionarParte(value)}
              disabled={!canEdit || busy || (!podeAdicionarDoador && !vinculo)}
            >
              <SelectTrigger className="h-7 text-[10px]">
                <SelectValue placeholder="Selecionar Cedente ou Cessionário..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__sem_vinculo__">Sem vínculo</SelectItem>
                {cedentes.map(item => (
                  <SelectItem key={`cedente:${item.id}`} value={`cedente:${item.id}`}>
                    Cedente · {item.razao_social || item.nome || "Cedente"} · {item.cnpj_cpf}
                  </SelectItem>
                ))}
                {cessionarios.map(item => (
                  <SelectItem key={`cessionario:${item.id}`} value={`cessionario:${item.id}`}>
                    Cessionário · {item.nome || "Cessionário"} · {item.cpf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {parteAtual ? (
            <div className="rounded border border-border/60 bg-muted/10 px-2 py-1.5 text-[9px]">
              <div className="font-semibold text-foreground">
                {parteAtual.tipo}: {parteAtual.nome}
              </div>
              <div className="mt-0.5 truncate text-muted-foreground">
                {[parteAtual.documento, parteAtual.detalhe].filter(Boolean).join(" · ")}
              </div>
            </div>
          ) : cedentes.length === 0 && cessionarios.length === 0 ? (
            <div className="text-[9px] text-muted-foreground">
              Nenhum Cedente ou Cessionário foi incluído neste pedido.
            </div>
          ) : (
            <div className="text-[9px] text-muted-foreground">
              Opcional: selecione um Cedente ou um Cessionário para esta linha.
            </div>
          )}
        </section>
      )}

      {mostraBonus && (
        <section className="rounded-md border border-border/70 bg-card/60 p-2 space-y-2">
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-[10px]">
              <Gift className="size-3.5 text-[var(--vivo)]" /> Bônus VIVO
            </div>
          </div>

          <BonusVivoSelect
            linhaId={linhaId}
            possuiBonus={possuiBonus}
            bonusGb={bonusGb}
            canEdit={canEdit}
            canManage={canManageBonusCatalog}
            allowCreate={podeAdicionarBonus}
            compact
            onChanged={onChanged}
          />
        </section>
      )}

      <PartePedidoCadastroDialog
        tipo="cedente"
        open={cedenteCadastroOpen}
        onOpenChange={setCedenteCadastroOpen}
        clienteId={clienteId}
        vendaId={vendaId}
        onSaved={cadastrarEVincular}
      />

      <PartePedidoCadastroDialog
        tipo="cessionario"
        open={cessionarioCadastroOpen}
        onOpenChange={setCessionarioCadastroOpen}
        clienteId={clienteId}
        vendaId={vendaId}
        onSaved={cadastrarEVincular}
      />
    </div>
  );
}
