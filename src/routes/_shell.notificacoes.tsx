import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useNotificacoes, type Notificacao } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, AlertTriangle, Zap, FileText, LifeBuoy, Inbox, X, Eye, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationDetailsDialog } from "@/components/notification-details-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_shell/notificacoes")({
  component: NotificacoesPage,
});

const ICON: Record<string, React.ReactNode> = {
  sla_alerta: <AlertTriangle className="size-4" />,
  sla_estouro: <Zap className="size-4" />,
  nova_venda: <FileText className="size-4" />,
  ticket_novo: <LifeBuoy className="size-4" />,
};

function NotificacoesPage() {
  const { items, naoLidas, marcarLida, marcarTodas, remover, removerTodas } = useNotificacoes(100);
  const navigate = useNavigate();
  const [detailsNotification, setDetailsNotification] = useState<Notificacao | null>(null);
  const [confirmRemoveAllOpen, setConfirmRemoveAllOpen] = useState(false);
  const [removingAll, setRemovingAll] = useState(false);

  async function handleRemoverTodas() {
    setRemovingAll(true);
    const ok = await removerTodas();
    setRemovingAll(false);

    if (!ok) {
      toast.error("Não foi possível remover todas as notificações.");
      return;
    }

    setConfirmRemoveAllOpen(false);
    toast.success("Todas as notificações foram removidas.");
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
            <Bell className="size-5 text-omni" /> Notificações
          </h1>
          <p className="text-sm text-muted-foreground">{naoLidas} não lidas · {items.length} no total</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {naoLidas > 0 && (
            <Button size="sm" variant="outline" onClick={marcarTodas} className="gap-2">
              <CheckCheck className="size-3.5" /> Marcar todas como lidas
            </Button>
          )}

          {items.length > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmRemoveAllOpen(true)}
              className="gap-2"
            >
              <Trash2 className="size-3.5" /> Remover todas
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {items.length === 0 && (
          <div className="p-16 text-center">
            <Inbox className="size-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma notificação ainda.</p>
          </div>
        )}
        {items.map(n => (
          <div
            key={n.id}
            className={cn(
              "group/notif-page relative border-b border-border last:border-0 transition-colors hover:bg-surface-1",
              !n.lida && "bg-omni/5",
            )}
          >
            <button
              type="button"
              onClick={() => {
                void marcarLida(n.id);
                if (n.link) navigate({ to: n.link });
              }}
              className="flex w-full items-start gap-3 px-4 py-3 pr-20 text-left"
            >
              <div className={cn(
                "size-9 rounded-lg grid place-items-center shrink-0",
                n.criticidade === "alta" ? "bg-destructive/15 text-destructive" :
                n.criticidade === "media" ? "bg-warning/15 text-warning" :
                "bg-info/15 text-info"
              )}>
                {ICON[n.tipo] ?? <Bell className="size-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{n.titulo}</span>
                  {!n.lida && <Badge className="bg-omni text-black text-[9px] h-4">NOVA</Badge>}
                </div>
                {n.descricao && <p className="text-xs text-muted-foreground truncate">{n.descricao}</p>}
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                  {new Date(n.updated_at || n.created_at).toLocaleString("pt-BR")}
                  {(n.item_count ?? 1) > 1 ? ` · ${n.item_count} alterações agrupadas` : ""}
                </p>
              </div>
            </button>

            {(n.tipo === "pedido_alterado_grupo" || n.tipo === "pedido_alterado_importante") && (
              <button
                type="button"
                aria-label="Ver alterações"
                title="Ver alterações"
                onClick={(event) => {
                  event.stopPropagation();
                  void marcarLida(n.id);
                  setDetailsNotification(n);
                }}
                className="absolute right-10 top-3 grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <Eye className="size-3.5" />
              </button>
            )}

            <button
              type="button"
              aria-label="Remover notificação"
              title="Remover notificação"
              onClick={(event) => {
                event.stopPropagation();
                void remover(n.id);
              }}
              className="absolute right-3 top-3 grid size-6 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover/notif-page:opacity-100 focus:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      <NotificationDetailsDialog
        notification={detailsNotification}
        open={Boolean(detailsNotification)}
        onOpenChange={(open) => !open && setDetailsNotification(null)}
      />

      <AlertDialog open={confirmRemoveAllOpen} onOpenChange={setConfirmRemoveAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover todas as notificações?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação apagará permanentemente todas as suas notificações, incluindo os detalhes das alterações agrupadas. Não será possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingAll}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleRemoverTodas();
              }}
              disabled={removingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="mr-2 size-3.5" />
              {removingAll ? "Removendo..." : "Remover todas"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
