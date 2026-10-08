import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "gestor" | "consultor" | "bko" | "closer" | "telespectador";

export interface Profile {
  id: string;
  nome_completo: string;
  email: string;
  telefone: string | null;
  operadora_default: "CLARO" | "VIVO" | null;
  avatar_url: string | null;
  ativo: boolean;
  must_change_password: boolean;
  permissoes: Record<string, boolean>;
  last_login_at: string | null;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  primaryRole: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

const ROLE_PRIORITY: AppRole[] = ["admin", "gestor", "consultor", "bko", "closer", "telespectador"];

function pickPrimary(roles: AppRole[]): AppRole | null {
  for (const r of ROLE_PRIORITY) if (roles.includes(r)) return r;
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedUserId = useRef<string | null>(null);

  async function loadProfileAndRoles(u: User) {
    const [profileResult, rolesResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", u.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", u.id),
    ]);

    if (profileResult.error) throw profileResult.error;
    if (rolesResult.error) throw rolesResult.error;

    const prof = profileResult.data;
    const p = prof as any;

    if (p && (p.is_deleted === true || p.deleted_at || p.ativo === false)) {
      loadedUserId.current = null;
      setUser(null);
      setProfile(null);
      setRoles([]);
      await supabase.auth.signOut();
      return;
    }

    setProfile((prof as Profile) ?? null);
    setRoles((rolesResult.data ?? []).map(r => r.role as AppRole));
    loadedUserId.current = u.id;
  }

  async function refresh() {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (data.session?.user) {
        setUser(data.session.user);
        await loadProfileAndRoles(data.session.user);
      } else {
        loadedUserId.current = null;
        setUser(null);
        setProfile(null);
        setRoles([]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;

        if (data.session?.user) {
          setUser(data.session.user);
          await loadProfileAndRoles(data.session.user);
        } else {
          loadedUserId.current = null;
          setUser(null);
          setProfile(null);
          setRoles([]);
        }
      } catch {
        if (mounted) {
          loadedUserId.current = null;
          setUser(null);
          setProfile(null);
          setRoles([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        loadedUserId.current = null;
        setUser(null);
        setProfile(null);
        setRoles([]);
        setLoading(false);
        return;
      }

      if (event === "TOKEN_REFRESHED" && session?.user) {
        setUser(session.user);
        return;
      }

      if (session?.user && (event === "SIGNED_IN" || event === "USER_UPDATED")) {
        setUser(session.user);

        const needsReload = loadedUserId.current !== session.user.id || event === "USER_UPDATED";
        if (!needsReload) return;

        setLoading(true);
        setTimeout(async () => {
          try {
            await loadProfileAndRoles(session.user);
          } finally {
            if (mounted) setLoading(false);
          }
        }, 0);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <Ctx.Provider value={{
      user,
      profile,
      roles,
      primaryRole: pickPrimary(roles),
      loading,
      signOut: async () => { await supabase.auth.signOut(); },
      refresh,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fora de AuthProvider");
  return v;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  consultor: "Consultor",
  bko: "BKO",
  closer: "Closer",
  telespectador: "Telespectador",
};

export const ROLE_COLOR: Record<AppRole, string> = {
  admin: "bg-omni text-black",
  gestor: "bg-info text-white",
  consultor: "bg-success text-white",
  bko: "bg-warning text-black",
  closer: "bg-[#7100CA] text-white",
  telespectador: "bg-success/20 text-success",
};
