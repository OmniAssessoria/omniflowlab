import { useEffect, useState } from "react";
import { ArrowRight, Bell, History, UserRound } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { Notificacao } from "@/lib/notifications";
import { uppercaseDisplay } from "@/lib/display-normalization";

type NotificationItem = {
  id: string;
  actor_nome: string | null;
  actor_role: string | null;
  campo: string | null;
  campo_label: string | null;
  valor_anterior: string | null;
  valor_novo: string | null;
  descricao: string;
  created_at: string;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function displayFieldLabel(item: NotificationItem) {
  if (!item.campo?.startsWith("linha.")) return item.campo_label || "Alteração";
  const key = item.campo.slice("linha.".length);
  const labels: Record<string, string> = {
    ddd: "DDD da linha",
    numero: "Número da linha",
    produto: "Produto da linha",
    tipo_produto: "Tipo de produto",
    plano: "Plano da linha",
    valor_mensal: "Valor mensal",
    passaporte_plano: "Passaporte",
    passaporte_valor: "Valor do passaporte",
    operadora_doadora: "Operadora doadora",
    descricao_adicional: "Descrição da linha",
    nome_aparelho: "Aparelho",
    possui_bonus: "Bônus",
    bonus_gb: "Bônus GB",
  };
  return labels[key] || item.campo_label || "Linha";
}

function formatValue(campo: string | null, value: string | null) {
  if (value == null || value === "") return "—";

  if (campo?.startsWith("data_")) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }

  if (campo === "valor" || campo?.endsWith(".valor_mensal") || campo?.endsWith(".passaporte_valor")) {
    const number = Number(value);
    if (Number.isFinite(number)) {
      return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
  }

  if (value === "true") return "SIM";
  if (value === "false") return "NÃO";
  return value;
}

export function NotificationDetailsDialog({
  notification,
  open,
  onOpenChange,
}: {
  notification: Notificacao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !notification?.id) {
      if (!open) setItems([]);
      return;
    }

    let active = true;
    setLoading(true);

    (async () => {
      const { data, error } = await (supabase as any)
        .from("notificacao_itens")
        .select("id, actor_nome, actor_role, campo, campo_label, valor_anterior, valor_novo, descricao, created_at")
        .eq("notificacao_id", notification.id)
        .order("created_at", { ascending: true });

      if (!active) return;
      if (error) {
        console.error("[NOTIFICAÇÃO DETALHES]", error);
        setItems([]);
      } else {
        setItems((data ?? []) as NotificationItem[]);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [open, notification?.id]);

  if (!notification) return null;

  const isGrouped = notification.tipo === "pedido_alterado_grupo"
    || notification.tipo === "pedido_alterado_importante";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="border-b border-border px-5 py-4">
          <div className="flex items-start gap-3 pr-8">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-omni/10 text-omni">
              {isGrouped ? <History className="size-4" /> : <Bell className="size-4" />}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base">{notification.titulo}</DialogTitle>
              <DialogDescription className="mt-1">
                {notification.cliente_cnpj_snapshot || "CNPJ/CPF não informado"}
                {" · "}
                {uppercaseDisplay(notification.cliente_razao_snapshot, "RAZÃO SOCIAL NÃO INFORMADA")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
          {notification.actor_nome && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2">
              <UserRound className="size-3.5 text-omni" />
              <span className="text-xs font-semibold">{uppercaseDisplay(notification.actor_nome)}</span>
              {notification.actor_role && (
                <Badge variant="outline" className="ml-auto text-[9px] uppercase">
                  {notification.actor_role}
                </Badge>
              )}
            </div>
          )}

          {loading ? (
            <div className="py-10 text-center text-xs text-muted-foreground">Carregando alterações…</div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface-1 p-4 text-sm text-muted-foreground">
              {notification.descricao || "Nenhum detalhe adicional disponível."}
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => {
                const hasValues = item.campo !== "movimentacao_pipeline"
                  && (item.valor_anterior != null || item.valor_novo != null);

                return (
                  <div key={item.id} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-start gap-3">
                      <div className="grid size-6 shrink-0 place-items-center rounded-full border border-border bg-surface-1 text-[9px] font-bold text-muted-foreground">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <div className="text-xs font-semibold">
                            {displayFieldLabel(item)}
                          </div>
                          <span className="text-[9px] text-muted-foreground">
                            {formatDateTime(item.created_at)}
                          </span>
                        </div>

                        <div className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                          {item.descricao}
                        </div>

                        {hasValues && (
                          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                            <div className="rounded-lg border border-border bg-background/40 px-2.5 py-2">
                              <div className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">Anterior</div>
                              <div className="mt-0.5 break-words text-[11px]">{formatValue(item.campo, item.valor_anterior)}</div>
                            </div>
                            <ArrowRight className="mx-auto size-3.5 text-muted-foreground" />
                            <div className="rounded-lg border border-omni/20 bg-omni/[0.035] px-2.5 py-2">
                              <div className="text-[8px] font-bold uppercase tracking-wider text-omni">Novo</div>
                              <div className="mt-0.5 break-words text-[11px]">{formatValue(item.campo, item.valor_novo)}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
