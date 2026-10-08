const FUNIL_LABELS: Record<string, string> = {
  prospeccao: "Prospecção",
  follow_up: "Follow Up",
  followup: "Follow Up",
  follow: "Follow Up",
  processos_bko: "Processos BKO",
  bko: "Processos BKO",
  assinatura: "Assinatura",
  suporte: "Suporte",
};

const ETAPA_LABELS: Record<string, string> = {
  "p-espera": "Aguardando Início",
  "p-d1-lig": "Dia 1 - Ligação",
  "p-d2-lig": "Dia 2 - Ligação",
  "p-d2-whats": "Dia 2 - WhatsApp",
  "p-d3-lig": "Dia 3 - Ligação",
  "p-d4-lig": "Dia 4 - Ligação",
  "p-d4-whats": "Dia 4 - WhatsApp",
  "p-d5-lig": "Dia 5 - Ligação",
  "p-d5-declinio": "Dia 5 - Declínio WhatsApp",
  "p-proposta": "Montar Proposta",
  "f-proposta": "Montar Proposta",
  "f-troca-carteira": "Troca de Carteira",
  "f-d1": "Dia 1 - Follow Up",
  "f-d2": "Dia 2 - Follow Up",
  "f-d3": "Dia 3 - Follow Up",
  "f-d4-apoio": "Dia 4 - Apoio Gestão",
  "f-d5": "Dia 5 - Follow Up",
  "f-d6": "Dia 6 - Follow Up",
  "f-d7-declinio": "Dia 7 - Declínio WhatsApp",
  "f-contrato": "Preenchimento de Contrato",
  "bko-pendente": "Pendente Consultor",
  "bko-apoio": "Apoio Gestão",
  "bko-troca-carteira": "Troca de Carteira | Abertura de Caso",
  "bko-montar-pedido": "Montar Pedido",
  "bko-suporte": "Tratativa de Suporte",
  "bko-tempo-input": "Tempo para Input",
  "bko-preenchimento": "Enviado para Preenchimento",
  "bko-assinatura": "Aguardando Assinatura",
  "a-aguardando": "Aguardando Assinatura",
  "s-espera": "Suportes em Espera",
  "s-urgente": "Urgente",
  "s-pre-vendas": "Pré Vendas",
  "s-devolutiva-consultor": "Devolutiva do Consultor",
  "s-tratar": "A Tratar",
  "s-retorno-cliente": "Aguardando Retorno Cliente",
  "s-conferencia": "Conferência Agendada",
  "s-retorno-omni": "Aguardando Retorno OMNI/DATAVOXX",
  "s-retorno-interno": "Aguardando Retorno Interno",
  "s-prazo-anatel": "Aguardando Prazo Anatel/Operadora",
  "s-pendencia-comercial": "Pendência Comercial",
  "s-concluido": "Concluído",
};

