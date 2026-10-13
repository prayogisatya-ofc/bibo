import type { Bubble } from "./bubbleState.js";

/**
 * Bubble ucapan mode Ngobrol: blok lebar DI ATAS karakter, tinggi mengikuti
 * teks (tanpa potong baris), pop 180ms (key unik per ucapan), fade 1,5 dtk
 * setelah ucapan selesai, tone error = tint merah lembut. Ekor di bawah
 * menunjuk ke kepala Bibo.
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
