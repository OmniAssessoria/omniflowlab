import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";

const NAVIGATION_STACK_KEY = "omni:navigation-stack:v1";
const MAX_HISTORY_ITEMS = 40;

let popListenerInstalled = false;
let lastNavigationWasPop = false;

function ensurePopListener() {
  if (typeof window === "undefined" || popListenerInstalled) return;
  window.addEventListener("popstate", () => {
    lastNavigationWasPop = true;
  });
  popListenerInstalled = true;
}

function currentHref() {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function normalizeHref(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const url = new URL(raw);
      if (typeof window !== "undefined" && url.origin !== window.location.origin) return "";
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return "";
  }

  return raw.startsWith("/") ? raw : "";
}

function readStack(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.sessionStorage.getItem(NAVIGATION_STACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(item => normalizeHref(String(item)))
      .filter(Boolean)
      .slice(-MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

function writeStack(stack: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      NAVIGATION_STACK_KEY,
      JSON.stringify(stack.slice(-MAX_HISTORY_ITEMS)),
    );
  } catch {
    // Navegação continua funcionando mesmo se o storage estiver indisponível.
  }
}

export function recordInternalNavigation(href?: string) {
  if (typeof window === "undefined") return;
  ensurePopListener();

  const next = normalizeHref(href || currentHref());
  if (!next || next.startsWith("/auth")) return;

  const stack = readStack();
  const last = stack.at(-1);

  if (last === next) {
    lastNavigationWasPop = false;
    return;
  }

  if (lastNavigationWasPop) {
    // Em Back/Forward, reaproveita a posição já conhecida da rota em vez
    // de criar uma entrada nova. Navegação por clique continua sendo PUSH normal.
    const previousIndex = stack.lastIndexOf(next);
    if (previousIndex >= 0) {
      writeStack(stack.slice(0, previousIndex + 1));
    } else {
      stack.push(next);
      writeStack(stack);
    }
    lastNavigationWasPop = false;
    return;
  }

  stack.push(next);
  writeStack(stack);
}

export function hasPreviousInternalPage() {
  return readStack().length > 1;
}

export function clearNavigationMemory() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(NAVIGATION_STACK_KEY);
  } catch {
    // noop
  }
}

export function useSmartBack(fallback: string) {
  const navigate = useNavigate();

  return useCallback(() => {
    if (typeof window !== "undefined") {
      recordInternalNavigation(currentHref());
      if (hasPreviousInternalPage()) {
        window.history.back();
        return;
      }
    }

    navigate({ to: fallback as any });
  }, [fallback, navigate]);
}
