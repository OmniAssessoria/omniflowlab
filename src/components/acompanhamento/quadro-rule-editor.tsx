import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Check, ListChecks, Settings2, Workflow } from "lucide-react";
import { toast } from "sonner";
import { normalizeAcompanhamentoStatus } from "@/lib/acompanhamento";
import { saveQuadroRules } from "@/lib/acompanhamento.functions";
import type {
  AcompanhamentoFonte,
  AcompanhamentoOperadora,
  AcompanhamentoQuadro,
  AcompanhamentoQuadroRegra,
  ManualStatusOption,
  PipelineStageOption,
  RobotStatusOption,
} from "@/lib/acompanhamento.types";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type DraftRule = {
  operadora: AcompanhamentoOperadora | null;
  fonte: AcompanhamentoFonte;
  referenciaId?: string | null;
  valorOriginal: string;
};

function sameRule(
  rule: { operadora: string | null; fonte: string; valor_original?: string; valorOriginal?: string },
  candidate: DraftRule,
) {
  return rule.operadora === candidate.operadora
    && rule.fonte === candidate.fonte
    && normalizeAcompanhamentoStatus(rule.valor_original ?? rule.valorOriginal ?? "")
      === normalizeAcompanhamentoStatus(candidate.valorOriginal);
}

function ruleKey(rule: DraftRule) {
  return [
    rule.operadora ?? "GERAL",
    rule.fonte,
    rule.referenciaId ?? "",
    normalizeAcompanhamentoStatus(rule.valorOriginal),
  ].join("|");
}

function SourceList({
  title,
  icon,
  operator,
  source,
  options,
  selected,
  onToggle,
}: {
  title: string;
  icon: React.ReactNode;
  operator: AcompanhamentoOperadora;
  source: AcompanhamentoFonte;
  options: Array<{ id: string; nome: string; referenceId?: string | null; hint?: string }>;
  selected: DraftRule[];
  onToggle: (rule: DraftRule) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-1">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        {icon}
        <span className="text-xs font-bold">{title}</span>
        <Badge variant="outline" className="ml-auto text-[9px]">{operator}</Badge>
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto p-2">
        {options.map(option => {
          const draft: DraftRule = {
            operadora: operator,
            fonte: source,
            referenciaId: option.referenceId ?? null,
            valorOriginal: option.nome,
          };
          const checked = selected.some(rule => sameRule({
            operadora: rule.operadora,
            fonte: rule.fonte,
            valorOriginal: rule.valorOriginal,
          }, draft));

          return (
            <button
              key={`${operator}:${source}:${option.id}`}
              type="button"
              onClick={() => onToggle(draft)}
              className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                checked ? "border-omni/45 bg-omni/10" : "border-transparent hover:border-border hover:bg-background"
              }`}
            >
              <span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded border ${
                checked ? "border-omni bg-omni text-black" : "border-border"
              }`}>
                {checked && <Check className="size-3" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">{option.nome}</span>
                <span className="block truncate text-[9px] text-muted-foreground">
                  Chave normalizada: {normalizeAcompanhamentoStatus(option.nome)}
                  {option.hint ? ` · ${option.hint}` : ""}
                </span>
              </span>
            </button>
          );
        })}
        {options.length === 0 && (
          <div className="px-2 py-5 text-center text-[10px] text-muted-foreground">Nenhuma opção observada.</div>
        )}
      </div>
    </div>
  );
}

