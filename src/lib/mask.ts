// Mascaramento de dados sensíveis por perfil.
import type { AppRole } from "./auth";

const SENSITIVE_ROLES_NO_VALUE: AppRole[] = ["bko"];

export function canSeeValue(role: AppRole | null): boolean {
  if (!role) return false;
  return !SENSITIVE_ROLES_NO_VALUE.includes(role);
}

export function canSeeFullDoc(role: AppRole | null): boolean {
  return role === "admin" || role === "gestor";
}

export function canSeeFullPhone(role: AppRole | null): boolean {
  return role === "admin" || role === "gestor";
}

export function maskCpfCnpj(doc: string, role: AppRole | null): string {
  const raw = doc.trim();
  const canonical = raw.replace(/[^A-Za-z0-9]/g, "");
  const onlyDigits = /^\d+$/.test(canonical);

  if (canSeeFullDoc(role)) {
    if (onlyDigits && canonical.length === 11) {
      return canonical.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    if (onlyDigits && canonical.length === 14) {
      return canonical.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return raw || "—";
  }

  if (canonical.length >= 4) {
    const tail = canonical.slice(-2);
    if (onlyDigits && canonical.length === 11) return `***.***.***-${tail}`;
    if (onlyDigits && canonical.length === 14) return `**.***.***/****-${tail}`;
    return `${"•".repeat(Math.max(4, canonical.length - 2))}${tail}`;
  }
  return "•••";
}

export function maskPhone(phone: string, role: AppRole | null): string {
  if (canSeeFullPhone(role)) return phone;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "(••) ••••-••••";
  const ddd = digits.slice(0, 2);
  const tail = digits.slice(-2);
  return `(${ddd}) ••••-••${tail}`;
}

export function maskValor(valor: number, role: AppRole | null): string {
  if (canSeeValue(role)) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
  }
  return "R$ •••••";
}

export function maskEmail(email: string, role: AppRole | null): string {
  if (canSeeFullDoc(role)) return email;
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  const visible = user.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(3, user.length - 2))}@${domain}`;
}
