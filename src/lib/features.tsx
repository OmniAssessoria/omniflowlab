import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { COMMISSIONS_FLAG } from "@/lib/module-flags";

interface FeaturesState {
  comissoesEnabled: boolean;
  comissoesRoles: string[];
  /** true se o usuário atual pode ver/acessar a área de comissões */
  comissoesVisible: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<FeaturesState | null>(null);

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const { user, primaryRole } = useAuth();
  const [comissoesEnabled, setComissoesEnabled] = useState(true);
  const [comissoesRoles, setComissoesRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("app_settings").select("valor").eq("chave", COMMISSIONS_FLAG).maybeSingle();
    const val = (data as { valor: any } | null)?.valor;
    if (typeof val === "object" && val !== null) {
      setComissoesEnabled(val.enabled !== false);
      setComissoesRoles(Array.isArray(val.roles) ? val.roles : []);
    } else {
      setComissoesEnabled(val !== false);
      setComissoesRoles([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel("app-settings-flags")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  const isAdmin = primaryRole === "admin";

  return (
    <Ctx.Provider value={{
      comissoesEnabled,
      comissoesRoles,
      comissoesVisible: comissoesEnabled && primaryRole ? comissoesRoles.includes(primaryRole) : false,
      loading,
      refresh: load,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useFeatures(): FeaturesState {
  return useContext(Ctx) ?? {
    comissoesEnabled: true,
    comissoesRoles: [],
    comissoesVisible: true,
    loading: false,
    refresh: async () => {},
  };
}