export function QuadroRuleEditor({
  quadro,
  regras,
  statusManuais,
  statusRobo,
  etapasPipeline,
  open,
  onOpenChange,
  onSaved,
}: {
  quadro: AcompanhamentoQuadro;
  regras: AcompanhamentoQuadroRegra[];
  statusManuais: ManualStatusOption[];
  statusRobo: RobotStatusOption[];
  etapasPipeline: PipelineStageOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
}) {
  const save = useServerFn(saveQuadroRules);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<DraftRule[]>([]);

  const rulesForQuadro = useMemo(
    () => regras.filter(rule => rule.quadro_id === quadro.id && rule.ativo),
    [regras, quadro.id],
  );

  useEffect(() => {
    if (!open) return;
    setDraft(rulesForQuadro.map(rule => ({
      operadora: rule.operadora,
      fonte: rule.fonte,
      referenciaId: rule.referencia_id,
      valorOriginal: rule.valor_original,
    })));
  }, [open, rulesForQuadro]);

  function toggle(rule: DraftRule) {
    setDraft(current => {
      const exists = current.some(item => sameRule({
        operadora: item.operadora,
        fonte: item.fonte,
        valorOriginal: item.valorOriginal,
      }, rule));
      return exists
        ? current.filter(item => !sameRule({
            operadora: item.operadora,
            fonte: item.fonte,
            valorOriginal: item.valorOriginal,
          }, rule))
        : [...current, rule];
    });
  }

  async function persist() {
    setSaving(true);
    try {
      const unique = Array.from(new Map(draft.map(rule => [ruleKey(rule), rule])).values());
      await save({ data: { quadroId: quadro.id, rules: unique } } as any);
      toast.success("Configuração do quadro salva", { description: quadro.titulo });
      await onSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Não foi possível salvar o quadro", { description: error?.message });
    } finally {
      setSaving(false);
    }
  }

  const robotOptions = statusRobo.map(item => ({
    id: item.id,
    nome: item.nome,
    referenceId: null,
    hint: item.roboNome ?? "Robô",
  }));

  const stageOptions = etapasPipeline.map(item => ({
    id: item.id,
    nome: item.nome,
    referenceId: item.id,
    hint: item.funil_id,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="size-4 text-omni" /> {quadro.titulo}
          </DialogTitle>
          <DialogDescription>
            Este quadro tem configuração própria. Selecione exatamente quais fontes devem alimentá-lo quando os cálculos forem ativados.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-info/30 bg-info/5 px-3 py-2 text-[11px] text-muted-foreground">
          Nomes equivalentes por caixa, acento, espaços ou prefixo técnico conhecido exibem a mesma chave normalizada.
          A origem continua explícita: marcar Status manual não marca Status do robô automaticamente.
        </div>

        <Tabs defaultValue="CLARO">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="CLARO">Claro</TabsTrigger>
            <TabsTrigger value="VIVO">Vivo</TabsTrigger>
          </TabsList>
          {(["CLARO", "VIVO"] as AcompanhamentoOperadora[]).map(operator => (
            <TabsContent key={operator} value={operator} className="mt-4 grid gap-3 lg:grid-cols-3">
              <SourceList
                title="Status manual"
                icon={<ListChecks className="size-3.5 text-info" />}
                operator={operator}
                source="status_manual"
                options={statusManuais
                  .filter(item => item.operadora === operator)
                  .map(item => ({
                    id: item.id,
                    nome: item.nome,
                    referenceId: item.id.split(":")[0],
                  }))}
                selected={draft}
                onToggle={toggle}
              />
              <SourceList
                title="Status do robô"
                icon={<Bot className="size-3.5 text-purple" />}
                operator={operator}
                source="status_robo"
                options={robotOptions}
                selected={draft}
                onToggle={toggle}
              />
              <SourceList
                title="Etapa do pipeline"
                icon={<Workflow className="size-3.5 text-warning" />}
                operator={operator}
                source="pipeline_etapa"
                options={stageOptions}
                selected={draft}
                onToggle={toggle}
              />
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter>
          <div className="mr-auto text-[10px] text-muted-foreground">{draft.length} regra(s) selecionada(s)</div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={persist} disabled={saving}>{saving ? "Salvando…" : "Salvar configuração"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuadroConfigButton({
  quadroCodigo,
  quadros,
  regras,
  statusManuais,
  statusRobo,
  etapasPipeline,
  onSaved,
  compact = false,
}: {
  quadroCodigo: string;
  quadros: AcompanhamentoQuadro[];
  regras: AcompanhamentoQuadroRegra[];
  statusManuais: ManualStatusOption[];
  statusRobo: RobotStatusOption[];
  etapasPipeline: PipelineStageOption[];
  onSaved: () => void | Promise<void>;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const quadro = quadros.find(item => item.codigo === quadroCodigo);

  if (!quadro) return null;

  return (
    <>
      <Button
        variant="outline"
        size={compact ? "sm" : "default"}
        onClick={() => setOpen(true)}
        className={compact ? "h-7 gap-1 px-2 text-[9px]" : "gap-1.5"}
      >
        <Settings2 className="size-3.5" /> Configurar
      </Button>
      <QuadroRuleEditor
        quadro={quadro}
        regras={regras}
        statusManuais={statusManuais}
        statusRobo={statusRobo}
        etapasPipeline={etapasPipeline}
        open={open}
        onOpenChange={setOpen}
        onSaved={onSaved}
      />
    </>
  );
}
