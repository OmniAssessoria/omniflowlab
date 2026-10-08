import { useEffect, useState } from "react";
import { Building2, Check, Loader2, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  cedenteTipoPorDocumento,
  montarPayloadCedente,
  validarCedenteCadastro,
  type CedentePessoaTipo,
} from "@/lib/cedente-cadastro";

export type PartePedidoTipo = "cedente" | "cessionario";

export type PartePedidoCadastro = {
  id: string;
  tipo: PartePedidoTipo;
  documento: string;
  razaoSocial?: string | null;
  nome: string;
  email: string;
  telefone?: string | null;
};

export function PartePedidoCadastroDialog({
  tipo,
  open,
  onOpenChange,
  clienteId,
  vendaId,
  editar,
  onSaved,
}: {
  tipo: PartePedidoTipo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  vendaId?: string | null;
  editar?: PartePedidoCadastro | null;
  onSaved?: (item: PartePedidoCadastro) => void | Promise<void>;
}) {
  const cedente = tipo === "cedente";
  const label = cedente ? "Cedente" : "Cessionário";
  const [tipoPessoa, setTipoPessoa] = useState<CedentePessoaTipo>("PJ");
  const [documento, setDocumento] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTipoPessoa(cedente && editar?.documento ? cedenteTipoPorDocumento(editar.documento) : "PJ");
    setDocumento(editar?.documento ?? "");
    setRazaoSocial(editar?.razaoSocial ?? "");
    setNome(editar?.nome ?? "");
    setEmail(editar?.email ?? "");
    setTelefone(editar?.telefone ?? "");
  }, [open, editar, cedente]);

  function digits(value: string) {
    return value.replace(/\D/g, "");
  }

  async function salvar() {
    const doc = digits(documento);
    const razao = razaoSocial.trim();
    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim();

    let cedentePayload: ReturnType<typeof montarPayloadCedente> | null = null;

    if (cedente) {
      const cedenteInput = {
        tipoPessoa,
        documento,
        razaoSocial,
        nome,
        email,
        telefone,
      };
      const erroCedente = validarCedenteCadastro(cedenteInput);
      if (erroCedente) return toast.error(erroCedente);
      cedentePayload = montarPayloadCedente(cedenteInput);
    } else {
      if (doc.length !== 11) return toast.error("Informe um CPF com 11 dígitos.");
      if (!nomeLimpo) return toast.error(`Informe o Nome do ${label}.`);
      if (!emailLimpo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
        return toast.error(`Informe um e-mail válido para o ${label}.`);
      }
    }

    setSaving(true);
    try {
      const db = supabase as any;
      const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
      const tabela = cedente ? "cedentes" : "cessionarios";
      const docCampo = cedente ? "cnpj_cpf" : "cpf";
      const clienteTabela = cedente ? "cliente_cedentes" : "cliente_cessionarios";
      const vendaTabela = cedente ? "venda_cedentes" : "venda_cessionarios";
      const idCampo = cedente ? "cedente_id" : "cessionario_id";

      let resolvedId = editar?.id ?? null;

      if (resolvedId) {
        const payload = cedente
          ? {
              ...(cedentePayload ?? {}),
              updated_at: new Date().toISOString(),
            }
          : {
              cpf: doc,
              nome: nomeLimpo,
              email: emailLimpo,
              updated_at: new Date().toISOString(),
            };
        const { error } = await db.from(tabela).update(payload).eq("id", resolvedId);
        if (error) throw error;
      } else {
        const { data: existentes, error: lookupError } = await db
          .from(tabela)
          .select(`id,${docCampo}`);
        if (lookupError) throw lookupError;

        const existente = (existentes ?? []).find(
          (item: any) => digits(String(item[docCampo] ?? "")) === doc,
        );
        resolvedId = existente?.id ?? null;

        if (!resolvedId) {
          const payload = cedente
            ? {
                ...(cedentePayload ?? {}),
                created_by: userId,
              }
            : {
                cpf: doc,
                nome: nomeLimpo,
                email: emailLimpo,
                created_by: userId,
              };

          const { data: criado, error: createError } = await db
            .from(tabela)
            .insert(payload)
            .select("id")
            .single();
          if (createError) throw createError;
          resolvedId = criado.id;
        }
      }

      const { error: clienteError } = await db
        .from(clienteTabela)
        .upsert(
          {
            cliente_id: clienteId,
            [idCampo]: resolvedId,
            ativo: true,
            created_by: userId,
          },
          { onConflict: `cliente_id,${idCampo}` },
        );
      if (clienteError) throw clienteError;

      if (vendaId) {
        const { data: vinculoExistente, error: vendaLookupError } = await db
          .from(vendaTabela)
          .select(idCampo)
          .eq("venda_id", vendaId)
          .eq(idCampo, resolvedId)
          .maybeSingle();
        if (vendaLookupError) throw vendaLookupError;

        if (!vinculoExistente) {
          const { error: vendaError } = await db
            .from(vendaTabela)
            .insert({
              venda_id: vendaId,
              [idCampo]: resolvedId,
              created_by: userId,
            });
          if (vendaError) throw vendaError;
        }
      }

      const item: PartePedidoCadastro = {
        id: resolvedId as string,
        tipo,
        documento: doc,
        razaoSocial: cedente ? cedentePayload?.razao_social ?? null : null,
        nome: nomeLimpo,
        email: emailLimpo,
        telefone: cedente ? cedentePayload?.telefone ?? null : null,
      };

      await onSaved?.(item);
      toast.success(`${label} ${editar ? "atualizado" : "cadastrado"} com sucesso.`);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Não foi possível salvar o ${label}.`, {
        description: error?.message ?? "Erro inesperado",
      });
    } finally {
      setSaving(false);
    }
  }

  const cedentePf = cedente && tipoPessoa === "PF";

  return (
    <Dialog open={open} onOpenChange={value => !saving && onOpenChange(value)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {cedente
              ? cedentePf
                ? <UserRound className="size-4 text-omni" />
                : <Building2 className="size-4 text-omni" />
              : <UserRound className="size-4 text-omni" />}
            {editar ? "Editar" : "Cadastrar"} {label}
          </DialogTitle>
          <DialogDescription>
            {cedente
              ? cedentePf
                ? "Cedente Pessoa Física: CPF, Nome Completo, E-mail e Telefone de Contato."
                : "Cedente Pessoa Jurídica: CNPJ, Razão Social, Nome e E-mail."
              : "Cessionário é Pessoa Física e opcional: CPF, Nome e E-mail."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {cedente && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Tipo de Pessoa *</Label>
              <Select value={tipoPessoa} onValueChange={value => setTipoPessoa(value as CedentePessoaTipo)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione PF ou PJ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PF">PF</SelectItem>
                  <SelectItem value="PJ">PJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{cedente ? (cedentePf ? "CPF *" : "CNPJ *") : "CPF *"}</Label>
            <Input
              value={documento}
              onChange={event => setDocumento(event.target.value)}
              placeholder={cedente ? (cedentePf ? "CPF" : "CNPJ") : "CPF"}
              inputMode="numeric"
            />
          </div>

          {cedente && !cedentePf && (
            <div className="space-y-1.5">
              <Label>Razão Social *</Label>
              <Input
                value={razaoSocial}
                onChange={event => setRazaoSocial(event.target.value)}
                placeholder="Razão Social"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{cedentePf ? "Nome Completo *" : "Nome *"}</Label>
            <Input
              value={nome}
              onChange={event => setNome(event.target.value)}
              placeholder={cedentePf ? "Nome Completo" : "Nome"}
            />
          </div>

          <div className="space-y-1.5">
            <Label>E-mail *</Label>
            <Input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>

          {cedentePf && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Telefone de Contato *</Label>
              <Input
                value={telefone}
                onChange={event => setTelefone(event.target.value)}
                placeholder="(00) 00000-0000"
                inputMode="tel"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void salvar()} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            {saving ? "Salvando..." : editar ? "Salvar alterações" : `Cadastrar ${label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
