import { useEffect, useRef } from "react";

/**
 * Perangkap fokus di dalam dialog (role="alertdialog"): Tab berputar di
 * dalam kartu; fokus awal ke kontrol pertama; fokus dikembalikan saat lepas.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean): React.MutableRefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    const prev = document.activeElement as HTMLElement | null;
    const focusables = (): HTMLElement[] =>
      [...el.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((i) => i.offsetParent !== null);
    const first = focusables()[0];
    (first ?? el).focus();

    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstI = items[0]!;
      const lastI = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === firstI) {
        e.preventDefault();
        lastI.focus();
      } else if (!e.shiftKey && document.activeElement === lastI) {
        e.preventDefault();
        firstI.focus();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("keydown", onKey);
      if (prev && document.contains(prev)) prev.focus();
    };
  }, [active]);

  return ref;
}