function titleFromSlug(value: string): string {
  return value
    .replace(/^[a-z]+-/, "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase() === "bko" ? "BKO" : part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function funilLabel(value: string | undefined): string {
  const raw = String(value || "").trim();
  return FUNIL_LABELS[raw] || titleFromSlug(raw) || "—";
}

function etapaLabel(value: string | undefined): string {
  const raw = String(value || "").trim();
  return ETAPA_LABELS[raw] || titleFromSlug(raw) || "—";
}

function destinoLabel(funil: string | undefined, etapa: string | undefined): string {
  return `${funilLabel(funil)} / ${etapaLabel(etapa)}`;
}

function humanizeSuportePayload(jsonText: string): string {
  try {
    const payload = JSON.parse(jsonText);
    const detalhes = [
      "Entrada no Suporte registrada",
      `Origem: ${destinoLabel(payload.origem_funil, payload.origem_etapa_id)}`,
      `Destino: ${destinoLabel("suporte", payload.suporte_etapa_id)}`,
    ];
    if (payload.registrado_em) {
      detalhes.push(`Registrado em: ${new Date(payload.registrado_em).toLocaleString("pt-BR")}`);
    }
    return detalhes.join(". ");
  } catch {
    return "Entrada no Suporte registrada";
  }
}

function humanizeText(text: string): string {
  let next = text;

  next = next.replace(/SUPORTE_RETORNO:(\{[^}]+\})/g, (_match, jsonText) => humanizeSuportePayload(jsonText));

  next = next.replace(
    /Alteração de Funil\/Etapa:\s*([^\s(]+)\s*\(([^)]+)\)\s*->\s*([^\s(]+)\s*\(([^)]+)\)/gi,
    (_match, fromFunil, fromEtapa, toFunil, toEtapa) =>
      `Venda movida de ${destinoLabel(fromFunil, fromEtapa)} para ${destinoLabel(toFunil, toEtapa)}`,
  );

  next = next.replace(
    /Chamado\s+(\S+)\s+resolvido por BKO\. Venda retornada automaticamente do funil\s+([^\s]+)\s+para\s+([^/]+)\s*\/\s*([^\s.]+)\.?/gi,
    (_match, ticket, _fromFunil, toFunil, toEtapa) =>
      `Chamado ${ticket} resolvido por BKO. Venda retornada automaticamente para ${destinoLabel(toFunil, toEtapa)}.`,
  );

  next = next.replace(
    /Funil:\s*([a-z0-9_-]+)\s*->\s*([a-z0-9_-]+)/gi,
    (_match, from, to) => `Funil alterado de ${funilLabel(from)} para ${funilLabel(to)}`,
  );

  next = next.replace(
    /Etapa:\s*([a-z0-9_-]+)\s*->\s*([a-z0-9_-]+)/gi,
    (_match, from, to) => `Etapa alterada de ${etapaLabel(from)} para ${etapaLabel(to)}`,
  );

  next = next.replace(
    /\b([a-z0-9_-]+)\|([a-z0-9_-]+)\b/gi,
    (_match, funil, etapa) => destinoLabel(funil, etapa),
  );

  Object.entries(ETAPA_LABELS).forEach(([key, label]) => {
    next = next.replace(new RegExp(`\\b${key}\\b`, "g"), label);
  });

  Object.entries(FUNIL_LABELS).forEach(([key, label]) => {
    next = next.replace(new RegExp(`\\b${key}\\b`, "g"), label);
  });

  return next;
}

function shouldRewriteText(text: string): boolean {
  return /SUPORTE_RETORNO|Alteração de Funil\/Etapa|Funil:|Etapa:|\b[a-z0-9_-]+\|[a-z0-9_-]+\b|\bp-d\d|\bs-espera\b|\bprospeccao\b|\bsuporte\b/.test(text);
}

function rewriteTextNodes(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      const value = node.nodeValue || "";
      if (!parent || parent.closest("script, style, textarea, input")) return NodeFilter.FILTER_REJECT;
      return shouldRewriteText(value) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  nodes.forEach((node) => {
    const original = node.nodeValue || "";
    const friendly = humanizeText(original);
    if (friendly !== original) node.nodeValue = friendly;
  });
}

function enhanceHistoricoCards(): void {
  const headings = Array.from(document.querySelectorAll("h3"));
  const timelineTitle = headings.find((h) => h.textContent?.includes("Linha do Tempo"));
  const temposTitle = headings.find((h) => h.textContent?.includes("Tempos por etapa"));

  [timelineTitle, temposTitle].forEach((title) => {
    const panel = title?.closest(".rounded-xl.border") as HTMLElement | null;
    if (panel) {
      panel.dataset.omniHistorico = "true";
      panel.classList.add("shadow-card");
    }
  });
}

export function installHistoricoEnhancer(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const win = window as typeof window & { __omniHistoricoEnhancerInstalled?: boolean };
  if (win.__omniHistoricoEnhancerInstalled) return;
  win.__omniHistoricoEnhancerInstalled = true;

  let scheduled = false;
  const run = () => {
    if (!document.body?.innerText.includes("Linha do Tempo") && !document.body?.innerText.includes("Tempos por etapa")) return;
    rewriteTextNodes(document.body);
    enhanceHistoricoCards();
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      run();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  window.addEventListener("load", schedule);
  setTimeout(schedule, 0);
}
