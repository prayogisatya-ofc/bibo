import { readdirSync, statSync } from "node:fs";
import { join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Regresi: dua file dalam satu direktori yang namanya hanya beda huruf
 * besar/kecil (mis. speechBubble.ts vs SpeechBubble.tsx) lolos di Linux
 * tapi merusak checkout & bundling di Windows/macOS (filesystem
 * case-insensitive). Contoh nyata: TalkMode.tsx mengimpor
 * "./SpeechBubble.js" yang di Windows malah ter-resolve ke
 * speechBubble.ts sehingga build gagal dengan "No matching export".
 */
function testDir(): string {
  const im = import.meta as unknown as { dirname?: string; url: string };
  if (im.dirname) return im.dirname;
  try {
    return fileURLToPath(new URL(".", im.url));
  } catch {
    return join(process.cwd(), "test");
  }
}

const JS_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      yield* walk(p);
    } else if (JS_EXT.has(parse(entry).ext.toLowerCase())) {
      yield p;
    }
  }
}

describe("nama file aman untuk filesystem case-insensitive", () => {
  it("tidak ada dua file sedirektori yang namanya hanya beda casing", () => {
    const root = join(testDir(), "..", "..");
    const seen = new Map<string, string[]>();
    for (const f of walk(root)) {
      const { dir, name } = parse(f);
      const key = `${dir}::${name.toLowerCase()}`;
      const arr = seen.get(key) ?? [];
      arr.push(f);
      seen.set(key, arr);
    }
    const collisions = [...seen.values()].filter((v) => v.length > 1);
    expect(collisions, JSON.stringify(collisions, null, 2)).toEqual([]);
  });
});
