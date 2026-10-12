import { spawn, type ChildProcess } from "node:child_process";

/**
 * Ukur NFR-PERF-01 (event→pose) & 02 (prompt terkirim) ujung-ke-ujung.
 * - 01: prompt ke mock → caption avatar berubah ( ìread full pipeline).
 * - 02: klik kirim → mock mencatat prompt (MOCK_LOG).
 * Output: p50/p95 tiap metrik.
 *
 *   bun run ./scripts/perf.ts [--iters 5]
 */

const BUN = process.env["BUN"] ?? "/home/trytoup/.bun/bin/bun";
const ROOT = new URL("../../..", import.meta.url).pathname;

function arg(name: string, dflt: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v: string | undefined = i >= 0 ? process.argv[i + 1] : undefined;
  return v ?? dflt;
}

function pct(a: number[], p: number): number {
  if (a.length === 0) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0;
}

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
  const iters = Number(arg("iters", "5"));
  const procs: ChildProcess[] = [];
  // Kebersihan awal (seperti e2e-run).
  try {
    const { execSync } = await import("node:child_process");
    for (const p of [4498, 4317, 5173]) {
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
        // abaikan
      }
    }
    await new Promise((r) => setTimeout(r, 1500));
  } catch {
    // abaikan
  }
  const run = (cmd: string, args: string[], cwd: string, env: Record<string, string>): ChildProcess => {
    const p = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: "pipe" });
    procs.push(p);
    return p;
  };
  try {
    run(BUN, ["run", "./src/server.ts"], `${ROOT}/tools/mock-opencode`, { MOCK_PORT: "4498", MOCK_LOG: "1" });
    await waitOk("http://127.0.0.1:4498/api/info", 15000);
    await import("node:fs/promises").then((fs) => fs.rm("/tmp/mock-debug.log", { force: true }));
    run(BUN, ["run", "./src/server.ts"], `${ROOT}/apps/bridge`, {
      CODEPET_BRIDGE_PORT: "4317",
      CODEPET_DATA_DIR: "/tmp/perf-btest",
      OPENCODE_URL: "http://127.0.0.1:4498",
      CODEPET_MOCK_SCENARIO: "simple-answer",
      CODEPET_POLL_MS: "500",
      CODEPET_APPROVAL_POLL_MS: "500",
    });
    await waitOk("http://127.0.0.1:4317/health", 15000);
    run(BUN, ["run", "preview", "--port", "5173"], `${ROOT}/apps/web`, {});
    await waitOk("http://127.0.0.1:5173/", 30000);

    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    const toPose: number[] = [];
    const toEcho: number[] = [];
    try {
      const page = await browser.newPage();
      page.on("console", (m) => {
        if (m.type() === "error") console.log("PAGE-ERR:", m.text().slice(0, 200));
      });
      await page.goto("http://127.0.0.1:5173/");
      await page.getByTestId("dir-input").waitFor({ timeout: 20000 });
      const { mkdir } = await import("node:fs/promises");
      for (let i = 0; i < iters; i++) {
        const dir = `/tmp/e2e-perf-${i}`;
        await mkdir(dir, { recursive: true });
        // Buka onboarding tiap iterasi (sesi baru per direktori).
        // Iterasi 0: modal sudah terbuka dari load awal.
        if ((await page.getByTestId("dir-input").count()) === 0) {
          await page.getByTestId("dir-btn").click();
        }
        const din = page.getByTestId("dir-input");
        await din.waitFor({ timeout: 10000 });
        await din.fill(dir, { force: true });
        await page.getByTestId("dir-go").click();
        await page.getByTestId("chat-input").fill(`ukur ${i}`);
        const t0 = Date.now();
        await page.getByTestId("send-btn").click();
        // Echo lokal (NFR-PERF-02): bubble pengguna muncul.
        await page.locator(".bubble-user", { hasText: `ukur ${i}` }).waitFor({ timeout: 5000 }).catch(() => {});
        toEcho.push(Date.now() - t0);
        // Pose berubah dari idle (event→pose, NFR-PERF-01: full pipeline).
        await page
          .waitForFunction(() => document.querySelector("[data-testid=avatar-caption]")?.textContent !== "Bibo siap.", null, { timeout: 15000 })
          .catch(() => {});
        toPose.push(Date.now() - t0);
        await page.waitForTimeout(1500);
      }
    } finally {
      await browser.close();
    }
    console.log(`PERF-01 event→pose: n=${toPose.length} p50=${pct(toPose, 50)}ms p95=${pct(toPose, 95)}ms`);
    console.log(`PERF-02 klik→echo: n=${toEcho.length} p50=${pct(toEcho, 50)}ms p95=${pct(toEcho, 95)}ms`);
  } finally {
    for (const p of procs) {
      try {
        p.kill();
      } catch {
        // abaikan
      }
    }
  }
}

main().catch((e) => {
  console.error("PERF FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
