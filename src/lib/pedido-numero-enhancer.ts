export const PEDIDO_NUMBER_LABEL = "Número do pedido:";

export function pedidoNumeroPresentation(value: string) {
  return {
    label: PEDIDO_NUMBER_LABEL,
    value: value.trim(),
  };
}

function findPedidoHeader(): HTMLElement | null {
  const voltar = Array.from(document.querySelectorAll<HTMLAnchorElement>("a"))
    .find((link) => link.textContent?.includes("Voltar ao pipeline"));

  if (!voltar) return null;
  return voltar.parentElement;
}

function findNumeroTarget(header: HTMLElement): HTMLInputElement | HTMLSpanElement | null {
  const editavel = header.querySelector<HTMLInputElement>(
    'input[title="Número do pedido (editável)"]',
  );
  if (editavel) return editavel;

  const linhaNumero = header.querySelector<HTMLElement>("div.flex.items-center.gap-2.mb-1");
  return linhaNumero?.querySelector<HTMLSpanElement>("span.font-mono") ?? null;
}

function ensureLabel(target: HTMLInputElement | HTMLSpanElement): void {
  const parent = target.parentElement;
  if (!parent) return;

  parent.dataset.omniPedidoNumero = "true";

  let label = parent.querySelector<HTMLSpanElement>("[data-omni-pedido-numero-label]");
  if (!label) {
    label = document.createElement("span");
    label.dataset.omniPedidoNumeroLabel = "true";
    label.className = "text-[10px] text-muted-foreground font-medium whitespace-nowrap";
    target.before(label);
  }

  const presentation = pedidoNumeroPresentation(
    target instanceof HTMLInputElement ? target.value : target.textContent || "",
  );
  label.textContent = presentation.label;

  target.setAttribute("aria-label", "Número do pedido");
  target.setAttribute("data-omni-pedido-numero-value", "true");

  if (target instanceof HTMLInputElement) {
    target.style.width = "156px";
    target.style.minHeight = "28px";
    target.style.paddingInline = "8px";
    target.style.borderColor = "color-mix(in oklab, var(--omni) 35%, var(--border))";
    target.style.background = "color-mix(in oklab, var(--surface-2) 74%, transparent)";
    target.style.color = "var(--foreground)";
    target.style.fontSize = "12px";

    let editButton = parent.querySelector<HTMLButtonElement>("[data-omni-pedido-numero-edit]");
    if (!editButton) {
      editButton = document.createElement("button");
      editButton.type = "button";
      editButton.dataset.omniPedidoNumeroEdit = "true";
      editButton.title = "Editar número do pedido";
      editButton.setAttribute("aria-label", "Editar número do pedido");
      editButton.textContent = "✎";
      editButton.className = "inline-flex size-7 items-center justify-center rounded-md border border-border bg-surface-2 text-xs text-muted-foreground hover:border-[var(--omni)]/40 hover:text-[var(--omni)] transition-colors";
      editButton.addEventListener("click", () => {
        target.focus();
        target.select();
      });
      target.after(editButton);
    }
  }
}

function enhancePedidoNumero(): void {
  const header = findPedidoHeader();
  if (!header) return;

  const target = findNumeroTarget(header);
  if (!target) return;

  ensureLabel(target);
}

export function installPedidoNumeroEnhancer(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const win = window as typeof window & { __omniPedidoNumeroEnhancerInstalled?: boolean };
  if (win.__omniPedidoNumeroEnhancerInstalled) return;
  win.__omniPedidoNumeroEnhancerInstalled = true;

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      enhancePedidoNumero();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.addEventListener("load", schedule);
  setTimeout(schedule, 0);
}
