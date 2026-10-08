import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import {
  AlertTriangle,
  Headphones,
  House,
  ImagePlus,
  Info,
  Loader2,
  MapPin,
  Eye,
  MessageSquare,
  Pencil,
  Plus,
  Tag,
  Trash2,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { canManageObservation } from "@/lib/observacoes-permissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface VendaObservacao {
  id: string;
  venda_id: string;
  texto: string;
  created_by: string;
  autor_nome: string;
  autor_perfil: string;
  created_at: string;
  updated_at: string;
  tag_id: string | null;
  tag_nome_snapshot: string | null;
  tag_cor_snapshot: string | null;
  tag_icone_snapshot: string | null;
  tag_slug_snapshot: string | null;
  imagens: string[];
}

interface ObservacaoTag {
  id: string;
  nome: string;
  slug: string;
  cor: string;
  icone: string;
  ativo: boolean;
  ordem: number;
}

const TAG_COLORS = {
  red: {
    label: "Vermelho",
    chip: "border-red-500/45 bg-red-500/10 text-red-300",
    card: "border-red-500/35 bg-red-500/[0.055] shadow-[inset_3px_0_0_rgba(239,68,68,0.85)]",
    dot: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)]",
    icon: "text-red-400",
  },
  blue: {
    label: "Azul",
    chip: "border-blue-500/45 bg-blue-500/10 text-blue-300",
    card: "border-blue-500/35 bg-blue-500/[0.055] shadow-[inset_3px_0_0_rgba(59,130,246,0.85)]",
    dot: "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.9)]",
    icon: "text-blue-400",
  },
  yellow: {
    label: "Amarelo",
    chip: "border-yellow-500/45 bg-yellow-500/10 text-yellow-300",
    card: "border-yellow-500/35 bg-yellow-500/[0.045] shadow-[inset_3px_0_0_rgba(234,179,8,0.85)]",
    dot: "bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.9)]",
    icon: "text-yellow-400",
  },
  emerald: {
    label: "Verde",
    chip: "border-emerald-500/45 bg-emerald-500/10 text-emerald-300",
    card: "border-emerald-500/35 bg-emerald-500/[0.05] shadow-[inset_3px_0_0_rgba(16,185,129,0.85)]",
    dot: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]",
    icon: "text-emerald-400",
  },
  violet: {
    label: "Roxo",
    chip: "border-violet-500/45 bg-violet-500/10 text-violet-300",
    card: "border-violet-500/35 bg-violet-500/[0.05] shadow-[inset_3px_0_0_rgba(139,92,246,0.85)]",
    dot: "bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.9)]",
    icon: "text-violet-400",
  },
  orange: {
    label: "Laranja",
    chip: "border-orange-500/45 bg-orange-500/10 text-orange-300",
    card: "border-orange-500/35 bg-orange-500/[0.05] shadow-[inset_3px_0_0_rgba(249,115,22,0.85)]",
    dot: "bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.9)]",
    icon: "text-orange-400",
  },
  cyan: {
    label: "Ciano",
    chip: "border-cyan-500/45 bg-cyan-500/10 text-cyan-300",
    card: "border-cyan-500/35 bg-cyan-500/[0.05] shadow-[inset_3px_0_0_rgba(6,182,212,0.85)]",
    dot: "bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.9)]",
    icon: "text-cyan-400",
  },
  slate: {
    label: "Cinza",
    chip: "border-slate-500/45 bg-slate-500/10 text-slate-300",
    card: "border-slate-500/35 bg-slate-500/[0.05] shadow-[inset_3px_0_0_rgba(100,116,139,0.85)]",
    dot: "bg-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.7)]",
    icon: "text-slate-400",
  },
} as const;

type TagColor = keyof typeof TAG_COLORS;

const TAG_ICONS = {
  "message-square": MessageSquare,
  "x-circle": XCircle,
  headphones: Headphones,
  house: House,
  "alert-triangle": AlertTriangle,
  info: Info,
  "map-pin": MapPin,
  tag: Tag,
} as const;

