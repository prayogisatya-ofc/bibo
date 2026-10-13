import { spawn, type ChildProcess } from "node:child_process";

/**
 * Orkestrasi E2E: mock + bridge + web, lalu playwright, lalu matikan semua.
 *   bun run ./scripts/e2e-run.ts --scenario simple-answer --grep "simple-answer"
 */

function arg(name: string, dflt: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v: string | undefined = i >= 0 ? process.argv[i + 1] : undefined;
  return v ?? dflt;
}

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

async function waitFree(port: number, ms: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      await fetch(`http://127.0.0.1:${port}/`);
    } catch {
      return; // koneksi ditolak = bebas
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function assertFree(ports: number[]): Promise<void> {
  for (const p of ports) {
    try {
      await fetch(`http://127.0.0.1:${p}/`, { signal: AbortSignal.timeout(2000) });
      throw new Error(`port ${p} masih dipakai setelah cleanup — abort`);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("port ")) throw e;
      // ditolak = bebas, lanjut
    }
  }
}

async function freePorts(ports: number[]): Promise<void> {
  const { execSync } = await import("node:child_process");
  for (const p of ports) {
    try {
      const out = execSync(`ss -ltnp 2>/dev/null | grep ":${p} " | grep -oP 'pid=\\K[0-9]+' | head -3`, { encoding: "utf-8" });
      for (const pid of out.split("\n").filter(Boolean)) {
        try {
          execSync(`kill -9 ${pid}`);
        } catch {
          // abaikan
        }
      }
    } catch {
      // abaikan (ss tak tersedia)
    }
  }
}

async function main(): Promise<void> {
  const scenario = arg("scenario", "simple-answer");
  const grep = arg("grep", "");
  const procs: ChildProcess[] = [];
  await freePorts([4498, 4317, 5173]);
  await assertFree([4498, 4317, 5173]);
  // Store bridge segar per leg (tanpa sesi basi dari leg/run sebelumnya).
  {
    const { rm, mkdir } = await import("node:fs/promises");
    await rm("/tmp/e2e-btest", { recursive: true, force: true });
    await mkdir("/tmp/e2e-btest", { recursive: true });
  }
  // Direktori sesi E2E harus ada (server nyata 500 bila tak ada).
  {
    const { mkdir } = await import("node:fs/promises");
    for (const d of [
      "/tmp/e2e-simple", "/tmp/e2e-edit", "/tmp/e2e-pose-edit", "/tmp/e2e-pose-perm",
      "/tmp/e2e-pose-silent", "/tmp/e2e-pose-drop", "/tmp/e2e-speak", "/tmp/e2e-speak2",
      "/tmp/e2e-voice-ok", "/tmp/e2e-voice-barge", "/tmp/e2e-voice-nomic", "/tmp/e2e-voice-stop",
      "/tmp/e2e-voice-negyes", "/tmp/e2e-voice-negsub", "/tmp/bibo-smoke",
      "/tmp/e2e-safe-med", "/tmp/e2e-safe-high", "/tmp/e2e-safe-form",
      "/tmp/e2e-mode", "/tmp/e2e-talk-med", "/tmp/e2e-talk-high", "/tmp/e2e-esc", "/tmp/e2e-sess-a", "/tmp/e2e-sess-b",
      "/tmp/e2e-a11y", "/tmp/e2e-a11y-perm", "/tmp/e2e-a11y-talk", "/tmp/e2e-tts-lat",
    ]) {
      await mkdir(d, { recursive: true });
    }
  }
  const run = (cmd: string, args: string[], cwd: string, env: Record<string, string>): ChildProcess => {
    const p = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: "pipe" });
    p.stderr?.on("data", () => {});
    procs.push(p);
    return p;
  };
  try {
    run(BUN, ["run", "./src/server.ts"], `${ROOT}/tools/mock-opencode`, { MOCK_PORT: "4498", MOCK_LOG: "1" });
    await waitOk("http://127.0.0.1:4498/api/info", 15000);
    run(BUN, ["run", "./src/server.ts"], `${ROOT}/apps/bridge`, {
      BIBO_BRIDGE_PORT: "4317",
      BIBO_DATA_DIR: "/tmp/e2e-btest",
      OPENCODE_URL: "http://127.0.0.1:4498",
      BIBO_MOCK_SCENARIO: scenario,
      BIBO_POLL_MS: "500",
      BIBO_APPROVAL_POLL_MS: "500",
    });
    await waitOk("http://127.0.0.1:4317/health", 15000);
    run(BUN, ["run", "preview", "--port", "5173"], `${ROOT}/apps/web`, {});
    await waitOk("http://127.0.0.1:5173/", 30000);
    const { execSync } = await import("node:child_process");
    execSync(`bunx playwright test ${grep ? `--grep "${grep}"` : ""}`, {
      cwd: `${ROOT}/apps/web`,
      stdio: "inherit",
    });
    console.log("E2E OK");
  } finally {
    for (const p of procs) {
      try {
        p.kill();
      } catch {
        // abaikan
      }
    }
    await freePorts([4498, 4317, 5173]);
    await waitFree(4498, 10000);
    await waitFree(4317, 10000);
    await waitFree(5173, 10000);
  }
}

main().catch((e) => {
  console.error("E2E FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
