import { spawn, type ChildProcess } from "node:child_process";

/**
 * smoke:real — bridge vs OpenCode v2 NYATA + ws-cli prompt "halo".
 * Syarat: model default OpenCode hidup dan direktori valid.
 *   bun run --filter ws-cli smoke-real
 */

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
  let bridge: ChildProcess | undefined;
  try {
    const { mkdir } = await import("node:fs/promises");
    await mkdir("/tmp/breal", { recursive: true });
    await mkdir("/tmp/breal-chat", { recursive: true });
    bridge = spawn(BUN, ["run", "./src/server.ts"], {
      cwd: `${ROOT}/apps/bridge`,
      env: { ...process.env, CODEPET_BRIDGE_PORT: "4318", CODEPET_DATA_DIR: "/tmp/breal" },
      stdio: "pipe",
    });
    await waitOk("http://127.0.0.1:4318/health", 30000);
    const { execSync } = await import("node:child_process");
    execSync(
      `${BUN} run ./src/index.ts --bridge ws://127.0.0.1:4318 --dataDir /tmp/breal --prompt "halo" --dir /tmp/breal-chat --timeout 120000`,
      { cwd: `${ROOT}/tools/ws-cli`, stdio: "inherit" },
    );
    console.log("SMOKE:REAL OK");
  } finally {
    bridge?.kill();
  }
}

main().catch((e) => {
  console.error("SMOKE:REAL FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
