import { useMemo, useState, type DragEvent } from 'react';
import { GripVertical, Loader2, LockKeyhole, Pencil, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { usePipelineStructure } from '@/hooks/use-pipeline-structure';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível alterar a estrutura do pipeline.';
}

export function PipelineStructurePanel() {
  const { roles } = useAuth();
  const {
    funis,
    etapas,
    loading,
    error,
    setFunilAtivo,
    setEtapaAtiva,
    renameEtapa,
    reorderEtapasExibicao,
  } = usePipelineStructure();
  const canEdit = roles.includes('admin') || roles.includes('bko');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ id: string; position: 'before' | 'after' } | null>(null);

  const renameStage = useMemo(
    () => etapas.find((etapa) => etapa.id === renameId) ?? null,
    [etapas, renameId],
  );

  async function toggleFunil(funilId: string, ativo: boolean) {
    if (!canEdit) return;
    setBusyKey(`funil:${funilId}`);
    try {
      await setFunilAtivo(funilId, ativo);
      toast.success(ativo ? 'Funil ativado' : 'Funil desativado');
    } catch (err) {
      toast.error('Alteração bloqueada', { description: messageFrom(err), duration: 8000 });
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleEtapa(etapaId: string, ativo: boolean) {
    if (!canEdit) return;
    setBusyKey(`etapa:${etapaId}`);
    try {
      await setEtapaAtiva(etapaId, ativo);
      toast.success(ativo ? 'Etapa ativada' : 'Etapa desativada');
    } catch (err) {
      toast.error('Alteração bloqueada', { description: messageFrom(err), duration: 8000 });
    } finally {
      setBusyKey(null);
    }
  }

  function openRename(etapaId: string, nome: string) {
    if (!canEdit) return;
    setRenameId(etapaId);
    setRenameValue(nome);
  }

  async function saveRename() {
    if (!renameId || !renameValue.trim()) return;
    setRenameSaving(true);
    try {
      await renameEtapa(renameId, renameValue);
      toast.success('Nome da etapa atualizado');
      setRenameId(null);
    } catch (err) {
      toast.error('Edição bloqueada', { description: messageFrom(err), duration: 8000 });
    } finally {
      setRenameSaving(false);
    }
  }

  function displayOrder(a: { ordem_exibicao?: number; ordem: number }, b: { ordem_exibicao?: number; ordem: number }) {
    return (a.ordem_exibicao ?? a.ordem) - (b.ordem_exibicao ?? b.ordem)
      || a.ordem - b.ordem;
  }

  function handleStageDragOver(event: DragEvent<HTMLDivElement>, etapaId: string) {
    if (!canEdit || !draggingId || draggingId === etapaId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const rect = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDragOver({ id: etapaId, position });
  }

  async function handleStageDrop(funilId: string, targetId: string) {
    if (!canEdit || !draggingId || draggingId === targetId || !dragOver) {
      setDraggingId(null);
      setDragOver(null);
      return;
    }

    const stages = etapas
      .filter((etapa) => etapa.funil_id === funilId)
      .sort(displayOrder);
    const dragged = stages.find((etapa) => etapa.id === draggingId);
    if (!dragged) {
      setDraggingId(null);
      setDragOver(null);
      return;
    }

    const next = stages.filter((etapa) => etapa.id !== draggingId);
    const targetIndex = next.findIndex((etapa) => etapa.id === targetId);
    if (targetIndex < 0) {
      setDraggingId(null);
      setDragOver(null);
      return;
    }

    const insertIndex = dragOver.position === 'after' ? targetIndex + 1 : targetIndex;
    next.splice(insertIndex, 0, dragged);

    const before = stages.map((etapa) => etapa.id).join('|');
    const after = next.map((etapa) => etapa.id).join('|');
    setDraggingId(null);
    setDragOver(null);
    if (before === after) return;

    setBusyKey(`order:${funilId}`);
    try {
      await reorderEtapasExibicao(funilId, next.map((etapa) => etapa.id));
      toast.success('Ordem de exibição atualizada', {
        description: 'O Kanban já seguirá esta nova sequência de colunas.',
      });
    } catch (err) {
      toast.error('Não foi possível reordenar as etapas', {
        description: messageFrom(err),
        duration: 8000,
      });
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando estrutura…
      </section>
    );
  }

  return (
    <>
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Workflow className="size-4 text-omni" />
              <h2 className="font-display font-semibold">Funis e Etapas</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
              Funis e etapas inativos deixam de aparecer nos fluxos operacionais. Arraste as etapas pela alça para alterar somente a ordem visual das colunas no Kanban; a sequência operacional e os avanços automáticos não são alterados.
            </p>
          </div>
          <Badge variant="outline" className={cn('gap-1', canEdit ? 'text-success border-success/40' : 'text-muted-foreground')}>
            {canEdit ? 'Administração liberada' : <><LockKeyhole className="size-3" /> Somente leitura</>}
          </Badge>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {funis.map((funil) => {
            const stages = etapas.filter((etapa) => etapa.funil_id === funil.id).sort(displayOrder);
            const activeCount = stages.filter((etapa) => etapa.ativo).length;
            const funnelBusy = busyKey === `funil:${funil.id}`;
            const reorderBusy = busyKey === `order:${funil.id}`;

            return (
              <article
                key={funil.id}
                className={cn(
                  'rounded-xl border p-3 transition-colors',
                  funil.ativo
                    ? 'border-success/35 bg-success/[0.035]'
                    : 'border-destructive/45 bg-destructive/[0.045]',
                )}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('size-2.5 rounded-full shrink-0', funil.ativo ? 'bg-success' : 'bg-destructive')} />
                      <span className="font-semibold text-sm truncate">{funil.nome}</span>
                      <Badge variant="outline" className={cn('text-[9px]', funil.ativo ? 'text-success border-success/35' : 'text-destructive border-destructive/35')}>
                        {funil.ativo ? 'ATIVO' : 'INATIVO'}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {activeCount}/{stages.length} etapas ativas{funil.id === 'suporte' ? ' · fora da sequência comercial' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {funnelBusy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                    <Switch
                      checked={funil.ativo}
                      disabled={!canEdit || funnelBusy}
                      onCheckedChange={(checked) => void toggleFunil(funil.id, checked)}
                      aria-label={`${funil.ativo ? 'Desativar' : 'Ativar'} funil ${funil.nome}`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  {stages.map((etapa) => {
                    const stageBusy = busyKey === `etapa:${etapa.id}`;
                    return (
                      <div
                        key={etapa.id}
                        onDragOver={(event) => handleStageDragOver(event, etapa.id)}
                        onDragLeave={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                            setDragOver(current => current?.id === etapa.id ? null : current);
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          void handleStageDrop(funil.id, etapa.id);
                        }}
                        className={cn(
                          'relative flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 transition-all',
                          etapa.ativo
                            ? 'border-success/25 bg-success/[0.025]'
                            : 'border-destructive/30 bg-destructive/[0.035]',
                          draggingId === etapa.id && 'opacity-45',
                          dragOver?.id === etapa.id && 'ring-1 ring-omni/50',
                        )}
                      >
                        {dragOver?.id === etapa.id && draggingId !== etapa.id && (
                          <span
                            className={cn(
                              'pointer-events-none absolute left-2 right-2 z-10 h-0.5 rounded-full bg-omni shadow-[0_0_8px_var(--omni)]',
                              dragOver.position === 'before' ? '-top-1' : '-bottom-1',
                            )}
                          />
                        )}

                        {canEdit && (
                          <button
                            type="button"
                            draggable={!stageBusy && !reorderBusy}
                            disabled={stageBusy || reorderBusy}
                            onDragStart={(event) => {
                              setDraggingId(etapa.id);
                              setDragOver(null);
                              event.dataTransfer.effectAllowed = 'move';
                              event.dataTransfer.setData('text/plain', etapa.id);
                            }}
                            onDragEnd={() => {
                              setDraggingId(null);
                              setDragOver(null);
                            }}
                            className="grid size-7 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-omni active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
                            title="Segure e arraste para alterar a ordem de exibição"
                            aria-label={`Reordenar etapa ${etapa.nome}`}
                          >
                            <GripVertical className="size-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => openRename(etapa.id, etapa.nome)}
                          className={cn('min-w-0 flex-1 text-left group', canEdit && 'cursor-pointer')}
                          title={canEdit ? 'Editar nome da etapa' : etapa.nome}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={cn('size-2 rounded-full shrink-0', etapa.ativo ? 'bg-success' : 'bg-destructive')} />
                            <span className={cn('text-xs font-medium truncate', !etapa.ativo && 'text-muted-foreground')}>{etapa.nome}</span>
                            {canEdit && <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
                          </div>
                          <div className="text-[9px] text-muted-foreground mt-0.5 pl-4.5 font-mono">{etapa.id}</div>
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          {stageBusy && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                          <span className={cn('text-[9px] font-semibold uppercase', etapa.ativo ? 'text-success' : 'text-destructive')}>
                            {etapa.ativo ? 'Ativa' : 'Inativa'}
                          </span>
                          <Switch
                            checked={etapa.ativo}
                            disabled={!canEdit || stageBusy || reorderBusy}
                            onCheckedChange={(checked) => void toggleEtapa(etapa.id, checked)}
                            aria-label={`${etapa.ativo ? 'Desativar' : 'Ativar'} etapa ${etapa.nome}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>

        <p className="text-[10px] text-muted-foreground mt-4">
          Se houver venda ou atendimento ativo no item, o banco bloqueia desativação e renomeação e informa o que precisa ser retirado antes. Não existe opção de forçar a alteração.
        </p>
      </section>

      <Dialog open={Boolean(renameId)} onOpenChange={(open) => !open && setRenameId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar nome da etapa</DialogTitle>
            <DialogDescription>
              O identificador técnico <span className="font-mono">{renameStage?.id}</span> permanece o mesmo. Apenas o nome exibido no sistema será alterado.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            maxLength={120}
            autoFocus
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && renameValue.trim()) void saveRename();
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameId(null)} disabled={renameSaving}>Cancelar</Button>
            <Button
              className="bg-omni text-black hover:bg-omni/90"
              onClick={() => void saveRename()}
              disabled={renameSaving || !renameValue.trim() || renameValue.trim() === renameStage?.nome}
            >
              {renameSaving ? <><Loader2 className="size-4 mr-1.5 animate-spin" />Salvando</> : 'Salvar nome'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
