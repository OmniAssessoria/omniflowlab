import type { AppRole } from "./auth";

export type { AppRole };

export interface Permissoes {
  ver_claro?: boolean;
  ver_vivo?: boolean;
  ver_omni?: boolean;
  ver_sensiveis?: boolean;
  importar?: boolean;
  exportar?: boolean;
  editar_funis?: boolean;
}

export const ACOMPANHAMENTO_ROLES: AppRole[] = ["admin", "gestor"];

export const ROUTE_ROLES: Record<string, AppRole[]> = {
  "/dashboard": ["admin", "gestor", "consultor"],
  "/acompanhamento": ACOMPANHAMENTO_ROLES,
  "/pipeline": ["admin", "gestor", "consultor", "bko"],
  "/vendas": ["admin", "gestor", "consultor", "bko"],
  "/clientes": ["admin", "gestor", "bko"],
  "/meus-clientes": ["admin", "gestor", "consultor", "bko"],
  "/equipe": ["admin", "gestor", "bko"],
  "/relatorios": ["admin", "gestor"],
  "/logs-robo": ["admin", "bko", "gestor"],
  "/comissoes": ["admin", "gestor", "consultor"],
  "/suporte": ["admin", "gestor", "consultor", "bko", "closer"],
  "/processos_bko": ["admin", "gestor", "consultor", "bko"],
  "/notificacoes": ["admin", "gestor", "consultor", "bko"],
  "/importar": ["admin"],
  "/config": ["admin", "gestor", "bko"],
  "/operacao-closer": ["admin", "gestor", "bko", "closer", "consultor"],
  "/tv": ["telespectador"],
};

export function canAccessRoute(pathname: string, role: AppRole | null): boolean {
  if (!role) return false;
  // Ficha individual do cliente: liberada para todos os perfis; a visibilidade
  // real do registro é garantida pelas políticas de acesso do banco (RLS).
  if (/^\/clientes\/[^/]+$/.test(pathname)) return true;
  for (const prefix of Object.keys(ROUTE_ROLES)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      const allowedRoles = ROUTE_ROLES[prefix];
      return allowedRoles.includes(role);
    }
  }
  return true;
}


export function landingForRole(role: AppRole | null): string {
  if (role === "telespectador") return "/tv";
  if (role === "admin" || role === "gestor") return "/dashboard";
  if (role === "bko") return "/suporte";
  if (role === "closer") return "/operacao-closer";
  return "/pipeline";
}

export function defaultPermissoesFor(role: AppRole): Permissoes {
  if (role === "admin") return { ver_claro: true, ver_vivo: true, ver_omni: true, ver_sensiveis: true, importar: true, exportar: true, editar_funis: true };
  if (role === "gestor") return { ver_claro: true, ver_vivo: true, ver_omni: true, ver_sensiveis: true, importar: false, exportar: true, editar_funis: false };
  if (role === "bko") return { ver_claro: true, ver_vivo: true, ver_omni: true, ver_sensiveis: true, importar: false, exportar: false, editar_funis: true };
  return { ver_claro: false, ver_vivo: false, ver_omni: false, ver_sensiveis: false, importar: false, exportar: false, editar_funis: false };
}
