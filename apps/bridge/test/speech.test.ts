import { describe, expect, it } from "vitest";
import { SpeakTracker, safeDisplay, splitSpeak } from "../src/speech/parse-speak.js";
import { clamp2, phrase, summarize } from "../src/speech/summarize.js";

describe("splitSpeak", () => {
  it("ekstrak blok + tampilan bersih", () => {
    const r = splitSpeak("Hasil kerja. <speak>Sudah beres, dua file berubah.</speak> Detail teknis.");
    expect(r.speak).toEqual(["Sudah beres, dua file berubah."]);
    expect(r.display).toBe("Hasil kerja.  Detail teknis.");
    expect(r.display).not.toContain("<speak>");
  });
  it("blok tak lengkap di final → dianggap speak", () => {
    const r = splitSpeak("Kerja. <speak>ringkasan terpotong");
    expect(r.speak).toEqual(["ringkasan terpotong"]);
    expect(r.display).toBe("Kerja.");
  });
  it("tanpa blok → speak kosong", () => {
    expect(splitSpeak("halo dunia").speak).toEqual([]);
  });
});

describe("SpeakTracker streaming", () => {
  it("menyembunyikan blok terpotong antar-delta", () => {
    const t = new SpeakTracker();
    expect(t.push("m", "Hasil ")).toBe("Hasil ");
    expect(t.push("m", "kerja <speak>rin")).toBe("kerja ");
    expect(t.push("m", "gkasan")).toBe(""); // masih di dalam blok
    expect(t.push("m", "</speak> selesai")).toBe(" selesai");
    const fin = t.done("m");
    expect(fin.display).toBe("Hasil kerja  selesai");
    expect(fin.speak).toEqual(["ringkasan"]);
  });
  it("buka-tanpa-tutup tak pernah bocor ke tampilan", () => {
    expect(safeDisplay("abc <speak>def")).toBe("abc ");
  });
});

describe("summarize tiga jalur", () => {
  it("tag diutamakan", async () => {
    const r = await summarize({ text: "Panjang. <speak>Singkat saja.</speak>", files: [] }, "auto");
    expect(r).toEqual({ text: "Singkat saja.", path: "tag" });
  });
  it("generate bila tanpa tag", async () => {
    const r = await summarize({ text: "Tanpa tag sama sekali di sini.", files: [], generate: async () => "Ringkasan generate." }, "auto");
    expect(r.path).toBe("generate");
  });
  it("heuristik bila generate gagal; sebut jumlah file", async () => {
    const r = await summarize(
      { text: "```kode```", files: [{ path: "a.ts" }, { path: "b.ts" }], generate: async () => { throw new Error("x"); } },
      "auto",
    );
    expect(r.path).toBe("heuristic");
    expect(r.text).toContain("2 file");
    expect(r.text).not.toContain("```");
  });
  it("clamp2: maks 2 kalimat", () => {
    expect(clamp2("Satu. Dua. Tiga.")).toBe("Satu. Dua.");
  });
  it("phrase en + tak berulang berturut-turut", () => {
    expect(phrase("ack", "en")).not.toBe("Oke, kukerjakan.");
    expect(phrase("ack", "id")).not.toBe("Okay, on it.");
    const seen = new Set([phrase("ack"), phrase("ack"), phrase("ack"), phrase("ack"), phrase("ack"), phrase("ack")]);
    expect(seen.size).toBeGreaterThan(1);
  });
});
