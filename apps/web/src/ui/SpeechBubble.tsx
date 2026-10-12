import type { Bubble } from "./speechBubble.js";

/**
 * Bubble ucapan mode Ngobrol: di kanan atas kepala Bibo (di atas kepala pada
 * layar sempit), pop 180ms (key unik per ucapan), maks 3 baris, fade 1,5 dtk
 * setelah ucapan selesai, tone error = tint merah lembut.
 */
export function SpeechBubble({ bubble }: { bubble: Bubble | null }): JSX.Element | null {
  if (!bubble || !bubble.text) return null;
  return (
    <div className="speech-bubble-pos" key={bubble.key}>
      <div
        className={`speech-bubble${bubble.fading ? " fading" : ""}${bubble.tone === "error" ? " tone-error" : ""}`}
        role="status"
        aria-live="polite"
        data-testid="speech-bubble"
      >
        {bubble.text}
        <span className="bubble-tail" aria-hidden="true" />
      </div>
    </div>
  );
}
