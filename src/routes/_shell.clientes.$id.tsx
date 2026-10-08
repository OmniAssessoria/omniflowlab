import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ArrowLeft, Building2, Pencil, Trash2 } from "lucide-react";
import { buildVendaDetailUrl } from "@/lib/rotas";
import { CedentesVinculados } from "@/components/cedentes-vinculados";
import { ClienteRepresentantes } from "@/components/cliente-representantes";
import { useSmartBack } from "@/lib/navigation-memory";

export const Route = createFileRoute("/_shell/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Ficha do Cliente | OMNI Flow Lab" },
      { name: "description", content: "Dados cadastrais e pedidos vinculados ao cliente no OMNI Flow Lab." },
      { property: "og:title", content: "Ficha do Cliente | OMNI Flow Lab" },
      { property: "og:description", content: "Dados cadastrais e pedidos vinculados ao cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FichaClientePage,
});

type Cliente = {
  id: string;
  razao_social: string | null;
  cnpj_cpf: string | null;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  uf: string | null;
  ddd: string | null;
  observacao: string | null;
  operadoras: string[] | null;
  consultor_id: string | null;
  updated_at: string | null;
};

type Venda = {
  id: string;
  produto: string | null;
  operadora: string | null;
  etapa_id: string | null;
  funil: string | null;
  quantidade_linhas: number | null;
  valor: number | null;
  created_at: string | null;
};

const CLIENTE_COLS =
  "id, razao_social, cnpj_cpf, contato, telefone, email, uf, ddd, observacao, operadoras, consultor_id, updated_at";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function fmtMoney(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
}

function fmtDateTime(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
}

const CAMPOS_LABEL: Record<string, string> = {
  razao_social: "Razão social",
  cnpj_cpf: "CNPJ/CPF",
  contato: "Contato",
  telefone: "Telefone",
  email: "E-mail",
  uf: "UF",
  ddd: "DDD",
  observacao: "Observação",
};

