import { describe, expect, it } from "vitest";
import { actionLabel, isSpeakable, matchCommand, matchFormAnswer, normalizeCmd, type CommandContext } from "../src/voice/commands.js";
import { applyDict } from "../src/voice/dictionary.js";

const idle: CommandContext = { busy: false, ttsSpeaking: false, pending: [], muted: false };

describe("tata bahasa tertutup (PRD §9.2)", () => {
  it("stop hanya saat sibuk/berbicara", () => {
    expect(matchCommand("berhenti", { ...idle, busy: true })).toEqual({ kind: "interrupt" });
    expect(matchCommand("Stop!", { ...idle, ttsSpeaking: true })).toEqual({ kind: "interrupt" });
    expect(matchCommand("berhenti", idle)).toEqual({ kind: "text", text: "berhenti" });
  });
  it("NEGATIF: kalimat mengandung kata kunci bukan perintah", () => {
    expect(matchCommand("jangan berhenti di baris 3", { ...idle, busy: true }).kind).toBe("text");
    expect(matchCommand("tolong berhenti sebentar ya teman", { ...idle, busy: true }).kind).toBe("text");
    expect(matchCommand("ya ampun susah banget", { ...idle, pending: [{ requestID: "p", risk: "low" }] }).kind).toBe("text");
  });
  it("ya → once hanya low/medium; high ditolak suara", () => {
    expect(matchCommand("ya", { ...idle, pending: [{ requestID: "p1", risk: "medium" }] })).toEqual({
      kind: "permAllow", requestID: "p1",
    });
    expect(matchCommand("boleh", { ...idle, pending: [{ requestID: "h", risk: "high" }] }).kind).toBe("text");
    expect(matchCommand("ya", idle).kind).toBe("text"); // tanpa pending → teks biasa
  });
  it("tidak/jangan → reject untuk risiko apa pun", () => {
    expect(matchCommand("tolak", { ...idle, pending: [{ requestID: "h", risk: "high" }] })).toEqual({
      kind: "permReject", requestID: "h",
    });
  });
  it("ulangi/senyap/bicara lagi + label toast", () => {
    expect(matchCommand("ulangi", idle)).toEqual({ kind: "repeat" });
    expect(matchCommand("senyap", idle)).toEqual({ kind: "mute", to: true });
    expect(matchCommand("senyap", { ...idle, muted: true }).kind).toBe("text");
    expect(matchCommand("bicara lagi", { ...idle, muted: true })).toEqual({ kind: "mute", to: false });
    expect(actionLabel({ kind: "interrupt" })).toBe("Perintah suara: berhenti");
    expect(actionLabel({ kind: "text", text: "x" })).toBe("");
  });
  it("normalisasi: kapital + tanda baca", () => {
    expect(normalizeCmd("  BERHENTI! ")).toBe("berhenti");
  });
  it("isSpeakable menolak kosong", () => {
    expect(isSpeakable("")).toBe(false);
    expect(isSpeakable("   ")).toBe(false);
    expect(isSpeakable("halo")).toBe(true);
  });
});

describe("matchFormAnswer (pilihan tunggal)", () => {
  const fields = [{ key: "q0", title: "Warna", type: "string", options: [{ value: "Red", label: "Red" }, { value: "Blue", label: "Blue" }] }];
  it("nomor dan label", () => {
    expect(matchFormAnswer("2", fields)).toEqual({ key: "q0", value: "Blue" });
    expect(matchFormAnswer("dua", fields)).toEqual({ key: "q0", value: "Blue" });
    expect(matchFormAnswer("red", fields)).toEqual({ key: "q0", value: "Red" });
  });
  it("bukan pilihan tunggal → undefined", () => {
    expect(matchFormAnswer("2", [{ key: "a", type: "string" }])).toBeUndefined();
    expect(matchFormAnswer("hijau", fields)).toBeUndefined();
    expect(matchFormAnswer("9", fields)).toBeUndefined();
  });
});

describe("kamus koreksi (FR-054)", () => {
  it("kata utuh saja; titik/koma tak disentuh", () => {
    const d = { reakt: "React" };
    expect(applyDict("pakai reakt untuk ui", d)).toBe("pakai React untuk ui");
    expect(applyDict("reaktif banget", d)).toBe("reaktif banget");
    expect(applyDict("tulis titik koma baris baru", d)).toBe("tulis titik koma baris baru");
  });
});
