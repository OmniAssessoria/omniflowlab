import { useLayoutEffect } from "react";

function findGlobalPeriodFiltersContainer() {
  const header = document.querySelector<HTMLElement>("header");
  if (!header) return null;

  return Array.from(header.querySelectorAll<HTMLElement>("div")).find((element) =>
    element.classList.contains("hidden")
    && element.classList.contains("lg:flex")
    && element.classList.contains("items-center")
    && element.classList.contains("gap-2")
    && element.querySelectorAll('[role="combobox"]').length === 2,
  ) ?? null;
}

function hideGlobalPeriodFilters() {
  const container = findGlobalPeriodFiltersContainer();
  if (!container || container.dataset.globalPeriodHidden === "true") return;

  container.dataset.globalPeriodHidden = "true";
  container.dataset.previousDisplay = container.style.display;
  container.dataset.previousDisplayPriority = container.style.getPropertyPriority("display");
  container.style.setProperty("display", "none", "important");
}

export function GlobalPeriodFiltersVisibility() {
  useLayoutEffect(() => {
    hideGlobalPeriodFilters();

    const header = document.querySelector<HTMLElement>("header");
    const observer = header
      ? new MutationObserver(() => hideGlobalPeriodFilters())
      : null;

    observer?.observe(header!, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      document
        .querySelectorAll<HTMLElement>('[data-global-period-hidden="true"]')
        .forEach((element) => {
          const previousDisplay = element.dataset.previousDisplay ?? "";
          const previousPriority = element.dataset.previousDisplayPriority ?? "";
          element.style.setProperty("display", previousDisplay, previousPriority);
          delete element.dataset.globalPeriodHidden;
          delete element.dataset.previousDisplay;
          delete element.dataset.previousDisplayPriority;
        });
    };
  }, []);

  return null;
}
