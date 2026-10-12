import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { OP_ROUTES, isAllowed } from "../src/opencode/allowlist.js";

/**
 * Penegakan NFR-SEC-04: setiap pemakaian `client.<op>` di src bridge harus
 * terdaftar di OP_ROUTES dan lolos isAllowed; token grup terlarang
 * (credential/integration/pty/…) tidak boleh muncul di src.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "..", "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

const OP_RE = /client\.([a-z]+(?:\.[a-z]+)*)\.([a-zA-Z]+)\s*\(/g;

function opName(parts: string[], method: string): string | undefined {
  // client.session.form.list(...) → "session.form.list"; client.session.active() → "session.active"
  const dotted = [...parts, method].join(".");
  if (dotted === "session.message.list") return "message.list";
  return dotted;
}

describe("op-usage (NFR-SEC-04)", () => {
  it("semua operasi client terdaftar & diizinkan", () => {
    const used = new Set<string>();
    for (const f of walk(SRC)) {
      const src = readFileSync(f, "utf-8");
      for (const m of src.matchAll(OP_RE)) {
        const [, group, method] = m as unknown as [string, string, string];
        if (!group || !method) continue;
        if (["opencode"].includes(group)) continue;
        const parts = group.split(".");
        const op = opName(parts, method);
        if (op) used.add(op);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    for (const op of used) {
      const route = OP_ROUTES[op];
      expect(route, `operasi tak terdaftar: ${op}`).toBeDefined();
      expect(isAllowed(route!.method, route!.path.replace(/\{[^}]+\}/g, "x")), `rute ditolak: ${op}`).toBe(true);
    }
  });

  it("tidak ada token grup terlarang di src", () => {
    const denied = ["credential.", "integration.", ".pty.", "persistentPty", "fs.write", "config.update", "/api/pair", "auth/connect"];
    for (const f of walk(SRC)) {
      // allowlist.ts mendefinisikan daftar larangan itu sendiri (dikecualikan;
      // penegakannya lewat OP_ROUTES + isAllowed di tes atas).
      if (f.endsWith("opencode/allowlist.ts")) continue;
      const src = readFileSync(f, "utf-8");
      for (const t of denied) {
        expect(src, `${f} memuat token terlarang ${t}`).not.toContain(t);
      }
    }
  });
});
