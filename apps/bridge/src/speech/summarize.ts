import type { OpenCodeClient } from "../opencode/client.js";
import { splitSpeak } from "./parse-speak.js";

export type SpeechLocale = "id" | "en";

/** Frasa ucapan. Dipakai ack/selesai/bingung; ≥5 varian ack per locale. */
const PH: Record<SpeechLocale, Record<PhraseKind, readonly string[]>> = {
  id: {
    ack: ["Oke, kukerjakan.", "Siap, aku mulai ya.", "Baik, kutangani sekarang.", "Mengerti, langsung kugarap.", "Oke, sabar sebentar ya."],
    done: ["Beres!", "Sudah selesai.", "Tugas selesai."],
    confused: ["Aduh, ada yang gagal.", "Hmm, ada masalah.", "Yah, gagal.", "Aduh, error."],
    progress: ["Aku lagi bekerja…", "Sebentar, masih kugarap…", "Lagi jalan…"],
  },
  en: {
    ack: ["Okay, on it.", "Sure, starting now.", "Got it, working on that.", "Understood, right away.", "Okay, one moment."],
    done: ["Done!", "All finished.", "Task complete."],
    confused: ["Oops, something failed.", "Hmm, a problem came up.", "Oh no, it failed.", "Ugh, error."],
    progress: ["Still working…", "One moment, still on it…", "In progress…"],
  },
};

export type PhraseKind = "ack" | "done" | "confused" | "progress";

const lastIdx = new Map<string, number>();

/** Pilih acak tanpa pengulangan berturut-turut. */
export function phrase(kind: PhraseKind, locale: SpeechLocale = "id"): string {
  const arr = PH[locale][kind];
  let i = Math.floor(Math.random() * arr.length);
  const lk = `${locale}:${kind}`;
  if (arr.length > 1 && lastIdx.get(lk) === i) i = (i + 1) % arr.length;
  lastIdx.set(lk, i);
  const s = arr[i];
  return typeof s === "string" ? s : arr[0] ?? "";
}

export type SummaryMode = "tag" | "generate" | "heuristic" | "auto";

export function summaryModeFromEnv(v: string | undefined): SummaryMode {
  return v === "tag" || v === "generate" || v === "heuristic" ? v : "auto";
}

export interface SummaryInput {
  /** Teks assistant terakhir (mentah, boleh memuat <speak>). */
  text: string;
  /** Hasil diff giliran (untuk fallback). */
  files: Array<{ path: string }>;
  /** Panggil session.generate (di-inject agar mudah diuji). */
  generate?: (prompt: string) => Promise<string>;
  locale?: SpeechLocale;
}

export interface SummaryResult {
  text: string;
  path: "tag" | "generate" | "heuristic";
}

/**
 * Ringkasan lisan (PRD §9.5): tag → generate (1×, timeout di pemanggil) → heuristik.
 * Selalu ≤ 2 kalimat pendek, tanpa kode.
 */
const GENERATE_PROMPT: Record<SpeechLocale, string> = {
  id: "Ringkas hasil terakhir dalam maksimal 2 kalimat Bahasa Indonesia untuk diucapkan, tanpa kode.",
  en: "Summarize the latest result in at most 2 English sentences to speak aloud, no code.",
};

export async function summarize(input: SummaryInput, mode: SummaryMode): Promise<SummaryResult> {
  const locale = input.locale ?? "id";
  if (mode === "tag" || mode === "auto") {
    const { speak } = splitSpeak(input.text);
    const best = speak[speak.length - 1];
    if (best) return { text: clamp2(best), path: "tag" };
    if (mode === "tag") return { text: heuristic(input), path: "heuristic" };
  }
  if ((mode === "generate" || mode === "auto") && input.generate) {
    try {
      const g = await input.generate(GENERATE_PROMPT[locale]);
      if (g.trim()) return { text: clamp2(g.trim()), path: "generate" };
    } catch {
      // jatuh ke heuristik
    }
  }
  return { text: heuristic(input), path: "heuristic" };
}

function heuristic(input: SummaryInput): string {
  const locale = input.locale ?? "id";
  const clean = input.text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 240)
    .slice(0, 2)
    .join(" ");
  if (clean) return clamp2(clean);
  if (input.files.length > 0) {
    return locale === "en"
      ? `Done, ${input.files.length} file${input.files.length === 1 ? "" : "s"} changed.`
      : `Selesai, ada ${input.files.length} file yang berubah.`;
  }
  return locale === "en" ? "All done." : "Sudah selesai.";
}

/** Batasi maksimal 2 kalimat, 220 karakter (aturan blok <speak>). */
export function clamp2(s: string): string {
  const parts = s.split(/(?<=[.!?])\s+/).filter((x) => x.trim().length > 0);
  const two = parts.slice(0, 2).join(" ");
  const t = two.trim() || s.trim();
  return t.length > 220 ? `${t.slice(0, 217)}…` : t;
}

/** Instruksi suara untuk disuntik via instruction entry (Lampiran A). */
export const VOICE_INSTRUCTION_KEY = "bibo.voice";
export const VOICE_INSTRUCTION_VALUE =
  "Setelah menyelesaikan tugas, akhiri jawabanmu dengan SATU blok: " +
  "<speak>1-2 kalimat Bahasa Indonesia santai yang merangkum hasilnya untuk diucapkan.</speak> " +
  "Aturan blok <speak>: maksimal 220 karakter. Tanpa kode, tanpa tanda markdown, tanpa URL. " +
  "Sebut nama file singkat saja, bukan path panjang. " +
  "Jawaban lengkap/teknis tetap ditulis seperti biasa DI LUAR blok <speak>.";

/** Generate dengan timeout (pemanggil memakai ini agar tak menggantung). */
export function generateWithTimeout(
  client: OpenCodeClient,
  sessionID: string,
  prompt: string,
  ms: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("generate timeout")), ms);
    client.session
      .generate({ sessionID, prompt })
      .then((r) => {
        clearTimeout(timer);
        resolve(r.text);
      })
      .catch((e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      });
  });
}
