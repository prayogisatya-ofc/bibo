/**
 * TTS browser (speechSynthesis) — MVP M4 (PRD §9.3), disambung ke avatar baru (fase D).
 * Antrean prioritas (urgent menyela normal), potong per kalimat ±180 karakter,
 * sanitasi sebelum ucap.
 *
 * Level suara 0..1 (≤30 Hz) kini menggerakkan MULUT PARAMETRIS — overlay
 * Berbicara di renderer (CHARACTER.md §5/§11), bukan lagi "voice-pulse"
 * (denyut badan) yang sudah dihapus. setSpeechLevel(0) wajib dipanggil saat
 * stop/cancel/selesai agar mulut menutup ≤100 ms; renderer menonaktifkan
 * overlay bila level 0.
 */

export interface TtsVoice {
  uri: string;
  name: string;
  lang: string;
  /** Referensi SpeechSynthesisVoice asli (adapter browser); tanpa ini, jangan assign ke utterance. */
  ref?: unknown;
}

export interface TtsSettings {
  voiceURI: string | undefined;
  rate: number; // 0.7–1.4
  pitch: number;
  volume: number;
  muted: boolean;
}

interface SynthLike {
  speak(u: UtteranceLike): void;
  cancel(): void;
  getVoices(): TtsVoice[];
  onvoiceschanged: ((() => void) | null);
}

export interface UtteranceLike {
  text: string;
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  voice: TtsVoice | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onboundary: ((charIndex: number) => void) | null;
}

export type UtteranceFactory = (text: string) => UtteranceLike;

export interface LevelOpts {
  now?: () => number;
  random?: () => number;
  raf?: (cb: () => void) => number;
  cancelRaf?: (id: number) => void;
}

const MAX_CHUNK = 180;

/** Potong teks menjadi kalimat-kalimat ≤ ~180 karakter. */
export function chunkSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const p of parts) {
    if ((`${cur} ${p}`.trim().length <= MAX_CHUNK || !cur) && p.length <= MAX_CHUNK) {
      cur = `${cur} ${p}`.trim();
    } else if (p.length > MAX_CHUNK) {
      if (cur) {
        out.push(cur);
        cur = "";
      }
      for (let i = 0; i < p.length; i += MAX_CHUNK) out.push(p.slice(i, i + MAX_CHUNK));
    } else {
      out.push(cur);
      cur = p;
    }
  }
  if (cur) out.push(cur);
  return out.filter(Boolean);
}

/**
 * Sanitasi sebelum diucapkan (PRD §9.3): buang markdown/blok kode/URL panjang,
 * path → nama file, angka besar dibulatkan.
 */
