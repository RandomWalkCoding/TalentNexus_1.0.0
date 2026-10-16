import { useEffect, useState } from "react";

export function useSessionState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try { const saved = sessionStorage.getItem(key); return saved ? { ...initial, ...JSON.parse(saved) } as T : initial; }
    catch { return initial; }
  });
  useEffect(() => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage may be disabled. */ } }, [key, value]);
  return [value, setValue] as const;
}

export function useDrawer(open: boolean, close: () => void, selector = ".operation-drawer") {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const drawer = document.querySelector<HTMLElement>(selector);
    drawer?.setAttribute("role", "dialog");
    drawer?.setAttribute("aria-modal", "true");
    drawer?.querySelector<HTMLElement>("input:not(:disabled), button:not(:disabled), select:not(:disabled), textarea:not(:disabled)")?.focus();
    const keydown = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
      if (dialogs[dialogs.length - 1] !== drawer) return;
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const elements = Array.from(drawer?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]") ?? []);
      const first = elements[0]; const last = elements.at(-1);
      if (!drawer?.contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); previous?.focus({ preventScroll: true }); };
  }, [open, close, selector]);
}
