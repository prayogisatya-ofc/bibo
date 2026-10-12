/** Bujet ukuran — CHARACTER.md §13: paket avatar < 60 KB gzip. */
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

describe("budget", () => {
  it("paket avatar (src) < 60 KB gzip", () => {
    const files = readdirSync(srcDir).filter((f) => f.endsWith(".ts")).sort();
    expect(files.length).toBeGreaterThan(0);
    const combined = files.map((f) => readFileSync(join(srcDir, f), "utf8")).join("\n");
    const gz = gzipSync(combined);
    expect(gz.length).toBeLessThan(60 * 1024);
  });
});