export function sanitizeForSpeech(text: string): string {
  return (
    text
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]*)`/g, "$1")
      .replace(/!?\[[^\]]*\]\(([^)]+)\)/g, "$1")
      .replace(/https?:\/\/\S+/g, "tautan")
      .replace(/\b[\w./-]+\/([\w.-]+\.\w+)\b/g, "file $1")
      .replace(/\b\d{7,}\b/g, (n) => `${n.slice(0, 3)} juta lebih`)
      .replace(/[*_#>|]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

interface Job {
  id: string;
  chunks: string[];
  priority: "normal" | "urgent";
}

export class TtsEngine {
  /**
   * Callback level suara 0..1 (≤30 Hz). App meneruskannya ke
   * renderer.setSpeechLevel: >0 mengaktifkan overlay Berbicara (mulut
   * parametris m-open + busur suara), 0 menonaktifkannya (mulut menutup).
   */
  onLevel: (level: number) => void = () => {};
  /** Riwayat teks yang selesai diucapkan (untuk tes & debug). */
  readonly spoken: string[] = [];
  private queue: Job[] = [];
  private current: { job: Job; idx: number; freq: number } | undefined;
  private rafId = 0;
  private lastFrame = 0;
  private accentUntil = 0;
  private settings: TtsSettings;
  private useDefaultVoice = false;

  constructor(
    private synth: SynthLike,
    private makeUtterance: UtteranceFactory,
    private opts: LevelOpts = {},
    settings?: Partial<TtsSettings>,
  ) {
    this.settings = { voiceURI: undefined, rate: 1, pitch: 1, volume: 1, muted: false, ...settings };
  }

  get muted(): boolean {
    return this.settings.muted;
  }

  setSettings(s: Partial<TtsSettings>): void {
    Object.assign(this.settings, s);
    if (s.muted) this.cancel();
  }

  /** true bila suara id-ID tak ada sehingga memakai default + peringatan. */
  get usingDefaultVoice(): boolean {
    return this.useDefaultVoice;
  }

  listVoices(): TtsVoice[] {
    return this.synth.getVoices();
  }

  pickVoice(preferURI?: string): TtsVoice | null {
    const vs = this.synth.getVoices();
    if (preferURI) {
      const hit = vs.find((v) => v.uri === preferURI);
      if (hit) {
        this.useDefaultVoice = false;
        return hit;
      }
    }
    const id = vs.find((v) => v.lang.toLowerCase().startsWith("id"));
    this.useDefaultVoice = !id && vs.length > 0;
    return id ?? vs[0] ?? null;
  }

  speak(id: string, text: string, priority: "normal" | "urgent"): void {
    if (this.settings.muted) return;
    const clean = sanitizeForSpeech(text);
    if (!clean) return;
    if (priority === "urgent") {
      // Sela: buang antrean normal + hentikan yang sedang jalan.
      this.queue = this.queue.filter((j) => j.priority === "urgent");
      this.stopCurrent();
    } else {
      // Antrean usang: hanya satu normal terbaru yang dipertahankan.
      this.queue = this.queue.filter((j) => j.priority === "urgent");
    }
    this.queue.push({ id, chunks: chunkSentences(clean), priority });
    this.pump();
  }

  /** Batal total (interrupt, mute, prompt baru). Level 0 seketika (≤100 ms) → mulut menutup. */
  cancel(): void {
    this.queue = [];
    this.stopCurrent();
    this.setLevel(0);
  }

  private stopCurrent(): void {
    try {
      this.synth.cancel();
    } catch {
      // abaikan
    }
    this.current = undefined;
  }

  private pump(): void {
    if (this.current || this.queue.length === 0 || this.settings.muted) return;
    const job = this.queue.shift();
    if (!job) return;
    this.current = { job, idx: 0, freq: 3.5 + (this.opts.random?.() ?? Math.random()) * 1.5 };
    this.nextChunk();
  }

  private nextChunk(): void {
    const cur = this.current;
    if (!cur) return;
    const text = cur.job.chunks[cur.idx];
    if (text === undefined) {
      this.spoken.push(cur.job.chunks.join(" "));
      this.current = undefined;
      this.setLevel(0); // ucapan selesai → mulut menutup (≤100 ms)
      this.pump();
      return;
    }
    const u = this.makeUtterance(text);
    u.lang = "id-ID";
    u.rate = this.settings.rate;
    u.pitch = this.settings.pitch;
    u.volume = this.settings.volume;
    const picked = this.pickVoice(this.settings.voiceURI);
    // Hanya assign bila berupa suara asli (ref); objek polos (stub/daftar) ditolak browser.
    u.voice = picked?.ref !== undefined && picked.ref !== null ? (picked.ref as TtsVoice) : null;
    u.onboundary = () => {
      this.accentUntil = (this.opts.now?.() ?? Date.now()) + 80;
    };
    const done = (): void => {
      if (this.current !== cur) return;
      cur.idx++;
      this.nextChunk();
    };
    u.onend = done;
    u.onerror = done;
    this.startLevels(cur.freq);
    try {
      this.synth.speak(u);
    } catch {
      done();
    }
  }

  private startLevels(freq: number): void {
    const raf = this.opts.raf ?? requestAnimationFrame;
    const cancel = this.opts.cancelRaf ?? cancelAnimationFrame;
    cancel(this.rafId);
    const rand = this.opts.random ?? Math.random;
    const now = this.opts.now ?? Date.now;
    this.lastFrame = now();
    const tick = (): void => {
      if (!this.current) return;
      const t = now();
      if (t - this.lastFrame < 33) {
        this.rafId = raf(tick);
        return;
      }
      this.lastFrame = t;
      const s = Math.abs(Math.sin((2 * Math.PI * freq * t) / 1000));
      let level = Math.min(1, 0.25 + 0.6 * s + rand() * 0.15);
      if (t < this.accentUntil) level = Math.min(1, level + 0.2);
      this.setLevel(level);
      this.rafId = raf(tick);
    };
    this.rafId = raf(tick);
  }

  private setLevel(level: number): void {
    this.onLevel(level);
  }
}
