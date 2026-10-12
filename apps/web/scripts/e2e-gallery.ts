import { spawn, type ChildProcess } from "node:child_process";

/** Galeri visual: hanya butuh web preview (tanpa mock/bridge). */

const BUN = process.env["BUN"] ?? "/home/trytoup/.bun/bin/bun";
const ROOT = new URL("../../..", import.meta.url).pathname;

async function waitOk(url: string, ms: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // coba lagi
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`timeout ${url}`);
}

async function main(): Promise<void> {
  let web: ChildProcess | undefined;
  try {
    web = spawn(BUN, ["run", "preview", "--port", "5173"], {
      cwd: `${ROOT}/apps/web`,
      env: process.env,
      stdio: "pipe",
    });
    await waitOk("http://127.0.0.1:5173/", 30000);
    const { execSync } = await import("node:child_process");
    execSync(`bunx playwright test e2e/avatar.spec.ts`, { cwd: `${ROOT}/apps/web`, stdio: "inherit" });
    console.log("GALLERY OK");
  } finally {
    web?.kill();
  }
}

main().catch((e) => {
  console.error("GALLERY FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