type TagIconKey = keyof typeof TAG_ICONS;

const observacoesTable = () => (supabase.from as any)("venda_observacoes");
const tagsTable = () => (supabase.from as any)("observacao_tags_catalogo");

function fmtDataHora(value: string) {
  const data = new Date(value);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function perfilLabel(value: string) {
  const labels: Record<string, string> = {
    admin: "Administrador",
    gestor: "Gestor",
    consultor: "Consultor",
    bko: "BKO",
  };
  return labels[value] ?? value;
}

export function ObservacoesPedido({ vendaId }: { vendaId: string }) {
  const { user, profile, roles } = useAuth();
  const [itens, setItens] = useState<VendaObservacao[]>([]);
  const [tags, setTags] = useState<ObservacaoTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [notasOpen, setNotasOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [selectedTagId, setSelectedTagId] = useState("");
  const [editando, setEditando] = useState<VendaObservacao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<VendaObservacao | null>(null);
  const [imagemFiles, setImagemFiles] = useState<File[]>([]);
  const [imagensMantidas, setImagensMantidas] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagFormOpen, setTagFormOpen] = useState(false);
  const [tagEditando, setTagEditando] = useState<ObservacaoTag | null>(null);
  const [tagNome, setTagNome] = useState("");
  const [tagCor, setTagCor] = useState<TagColor>("yellow");
  const [tagIcone, setTagIcone] = useState<TagIconKey>("tag");
  const [tagSaving, setTagSaving] = useState(false);

  const autorNome = profile?.nome_completo ?? user?.email ?? "Usuário";
  const autorPerfil = roles[0] ?? "usuario";
  const canManageTags = roles.includes("admin") || roles.includes("bko");
  const canUploadImages = roles.some(role => ["admin", "gestor", "bko", "consultor"].includes(role));
  const mediaInputRef = useRef<HTMLInputElement | null>(null);

  const selectedTag = useMemo(
    () => tags.find(tagItem => tagItem.id === selectedTagId) ?? null,
    [tags, selectedTagId],
  );

  const novasImagemPreviews = useMemo(
    () => imagemFiles.map(file => ({
      key: `${file.name}::${file.size}::${file.lastModified}`,
      file,
      url: URL.createObjectURL(file),
    })),
    [imagemFiles],
  );

  useEffect(() => {
    return () => {
      for (const item of novasImagemPreviews) URL.revokeObjectURL(item.url);
    };
  }, [novasImagemPreviews]);

  const placeholderObservacao = selectedTag?.slug === "endereco"
    ? "Digite o endereço completo, número, complemento e ponto de referência…"
    : "Digite a observação do pedido…";

  const loadTags = useCallback(async () => {
    const { data, error } = await tagsTable()
      .select("id, nome, slug, cor, icone, ativo, ordem")
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });

    if (error) {
      console.error("[ObservacoesPedido] Falha ao carregar tags", error);
      toast.error("Não foi possível carregar as tags", { description: error.message });
      return;
    }
    setTags((data ?? []) as ObservacaoTag[]);
  }, []);

  const load = useCallback(async () => {
    if (!vendaId) return;
    setLoading(true);
    const { data, error } = await observacoesTable()
      .select("id, venda_id, texto, created_by, autor_nome, autor_perfil, created_at, updated_at, tag_id, tag_nome_snapshot, tag_cor_snapshot, tag_icone_snapshot, tag_slug_snapshot, imagens")
      .eq("venda_id", vendaId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ObservacoesPedido] Falha ao carregar", error);
      toast.error("Não foi possível carregar as observações", { description: error.message });
      setLoading(false);
      return;
    }

    const observacoes = ((data ?? []) as VendaObservacao[]).map(item => ({
      ...item,
      imagens: Array.isArray(item.imagens) ? item.imagens : [],
    }));
    setItens(observacoes);

    const paths = Array.from(new Set(observacoes.flatMap(item => item.imagens ?? [])));
    if (paths.length === 0) {
      setImageUrls({});
    } else {
      const { data: signedData, error: signedError } = await supabase.storage
        .from("venda-observacoes")
        .createSignedUrls(paths, 21_600);

      if (signedError) {
        console.error("[ObservacoesPedido] Falha ao assinar imagens", signedError);
      } else {
        const nextUrls: Record<string, string> = {};
        for (const item of signedData ?? []) {
          if (item.path && item.signedUrl) nextUrls[item.path] = item.signedUrl;
        }
        setImageUrls(nextUrls);
      }
    }

    setLoading(false);
  }, [vendaId]);

  useEffect(() => {
    void load();
    void loadTags();
  }, [load, loadTags]);

  useEffect(() => {
    if (!vendaId) return;
    const channel = supabase
      .channel(`venda-observacoes-${vendaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "venda_observacoes", filter: `venda_id=eq.${vendaId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vendaId, load]);

  useEffect(() => {
    const channel = supabase
      .channel("observacao-tags-catalogo")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "observacao_tags_catalogo" },
        () => loadTags(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTags]);

  useEffect(() => {
    if (!modalOpen || editando || selectedTagId || tags.length === 0) return;
    const tagPadrao = tags.find(tagItem => tagItem.slug === "observacao" && tagItem.ativo) ?? tags.find(tagItem => tagItem.ativo);
    if (tagPadrao) setSelectedTagId(tagPadrao.id);
  }, [modalOpen, editando, selectedTagId, tags]);

  const totalLabel = useMemo(() => {
    if (itens.length === 0) return "Nenhuma observação";
    if (itens.length === 1) return "1 observação";
    return `${itens.length} observações`;
  }, [itens.length]);

  function abrirNova() {
    setEditando(null);
    setTexto("");
    setImagemFiles([]);
    setImagensMantidas([]);
    const tagPadrao = tags.find(tagItem => tagItem.slug === "observacao" && tagItem.ativo) ?? tags.find(tagItem => tagItem.ativo);
    setSelectedTagId(tagPadrao?.id ?? "");
    setModalOpen(true);
  }

  function abrirEdicao(item: VendaObservacao) {
    if (!user || !canManageObservation(user.id, item.created_by)) return;
    setNotasOpen(false);
    setEditando(item);
    setTexto(item.texto);
    setImagemFiles([]);
    setImagensMantidas(item.imagens ?? []);
    const atual = tags.find(tagItem => tagItem.id === item.tag_id)
      ?? tags.find(tagItem => tagItem.slug === item.tag_slug_snapshot);
    setSelectedTagId(atual?.id ?? "");
    setModalOpen(true);
  }

  function normalizeImageName(name: string) {
    const clean = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
    return clean || "imagem";
  }

  function adicionarImagensSelecionadas(files: File[]) {
    if (!canUploadImages || files.length === 0) return;

    if (files.length > 1) {
      toast.info("A observação aceita somente 1 imagem. A primeira imagem foi selecionada.");
    }

    const file = files[0];
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast.error(`${file.name}: formato de imagem não permitido.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`${file.name}: a imagem deve ter no máximo 10 MB.`);
      return;
    }

    // Uma imagem por observação: uma nova seleção substitui a anterior.
    setImagemFiles([file]);
    setImagensMantidas([]);
  }

  function colarImagemDaAreaDeTransferencia(event: ClipboardEvent) {
    if (!canUploadImages || salvando) return;

    const imagem = Array.from(event.clipboardData.items)
      .find(item => item.kind === "file" && item.type.startsWith("image/"))
      ?.getAsFile();

    if (!imagem) return;

    event.preventDefault();
    const extensao = imagem.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
    const arquivo = new File(
      [imagem],
      `imagem-colada-${Date.now()}.${extensao}`,
      { type: imagem.type, lastModified: Date.now() },
    );
    adicionarImagensSelecionadas([arquivo]);
    toast.success("Imagem colada na observação.");
  }

  async function uploadImagens(observacaoId: string) {
    if (!canUploadImages || imagemFiles.length === 0) return [] as string[];

    const file = imagemFiles[0];
    const uploaded: string[] = [];
    try {
      const path = `${vendaId}/${observacaoId}/${crypto.randomUUID()}-${normalizeImageName(file.name)}`;
      const { error } = await supabase.storage
        .from("venda-observacoes")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
      if (error) throw error;
      uploaded.push(path);
      return uploaded;
    } catch (error) {
      if (uploaded.length > 0) {
        await supabase.storage.from("venda-observacoes").remove(uploaded);
      }
      throw error;
    }
  }

  async function salvar() {
    const valor = texto.trim();
    if (!valor) {
      toast.error("Digite uma observação antes de salvar.");
      return;
    }
    if (!user) {
      toast.error("Sua sessão expirou. Entre novamente.");
      return;
    }
    if (!editando && !selectedTag) {
      toast.error("Selecione uma tag para a observação.");
      return;
    }

    setSalvando(true);
    try {
      if (editando) {
        if (!canManageObservation(user.id, editando.created_by)) {
          toast.error("Você só pode editar observações criadas por você.");
          return;
        }

        const novasImagens = canUploadImages ? await uploadImagens(editando.id) : [];
        const imagensFinais = canUploadImages
          ? [...imagensMantidas, ...novasImagens].slice(0, 1)
          : (editando.imagens ?? []).slice(0, 1);

        const patch: Record<string, unknown> = {
          texto: valor,
          updated_at: new Date().toISOString(),
          ...(canUploadImages ? { imagens: imagensFinais } : {}),
        };
        if (selectedTag) {
          patch.tag_id = selectedTag.id;
          patch.tag_nome_snapshot = selectedTag.nome;
          patch.tag_cor_snapshot = selectedTag.cor;
          patch.tag_icone_snapshot = selectedTag.icone;
          patch.tag_slug_snapshot = selectedTag.slug;
        }

        const { error } = await observacoesTable()
          .update(patch)
          .eq("id", editando.id)
          .eq("created_by", user.id);

        if (error) {
          if (novasImagens.length > 0) {
            await supabase.storage.from("venda-observacoes").remove(novasImagens);
          }
          throw error;
        }

        if (canUploadImages) {
          const removidas = (editando.imagens ?? []).filter(path => !imagensMantidas.includes(path));
          if (removidas.length > 0) {
            const { error: removeError } = await supabase.storage.from("venda-observacoes").remove(removidas);
            if (removeError) console.error("[ObservacoesPedido] Falha ao remover imagem antiga", removeError);
          }
        }

        toast.success("Observação atualizada.");
      } else {
        const observacaoId = crypto.randomUUID();
        const novasImagens = canUploadImages ? await uploadImagens(observacaoId) : [];

        const { error } = await observacoesTable().insert({
          id: observacaoId,
          venda_id: vendaId,
          texto: valor,
          created_by: user.id,
          autor_nome: autorNome,
          autor_perfil: autorPerfil,
          tag_id: selectedTag!.id,
          tag_nome_snapshot: selectedTag!.nome,
          tag_cor_snapshot: selectedTag!.cor,
          tag_icone_snapshot: selectedTag!.icone,
          tag_slug_snapshot: selectedTag!.slug,
          imagens: novasImagens,
        });

        if (error) {
          if (novasImagens.length > 0) {
            await supabase.storage.from("venda-observacoes").remove(novasImagens);
          }
          throw error;
        }
        toast.success("Observação adicionada.");
      }

      setModalOpen(false);
      setTexto("");
      setSelectedTagId("");
      setEditando(null);
      setImagemFiles([]);
      setImagensMantidas([]);
      await load();
    } catch (error: any) {
      console.error("[ObservacoesPedido] Falha ao salvar", error);
      toast.error("Não foi possível salvar a observação", { description: error?.message });
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (!excluindo || !user) return;
    if (!canManageObservation(user.id, excluindo.created_by)) {
      toast.error("Você só pode excluir observações criadas por você.");
      setExcluindo(null);
      return;
    }

    const { error } = await observacoesTable()
      .delete()
      .eq("id", excluindo.id)
      .eq("created_by", user.id);

    if (error) {
      toast.error("Não foi possível excluir a observação", { description: error.message });
      return;
    }

    if (canUploadImages && (excluindo.imagens?.length ?? 0) > 0) {
      const { error: storageError } = await supabase.storage
        .from("venda-observacoes")
        .remove(excluindo.imagens);
      if (storageError) {
        console.error("[ObservacoesPedido] Observação removida, mas imagem ficou pendente de limpeza", storageError);
      }
    }

    toast.success("Observação excluída.");
    setExcluindo(null);
    await load();
  }

  function abrirNovaTag() {
    setTagEditando(null);
    setTagNome("");
    setTagCor("yellow");
    setTagIcone("tag");
    setTagFormOpen(true);
  }

  function abrirEditarTag(tagItem: ObservacaoTag) {
    setTagEditando(tagItem);
    setTagNome(tagItem.nome);
    setTagCor((tagItem.cor in TAG_COLORS ? tagItem.cor : "yellow") as TagColor);
    setTagIcone((tagItem.icone in TAG_ICONS ? tagItem.icone : "tag") as TagIconKey);
    setTagFormOpen(true);
  }

  async function salvarTag() {
    if (!canManageTags) return;
    const nome = tagNome.trim();
    if (!nome) {
      toast.error("Digite o nome da tag.");
      return;
    }

    setTagSaving(true);
    try {
      if (tagEditando) {
        const { error } = await tagsTable()
          .update({
            nome,
            cor: tagCor,
            icone: tagIcone,
            updated_at: new Date().toISOString(),
          })
          .eq("id", tagEditando.id);
        if (error) throw error;
        toast.success("Tag atualizada.");
      } else {
        const slug = nome
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || `tag-${Date.now()}`;

        const proximaOrdem = tags.reduce((maior, tagItem) => Math.max(maior, tagItem.ordem ?? 0), 0) + 10;
        const { error } = await tagsTable().insert({
          nome,
          slug,
          cor: tagCor,
          icone: tagIcone,
          ativo: true,
          ordem: proximaOrdem,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
        toast.success("Tag criada.");
      }

      setTagFormOpen(false);
      setTagEditando(null);
      await loadTags();
    } catch (error: any) {
      toast.error("Não foi possível salvar a tag", { description: error?.message });
    } finally {
      setTagSaving(false);
    }
  }

  async function excluirTag(tagItem: ObservacaoTag) {
    if (!canManageTags) return;
    const confirmou = window.confirm(
      `Excluir a tag “${tagItem.nome}”? Observações antigas continuarão com o nome, a cor e o ícone originais.`,
    );
    if (!confirmou) return;

    const { error } = await tagsTable().delete().eq("id", tagItem.id);
    if (error) {
      toast.error("Não foi possível excluir a tag", { description: error.message });
      return;
    }

    if (selectedTagId === tagItem.id) setSelectedTagId("");
    toast.success("Tag excluída. O histórico antigo foi preservado.");
    await loadTags();
  }

  function renderObservacaoCard(item: VendaObservacao) {
    const minha = Boolean(user && canManageObservation(user.id, item.created_by));
    const editada = new Date(item.updated_at).getTime() - new Date(item.created_at).getTime() > 1000;
    const iniciais = item.autor_nome
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(parte => parte[0]?.toUpperCase() ?? "")
      .join("") || "U";
    const cor = (item.tag_cor_snapshot ?? "yellow") as TagColor;
    const tone = TAG_COLORS[cor] ?? TAG_COLORS.yellow;
    const iconKey = (item.tag_icone_snapshot ?? "message-square") as TagIconKey;
    const TagIcon = TAG_ICONS[iconKey] ?? MessageSquare;
    const tagNomeSnapshot = item.tag_nome_snapshot ?? "Observação";

    return (
      <div key={item.id} className={cn("rounded-lg border p-3.5 transition-colors", tone.card)}>
        <div className="flex items-start gap-3">
          <div className="size-9 shrink-0 rounded-full bg-[var(--omni)]/15 border border-[var(--omni)]/25 grid place-items-center text-[11px] font-bold text-[var(--omni)]">
            {iniciais}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold">{item.autor_nome}</span>
              <span className="text-[10px] uppercase tracking-wider rounded border border-border px-1.5 py-0.5 text-muted-foreground">
                {perfilLabel(item.autor_perfil)}
              </span>
              <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", tone.chip)}>
                <span className={cn("size-1.5 rounded-full", tone.dot)} />
                <TagIcon className={cn("size-3", tone.icon)} />
                {tagNomeSnapshot}
              </span>
              <span className="text-[11px] text-muted-foreground">{fmtDataHora(item.created_at)}</span>
              {editada && <span className="text-[10px] text-muted-foreground italic">Editada</span>}
            </div>

            <div className="text-sm mt-2 whitespace-pre-wrap break-words text-foreground/95">{item.texto}</div>

            {(item.imagens?.length ?? 0) > 0 && (() => {
              const path = item.imagens[0];
              const url = imageUrls[path];
              return (
                <div className="mt-3 max-w-md">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="group block overflow-hidden rounded-lg border border-border bg-background/30"
                      title="Abrir imagem da observação"
                    >
                      <img
                        src={url}
                        alt="Imagem da observação"
                        loading="lazy"
                        className="max-h-64 w-full object-contain transition-transform duration-200 group-hover:scale-[1.01]"
                      />
                    </a>
                  ) : (
                    <div className="grid h-40 place-items-center rounded-lg border border-border bg-background/25 text-[10px] text-muted-foreground">
                      Carregando imagem…
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {minha && (
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="size-7" title="Editar observação" onClick={() => abrirEdicao(item)}>
                <Pencil className="size-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive" title="Excluir observação" onClick={() => setExcluindo(item)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-[var(--omni)]" />
          <h3 className="font-display font-semibold text-sm">Observações do Pedido</h3>
          <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border border-border bg-surface-1 text-muted-foreground">
            {totalLabel}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => setNotasOpen(true)}
            disabled={itens.length === 0}
          >
            <Eye className="size-3.5" /> Visualizar notas
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={abrirNova}>
            <Plus className="size-3.5" /> Adicionar observação
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground text-center py-6">Carregando observações…</div>
      ) : itens.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-1/40 px-4 py-7 text-center">
          <MessageSquare className="size-6 mx-auto mb-2 text-muted-foreground/50" />
          <div className="text-sm font-medium">Nenhuma observação registrada</div>
          <div className="text-xs text-muted-foreground mt-1">Use este espaço para registrar informações importantes sobre o pedido.</div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Observação mais recente
          </div>
          {renderObservacaoCard(itens[0])}
        </div>
      )}

      <Dialog open={notasOpen} onOpenChange={setNotasOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="size-4 text-[var(--omni)]" />
              Todas as observações
            </DialogTitle>
            <DialogDescription>
              {totalLabel} · da mais recente para a mais antiga.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[68vh] overflow-y-auto pr-1">
            <div className="space-y-3">
              {itens.map(item => renderObservacaoCard(item))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modalOpen} onOpenChange={open => {
        setModalOpen(open);
        if (!open) {
          setEditando(null);
          setTexto("");
          setSelectedTagId("");
          setImagemFiles([]);
          setImagensMantidas([]);
        }
      }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar observação" : "Adicionar observação"}</DialogTitle>
            <DialogDescription>
              {editando
                ? "Atualize a observação e, se necessário, altere sua categoria."
                : "Escolha a categoria para que a informação fique visualmente fácil de identificar no pedido."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">Tipo da observação</Label>
                {canManageTags && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setTagsOpen(true)}>
                    <Tag className="size-3.5" /> Gerenciar tags
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.filter(tagItem => tagItem.ativo).map(tagItem => {
                  const cor = (tagItem.cor in TAG_COLORS ? tagItem.cor : "yellow") as TagColor;
                  const tone = TAG_COLORS[cor];
                  const iconKey = (tagItem.icone in TAG_ICONS ? tagItem.icone : "tag") as TagIconKey;
                  const TagIcon = TAG_ICONS[iconKey];
                  const selected = selectedTagId === tagItem.id;
                  return (
                    <button
                      key={tagItem.id}
                      type="button"
                      onClick={() => setSelectedTagId(tagItem.id)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all",
                        tone.chip,
                        selected ? "ring-2 ring-white/20 scale-[1.02]" : "opacity-70 hover:opacity-100",
                      )}
                    >
                      <span className={cn("size-2 rounded-full", tone.dot)} />
                      <TagIcon className={cn("size-3.5", tone.icon)} />
                      {tagItem.nome}
                    </button>
                  );
                })}
              </div>
              {editando && !selectedTag && editando.tag_nome_snapshot && (
                <div className="rounded-lg border border-border bg-surface-1 px-3 py-2 text-xs text-muted-foreground">
                  Tag histórica: <strong className="text-foreground">{editando.tag_nome_snapshot}</strong>. Ela não existe mais no catálogo; selecione outra somente se quiser reclassificar esta observação.
                </div>
              )}
            </div>

            {selectedTag?.slug === "endereco" && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2.5 text-xs">
                <House className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-emerald-300">Endereço / instalação / entrega</div>
                  <div className="text-muted-foreground mt-0.5">Informe o endereço completo e, se necessário, complemento e ponto de referência.</div>
                </div>
              </div>
            )}

            <Textarea
              rows={6}
              value={texto}
              onChange={event => setTexto(event.target.value)}
              onPaste={colarImagemDaAreaDeTransferencia}
              placeholder={placeholderObservacao}
              autoFocus
            />

            {canUploadImages && (
              <div
                className="space-y-2 rounded-xl border border-border bg-surface-1/45 p-3"
                onPaste={colarImagemDaAreaDeTransferencia}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ImagePlus className="size-4 text-purple" />
                    <div>
                      <div className="text-xs font-semibold">Mídia da observação</div>
                      <div className="text-[10px] text-muted-foreground">
                        Máximo de 1 imagem · JPEG, PNG, WebP ou GIF · até 10 MB
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    disabled={salvando}
                    onClick={() => mediaInputRef.current?.click()}
                  >
                    <ImagePlus className="size-3.5" /> + mídia
                  </Button>

                  <input
                    ref={mediaInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={salvando}
                    onChange={event => {
                      adicionarImagensSelecionadas(Array.from(event.target.files ?? []));
                      event.currentTarget.value = "";
                    }}
                  />
                </div>

                <div className="text-[10px] text-muted-foreground">
                  Você também pode copiar uma imagem e usar <span className="font-semibold text-foreground">Ctrl+V</span> dentro do texto da observação ou nesta área. Uma nova imagem substitui a anterior.
                </div>

                {(imagensMantidas.length > 0 || novasImagemPreviews.length > 0) && (
                  <div className="max-w-sm">
                    {imagensMantidas.slice(0, 1).map(path => {
                      const url = imageUrls[path];
                      return (
                        <div key={path} className="relative overflow-hidden rounded-lg border border-border bg-background/30">
                          {url ? (
                            <img src={url} alt="Imagem atual da observação" className="max-h-56 w-full object-contain" />
                          ) : (
                            <div className="grid h-40 place-items-center text-[10px] text-muted-foreground">Imagem atual</div>
                          )}
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            className="absolute right-1 top-1 size-6"
                            onClick={() => setImagensMantidas([])}
                            title="Remover imagem da observação"
                          >
                            <XCircle className="size-3.5" />
                          </Button>
                        </div>
                      );
                    })}

                    {novasImagemPreviews.slice(0, 1).map(item => (
                      <div key={item.key} className="relative overflow-hidden rounded-lg border border-purple/25 bg-purple/[0.035]">
                        <img src={item.url} alt={item.file.name} className="max-h-56 w-full object-contain" />
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          className="absolute right-1 top-1 size-6"
                          onClick={() => setImagemFiles([])}
                          title="Remover da seleção"
                        >
                          <XCircle className="size-3.5" />
                        </Button>
                        <div className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-[9px] text-white" title={item.file.name}>
                          {item.file.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={salvando}>Cancelar</Button>
            <Button
              onClick={salvar}
              disabled={salvando || !texto.trim() || (!editando && !selectedTag)}
              className="bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)]"
            >
              {salvando && <Loader2 className="mr-2 size-4 animate-spin" />}
              {salvando ? "Salvando…" : editando ? "Salvar alteração" : "Adicionar observação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tagsOpen} onOpenChange={open => {
        setTagsOpen(open);
        if (!open) {
          setTagFormOpen(false);
          setTagEditando(null);
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Tag className="size-4 text-[var(--omni)]" /> Gerenciar tags</DialogTitle>
            <DialogDescription>
              Admin e BKO podem criar, editar e excluir categorias. Observações antigas mantêm o nome, a cor e o ícone que possuíam quando foram registradas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">{tags.length} tag(s) cadastrada(s)</div>
              <Button size="sm" className="gap-1.5 bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)]" onClick={abrirNovaTag}>
                <Plus className="size-3.5" /> Nova tag
              </Button>
            </div>

            <div className="space-y-2">
              {tags.map(tagItem => {
                const cor = (tagItem.cor in TAG_COLORS ? tagItem.cor : "yellow") as TagColor;
                const tone = TAG_COLORS[cor];
                const iconKey = (tagItem.icone in TAG_ICONS ? tagItem.icone : "tag") as TagIconKey;
                const TagIcon = TAG_ICONS[iconKey];
                return (
                  <div key={tagItem.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-1/50 px-3 py-2.5">
                    <span className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold", tone.chip)}>
                      <span className={cn("size-2 rounded-full", tone.dot)} />
                      <TagIcon className={cn("size-3.5", tone.icon)} />
                      {tagItem.nome}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">{tagItem.slug}</span>
                    <div className="ml-auto flex gap-1">
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => abrirEditarTag(tagItem)} title="Editar tag">
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={() => void excluirTag(tagItem)} title="Excluir tag">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={tagFormOpen} onOpenChange={setTagFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tagEditando ? "Editar tag" : "Nova tag"}</DialogTitle>
            <DialogDescription>Escolha um nome, uma cor e um ícone. A combinação aparecerá nas observações do pedido.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={tagNome} onChange={event => setTagNome(event.target.value)} placeholder="Ex.: Pendência financeira" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <Select value={tagCor} onValueChange={value => setTagCor(value as TagColor)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TAG_COLORS) as TagColor[]).map(colorKey => (
                      <SelectItem key={colorKey} value={colorKey}>
                        <span className="flex items-center gap-2">
                          <span className={cn("size-2 rounded-full", TAG_COLORS[colorKey].dot)} />
                          {TAG_COLORS[colorKey].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Ícone</Label>
                <Select value={tagIcone} onValueChange={value => setTagIcone(value as TagIconKey)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TAG_ICONS) as TagIconKey[]).map(iconKey => {
                      const Icon = TAG_ICONS[iconKey];
                      return (
                        <SelectItem key={iconKey} value={iconKey}>
                          <span className="flex items-center gap-2"><Icon className="size-3.5" /> {iconKey}</span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface-1 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Prévia</div>
              {(() => {
                const tone = TAG_COLORS[tagCor];
                const Icon = TAG_ICONS[tagIcone];
                return (
                  <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold", tone.chip)}>
                    <span className={cn("size-2 rounded-full", tone.dot)} />
                    <Icon className={cn("size-3.5", tone.icon)} />
                    {tagNome.trim() || "Nome da tag"}
                  </span>
                );
              })()}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTagFormOpen(false)} disabled={tagSaving}>Cancelar</Button>
            <Button onClick={() => void salvarTag()} disabled={tagSaving || !tagNome.trim()} className="bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)]">
              {tagSaving ? "Salvando…" : tagEditando ? "Salvar alterações" : "Criar tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(excluindo)} onOpenChange={open => !open && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir observação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta observação será removida do histórico visível do pedido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir observação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
