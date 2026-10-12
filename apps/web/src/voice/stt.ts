/**
 * STT di balik SttEngine agar bisa ditukar (Whisper di v0.2).
 * Implementasi MVP: Web Speech API. Tanpa menyimpan audio (PRD §9.1).
 */

export interface SttResult {
  transcript: string;
  isFinal: boolean;
  alternatives: string[];
}

export interface SttEngine {
  readonly supported: boolean;
  readonly reason?: string;
  start(opts?: { lang?: string }): void;
  stop(): void;
  onInterim: (text: string) => void;
  onFinal: (result: SttResult) => void;
  onError: (code: string, message: string) => void;
}

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((ev: { results: ArrayLike<{ isFinal: boolean; [i: number]: { transcript: string } }>; resultIndex: number }) => void) | null;
  onerror: ((ev: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
}

export type RecognitionFactory = (opts: { lang: string }) => RecognitionLike | undefined;

function defaultFactory(opts: { lang: string }): RecognitionLike | undefined {
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return undefined;
  const rec = new Ctor();
  rec.lang = opts.lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 3;
  return rec;
}

export class WebSpeechEngine implements SttEngine {
  readonly supported: boolean;
  readonly reason?: string;
  onInterim: (text: string) => void = () => {};
  onFinal: (result: SttResult) => void = () => {};
  onError: (code: string, message: string) => void = () => {};
  private rec: RecognitionLike | undefined;
  private lang = "id-ID";
  private active = false;

  constructor(private factory: RecognitionFactory = defaultFactory) {
    const probe = factory({ lang: "id-ID" });
    this.supported = !!probe;
    if (!probe) this.reason = "Web Speech API tidak tersedia di browser ini.";
  }

  start(opts?: { lang?: string }): void {
    if (!this.supported) {
      this.onError("NOT_SUPPORTED", this.reason ?? "STT tak didukung.");
      return;
    }
    if (opts?.lang) this.lang = opts.lang;
    try {
      this.rec?.stop();
    } catch {
      // abaikan
    }
    this.rec = this.factory({ lang: this.lang });
    if (!this.rec) {
      this.onError("NOT_SUPPORTED", "STT tak didukung.");
      return;
    }
    const rec = this.rec;
    this.active = true;
    rec.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (!r) continue;
        const best = r[0]?.transcript ?? "";
        if (r.isFinal) {
          const alternatives: string[] = [];
          for (let a = 1; a < 3; a++) {
            const alt = (r as unknown as Array<{ transcript?: string }>)[a]?.transcript;
            if (alt) alternatives.push(alt);
          }
          this.onFinal({ transcript: best, isFinal: true, alternatives });
        } else {
          interim += best;
        }
      }
      if (interim) this.onInterim(interim);
    };
    rec.onerror = (ev) => {
      if (!this.active) return;
      const code = ev.error === "not-allowed" || ev.error === "service-not-allowed" ? "MIC_DENIED" : "RECOGNITION";
      this.onError(code, ev.message ?? ev.error);
    };
    rec.onend = () => {
      this.active = false;
    };
    try {
      rec.start();
    } catch {
      this.onError("START_FAILED", "Gagal menyalakan mic.");
    }
  }

  stop(): void {
    this.active = false;
    try {
      this.rec?.stop();
    } catch {
      // abaikan
    }
  }
}

/** Engine palsu untuk tes/E2E (?stt=fake): inject transkrip via window.__stt. */
export class FakeSttEngine implements SttEngine {
  readonly supported = true;
  onInterim: (text: string) => void = () => {};
  onFinal: (result: SttResult) => void = () => {};
  onError: (code: string, message: string) => void = () => {};
  private active = false;

  start(): void {
    this.active = true;
    (window as unknown as { __stt?: object }).__stt = {
      interim: (text: string) => {
        if (this.active) this.onInterim(text);
      },
      final: (transcript: string, alternatives: string[] = []) => {
        if (!this.active) return;
        this.active = false;
        this.onFinal({ transcript, isFinal: true, alternatives });
      },
      error: (code: string, message: string) => this.onError(code, message),
    };
  }

  stop(): void {
    this.active = false;
  }
}
