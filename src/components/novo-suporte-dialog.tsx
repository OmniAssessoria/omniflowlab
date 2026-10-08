import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatSupportPhone, isCompleteSupportPhone } from "@/lib/support-contact";
import { createStandaloneSupport } from "@/lib/support.functions";
import type { SupportPriority } from "@/lib/support-priority";

export function NovoSuporteDialog({ onCreated }: { onCreated?: (id: string) => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [motivo, setMotivo] = useState("");
  const [prioridade, setPrioridade] = useState<SupportPriority>("a_tratar");
  const [destino, setDestino] = useState<"s-espera" | "s-prevendas">("s-espera");

  function reset() {
    setRazaoSocial("");
    setCnpj("");
    setNome("");
    setEmail("");
    setTelefone("");
    setMotivo("");
    setPrioridade("a_tratar");
    setDestino("s-espera");
  }

  async function submit() {
    if (!razaoSocial.trim() || !cnpj.trim() || !nome.trim() || !email.trim() || !telefone.trim() || !motivo.trim()) {
      toast.error("Preencha todos os campos obrigatórios do suporte.");
      return;
    }
    if (!email.includes("@")) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (!isCompleteSupportPhone(telefone)) {
      toast.error("Informe um telefone completo com DDD.");
      return;
    }

    setSaving(true);
    try {
      const id = await createStandaloneSupport({
        clienteRazaoSocial: razaoSocial,
        clienteCnpj: cnpj,
        clienteNome: nome,
        clienteEmail: email,
        clienteTelefone: telefone,
        motivo,
        prioridade,
        etapaInicialId: destino,
      });
      toast.success("Novo suporte criado", {
        description: destino === "s-prevendas" ? "Enviado para Pré Vendas." : "Enviado para Suportes em Espera.",
      });
      setOpen(false);
      reset();
      await onCreated?.(id);
    } catch (error: any) {
      toast.error("Não foi possível criar o suporte", { description: error?.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) setOpen(next); }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <LifeBuoy className="size-4" /> Novo Suporte
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Suporte</DialogTitle>
          <DialogDescription>
            Crie um atendimento mesmo quando ainda não existe um pedido vinculado. Todos os campos são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <section className="rounded-xl border border-border bg-surface-1/40 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold">Empresa</h3>
              <p className="text-[11px] text-muted-foreground">Identificação da empresa que solicita o atendimento.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Razão Social *</Label>
                <Input
                  value={razaoSocial}
                  onChange={event => setRazaoSocial(event.target.value)}
                  placeholder="Razão social da empresa"
                  autoComplete="organization"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>CNPJ *</Label>
                <Input
                  value={cnpj}
                  onChange={event => setCnpj(event.target.value)}
                  placeholder="Digite o CNPJ"
                  required
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface-1/40 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold">Contato responsável</h3>
              <p className="text-[11px] text-muted-foreground">Pessoa com quem o time de suporte vai tratar o atendimento.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Nome completo *</Label>
                <Input
                  value={nome}
                  onChange={event => setNome(event.target.value)}
                  placeholder="Nome do responsável"
                  autoComplete="name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="cliente@empresa.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone *</Label>
                <Input
                  type="tel"
                  value={telefone}
                  onChange={event => setTelefone(formatSupportPhone(event.target.value))}
                  placeholder="(16) 99999-9999"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={15}
                  required
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface-1/40 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold">Atendimento</h3>
              <p className="text-[11px] text-muted-foreground">Explique de forma objetiva o que precisa ser tratado.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Motivo / descrição *</Label>
              <Textarea
                rows={5}
                value={motivo}
                onChange={event => setMotivo(event.target.value)}
                placeholder="Descreva a necessidade do atendimento..."
                required
              />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface-1/40 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold">Direcionamento</h3>
              <p className="text-[11px] text-muted-foreground">Classifique a prioridade e escolha o destino inicial do suporte.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioridade *</Label>
                <Select value={prioridade} onValueChange={value => setPrioridade(value as SupportPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a_tratar">A tratar</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Destino inicial *</Label>
                <Select value={destino} onValueChange={value => setDestino(value as "s-espera" | "s-prevendas")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="s-espera">Suportes em Espera</SelectItem>
                    <SelectItem value="s-prevendas">Pré Vendas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
          <Button className="bg-omni text-black hover:bg-omni-glow" onClick={() => void submit()} disabled={saving}>
            {saving ? "Criando…" : "Criar suporte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
