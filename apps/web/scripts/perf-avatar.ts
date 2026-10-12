import { spawn, execSync, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

/**
 * Performa avatar fase E (CHARACTER.md §13): fps (penghitung rAF di halaman)
 * + perkiraan CPU selama 10 dtk pada pose celebrate dan working,
 * memakai galeri ?dev=avatar. Target: ≥55fps di kelas laptop; VM ini
 * mungkin berbeda — angka dilaporkan apa adanya.
 *
 *   bun run ./scripts/perf-avatar.ts
 * Output: docs/reports/avatar-ui/PERF.md (+ stdout)
 */

const BUN = process.env["BUN"] ?? "/home/trytoup/.bun/bin/bun";
const ROOT = new URL("../../..", import.meta.url).pathname;
const OUT = `${ROOT}/docs/reports/avatar-ui`;

/** Jumlahkan %CPU semua proses chromium/chrome saat ini. */
function chromeCpu(): number {
  try {
    const out = execSync(`ps -eo pcpu,comm | awk '$2 ~ /chrom/ {s+=$1} END {print s+0}'`, { encoding: "utf-8" });
    return Number(out.trim()) || 0;
  } catch {
    return 0;
  }
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

async function measure(url: string, seconds: number): Promise<{ fps: number; cpuMean: number; cpuMax: number }> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(url);
  await page.getByTestId("dev-stage").waitFor({ timeout: 15000 });
  await page.waitForTimeout(1000); // pemanasan

  const cpuSamples: number[] = [];
  const sampler = setInterval(() => cpuSamples.push(chromeCpu()), 1000);
  const fps = await page.evaluate(
    (secs) =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = (): void => {
          frames++;
          if (performance.now() - start < secs * 1000) requestAnimationFrame(tick);
          else resolve((frames / (performance.now() - start)) * 1000);
        };
        requestAnimationFrame(tick);
      }),
    seconds,
  );
  clearInterval(sampler);
  // Satu sampel akhir agar jendela 10 dtk terwakili.
  cpuSamples.push(chromeCpu());
  await browser.close();
  const cpuMean = cpuSamples.reduce((a, b) => a + b, 0) / Math.max(1, cpuSamples.length);
  const cpuMax = Math.max(...cpuSamples, 0);
  return { fps, cpuMean, cpuMax };
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

    const targets = [
      { name: "celebrate", url: "http://127.0.0.1:5173/?dev=avatar&pose=celebrate&theme=dark&seed=1234" },
      { name: "working (typing)", url: "http://127.0.0.1:5173/?dev=avatar&pose=working&variant=typing&theme=dark&seed=1234" },
    ];
    const rows: string[] = [];
    for (const t of targets) {
      console.log(`mengukur ${t.name} (10 dtk)…`);
      const m = await measure(t.url, 10);
      const line = `${t.name}: fps=${m.fps.toFixed(1)} cpu_mean=${m.cpuMean.toFixed(1)}% cpu_max=${m.cpuMax.toFixed(1)}%`;
      console.log(line);
      rows.push(`| ${t.name} | ${m.fps.toFixed(1)} | ${m.cpuMean.toFixed(1)}% | ${m.cpuMax.toFixed(1)}% |`);
    }

    await mkdir(OUT, { recursive: true });
    const md = [
      "# Performa Avatar (fase E)",
      "",
      `Tanggal: ${new Date().toISOString().slice(0, 10)} · headless Chromium · viewport 1280x800 · galeri ?dev=avatar (animasi berjalan, seed 1234)`,
      "CPU = jumlah %CPU semua proses chromium (ps, sampel 1 dtk) — perkiraan kasar, bukan profiling.",
      "",
      "Target CHARACTER.md §13: ≥55fps di kelas laptop. VM ini (headless, tanpa GPU) mungkin berbeda — angka di bawah apa adanya.",
      "",
      "| Pose | fps (rAF, 10 dtk) | CPU rata-rata | CPU maks |",
      "|---|---|---|---|",
      ...rows,
      "",
    ].join("\n");
    await writeFile(`${OUT}/PERF.md`, md);
    console.log("PERF.md ditulis");
  } finally {
    web?.kill();
  }
}

main().catch((e) => {
  console.error("PERF FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
