/**
 * Perintah suara lokal: TATA BAHASA TERTUTUP (PRD §9.2).
 * Kecocokan PENUH setelah normalisasi (bukan substring), hanya pada konteks relevan.
 */

export type VoiceAction =
  | { kind: "interrupt" }
  | { kind: "permAllow"; requestID: string }
  | { kind: "permReject"; requestID: string }
  | { kind: "repeat" }
  | { kind: "mute"; to: boolean }
  | { kind: "text"; text: string };

export interface CommandContext {
  /** Agent sibuk ATAU TTS sedang bicara (untuk stop). */
  busy: boolean;
  ttsSpeaking: boolean;
  /** Permission menunggu (risiko diketahui dari bridge). */
  pending: Array<{ requestID: string; risk: "low" | "medium" | "high" }>;
  muted: boolean;
}

export function normalizeCmd(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:…"'“”‘’()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(["berhenti", "stop", "batal", "diam dulu", "cancel", "berhentilah", "stop ya"]);
const YES = new Set(["ya", "boleh", "izinkan", "lanjut", "yes", "allow", "go ahead", "oke ya", "setuju"]);
const NO = new Set(["tidak", "jangan", "tolak", "no", "deny", "reject", "nggak", "tidak usah"]);
const REPEAT = new Set(["ulangi", "repeat", "ulangi lagi"]);
const MUTE = new Set(["senyap", "mute", "diam"]);
const UNMUTE = new Set(["bicara lagi", "unmute", "nyala lagi", "suara lagi"]);

/**
 * Kembalikan aksi lokal, atau {kind:"text"} agar diteruskan ke agent.
 * Aturan keselamatan: always tak ada versi suara; risiko high tak bisa via suara.
 */
export function matchCommand(raw: string, ctx: CommandContext): VoiceAction {
  const t = normalizeCmd(raw);
  if (STOP.has(t) && (ctx.busy || ctx.ttsSpeaking)) return { kind: "interrupt" };
  if (NO.has(t) && ctx.pending.length > 0) {
    const first = ctx.pending[0];
    if (first) return { kind: "permReject", requestID: first.requestID };
  }
  if (YES.has(t)) {
    const first = ctx.pending.find((p) => p.risk === "low" || p.risk === "medium");
    if (first) return { kind: "permAllow", requestID: first.requestID };
  }
  if (REPEAT.has(t)) return { kind: "repeat" };
  if (MUTE.has(t) && !ctx.muted) return { kind: "mute", to: true };
  if (UNMUTE.has(t) && ctx.muted) return { kind: "mute", to: false };
  return { kind: "text", text: raw };
}

/** True bila teks layak dikirim/diucapkan (tidak kosong setelah dibersihkan). */
export function isSpeakable(text: string): boolean {
  return text.replace(/[<>\s]/g, "").length > 0;
}

export interface FormFieldView {
  key?: string;
  title?: string;
  type?: string;
  options?: Array<{ value: string; label?: string }>;
}

/**
 * Jawaban suara untuk pilihan TUNGGAL: nomor ("dua"/"2") atau label persis.
 * Mengembalikan {key, value} atau undefined (bukan pilihan tunggal).
 */
export function matchFormAnswer(
  raw: string,
  fields: FormFieldView[],
): { key: string; value: string } | undefined {
  const single = fields.find((f) => f.key && f.options && f.options.length > 0 && f.type !== "multiselect");
  if (!single?.key || !single.options) return undefined;
  const t = normalizeCmd(raw);
  const NUMBERS: Record<string, number> = {
    satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
    one: 1, two: 2, three: 3, four: 4, five: 5,
  };
  const asNum = /^\d+$/.test(t) ? Number(t) : (NUMBERS[t] ?? 0);
  if (asNum >= 1 && asNum <= single.options.length) {
    const opt = single.options[asNum - 1];
    if (opt) return { key: single.key, value: opt.value };
  }
  const hit = single.options.find(
    (o) => normalizeCmd(o.label ?? o.value) === t || normalizeCmd(o.value) === t,
  );
  if (hit) return { key: single.key, value: hit.value };
  return undefined;
}
/** Label toast transparansi untuk tiap aksi lokal. */
export function actionLabel(a: VoiceAction): string {
  switch (a.kind) {
    case "interrupt":
      return "Perintah suara: berhenti";
    case "permAllow":
      return "Perintah suara: izinkan sekali";
    case "permReject":
      return "Perintah suara: tolak";
    case "repeat":
      return "Perintah suara: ulangi";
    case "mute":
      return a.to ? "Perintah suara: senyap" : "Perintah suara: bicara lagi";
    case "text":
      return "";
  }
}
