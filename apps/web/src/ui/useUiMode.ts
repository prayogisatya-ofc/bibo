import { useCallback, useEffect, useState } from "react";

/** Mode tampilan aplikasi (AGENT-PROMPT-AVATAR-UI §C.2). */
export type UiMode = "chat" | "talk";

const KEY = "codepet.ui-mode";

function load(): UiMode {
  try {
    return localStorage.getItem(KEY) === "talk" ? "talk" : "chat";
  } catch {
    return "chat";
  }
}

/**
 * State uiMode persisten (localStorage) + pintasan Ctrl/Cmd+. untuk berpindah.
 * Riwayat percakapan tidak disentuh hook ini — ia hidup di store dan
 * dipertahankan di kedua mode.
 */
export function useUiMode(): { mode: UiMode; setMode: (m: UiMode) => void; toggleMode: () => void } {
  const [mode, setModeState] = useState<UiMode>(load);

  const setMode = useCallback((m: UiMode) => {
    setModeState(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      // abaikan
    }
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next: UiMode = prev === "chat" ? "talk" : "chat";
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // abaikan
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === ".") {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) return;
        e.preventDefault();
        toggleMode();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleMode]);

  return { mode, setMode, toggleMode };
}