function FichaClientePage() {
  const { id } = Route.useParams();
  const { user, primaryRole, profile } = useAuth();
  const voltarPaginaAnterior = useSmartBack(primaryRole === "consultor" ? "/meus-clientes" : "/clientes");
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) {
      setLoading(true);
      setErro(null);
    }
    const { data, error } = await supabase.from("clientes").select(CLIENTE_COLS).eq("id", id).maybeSingle();
    if (error) {
      setErro(
        error.message.includes("permission") || error.code === "42501"
          ? "Você não tem permissão para acessar este cliente."
          : "Não foi possível carregar este cliente. Tente novamente.",
      );
      setLoading(false);
      return;
    }
    if (!data) {
      setErro("Cliente não encontrado.");
      setLoading(false);
      return;
    }
    setCliente(data as Cliente);
    const { data: vs } = await supabase
      .from("vendas")
      .select("id, produto, operadora, etapa_id, funil, quantidade_linhas, valor, created_at")
      .eq("cliente_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setVendas((vs ?? []) as Venda[]);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar, tentativa]);

  // Refetch seguro em tempo real (canal único por cliente para evitar subscribe duplicado)
  useEffect(() => {
    const canal = supabase
      .channel(`ficha-cliente-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vendas", filter: `cliente_id=eq.${id}` }, () => {
        void carregar(true);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "clientes", filter: `id=eq.${id}` }, () => {
        void carregar(true);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [id, carregar]);

  // Métricas sempre calculadas a partir dos pedidos vinculados
  const totais = useMemo(() => {
    const linhas = vendas.reduce((acc, v) => acc + Number(v.quantidade_linhas ?? 0), 0);
    const receita = vendas.reduce((acc, v) => acc + Number(v.valor ?? 0), 0);
    const operadorasVendas = Array.from(new Set(vendas.map(v => v.operadora).filter(Boolean) as string[]));
    return { linhas, receita, pedidos: vendas.length, operadorasVendas };
  }, [vendas]);

  const podeEditar = useMemo(() => {
    if (!primaryRole) return false;
    if (primaryRole === "admin" || primaryRole === "gestor" || primaryRole === "bko") return true;
    if (primaryRole === "consultor") return !!user && cliente?.consultor_id === user.id;
    return false;
  }, [primaryRole, user, cliente?.consultor_id]);

  const podeExcluir = primaryRole === "admin" || primaryRole === "gestor";

  const confirmarExclusao = async () => {
    if (!cliente?.id || !deleteReason.trim() || deleteLoading) return;
    setDeleteLoading(true);
    try {
      const { deleteCliente } = await import("@/lib/exclusao.functions");
      const res = await deleteCliente({
        data: {
          clienteId: cliente.id,
          reason: deleteReason.trim(),
        },
      });

      toast.success(`Empresa excluída com sucesso. ${res.vendas_updated ?? 0} pedido(s) vinculado(s) também foram excluídos.`);
      setDeleteOpen(false);
      setDeleteReason("");
      voltarPaginaAnterior();
    } catch (error: any) {
      console.error("[EXCLUSÃO EMPRESA]", error);
      toast.error(error?.message || "Não foi possível excluir a empresa.");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-muted-foreground">Carregando cliente...</div>;
  }

  if (erro) {
    return (
      <div className="p-8 space-y-3">
        <h1 className="text-xl font-semibold">{erro}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTentativa(t => t + 1)}>Tentar novamente</Button>
          <Button variant="ghost" onClick={voltarPaginaAnterior}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const operadoras = (cliente?.operadoras?.length ? cliente.operadoras : totais.operadorasVendas).join(" / ") || "—";

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={voltarPaginaAnterior}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="size-5 text-omni" /> {cliente?.razao_social ?? "Cliente"}
            </h1>
            <p className="text-xs text-muted-foreground font-mono">{cliente?.cnpj_cpf ?? "—"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {podeEditar && (
            <Button
              onClick={() => setEditOpen(true)}
              className="gap-2 bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)]"
            >
              <Pencil className="size-4" /> Editar cliente
            </Button>
          )}
          {podeExcluir && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteReason("");
                setDeleteOpen(true);
              }}
              className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" /> Excluir empresa
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Contato", cliente?.contato || "—"],
          ["Telefone", cliente?.telefone || "—"],
          ["E-mail", cliente?.email || "—"],
          ["UF / DDD", `${cliente?.uf || "—"} / ${cliente?.ddd || "—"}`],
          ["Operadoras", operadoras],
          ["Linhas totais", String(totais.linhas)],
          ["Receita total", fmtMoney(totais.receita)],
          ["Pedidos", String(totais.pedidos)],
          ["Última alteração", fmtDateTime(cliente?.updated_at)],
          ["Observação", cliente?.observacao || "—"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-sm font-medium mt-1 break-words">{value}</p>
          </div>
        ))}
      </div>

      {cliente?.id && (
        <ClienteRepresentantes
          clienteId={cliente.id}
          canManage={podeEditar}
          onChanged={() => carregar(true)}
        />
      )}

      {cliente?.id && <CedentesVinculados clienteId={cliente.id} />}

      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border text-sm font-semibold">Pedidos do cliente</div>
        {vendas.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhum pedido vinculado a este cliente.</div>
        ) : (
          <div className="divide-y divide-border">
            {vendas.map(v => (
              <Link
                key={v.id}
                {...buildVendaDetailUrl(v.id)}
                search={{ suporte: undefined, etapaSuporte: undefined, clienteId: undefined }}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-1/60"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{v.produto ?? "Pedido"}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.operadora ?? "—"} · {v.funil ?? "—"} · {v.quantidade_linhas ?? 0} linha(s)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-success font-semibold">{fmtMoney(v.valor)}</span>
                  <Badge variant="outline" className="text-[9px]">{v.etapa_id ?? "—"}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {cliente && (
        <EditarClienteDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          cliente={cliente}
          userId={user?.id ?? null}
          userEmail={profile?.email ?? user?.email ?? null}
          role={primaryRole}
          onSaved={() => void carregar(true)}
        />
      )}

      <AlertDialog
        open={deleteOpen}
        onOpenChange={open => {
          if (deleteLoading) return;
          setDeleteOpen(open);
          if (!open) setDeleteReason("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              A exclusão é definitiva.
              {vendas.length > 0
                ? ` Esta empresa possui ${vendas.length} pedido(s) vinculado(s), que também serão excluídos definitivamente.`
                : " Esta empresa não possui pedidos ativos vinculados."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="delete-company-reason">Motivo da exclusão *</Label>
            <Textarea
              id="delete-company-reason"
              rows={3}
              value={deleteReason}
              onChange={event => setDeleteReason(event.target.value)}
              placeholder="Informe o motivo da exclusão"
              disabled={deleteLoading}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteLoading || !deleteReason.trim()}
              onClick={event => {
                event.preventDefault();
                void confirmarExclusao();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? "Excluindo…" : "Excluir empresa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditarClienteDialog({
  open,
  onOpenChange,
  cliente,
  userId,
  userEmail,
  role,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente: Cliente;
  userId: string | null;
  userEmail: string | null;
  role: string | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => ({
    razao_social: cliente.razao_social ?? "",
    cnpj_cpf: cliente.cnpj_cpf ?? "",
    contato: cliente.contato ?? "",
    telefone: cliente.telefone ?? "",
    email: cliente.email ?? "",
    uf: cliente.uf ?? "",
    ddd: cliente.ddd ?? "",
    observacao: cliente.observacao ?? "",
  }));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        razao_social: cliente.razao_social ?? "",
        cnpj_cpf: cliente.cnpj_cpf ?? "",
        contato: cliente.contato ?? "",
        telefone: cliente.telefone ?? "",
        email: cliente.email ?? "",
        uf: cliente.uf ?? "",
        ddd: cliente.ddd ?? "",
        observacao: cliente.observacao ?? "",
      });
    }
  }, [open, cliente]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  function validar(): string | null {
    if (!form.razao_social.trim()) return "Razão social é obrigatória.";
    if (!form.cnpj_cpf.trim()) return "CNPJ/CPF é obrigatório.";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) return "E-mail inválido.";
    if (form.telefone.trim()) {
      const d = form.telefone.replace(/\D/g, "");
      if (d.length < 10 || d.length > 11) return "Telefone inválido. Use DDD + número.";
    }
    if (form.uf.trim() && !UFS.includes(form.uf.trim().toUpperCase())) return "UF inválida.";
    if (form.ddd.trim() && !/^\d{2}$/.test(form.ddd.trim())) return "DDD deve ter 2 dígitos numéricos.";
    return null;
  }

  async function salvar() {
    const invalido = validar();
    if (invalido) {
      toast.error(invalido);
      return;
    }
    setSalvando(true);
    const payload = {
      razao_social: form.razao_social.trim(),
      cnpj_cpf: form.cnpj_cpf.trim() || null,
      contato: form.contato.trim() || null,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      uf: form.uf.trim() ? form.uf.trim().toUpperCase() : null,
      ddd: form.ddd.trim() || null,
      observacao: form.observacao.trim() || null,
    };

    const anterior: Record<string, unknown> = {};
    const novo: Record<string, unknown> = {};
    for (const k of Object.keys(payload) as (keyof typeof payload)[]) {
      const antes = (cliente as unknown as Record<string, unknown>)[k] ?? null;
      if ((payload[k] ?? null) !== antes) {
        anterior[k] = antes;
        novo[k] = payload[k] ?? null;
      }
    }

    const { error } = await supabase.from("clientes").update(payload).eq("id", cliente.id);
    setSalvando(false);
    if (error) {
      const negado = error.code === "42501" || error.message.toLowerCase().includes("policy") || error.message.toLowerCase().includes("permission");
      toast.error(negado ? "Você não tem permissão para editar este cliente." : error.message);
      return;
    }

    if (Object.keys(novo).length > 0) {
      const descricao = Object.keys(novo)
        .map(k => `${CAMPOS_LABEL[k] ?? k}: "${String(anterior[k] ?? "vazio")}" → "${String(novo[k] ?? "vazio")}"`)
        .join(" | ");
      await supabase.from("audit_logs").insert({
        user_id: userId,
        user_email: userEmail,
        acao: "cliente_atualizado",
        entidade: "clientes",
        entidade_id: cliente.id,
        descricao: `Cliente atualizado (${role ?? "—"}) — ${descricao}`,
        valor_anterior: anterior as never,
        valor_novo: novo as never,
      });
    }

    toast.success("Cliente atualizado.");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>
            Apenas dados cadastrais da empresa. Linhas, receita e pedidos são calculados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="razao_social">Razão social *</Label>
            <Input id="razao_social" value={form.razao_social} onChange={set("razao_social")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cnpj_cpf">CNPJ/CPF *</Label>
            <Input id="cnpj_cpf" value={form.cnpj_cpf} onChange={set("cnpj_cpf")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contato">Contato</Label>
            <Input id="contato" value={form.contato} onChange={set("contato")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" value={form.telefone} onChange={set("telefone")} placeholder="(16) 99999-9999" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" value={form.email} onChange={set("email")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="uf">UF</Label>
            <Input id="uf" value={form.uf} onChange={set("uf")} maxLength={2} placeholder="SP" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ddd">DDD</Label>
            <Input id="ddd" value={form.ddd} onChange={set("ddd")} maxLength={2} placeholder="16" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea id="observacao" value={form.observacao} onChange={set("observacao")} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando} className="bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)]">
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
