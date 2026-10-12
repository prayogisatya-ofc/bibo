/** Struktur SVG — CHARACTER.md §3 (anatomi, ID, urutan layer). */
import { describe, expect, it } from "vitest";
import { BOT_SVG } from "../src/svg.js";

describe("BOT_SVG structure", () => {
  it('viewBox 0 0 200 200, id="bot"', () => {
    expect(BOT_SVG).toContain('id="bot"');
    expect(BOT_SVG).toContain('viewBox="0 0 200 200"');
    expect(BOT_SVG).toContain('role="img"');
  });

  it("semua ID layer §3.2 ada", () => {
    for (const id of [
      "shadow", "hands-back", "hand-l", "hand-r", "body-float", "body-nod",
      "antenna", "stem", "bulb", "bulb-core", "bulb-glint", "bulb-ring",
      "body", "body-shape", "body-glint", "visor", "visor-shape", "cheeks",
      "eyes", "eye-l", "eye-r", "mouth", "props-float", "dots",
      "q-bubble", "zzz-1", "zzz-2", "zzz-3", "sweat-1", "sweat-2",
      "props-world", "keyboard", "key-row", "sound-arcs",
      "arc-r1", "arc-r2", "arc-r3", "arc-l1", "arc-l2", "arc-l3",
      "confetti", "hands-front", "fx",
    ]) {
      expect(BOT_SVG, `id="${id}"`).toContain(`id="${id}"`);
    }
  });

  it("urutan layer belakang→depan benar", () => {
    const order = ["hands-back", "body-float", "props-world", "hands-front", "fx"];
    const idx = order.map((id) => BOT_SVG.indexOf(`id="${id}"`));
    for (let i = 1; i < idx.length; i++) {
      expect(idx[i]).toBeGreaterThan(idx[i - 1] as number);
    }
  });

  it("bank ekspresi: 9 varian mata, 7 varian mulut", () => {
    for (const v of ["e-open", "e-blink", "e-happy", "e-focus", "e-wide", "e-worried", "e-sleep", "e-flat", "e-down"]) {
      expect(BOT_SVG, v).toContain(v);
    }
    for (const v of ["m-smile", "m-flat", "m-o", "m-bigsmile", "m-wavy", "m-open", "m-yawn"]) {
      expect(BOT_SVG, v).toContain(v);
    }
  });

  it("geometri §3.1: badan, visor, mata, antena", () => {
    expect(BOT_SVG).toContain('x="40" y="60" width="120" height="106" rx="46"'); // badan
    expect(BOT_SVG).toContain('x="57" y="86" width="86" height="50" rx="23"'); // visor
    expect(BOT_SVG).toContain("M100 62 V46"); // batang antena
    expect(BOT_SVG).toContain('cx="100" cy="39" r="8.5"'); // lampu
    expect(BOT_SVG).toContain('cx="100" cy="178" rx="50" ry="7"'); // bayangan
  });

  it("palet §2 hanya sebagai CSS variables", () => {
    for (const v of ["--bot-body", "--bot-visor", "--bot-eye", "--bot-info", "--bot-ok", "--bot-ask", "--bot-bad", "--bot-stage"]) {
      expect(BOT_SVG, v).toContain(v);
    }
    // Tema terang sebagai override [data-theme="light"].
    expect(BOT_SVG).toContain('[data-theme="light"]');
  });

  it("atribut data-* kontrak §12 ada", () => {
    for (const a of ["data-pose", "data-variant", "data-mood", "data-speaking"]) {
      expect(BOT_SVG, a).toContain(a);
    }
  });

  it("template < 20 KB (bujet §13)", () => {
    expect(BOT_SVG.length).toBeLessThan(20 * 1024);
  });
});
