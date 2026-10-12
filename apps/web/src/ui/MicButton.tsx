import { useRef } from "react";

/**
 * Tombol mic: tahan = PTT (lepas berhenti), klik cepat = toggle.
 * Penentu klik-vs-tahan: <250 ms.
 */
export function MicButton({
  listening,
  disabled,
  onDown,
  onUp,
}: {
  listening: boolean;
  disabled: boolean;
  onDown: () => void;
  onUp: () => void;
}): JSX.Element {
  const meta = useRef({ at: 0, was: false });
  return (
    <button
      type="button"
      className={listening ? "mic live" : "mic"}
      disabled={disabled}
      aria-label="Tahan untuk bicara"
      aria-pressed={listening}
      data-testid="mic-btn"
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
      🎤
    </button>
  );
}
