import { useEffect, useState, useCallback, useId } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type NotificationChannel = "closer" | "operadoras";

export interface Notificacao {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  venda_id: string | null;
  ticket_id: string | null;
  solicitacao_id?: string | null;
  closer_pedido_id?: string | null;
  canal?: NotificationChannel | null;
  marca?: "ONVOX" | "TAKE_FLOW" | "CLARO" | "VIVO" | "PABX" | string | null;
  actor_user_id?: string | null;
  actor_nome?: string | null;
  actor_role?: string | null;
  updated_at?: string | null;
  item_count?: number;
  grupo_aberto?: boolean;
  source_txid?: number | null;
  cliente_cnpj_snapshot?: string | null;
  cliente_razao_snapshot?: string | null;
  link: string | null;
  criticidade: "info" | "media" | "alta";
  lida: boolean;
  created_at: string;
}

export function useNotificacoes(limit = 20, canal?: NotificationChannel) {
  const { user } = useAuth();
  const instanceId = useId().replace(/:/g, "");
  const [items, setItems] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setItems([]); setLoading(false); return; }
    const db = supabase as any;
    let query = db
      .from("notificacoes")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (canal) query = query.eq("canal", canal);

    const { data } = await query;
    setItems((data ?? []) as Notificacao[]);
    setLoading(false);
  }, [user, limit, canal]);

  useEffect(() => {
    void load();
    if (!user) return;

    const syncLocal = () => { void load(); };
    window.addEventListener("omni-notifications-changed", syncLocal);

    const channel = supabase
      .channel(`notifications-${user.id}-${canal ?? "all"}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacoes", filter: `user_id=eq.${user.id}` },
        () => { void load(); },
      )
      .subscribe();

    const t = window.setInterval(load, 30_000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(t);
      window.removeEventListener("omni-notifications-changed", syncLocal);
    };
  }, [user, load, canal, instanceId]);

  const marcarLida = useCallback(async (id: string) => {
    await (supabase as any).from("notificacoes").update({ lida: true }).eq("id", id);
    setItems(curr => curr.map(n => n.id === id ? { ...n, lida: true } : n));
    window.dispatchEvent(new Event("omni-notifications-changed"));
  }, []);

  const marcarTodas = useCallback(async () => {
    if (!user) return;
    const db = supabase as any;
    let query = db.from("notificacoes").update({ lida: true }).eq("user_id", user.id).eq("lida", false);
    if (canal) query = query.eq("canal", canal);
    await query;
    setItems(curr => curr.map(n => ({ ...n, lida: true })));
    window.dispatchEvent(new Event("omni-notifications-changed"));
  }, [user, canal]);

  const remover = useCallback(async (id: string) => {
    const { error } = await (supabase as any)
      .from("notificacoes")
      .delete()
      .eq("id", id);
    if (!error) {
      setItems(curr => curr.filter(n => n.id !== id));
      window.dispatchEvent(new Event("omni-notifications-changed"));
    }
    return !error;
  }, []);

  const removerTodas = useCallback(async () => {
    if (!user) return false;

    const db = supabase as any;
    let query = db
      .from("notificacoes")
      .delete()
      .eq("user_id", user.id);

    if (canal) query = query.eq("canal", canal);

    const { error } = await query;
    if (!error) {
      setItems([]);
      window.dispatchEvent(new Event("omni-notifications-changed"));
    }
    return !error;
  }, [user, canal]);

  const naoLidas = items.filter(n => !n.lida).length;

  return { items, loading, naoLidas, reload: load, marcarLida, marcarTodas, remover, removerTodas };
}
