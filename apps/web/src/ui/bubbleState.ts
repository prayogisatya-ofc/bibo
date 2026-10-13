/**
 * Mesin status bubble ucapan mode Ngobrol (murni, tanpa React).
 *
 * Aturan (AGENT-PROMPT-AVATAR-UI §C.4):
 * - muncul dengan pop 180ms (animasi CSS, dipicu key unik per ucapan);
 * - teks mengikuti TTS per kalimat: tampilkan DUA kalimat terakhir
 *   (maks 3 baris visual via CSS line-clamp);
 * - memudar 1,5 dtk setelah ucapan selesai (fading → App menjadwalkan `faded`);
 * - ucapan urgent (izin/error) langsung menggantikan bubble yang ada;
 * - error memakai tone merah lembut (Bibo pose Bingung ditangani orchestrator).
 */

export type BubbleTone = "normal" | "urgent" | "error";

export interface Bubble {
  /** id ucapan TTS (agent.speak id). */
  id: string;
  /** kunci unik per ucapan — memicu animasi pop di React. */
  key: number;
  /** teks tampil: dua kalimat terakhir dari chunk/ucapan terakhir. */
  text: string;
  tone: BubbleTone;
  /** true selama 1,5 dtk fade-out sebelum hilang. */
  fading: boolean;
}

export type BubbleEvent =
  | { type: "speak"; id: string; text: string; urgent: boolean; error: boolean }
  | { type: "sentence"; id: string; text: string }
  | { type: "speechend"; id: string }
  | { type: "faded" };

/** Ambil kalimat: pisah pada tanda akhir kalimat. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Teks tampil bubble: dua kalimat terakhir (maks 3 baris ditangani CSS). */
export function bubbleText(full: string): string {
  const ss = splitSentences(full);
  return ss.slice(-2).join(" ");
}

function toneOf(urgent: boolean, error: boolean): BubbleTone {
  if (error) return "error";
  if (urgent) return "urgent";
  return "normal";
}

/**
 * Reducer murni. `speak` selalu menggantikan (urgent/error: seketika);
 * `sentence` (chunk TTS) mengganti teks tampil dengan dua kalimat terakhir
 * chunk itu — hanya untuk id yang sedang tampil; `speechend` memulai fade
 * 1,5 dtk; `faded` menghilangkan.
 */
export function reduceBubble(b: Bubble | null, e: BubbleEvent): Bubble | null {
  switch (e.type) {
    case "speak": {
      const key = (b?.key ?? 0) + 1;
      return { id: e.id, key, text: bubbleText(e.text), tone: toneOf(e.urgent, e.error), fading: false };
    }
    case "sentence": {
      if (!b || b.id !== e.id || b.fading) return b;
      return { ...b, text: bubbleText(e.text) };
    }
    case "speechend": {
      if (!b || b.id !== e.id || b.fading) return b;
      return { ...b, fading: true };
    }
    case "faded":
      return null;
  }
}
