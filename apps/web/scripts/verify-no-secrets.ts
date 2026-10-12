import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * DoD M2: tidak ada rahasia/token OpenCode di bundle web.
 * Build dulu, lalu pindai dist untuk pola rahasia umum.
 * Pola yang DIIZINKAN: URL bridge default (konfigurasi, bukan rahasia),
 * kata "token" pada kode bootstrap (nilainya diambil runtime via /bootstrap).
 */

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

function files(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(js|css|html|map)$/.test(e)) out.push(p);
  }
  return out;
}

const DENIED: RegExp[] = [
  /sk-[A-Za-z0-9_-]{16,}/,
  /thk_[A-Za-z0-9._-]+/,
  /apiKey/i,
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /Basic [A-Za-z0-9+/=]{16,}/,
  /Bearer [A-Za-z0-9._~-]{16,}/,
];

function main(): void {
  console.log("[verify] building web...");
  execSync("bunx vite build", { stdio: "inherit", cwd: join(dirname(fileURLToPath(import.meta.url)), "..") });
  const hits: string[] = [];
  for (const f of files(DIST)) {
    const content = readFileSync(f, "utf-8");
    for (const re of DENIED) {
      if (re.test(content)) hits.push(`${f}: ${re}`);
    }
  }
  if (hits.length > 0) {
    console.error(`[verify] RAHASIA DITEMUKAN:\n${hits.join("\n")}`);
    process.exit(1);
  }
  console.log("[verify] OK: tidak ada pola rahasia di dist/");
}

main();
