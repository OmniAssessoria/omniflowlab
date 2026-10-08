import { useEffect, useState } from "react";
import { Building2, Check, ChevronsUpDown, Plus, Sparkles, UserRound } from "lucide-react";
import { useOmni } from "@/lib/omni-store";
import { MESES_LONG, type FunilId } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useCatalogo, useClientesDB, useConsultoresReais, useColaboradoresDB } from "@/lib/catalogos";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { tipoPedidoExigeCedente } from "@/lib/cedente-rules";
import { produtoExigeEndereco } from "@/lib/tipo-produto-catalogo";
import { PartePedidoCadastroDialog } from "@/components/parte-pedido-cadastro-dialog";
import { NUMERO_PEDIDO_NAO_INFORMADO_OMN } from "@/lib/pedido-numero";
import { CatalogoMultiCheckbox } from "@/components/catalogo-multi-checkbox";
import { toast } from "sonner";

const UFS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PIPELINE_NOVA_VENDA_DESTINO = {
  funil_id: "processos_bko",
  etapa_id: "bko-troca",
  nome: "Troca de Carteira | Abertura de Caso",
} as const;

export function NovaVendaDialog({ triggerLabel = "Nova Venda" }: { triggerLabel?: string } = {}) {
  const { mesRef, anoRef, ambiente, reloadFromDb } = useOmni();
  const { user, profile, primaryRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [operadora, setOperadora] = useState(ambiente === "GERAL" ? "CLARO" : ambiente);
  const [clienteId, setClienteId] = useState("");
  const [clienteLabel, setClienteLabel] = useState("");
  const [consultorId, setConsultorId] = useState("");
  const [consultorLabel, setConsultorLabel] = useState("");
  const [tipoPedidosSelecionados, setTipoPedidosSelecionados] = useState<string[]>([]);
  const [produtosSelecionados, setProdutosSelecionados] = useState<string[]>([]);
  const [enderecoCliente, setEnderecoCliente] = useState("");
  const tipoPedido = tipoPedidosSelecionados[0] ?? "";
  const produto = produtosSelecionados[0] ?? "";
  const possuiProdutoComEndereco = produtoExigeEndereco(produtosSelecionados);
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickClientSaving, setQuickClientSaving] = useState(false);
  const [novaRazao, setNovaRazao] = useState("");
  const [novoDocumento, setNovoDocumento] = useState("");
  const [novoContato, setNovoContato] = useState("");
  const [novoDdd, setNovoDdd] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [novaUf, setNovaUf] = useState("");
  const [principalNegociante, setPrincipalNegociante] = useState(true);
  const [principalAssinante, setPrincipalAssinante] = useState(true);
  const [representantesExtras, setRepresentantesExtras] = useState<Array<{
    nome: string;
    ddd: string;
    telefone: string;
    email: string;
    negociante: boolean;
    assinante: boolean;
  }>>([]);

  const [cedentes, setCedentes] = useState<Array<{
    id: string;
    cnpj_cpf: string;
    razao_social: string | null;
    nome: string | null;
    email: string | null;
    telefone: string | null;
  }>>([]);
  const [cessionarios, setCessionarios] = useState<Array<{
    id: string;
    cpf: string;
    nome: string;
    email: string;
  }>>([]);
  const [cedenteIds, setCedenteIds] = useState<string[]>([]);
  const [cessionarioIds, setCessionarioIds] = useState<string[]>([]);
  const [cedenteCadastroOpen, setCedenteCadastroOpen] = useState(false);
  const [cessionarioCadastroOpen, setCessionarioCadastroOpen] = useState(false);

  const { data: dbClientes, refetch: refetchClientes } = useClientesDB();
  const { data: consultoresReais } = useConsultoresReais();
  const { data: colabsDB } = useColaboradoresDB();
  const { data: tiposPedido } = useCatalogo("tipos_pedido_catalogo", operadora);
  const { data: produtos } = useCatalogo("produtos_catalogo", operadora);
  const isConsultor = primaryRole === "consultor";
  const isPrivileged = primaryRole === "admin" || primaryRole === "gestor" || primaryRole === "bko";
  const consultorOptional = primaryRole === "admin" || primaryRole === "bko";
  const clienteSelecionado = dbClientes.find(c => c.id === clienteId);
  const podeGerenciarPartes = primaryRole === "admin" || primaryRole === "gestor" || primaryRole === "bko" || primaryRole === "consultor";

  useEffect(() => {
    setEnderecoCliente(clienteSelecionado?.endereco ?? "");
  }, [clienteSelecionado?.id, clienteSelecionado?.endereco]);

  function resetQuickClient() {
    setNovaRazao("");
    setNovoDocumento("");
    setNovoContato("");
    setNovoDdd("");
    setNovoTelefone("");
    setNovoEmail("");
    setNovaUf("");
    setPrincipalNegociante(true);
    setPrincipalAssinante(true);
    setRepresentantesExtras([]);
  }

  async function carregarPartesDoCliente() {
    if (!clienteId) {
      setCedentes([]);
      setCessionarios([]);
      return;
    }

    const db = supabase as any;
    const [cedentesRes, cessionariosRes] = await Promise.all([
      db
        .from("cliente_cedentes")
        .select("cedente_id,ativo,cedentes(id,cnpj_cpf,razao_social,nome,email,telefone)")
        .eq("cliente_id", clienteId)
        .eq("ativo", true),
      db
        .from("cliente_cessionarios")
        .select("cessionario_id,ativo,cessionarios(id,cpf,nome,email)")
        .eq("cliente_id", clienteId)
        .eq("ativo", true),
    ]);

    if (cedentesRes.error || cessionariosRes.error) {
      console.error("[Nova Venda] Falha ao carregar Cedentes/Cessionários", cedentesRes.error || cessionariosRes.error);
    }

    setCedentes(
      (cedentesRes.data ?? [])
        .map((row: any) => row.cedentes)
        .filter(Boolean)
        .sort((a: any, b: any) =>
          (a.razao_social || a.nome || a.cnpj_cpf).localeCompare(b.razao_social || b.nome || b.cnpj_cpf, "pt-BR"),
        ),
    );
    setCessionarios(
      (cessionariosRes.data ?? [])
        .map((row: any) => row.cessionarios)
        .filter(Boolean)
        .sort((a: any, b: any) => (a.nome || a.cpf).localeCompare(b.nome || b.cpf, "pt-BR")),
    );
  }

  useEffect(() => {
    setCedenteIds([]);
    setCessionarioIds([]);
    setCedenteCadastroOpen(false);
    setCessionarioCadastroOpen(false);
    void carregarPartesDoCliente();
  }, [clienteId]);

  async function criarClienteRapido() {
    if (!user) return toast.error("Sessão expirada");
    const razao = novaRazao.trim();
    const documento = novoDocumento.trim();
    const contato = novoContato.trim();
    const ddd = novoDdd.replace(/\D/g, "");
    const telefone = novoTelefone.replace(/\D/g, "");
    const email = novoEmail.trim();

    if (razao.length < 2) return toast.error("Informe a razão social");
    if (!documento) return toast.error("Informe o CNPJ/CPF");
    if (contato.length < 2) return toast.error("Informe o contato");
    if (ddd.length !== 2) return toast.error("Informe o DDD com 2 dígitos");
    if (telefone.length < 8) return toast.error("Informe um telefone válido");
    if (!EMAIL_REGEX.test(email)) return toast.error("Informe um e-mail válido");
    if (!novaUf) return toast.error("Selecione a UF");

    const temNegociante = principalNegociante || representantesExtras.some(rep => rep.negociante);
    const temAssinante = principalAssinante || representantesExtras.some(rep => rep.assinante);
    if (!temNegociante) return toast.error("Selecione quem será o Negociante da empresa.");
    if (!temAssinante) return toast.error("Selecione quem será o Assinante da empresa.");

    for (let index = 0; index < representantesExtras.length; index += 1) {
      const rep = representantesExtras[index];
      const repDdd = rep.ddd.replace(/\D/g, "");
      const repTelefone = rep.telefone.replace(/\D/g, "");
      if (rep.nome.trim().length < 2) return toast.error(`Informe o nome do Representante ${index + 2}`);
      if (repDdd.length !== 2) return toast.error(`Informe o DDD do Representante ${index + 2}`);
      if (repTelefone.length < 8) return toast.error(`Informe um telefone válido para o Representante ${index + 2}`);
      if (!EMAIL_REGEX.test(rep.email.trim())) return toast.error(`Informe um e-mail válido para o Representante ${index + 2}`);
    }

    setQuickClientSaving(true);
    try {
      const { data: existentes, error: lookupError } = await (supabase as any)
        .rpc("buscar_cliente_por_documento", { p_documento: documento });

      if (lookupError) throw lookupError;

      const existente = Array.isArray(existentes) ? existentes[0] : existentes;
      if (existente?.id) {
        setClienteId(existente.id);
        setClienteLabel(`${existente.razao_social} — ${existente.cnpj_cpf ?? documento}`);
        setQuickClientOpen(false);
        resetQuickClient();
        toast.info("Empresa já cadastrada", {
          description: "Este CNPJ/CPF já existe. A empresa existente foi selecionada para esta venda.",
        });
        return;
      }

      const { data: novoCliente, error } = await supabase
        .from("clientes")
        .insert({
          razao_social: razao,
          cnpj_cpf: documento,
          contato,
          ddd,
          telefone,
          email,
          uf: novaUf,
          operadoras: [],
          consultor_id: primaryRole === "consultor" ? user.id : null,
          created_by: user.id,
          is_deleted: false,
          deleted_at: null,
        })
        .select("id, razao_social, cnpj_cpf")
        .single();

      if (error) {
        // Se dois usuários tentarem cadastrar o mesmo documento ao mesmo tempo,
        // o índice único vence a corrida e reaproveitamos a empresa já criada.
        if ((error as any)?.code === "23505") {
          const { data: concorrentes, error: concorrenteError } = await (supabase as any)
            .rpc("buscar_cliente_por_documento", { p_documento: documento });
          if (concorrenteError) throw concorrenteError;
          const concorrente = Array.isArray(concorrentes) ? concorrentes[0] : concorrentes;
          if (concorrente?.id) {
            setClienteId(concorrente.id);
            setClienteLabel(`${concorrente.razao_social} — ${concorrente.cnpj_cpf ?? documento}`);
            setQuickClientOpen(false);
            resetQuickClient();
            toast.info("Empresa já cadastrada", {
              description: "Outro cadastro com este CNPJ/CPF já existia e foi selecionado.",
            });
            return;
          }
        }
        throw error;
      }

      if (representantesExtras.length > 0) {
        const { error: representantesError } = await (supabase as any)
          .from("cliente_representantes")
          .insert(
            representantesExtras.map((rep, index) => ({
              cliente_id: novoCliente.id,
              nome: rep.nome.trim(),
              ddd: rep.ddd.replace(/\D/g, "") || null,
              telefone: rep.telefone.trim() || null,
              email: rep.email.trim() || null,
              principal: false,
              ordem: index + 1,
              created_by: user.id,
            })),
          );
        if (representantesError) {
          toast.warning("Empresa criada, mas algum representante adicional não foi salvo.", {
            description: representantesError.message,
          });
        } else {
          const { data: representantesSalvos } = await (supabase as any)
            .from("cliente_representantes")
            .select("id, ordem")
            .eq("cliente_id", novoCliente.id)
            .gt("ordem", 0)
            .order("ordem", { ascending: true });

          for (const [index, rep] of representantesExtras.entries()) {
            const salvo = representantesSalvos?.find((item: any) => Number(item.ordem) === index + 1);
            if (!salvo) continue;
            if (rep.negociante) {
              await (supabase as any).rpc("cliente_definir_papel_representante", {
                p_cliente_id: novoCliente.id,
                p_representante_id: salvo.id,
                p_papel: "negociante",
              });
            }
            if (rep.assinante) {
              await (supabase as any).rpc("cliente_definir_papel_representante", {
                p_cliente_id: novoCliente.id,
                p_representante_id: salvo.id,
                p_papel: "assinante",
              });
            }
          }
        }
      }

      await refetchClientes();
      setClienteId(novoCliente.id);
      setClienteLabel(`${novoCliente.razao_social} — ${novoCliente.cnpj_cpf ?? documento}`);
      setQuickClientOpen(false);
      resetQuickClient();
      toast.success("Empresa criada e selecionada");
    } catch (error: any) {
      toast.error("Falha ao criar empresa", { description: error?.message ?? "Erro inesperado" });
    } finally {
      setQuickClientSaving(false);
    }
  }

  async function salvar() {
    if (!user) return toast.error("Sessão expirada");
    if (!clienteId) return toast.error("Selecione um cliente");

    const finalConsultorId = isPrivileged ? (consultorId || null) : user.id;
    const finalConsultor = finalConsultorId
      ? isPrivileged
        ? consultoresReais.find(c => c.id === finalConsultorId) ?? null
        : { id: user.id, nome_completo: profile?.nome_completo ?? user.email ?? "" }
      : null;

    if (primaryRole === "gestor" && !finalConsultorId) {
      return toast.error("Selecione um consultor responsável");
    }
    if (finalConsultorId && !finalConsultor) {
      return toast.error("Consultor selecionado não está mais disponível");
    }

    const cli = dbClientes.find(c => c.id === clienteId);
    if (!cli) return toast.error("Cliente inválido");

    setSaving(true);
    try {
      if (possuiProdutoComEndereco) {
        const enderecoNormalizado = enderecoCliente.trim();
        const enderecoAtual = String(cli.endereco ?? "").trim();

        if (enderecoNormalizado !== enderecoAtual) {
          const { error: enderecoError } = await (supabase as any)
            .from("clientes")
            .update({ endereco: enderecoNormalizado || null })
            .eq("id", cli.id);

          if (enderecoError) {
            throw new Error(`Não foi possível salvar o endereço do cliente: ${enderecoError.message}`);
          }
        }
      }
      const destino = PIPELINE_NOVA_VENDA_DESTINO;
      const [{ data: funilDestino, error: funilDestinoError }, { data: etapaDestino, error: etapaDestinoError }] = await Promise.all([
        (supabase as any)
          .from("pipeline_funis")
          .select("id,nome,ativo")
          .eq("id", PIPELINE_NOVA_VENDA_DESTINO.funil_id)
          .eq("ativo", true)
          .maybeSingle(),
        (supabase as any)
          .from("pipeline_etapas")
          .select("id,nome,funil_id,ativo")
          .eq("id", PIPELINE_NOVA_VENDA_DESTINO.etapa_id)
          .eq("funil_id", PIPELINE_NOVA_VENDA_DESTINO.funil_id)
          .eq("ativo", true)
          .maybeSingle(),
      ]);

      if (funilDestinoError || etapaDestinoError || !funilDestino || !etapaDestino) {
        toast.error("Destino inicial da venda indisponível", {
          description: "Ative Processos BKO → Troca de Carteira | Abertura de Caso em Configurações → Estrutura.",
        });
        return;
      }
      const cedentesResolvidos = tipoPedidoExigeCedente(tipoPedidosSelecionados) ? [...cedenteIds] : [];
      const cessionariosResolvidos = tipoPedidoExigeCedente(tipoPedidosSelecionados) ? [...cessionarioIds] : [];
      const colabVinc = finalConsultorId ? colabsDB.find(c => c.user_id === finalConsultorId) ?? null : null;
      const nomeFinal = finalConsultor ? (colabVinc?.nome_exibicao ?? finalConsultor.nome_completo) : null;
      const { data: vendaCriada, error } = await supabase.from("vendas").insert({
        numero: null as any,
        operadora: operadora as "CLARO" | "VIVO",
        mes_ref: mesRef,
        ano_ref: anoRef,
        cliente_razao_social: cli.razao_social,
        cliente_cnpj: cli.cnpj_cpf ?? "",
        cliente_id: cli.id,
        cliente_contato: cli.contato,
        cliente_telefone: cli.telefone,
        cliente_email: cli.email,
        cliente_uf: cli.uf,
        funil: destino.funil_id as FunilId,
        etapa_id: destino.etapa_id,
        status: "AGUARDANDO ACEITE",
        tipo_pedido: tipoPedidosSelecionados[0] ?? null,
        tipo_pedidos: tipoPedidosSelecionados,
        produto: produtosSelecionados[0] ?? null,
        produtos: produtosSelecionados,
        cedente_id: cedentesResolvidos[0] ?? null,
        quantidade_linhas: 0,
        valor: 0,
        consultor_id: finalConsultorId,
        consultor_colab_id: colabVinc?.id ?? null,
        consultor_nome: nomeFinal,
        created_by: user.id,
        data_recebimento: new Date().toISOString().slice(0, 10),
        proxima_acao: etapaDestino?.nome ?? "Aguardando início",
        proxima_acao_data: new Date().toISOString().slice(0, 10),
        dias_na_etapa: 0,
        sla_status: "ok",
        prioridade: "media",
      } as any).select("id").single();
      if (error) throw error;

      if (cedentesResolvidos.length > 0) {
        const { error: cedentesError } = await (supabase as any)
          .from("venda_cedentes")
          .insert(cedentesResolvidos.map(cedente_id => ({
            venda_id: vendaCriada.id,
            cedente_id,
            created_by: user.id,
          })));
        if (cedentesError) throw cedentesError;
      }

      if (cessionariosResolvidos.length > 0) {
        const { error: cessionariosError } = await (supabase as any)
          .from("venda_cessionarios")
          .insert(cessionariosResolvidos.map(cessionario_id => ({
            venda_id: vendaCriada.id,
            cessionario_id,
            created_by: user.id,
          })));
        if (cessionariosError) throw cessionariosError;
      }

      toast.success("Venda criada", {
        description: `${NUMERO_PEDIDO_NAO_INFORMADO_OMN} adicionada em ${funilDestino?.nome ?? destino.funil_id} → ${etapaDestino?.nome ?? destino.etapa_id}`,
      });
      await reloadFromDb();
      setClienteId("");
      setClienteLabel("");
      setEnderecoCliente("");
      setTipoPedidosSelecionados([]);
      setProdutosSelecionados([]);
      setCedenteIds([]);
      setCessionarioIds([]);
      setCedenteCadastroOpen(false);
      setCessionarioCadastroOpen(false);
      setQuickClientOpen(false);
      resetQuickClient();
      setOpen(false);
    } catch (error: any) {
      toast.error("Falha ao criar venda", { description: error?.message ?? "Erro inesperado" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)] font-semibold shadow-[0_0_20px_-4px_var(--omni)]">
          <Plus className="size-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className={cn(
        "max-h-[86dvh] overflow-y-auto bg-card border-border",
        isConsultor
          ? "w-[min(96vw,980px)] max-w-[980px] px-4 sm:px-5"
          : "w-[min(96vw,1100px)] max-w-[1100px] px-4 sm:px-6",
      )}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="size-4 text-omni" /> Nova Venda</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">Mês ref.</Label>
              <div
                className="flex h-7 items-center rounded-md border border-border/70 bg-surface-1/70 px-2 text-[10px] font-semibold"
                title="Mês de referência fixo para este cadastro"
              >
                {MESES_LONG[mesRef - 1]}/{anoRef}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">Operadora</Label>
              <Select
                value={operadora}
                onValueChange={v => {
                  setOperadora(v as "CLARO" | "VIVO");
                  setTipoPedidosSelecionados([]);
                  setProdutosSelecionados([]);
                  setCedenteIds([]);
                  setCessionarioIds([]);
                  setCedenteCadastroOpen(false);
                  setCessionarioCadastroOpen(false);
                }}
              >
                <SelectTrigger className="h-7 w-[108px] px-2 text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="CLARO">Claro</SelectItem><SelectItem value="VIVO">Vivo</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label>Cliente</Label>
            <ComboBox
              value={clienteId}
              label={clienteLabel}
              placeholder="Buscar cliente (razão, CNPJ, contato)…"
              onChange={(id, label) => { setClienteId(id); setClienteLabel(label); }}
              options={dbClientes.map(c => ({
                id: c.id,
                label: `${c.razao_social}${c.cnpj_cpf ? ` — ${c.cnpj_cpf}` : ""}`,
                hint: `${c.uf ?? ""}${c.ddd ? ` · DDD ${c.ddd}` : ""}${c.operadoras?.length ? ` · ${c.operadoras.join("/")}` : ""}`,
              }))}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-[11px] text-[var(--omni)]"
              onClick={() => setQuickClientOpen(true)}
            >
              <Building2 className="size-3.5" />
              Empresa não encontrada? Criar empresa
            </Button>

            {dbClientes.length === 0 && <div className="text-xs text-muted-foreground italic">Nenhuma empresa disponível. Use “Criar empresa” para cadastrar uma nova.</div>}
          </div>

          {clienteSelecionado && (
            <div className="sm:col-span-2 rounded-lg border border-border bg-surface-1 p-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div><span className="text-muted-foreground">Contato:</span> <span className="font-semibold">{clienteSelecionado.contato ?? "—"}</span></div>
              <div><span className="text-muted-foreground">UF/DDD:</span> {clienteSelecionado.uf ?? "—"} · {clienteSelecionado.ddd ?? "—"}</div>
              <div><span className="text-muted-foreground">Linhas atuais:</span> {clienteSelecionado.qtd_linhas_total}</div>
              <div><span className="text-muted-foreground">Operadoras:</span> {clienteSelecionado.operadoras?.join(", ") || "—"}</div>
            </div>
          )}

          <div className="sm:col-span-2 grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-surface-1/25 p-2 space-y-1">
              <div>
                <Label className="text-[11px] font-semibold">Tipos de pedido</Label>
                <p className="mt-0.5 text-[8px] leading-tight text-muted-foreground">
                  Selecione um ou mais. Itens de grupos diferentes não podem coexistir no mesmo pedido.
                </p>
              </div>

              <CatalogoMultiCheckbox
                items={tiposPedido}
                value={tipoPedidosSelecionados}
                onChange={setTipoPedidosSelecionados}
                emptyLabel="Nenhum Tipo de Pedido selecionado."
                compact
              />
            </div>

            <div className="rounded-lg border border-border/70 bg-surface-1/25 p-2 space-y-1">
              <div>
                <Label className="text-[11px] font-semibold">Produtos</Label>
                <p className="mt-0.5 text-[8px] leading-tight text-muted-foreground">
                  Você pode selecionar vários Produtos, desde que sejam do mesmo grupo.
                </p>
              </div>

              <CatalogoMultiCheckbox
                items={produtos}
                value={produtosSelecionados}
                onChange={setProdutosSelecionados}
                emptyLabel="Nenhum Produto selecionado."
                compact
              />
            </div>
          </div>

          {clienteSelecionado && possuiProdutoComEndereco && (
            <div className="sm:col-span-2 space-y-1.5 rounded-lg border border-border/70 bg-surface-1/25 p-3">
              <Label htmlFor="novo-pedido-endereco" className="text-[11px] font-semibold">ENDEREÇO</Label>
              <Input
                id="novo-pedido-endereco"
                value={enderecoCliente}
                onChange={event => setEnderecoCliente(event.target.value)}
                placeholder="Informe o endereço do cliente"
              />
              <p className="text-[9px] text-muted-foreground">
                Este endereço é salvo no cadastro do cliente e será o mesmo exibido na tela do cliente.
              </p>
            </div>
          )}

          {clienteSelecionado && tipoPedidoExigeCedente(tipoPedidosSelecionados) && (
            <div className="sm:col-span-2 space-y-3 rounded-xl border border-border bg-surface-1/50 p-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-sm font-semibold">Cedente / Cessionário</Label>
                  <Badge variant="outline" className="text-[9px]">Opcional</Badge>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Para estes tipos de pedido, você pode incluir Cedente (PJ) ou Cessionário (PF). O vínculo específico é definido depois em cada linha.
                </p>
              </div>

              {podeGerenciarPartes && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    onClick={() => setCedenteCadastroOpen(true)}
                  >
                    <Building2 className="size-3.5" /> Cadastrar Cedente
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    onClick={() => setCessionarioCadastroOpen(true)}
                  >
                    <UserRound className="size-3.5" /> Cadastrar Cessionário
                  </Button>
                </div>
              )}

              <div className="grid gap-3 lg:grid-cols-2">
                <section className="rounded-lg border border-border bg-card/50 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Building2 className="size-3.5 text-omni" />
                    <div>
                      <div className="text-xs font-semibold">Cedentes</div>
                      <div className="text-[9px] text-muted-foreground">PF ou PJ · CPF/CNPJ e dados de contato</div>
                    </div>
                  </div>

                  {cedentes.length === 0 ? (
                    <div className="text-[10px] text-muted-foreground">Nenhum Cedente cadastrado para esta empresa.</div>
                  ) : (
                    <div className="space-y-2">
                      {cedentes.map(item => {
                        const checked = cedenteIds.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            className={cn(
                              "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors",
                              checked ? "border-[var(--omni)]/50 bg-[var(--omni)]/5" : "border-border bg-background/30",
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={!podeGerenciarPartes}
                              onCheckedChange={() => setCedenteIds(current =>
                                checked ? current.filter(id => id !== item.id) : [...current, item.id]
                              )}
                            />
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold">{item.razao_social || item.nome || "Cedente"}</div>
                              <div className="font-mono text-[9px] text-muted-foreground">
                                {String(item.cnpj_cpf ?? "").replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ"}: {item.cnpj_cpf}
                              </div>
                              <div className="truncate text-[9px] text-muted-foreground">{[item.nome, item.email, item.telefone].filter(Boolean).join(" · ")}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="rounded-lg border border-border bg-card/50 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <UserRound className="size-3.5 text-omni" />
                    <div>
                      <div className="text-xs font-semibold">Cessionários</div>
                      <div className="text-[9px] text-muted-foreground">PF opcional · CPF, Nome e E-mail</div>
                    </div>
                  </div>

                  {cessionarios.length === 0 ? (
                    <div className="text-[10px] text-muted-foreground">Nenhum Cessionário cadastrado para esta empresa.</div>
                  ) : (
                    <div className="space-y-2">
                      {cessionarios.map(item => {
                        const checked = cessionarioIds.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            className={cn(
                              "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors",
                              checked ? "border-[var(--omni)]/50 bg-[var(--omni)]/5" : "border-border bg-background/30",
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={!podeGerenciarPartes}
                              onCheckedChange={() => setCessionarioIds(current =>
                                checked ? current.filter(id => id !== item.id) : [...current, item.id]
                              )}
                            />
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold">{item.nome || "Cessionário"}</div>
                              <div className="font-mono text-[9px] text-muted-foreground">CPF: {item.cpf}</div>
                              <div className="truncate text-[9px] text-muted-foreground">{item.email}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {isPrivileged && (
            <div className="sm:col-span-2 max-w-md space-y-1.5">
              <Label className="text-xs">
                Consultor responsável
                {consultorOptional && <span className="ml-1 text-[9px] font-normal text-muted-foreground">(opcional)</span>}
              </Label>

              {consultoresReais.length === 0 ? (
                <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[10px] text-warning">
                  {consultorOptional
                    ? "Nenhum consultor cadastrado. A venda pode ser criada sem vínculo."
                    : "Nenhum consultor cadastrado. Cadastre um usuário antes de atribuir uma venda."}
                </div>
              ) : (
                <div className="space-y-1">
                  <ComboBox
                    value={consultorId}
                    label={consultorLabel}
                    placeholder={consultorOptional ? "Opcional — selecionar consultor…" : "Buscar consultor cadastrado…"}
                    onChange={(id, label) => { setConsultorId(id); setConsultorLabel(label); }}
                    options={consultoresReais.map(c => ({
                      id: c.id,
                      label: c.nome_completo,
                      hint: `${c.email} · ${c.roles.join(", ")}`,
                    }))}
                  />

                  {consultorOptional && consultorId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[9px] text-muted-foreground"
                      onClick={() => {
                        setConsultorId("");
                        setConsultorLabel("");
                      }}
                    >
                      Deixar sem consultor
                    </Button>
                  )}
                </div>
              )}

              {(() => {
                const colab = consultorId ? colabsDB.find(c => c.user_id === consultorId) : null;
                if (!colab) return null;
                return (
                  <div className="flex items-center gap-1.5 rounded-md border border-[var(--omni)]/25 bg-[var(--omni)]/5 px-2.5 py-1.5 text-[10px]">
                    <span className="text-muted-foreground">Responsável:</span>
                    <span className="font-semibold">{colab.nome_exibicao}</span>
                    {colab.funcao && <Badge variant="outline" className="h-4 px-1.5 text-[8px]">{colab.funcao}</Badge>}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {!isPrivileged ? (
            <div className="mr-auto flex min-w-0 items-center gap-1.5 rounded-md border border-border/60 bg-surface-1/35 px-2 py-1 text-[10px]">
              <span className="text-muted-foreground">Responsável:</span>
              <span className="max-w-[240px] truncate font-semibold">
                {colabsDB.find(c => c.user_id === user?.id)?.nome_exibicao ?? profile?.nome_completo ?? user?.email ?? "Consultor"}
              </span>
            </div>
          ) : <div className="mr-auto" />}

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button className="bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)] gap-2" onClick={() => void salvar()} disabled={saving || !clienteId || (primaryRole === "gestor" && !consultorId)}>
              <Sparkles className="size-4" /> {saving ? "Salvando…" : "Criar Venda"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <Dialog
        open={quickClientOpen}
        onOpenChange={value => {
          if (quickClientSaving) return;
          setQuickClientOpen(value);
          if (!value) resetQuickClient();
        }}
      >
        <DialogContent className="w-[min(94vw,620px)] max-w-[620px] max-h-[84dvh] overflow-y-auto bg-card border-border px-4 sm:px-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-4 text-[var(--omni)]" />
              Cadastrar nova empresa
            </DialogTitle>
            <p className="text-[10px] text-muted-foreground">
              Cadastre a empresa e seus representantes. Ao salvar, ela será selecionada automaticamente na Nova Venda.
            </p>
          </DialogHeader>
          <div className="space-y-2.5">
            <div className="rounded-lg border border-border/70 bg-surface-1/25 p-2.5">
              <div className="mb-2 text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">Dados da empresa</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="sm:col-span-2 space-y-1">
                              <Label className="text-[10px]">Razão social *</Label>
                              <Input className="h-8 text-xs" value={novaRazao} onChange={e => setNovaRazao(e.target.value)} placeholder="Empresa / Razão social" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">CNPJ / CPF *</Label>
                              <Input className="h-8 text-xs" value={novoDocumento} onChange={e => setNovoDocumento(e.target.value)} placeholder="CNPJ/CPF" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">UF *</Label>
                              <Select value={novaUf} onValueChange={setNovaUf}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="UF" /></SelectTrigger>
                                <SelectContent>{UFS_BRASIL.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
          
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-surface-1/25 p-2.5">
              <div className="mb-2">
                <div className="text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">Responsável principal</div>
                <div className="mt-0.5 text-[9px] text-muted-foreground">Toda empresa precisa de pelo menos um representante.</div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1">
                                  <Label className="text-[10px]">Nome *</Label>
                                  <Input className="h-8 text-xs" value={novoContato} onChange={e => setNovoContato(e.target.value)} placeholder="Nome do representante" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px]">DDD *</Label>
                                  <Input className="h-8 text-xs" value={novoDdd} onChange={e => setNovoDdd(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="16" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px]">Telefone *</Label>
                                  <Input className="h-8 text-xs" value={novoTelefone} onChange={e => setNovoTelefone(e.target.value)} placeholder="99999-9999" />
                                </div>
                                <div className="sm:col-span-2 space-y-1">
                                  <Label className="text-[10px]">E-mail *</Label>
                                  <Input className="h-8 text-xs" type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} placeholder="representante@empresa.com" />
                                </div>
          
                                <div className="sm:col-span-2 grid gap-2 sm:grid-cols-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPrincipalNegociante(true);
                                      setRepresentantesExtras(current => current.map(rep => ({ ...rep, negociante: false })));
                                    }}
                                    className={cn(
                                      "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left",
                                      principalNegociante ? "border-[var(--warning)]/40 bg-[var(--warning)]/10" : "border-border bg-background/30",
                                    )}
                                  >
                                    <Checkbox checked={principalNegociante} tabIndex={-1} className="pointer-events-none" />
                                    <div>
                                      <div className="text-[10px] font-bold">Negociante</div>
                                      <div className="text-[8px] text-muted-foreground">Conduz a negociação</div>
                                    </div>
                                  </button>
          
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPrincipalAssinante(true);
                                      setRepresentantesExtras(current => current.map(rep => ({ ...rep, assinante: false })));
                                    }}
                                    className={cn(
                                      "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left",
                                      principalAssinante ? "border-purple/40 bg-purple/10" : "border-border bg-background/30",
                                    )}
                                  >
                                    <Checkbox checked={principalAssinante} tabIndex={-1} className="pointer-events-none" />
                                    <div>
                                      <div className="text-[10px] font-bold">Assinante</div>
                                      <div className="text-[8px] text-muted-foreground">Responsável pela assinatura</div>
                                    </div>
                                  </button>
                                </div>
                              </div>
                            </div>
          
                            {representantesExtras.map((rep, index) => (
                              <div key={index} className="sm:col-span-2 rounded-lg border border-border/70 bg-background/25 p-2.5">
                                <div className="mb-3 flex items-center justify-between gap-2">
                                  <div className="text-xs font-semibold">Representante {index + 2}</div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-[10px] text-destructive hover:text-destructive"
                                    onClick={() => setRepresentantesExtras(current => current.filter((_, itemIndex) => itemIndex !== index))}
                                  >
                                    Remover
                                  </Button>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <div className="sm:col-span-2 space-y-1">
                                    <Label className="text-[10px]">Nome *</Label>
                                    <Input
                                      className="h-8 text-xs"
                                      value={rep.nome}
                                      onChange={event => setRepresentantesExtras(current => current.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, nome: event.target.value } : item
                                      ))}
                                      placeholder="Nome do representante"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px]">DDD *</Label>
                                    <Input
                                      className="h-8 text-xs"
                                      value={rep.ddd}
                                      onChange={event => setRepresentantesExtras(current => current.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, ddd: event.target.value.replace(/\D/g, "").slice(0, 2) } : item
                                      ))}
                                      placeholder="16"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px]">Telefone *</Label>
                                    <Input
                                      className="h-8 text-xs"
                                      value={rep.telefone}
                                      onChange={event => setRepresentantesExtras(current => current.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, telefone: event.target.value } : item
                                      ))}
                                      placeholder="99999-9999"
                                    />
                                  </div>
                                  <div className="sm:col-span-2 space-y-1">
                                    <Label className="text-[10px]">E-mail *</Label>
                                    <Input
                                      className="h-8 text-xs"
                                      type="email"
                                      value={rep.email}
                                      onChange={event => setRepresentantesExtras(current => current.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, email: event.target.value } : item
                                      ))}
                                      placeholder="representante@empresa.com"
                                    />
                                  </div>
          
                                  <div className="sm:col-span-2 grid gap-2 sm:grid-cols-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPrincipalNegociante(false);
                                        setRepresentantesExtras(current => current.map((item, itemIndex) => ({
                                          ...item,
                                          negociante: itemIndex === index,
                                        })));
                                      }}
                                      className={cn(
                                        "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left",
                                        rep.negociante ? "border-[var(--warning)]/40 bg-[var(--warning)]/10" : "border-border bg-background/30",
                                      )}
                                    >
                                      <Checkbox checked={rep.negociante} tabIndex={-1} className="pointer-events-none" />
                                      <div>
                                        <div className="text-[10px] font-bold">Negociante</div>
                                        <div className="text-[8px] text-muted-foreground">Conduz a negociação</div>
                                      </div>
                                    </button>
          
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPrincipalAssinante(false);
                                        setRepresentantesExtras(current => current.map((item, itemIndex) => ({
                                          ...item,
                                          assinante: itemIndex === index,
                                        })));
                                      }}
                                      className={cn(
                                        "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left",
                                        rep.assinante ? "border-purple/40 bg-purple/10" : "border-border bg-background/30",
                                      )}
                                    >
                                      <Checkbox checked={rep.assinante} tabIndex={-1} className="pointer-events-none" />
                                      <div>
                                        <div className="text-[10px] font-bold">Assinante</div>
                                        <div className="text-[8px] text-muted-foreground">Responsável pela assinatura</div>
                                      </div>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
          
                            <div className="sm:col-span-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5"
                                onClick={() => setRepresentantesExtras(current => [
                                  ...current,
                                  { nome: "", ddd: "", telefone: "", email: "", negociante: false, assinante: false },
                                ])}
                              >
                                <Plus className="size-3.5" /> Adicionar outro representante
                              </Button>
                            </div>
            </div>
            <DialogFooter className="mt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setQuickClientOpen(false)}
                disabled={quickClientSaving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5 bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)]"
                onClick={() => void criarClienteRapido()}
                disabled={quickClientSaving}
              >
                <Plus className="size-3.5" /> {quickClientSaving ? "Criando…" : "Criar e selecionar empresa"}
              </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {clienteId && (
        <>
          <PartePedidoCadastroDialog
            tipo="cedente"
            open={cedenteCadastroOpen}
            onOpenChange={setCedenteCadastroOpen}
            clienteId={clienteId}
            onSaved={async item => {
              await carregarPartesDoCliente();
              setCedenteIds(current => current.includes(item.id) ? current : [...current, item.id]);
            }}
          />
          <PartePedidoCadastroDialog
            tipo="cessionario"
            open={cessionarioCadastroOpen}
            onOpenChange={setCessionarioCadastroOpen}
            clienteId={clienteId}
            onSaved={async item => {
              await carregarPartesDoCliente();
              setCessionarioIds(current => current.includes(item.id) ? current : [...current, item.id]);
            }}
          />
        </>
      )}
    </Dialog>
  );
}

function ComboBox({ value, label, options, onChange, placeholder }: {
  value: string;
  label: string;
  options: { id: string; label: string; hint?: string }[];
  onChange: (id: string, label: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between bg-surface-1 font-normal">
          <span className="truncate">{current?.label || label || placeholder}</span>
          <ChevronsUpDown className="size-3.5 opacity-50 ml-2 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[min(560px,90vw)]" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
            <CommandGroup>
              {options.slice(0, 200).map(o => (
                <CommandItem key={o.id} value={`${o.label} ${o.hint ?? ""}`} onSelect={() => { onChange(o.id, o.label); setOpen(false); }}>
                  <Check className={cn("size-3.5 mr-2", o.id === value ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0 flex-1"><div className="truncate text-sm">{o.label}</div>{o.hint && <div className="truncate text-[10px] text-muted-foreground">{o.hint}</div>}</div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
