import { useLayoutEffect } from "react";

const HIDDEN_PEDIDOS_FILTER_LABELS = new Set(["BKO", "BIOMETRIA", "ERRO"]);

export function shouldHidePedidosFilter(label: string) {
  return HIDDEN_PEDIDOS_FILTER_LABELS.has(label.trim().toUpperCase());
}

function applyPedidosFilterVisibility() {
  const search = document.querySelector<HTMLInputElement>(
    'input[placeholder="Cliente, nº do pedido, CNPJ, telefone…"]',
  );
  if (!search) return;

  const panel = search.closest<HTMLElement>(".rounded-xl");
  if (!panel) return;

  panel.querySelectorAll<HTMLLabelElement>("label").forEach((label) => {
    if (!shouldHidePedidosFilter(label.textContent ?? "")) return;
    const wrapper = label.parentElement;
    if (!wrapper) return;
    wrapper.dataset.pedidosFilterHidden = "true";
    wrapper.classList.add("hidden");
  });
}

export function PedidosFilterVisibility() {
  useLayoutEffect(() => {
    applyPedidosFilterVisibility();

    const observer = new MutationObserver(() => applyPedidosFilterVisibility());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document
        .querySelectorAll<HTMLElement>('[data-pedidos-filter-hidden="true"]')
        .forEach((element) => {
          element.classList.remove("hidden");
          delete element.dataset.pedidosFilterHidden;
        });
    };
  }, []);

  return null;
}
