import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type DragState = {
  active: boolean;
  pointerId: number | null;
  startX: number;
  lastX: number;
  moved: boolean;
  element: HTMLDivElement | null;
};

const INTERACTIVE_SELECTOR = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "[role='button']",
  "[draggable='true']",
  "[data-kanban-no-pan]",
  ".omni-pipeline-card",
].join(",");

export function useHorizontalDragScroll() {
  const dragRef = useRef<DragState>({
    active: false,
    pointerId: null,
    startX: 0,
    lastX: 0,
    moved: false,
    element: null,
  });
  const [dragging, setDragging] = useState(false);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Mouse: botão esquerdo. Touch/pen mantêm o scroll nativo.
    if (event.pointerType !== "mouse" || event.button !== 0) return;

    const target = event.target as Element | null;
    if (target?.closest(INTERACTIVE_SELECTOR)) return;

    const element = event.currentTarget;

    // A faixa inferior pertence à scrollbar nativa. Não capturamos o ponteiro
    // nessa região, senão o "grab" do Kanban disputa o mouse com a barra.
    const rect = element.getBoundingClientRect();
    const nativeScrollbarHeight = Math.max(0, element.offsetHeight - element.clientHeight);
    const scrollbarHitArea = Math.max(nativeScrollbarHeight, 16);
    if (event.clientY >= rect.bottom - scrollbarHitArea) return;

    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      moved: false,
      element,
    };

    setDragging(true);
    element.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = dragRef.current;
    if (!state.active || state.pointerId !== event.pointerId || !state.element) return;

    const deltaX = event.clientX - state.lastX;
    const totalDelta = event.clientX - state.startX;

    if (Math.abs(totalDelta) >= 2) {
      state.moved = true;
      event.preventDefault();
    }

    // Movimento incremental 1:1 evita saltos quando o navegador perde algum frame
    // e mantém o quadro seguindo o mouse, como em Kanbans comerciais.
    if (deltaX !== 0) {
      state.element.scrollLeft -= deltaX;
      state.lastX = event.clientX;
    }
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const state = dragRef.current;
    if (!state.active || state.pointerId !== event.pointerId) return;

    const element = state.element ?? event.currentTarget;

    dragRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      lastX: 0,
      moved: false,
      element: null,
    };

    setDragging(false);

    if (element.hasPointerCapture?.(event.pointerId)) {
      element.releasePointerCapture?.(event.pointerId);
    }
  }

  return {
    dragging,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onLostPointerCapture: endDrag,
    },
  };
}
