import { describe, expect, it, vi } from "vitest";
import { TtsEngine, chunkSentences, sanitizeForSpeech, type UtteranceLike } from "../src/voice/tts.js";

function stub() {
  const spoken: UtteranceLike[] = [];
  let now = 1000;
  const rafCbs = new Map<number, () => void>();
  let rafId = 0;
  const synth = {
    speak(u: UtteranceLike) {
      spoken.push(u);
    },
    cancel() {},
    getVoices: () => [
      { uri: "en", name: "English", lang: "en-US" },
      { uri: "id", name: "Bahasa", lang: "id-ID" },
    ],
    onvoiceschanged: null,
  };
  const make = (text: string): UtteranceLike => ({
    text, lang: "", rate: 1, pitch: 1, volume: 1, voice: null,
    onend: null, onerror: null, onboundary: null,
  });
  const eng = new TtsEngine(synth, make, {
    now: () => now,
    random: () => 0.5,
    raf: (cb) => ++rafId && (rafCbs.set(rafId, cb), rafId),
    cancelRaf: (id) => void rafCbs.delete(id),
  });
  return {
    eng, spoken, synth,
    finish: () => {
      const u = spoken[spoken.length - 1];
      u?.onend?.();
    },
    step: (ms: number, frames: number) => {
      for (let i = 0; i < frames; i++) {
        now += ms;
        for (const cb of [...rafCbs.values()]) cb();
      }
    },
  };
}

describe("chunk + sanitize (FR-022)", () => {
  it("potong per kalimat ≤180", () => {
    const chunks = chunkSentences(`${"Kalimat pertama. "} ${"Kalimat kedua yang cukup panjang untuk diuji. ".repeat(6)}`);
    expect(chunks.every((c) => c.length <= 180)).toBe(true);
    expect(chunks.length).toBeGreaterThan(1);
  });
  it("sanitize: buang kode/URL, path jadi nama file", () => {
    const s = sanitizeForSpeech("Lihat `App.tsx` di src/components/App.tsx dan https://panjang.id/x.\n```ts\ncode();\n```");
    expect(s).not.toContain("```");
    expect(s).not.toContain("https://");
    expect(s).toContain("App.tsx");
    expect(s).not.toContain("src/components");
  });
});

describe("antrean & prioritas", () => {
  it("urgent menyela normal", () => {
    const t = stub();
    t.eng.speak("a", "pesan normal yang panjang", "normal");
    expect(t.spoken).toHaveLength(1);
    t.eng.speak("b", "izin penting", "urgent");
    expect(t.spoken).toHaveLength(2);
    expect(t.spoken[1]?.text).toContain("izin penting");
  });
  it("normal hanya terbaru (usang dibuang)", () => {
    const t = stub();
    t.eng.speak("a", "lama", "normal");
    t.eng.speak("b", "baru", "normal");
    t.finish();
    t.finish();
    // Setelah 'lama' selesai (1 chunk), 'baru' jalan; 'lama' tak diulang.
    expect(t.eng.spoken).toEqual(["lama", "baru"]);
  });
  it("cancel menghentikan + level 0 seketika", () => {
    const t = stub();
    const levels: number[] = [];
    t.eng.onLevel = (l) => levels.push(l);
    t.eng.speak("a", "halo dunia", "normal");
    t.step(40, 3);
    expect(levels.length).toBeGreaterThan(0);
    expect(Math.max(...levels)).toBeGreaterThan(0);
    t.eng.cancel();
    expect(levels[levels.length - 1]).toBe(0);
  });
  it("level di 0..1 (overlay speaking)", () => {
    const t = stub();
    const levels: number[] = [];
    t.eng.onLevel = (l) => levels.push(l);
    t.eng.speak("a", "halo dunia test", "normal");
    t.step(40, 10);
    expect(levels.every((l) => l >= 0 && l <= 1)).toBe(true);
  });
  it("suara id-ID dipilih; default + peringatan bila tak ada", () => {
    const t = stub();
    expect(t.eng.pickVoice()?.lang).toBe("id-ID");
    expect(t.eng.usingDefaultVoice).toBe(false);
  });
  it("tidak assign objek polos ke utterance (bug voice asli)", () => {
    const t = stub();
    t.eng.speak("a", "halo dunia", "normal");
    const u = t.spoken[t.spoken.length - 1];
    // Stub tanpa ref → voice null (browser pakai default), bukan objek polos.
    expect(u?.voice).toBeNull();
  });
  it("ref suara asli diteruskan ke utterance", () => {
    const t = stub();
    const real = { fake: "voice" };
    (t.synth as unknown as { getVoices: () => Array<{ uri: string; name: string; lang: string; ref: unknown }> }).getVoices =
      () => [{ uri: "id", name: "Bahasa", lang: "id-ID", ref: real }];
    t.eng.speak("a", "halo dunia", "normal");
    expect(t.spoken[t.spoken.length - 1]?.voice).toBe(real as never);
  });
  it("mute membisu", () => {
    const t = stub();
    t.eng.setSettings({ muted: true });
    t.eng.speak("a", "halo", "urgent");
    expect(t.spoken).toHaveLength(0);
  });
});

describe("callback bubble (fase C, aditif)", () => {
  it("onChunk per chunk; onUtteranceEnd saat selesai", () => {
    const t = stub();
    const chunks: Array<[string, string, number]> = [];
    const ended: string[] = [];
    t.eng.onChunk = (id, chunk, idx) => chunks.push([id, chunk, idx]);
    t.eng.onUtteranceEnd = (id) => ended.push(id);
    t.eng.speak("a", "Kalimat satu. Kalimat dua. Kalimat tiga.", "normal");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]?.[0]).toBe("a");
    expect(chunks.map((c) => c[2])).toEqual(chunks.map((_, i) => i));
    t.finish();
    expect(ended).toEqual(["a"]);
  });
  it("onUtteranceEnd dipanggil saat cancel", () => {
    const t = stub();
    const ended: string[] = [];
    t.eng.onUtteranceEnd = (id) => ended.push(id);
    t.eng.speak("a", "halo dunia", "normal");
    t.eng.cancel();
    expect(ended).toEqual(["a"]);
  });
});
