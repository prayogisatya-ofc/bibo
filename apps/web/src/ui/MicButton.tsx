import { useRef } from "react";
import { useT } from "../i18n/index.js";
import { MicIcon } from "./icons.js";

/**
 * Tombol mic: tahan = PTT (lepas berhenti), klik cepat = toggle.
 * Penentu klik-vs-tahan: <250 ms. Saat `listening`, tombol berdenyut
 * (level mic real-time tak tersedia dari Web Speech API — denyut
 * mengikuti status listening).
 */
export function MicButton({
  listening,
  disabled,
  onDown,
  onUp,
  size = "big",
  testId = "mic-btn",
}: {
  listening: boolean;
  disabled: boolean;
  onDown: () => void;
  onUp: () => void;
  /** big = 72px (chat), huge = 88px (ngobrol), small = 44px (komposer). */
  size?: "big" | "huge" | "small";
  /** Testid; komposer memakai "mic-input-btn" agar tak ganda dengan mic panggung. */
  testId?: string;
}): JSX.Element {
  const t = useT();
  const meta = useRef({ at: 0, was: false });
  const cls = size === "huge" ? "mic-huge" : size === "small" ? "mic-small" : "mic-big";
  return (
    <button
      type="button"
      className={`${cls}${listening ? " listening" : ""}`}
      disabled={disabled}
      aria-label={t.micLabel}
      aria-pressed={listening}
      data-testid={testId}
      onPointerDown={() => {
        meta.current = { at: Date.now(), was: listening };
        onDown();
      }}
      onPointerUp={() => {
        const quick = Date.now() - meta.current.at < 250;
        // Klik cepat saat mic sudah menyala sebelumnya = toggle mati.
        // Klik cepat dari mati = toggle menyala (biarkan menyala).
        if (!quick || meta.current.was) onUp();
      }}
      onPointerLeave={() => {
        if (Date.now() - meta.current.at >= 250) onUp();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MicIcon size={size === "huge" ? 36 : size === "small" ? 22 : 30} />
    </button>
  );
}
