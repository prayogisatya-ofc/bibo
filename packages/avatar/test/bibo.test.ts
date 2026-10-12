import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AVATAR_POSES } from "@codepet/protocol";
import { BiboSVG, POSES } from "../src/bibo.js";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "..", "src");

describe("budget ukuran (FR paket avatar)", () => {
  it("SVG < 40 KB", () => {
    expect(Buffer.byteLength(BiboSVG, "utf-8")).toBeLessThan(40 * 1024);
  });
  it("paket < 60 KB gzip", () => {
    let total = 0;
    for (const f of readdirSync(SRC)) {
      if (f.endsWith(".ts")) {
        total += gzipSync(readFileSync(join(SRC, f))).length;
      }
    }
    expect(total).toBeLessThan(60 * 1024);
  });
});

describe("identitas karakter (PRD §8.4)", () => {
  it("14 pose terdefinisi, badge hanya tersembunyi saat idle", () => {
    expect(AVATAR_POSES).toHaveLength(14);
    for (const pose of AVATAR_POSES) {
      expect(POSES[pose], pose).toBeDefined();
    }
    const hidden = (Object.keys(POSES) as Array<keyof typeof POSES>).filter((p) => POSES[p]?.badge === null);
    expect(hidden).toEqual(["idle"]);
  });
  it("tanpa mulut/alis/pipi/hidung", () => {
    const lower = BiboSVG.toLowerCase();
    for (const pat of [/<mouth[\s>]/, /<nose[\s>]/, /id="mouth"/, /id="nose"/, /id="cheek"/, /id="brow"/, /id="eyebrow"/, /class="[^"]*mouth/]) {
      expect(lower).not.toMatch(pat);
    }
    // "ellipse" memang mengandung "lip" — pastikan hanya itu kemunculannya.
    expect(lower.replaceAll("ellipse", "")).not.toContain("lip");
  });
  it("semua ID grup hierarki PRD ada", () => {
    for (const id of ["bibo", "ground-shadow", "hand-left", "hand-right", "body-wrap", "body", "body-highlight", "face", "eyes", "badge", "badge-bg", "badge-icon", "props"]) {
      expect(BiboSVG).toContain(`id="${id}"`);
    }
  });
  it("tag g seimbang (tidak ada grup tak tertutup)", () => {
    const opens = BiboSVG.match(/<g[\s>]/g)?.length ?? 0;
    const closes = BiboSVG.match(/<\/g>/g)?.length ?? 0;
    expect(closes).toBe(opens);
  });
  it("tangan melayang terpisah dari badan (idle)", () => {
    const idle = POSES["idle"];
    expect(idle).toBeDefined();
    // Tepi badan: x 120..360, y 64..236. Jarak pusat tangan ke tepi ≥ 10 px.
    const [lx, ly] = idle?.handL ?? [0, 0];
    const [rx, ry] = idle?.handR ?? [0, 0, 0];
    expect(120 - lx).toBeGreaterThanOrEqual(10);
    expect(rx - 360).toBeGreaterThanOrEqual(10);
    expect(ly).toBeGreaterThan(64);
    expect(ry).toBeGreaterThan(64);
  });
});
