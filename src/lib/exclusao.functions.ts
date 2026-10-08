import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Valida se o usuário tem permissão de exclusão definitiva de Cliente/Pedido.
 * A RPC repete essa validação no banco para não depender apenas da aplicação.
 */
async function validateExclusaoPermission(context: any, options: { allowBkoForPedido?: boolean } = {}) {
  const { supabase, userId } = context;
  if (!userId) throw new Error("Não autenticado");

  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const userRoles: string[] = (roles ?? []).map((r: any) => r.role);

  if (userRoles.length === 0) {
    throw new Error("Perfil do usuário não encontrado. Entre em contato com o administrador.");
  }

  const permitido = options.allowBkoForPedido === true
    ? userRoles.some(r => r === "admin" || r === "bko")
    : userRoles.some(r => r === "admin" || r === "gestor");

  if (!permitido) {
    throw new Error(
      options.allowBkoForPedido
        ? "Acesso negado: somente Admin ou BKO podem excluir pedidos."
        : "Acesso negado: somente Admin ou Gestor podem excluir clientes."
    );
  }
}

export const deleteVendaLinha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({
    linhaId: z.string().uuid(),
  }).parse(data))
  .handler(async ({ data: { linhaId }, context }) => {
    const supabase = (context as any).supabase;
    const { data, error } = await (supabase as any).rpc("excluir_linha_venda", {
      p_linha_id: linhaId,
    });

    if (error) {
      throw new Error(error.message || "Não foi possível excluir a linha.");
    }

    const res = data as any;
    if (!res?.success || Number(res.deleted ?? 0) !== 1) {
      throw new Error(res?.message || "A linha não foi excluída. Tente novamente.");
    }

    return res;
  });

export const deleteVenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({
    vendaId: z.string().uuid(),
    reason: z.string().trim().min(1),
  }).parse(data))
  .handler(async ({ data: { vendaId, reason }, context }) => {
    await validateExclusaoPermission(context, { allowBkoForPedido: true });
    const supabase = (context as any).supabase;

    const { data, error } = await (supabase as any).rpc("excluir_venda_definitiva", {
      p_venda_id: vendaId,
      p_reason: reason,
    });

    if (error) {
      throw new Error(error.message || "Não foi possível excluir o pedido definitivamente.");
    }

    const res = data as any;
    if (!res?.success || Number(res.deleted ?? 0) !== 1) {
      throw new Error(res?.message || "Não foi possível confirmar a exclusão definitiva do pedido.");
    }

    return res;
  });

export const deleteCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({
    clienteId: z.string().uuid(),
    reason: z.string().trim().min(1),
  }).parse(data))
  .handler(async ({ data: { clienteId, reason }, context }) => {
    await validateExclusaoPermission(context);
    const supabase = (context as any).supabase;

    const { data, error } = await (supabase as any).rpc("excluir_cliente_definitivo", {
      p_cliente_id: clienteId,
      p_reason: reason,
    });

    if (error) {
      throw new Error(error.message || "Não foi possível excluir o cliente definitivamente.");
    }

    const res = data as any;
    if (!res?.success || Number(res.cliente_deleted ?? 0) !== 1) {
      throw new Error(res?.message || "Não foi possível confirmar a exclusão definitiva do cliente.");
    }

    return {
      ...res,
      // Mantém aliases para chamadas antigas que exibem estas contagens.
      cliente_updated: res.cliente_deleted,
      vendas_updated: res.vendas_deleted,
    };
  });
