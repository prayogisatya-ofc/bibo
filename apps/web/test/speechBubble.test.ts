import { describe, expect, it } from "vitest";
import {
  bubbleText,
  reduceBubble,
  splitSentences,
  type Bubble,
} from "../src/ui/speechBubble.js";

describe("splitSentences / bubbleText", () => {
  it("pisah pada . ! ? …", () => {
    expect(splitSentences("Halo! Apa kabar? Baik… ya.")).toEqual(["Halo!", "Apa kabar?", "Baik…", "ya."]);
  });
  it("dua kalimat terakhir; satu kalimat tetap utuh", () => {
    expect(bubbleText("Satu. Dua. Tiga.")).toBe("Dua. Tiga.");
    expect(bubbleText("Hanya satu.")).toBe("Hanya satu.");
    expect(bubbleText("")).toBe("");
  });
});

describe("reduceBubble (mesin status bubble §C.4)", () => {
  const speak = { type: "speak", id: "s1", text: "Satu. Dua. Tiga.", urgent: false, error: false } as const;

  it("speak memunculkan bubble (pop key baru, dua kalimat terakhir)", () => {
    const b = reduceBubble(null, speak);
    expect(b).toMatchObject({ id: "s1", text: "Dua. Tiga.", tone: "normal", fading: false });
    expect(b?.key).toBe(1);
  });
  it("sentence mengganti teks tampil mengikuti chunk TTS", () => {
    let b = reduceBubble(null, speak);
    b = reduceBubble(b, { type: "sentence", id: "s1", text: "Empat. Lima. Enam." });
    expect(b?.text).toBe("Lima. Enam.");
    // id lain diabaikan
    const same = reduceBubble(b, { type: "sentence", id: "sX", text: "Zzz." });
    expect(same).toBe(b);
  });
  it("urgent langsung menggantikan (key naik, tone urgent)", () => {
    let b = reduceBubble(null, speak);
    const b2 = reduceBubble(b, { type: "speak", id: "s2", text: "Boleh?", urgent: true, error: false });
    expect(b2?.tone).toBe("urgent");
    expect(b2?.key).toBe((b?.key ?? 0) + 1);
    expect(b2?.fading).toBe(false);
  });
  it("error memakai tone error", () => {
    const b = reduceBubble(null, { type: "speak", id: "e1", text: "Gagal.", urgent: true, error: true });
    expect(b?.tone).toBe("error");
  });
  it("speechend → fading; faded → hilang", () => {
    const b0: Bubble = { id: "s1", key: 1, text: "Dua.", tone: "normal", fading: false };
    const b1 = reduceBubble(b0, { type: "speechend", id: "s1" });
    expect(b1?.fading).toBe(true);
    expect(b1?.text).toBe("Dua.");
    expect(reduceBubble(b1, { type: "faded" })).toBeNull();
  });
  it("speak baru saat fading menggantikan seketika", () => {
    const b0: Bubble = { id: "s1", key: 1, text: "Dua.", tone: "normal", fading: true };
    const b = reduceBubble(b0, { type: "speak", id: "s2", text: "Hai.", urgent: false, error: false });
    expect(b?.fading).toBe(false);
    expect(b?.id).toBe("s2");
  });
  it("sentence diabaikan saat fading", () => {
    const b0: Bubble = { id: "s1", key: 1, text: "Dua.", tone: "normal", fading: true };
    expect(reduceBubble(b0, { type: "sentence", id: "s1", text: "Tiga." })).toBe(b0);
  });
});
