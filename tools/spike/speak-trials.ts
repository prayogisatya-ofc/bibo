/**
 * M4 DoD: 10 giliran terhadap OpenCode v2 NYATA — jalur ringkasan + teks ucapan.
 * Memakai model default server KECUALI bila BIBO_TRIAL_MODEL/Provider diset
 * (lingkungan ini: default 9router mati → fallback ke model gratis yang bekerja).
 * Putaran ganjil: instruction entry dipasang (jalur tag). Genap: tanpa entry
 * (jalur generate/heuristic). Biaya: 10 prompt kecil.
 *
 *   bun run ./speak-trials.ts [--n 10] [--out docs-M4-trials.json]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";
import { splitSpeak } from "../../apps/bridge/src/speech/parse-speak.js";
import { VOICE_INSTRUCTION_KEY, VOICE_INSTRUCTION_VALUE, clamp2 } from "../../apps/bridge/src/speech/summarize.js";

const MODEL = {
  id: process.env["BIBO_TRIAL_MODEL"] ?? "muse-spark-1.3-free",
  providerID: process.env["BIBO_TRIAL_PROVIDER"] ?? "openagentic",
};

const TASKS = [
  "Jawab singkat dalam Bahasa Indonesia: apa ibu kota Indonesia? Satu kalimat saja.",
  "Jawab singkat dalam Bahasa Indonesia: berapa 12 tambah 30? Satu kalimat saja.",
  "Jawab singkat dalam Bahasa Indonesia: sebutkan satu warna favoritmu dan alasannya. Dua kalimat maksimal.",
  "Jawab singkat dalam Bahasa Indonesia: apa fungsi air bagi tumbuhan? Dua kalimat maksimal.",
  "Jawab singkat dalam Bahasa Indonesia: siapa penulis _Laskar Pelangi_? Satu kalimat saja.",
  "Jawab singkat dalam Bahasa Indonesia: apa itu fotosintesis? Dua kalimat maksimal.",
  "Jawab singkat dalam Bahasa Indonesia: sebutkan 2 planet terdekat dari matahari. Satu kalimat saja.",
  "Jawab singkat dalam Bahasa Indonesia: kenapa langit berwarna biru? Dua kalimat maksimal.",
  "Jawab singkat dalam Bahasa Indonesia: apa kepanjangan dari CPU? Satu kalimat saja.",
  "Jawab singkat dalam Bahasa Indonesia: sebutkan 3 buah-buahan berwarna merah. Satu kalimat saja.",
];

function sentences(s: string): number {
  return s.split(/(?<=[.!?])\s+/).filter((x) => x.trim().length > 0).length;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const get = (k: string, d: string): string => {
    const i = args.indexOf(`--${k}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : d;
  };
  const n = Math.min(Number(get("n", "10")), TASKS.length);
  const work = "/tmp/speak-trials";
  await mkdir(work, { recursive: true });

  const endpoint = await Service.ensure();
  const client = OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint) });
  const info = await client.server.info();
  console.log(`server ${info.version}, model ${MODEL.providerID}/${MODEL.id}`);

  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < n; i++) {
    const withEntry = i % 2 === 0; // ganjil (1-based): pakai entry
    const session = await client.session.create({
      title: `speak-trial-${i + 1}`,
      location: { directory: work },
      model: { ...MODEL },
    });
    if (withEntry) {
      await client.session.instructions.entry.put({
        sessionID: session.id,
        key: VOICE_INSTRUCTION_KEY,
        value: VOICE_INSTRUCTION_VALUE,
      });
    }
    const task = TASKS[i] ?? "Katakan halo.";
    await client.session.prompt({ sessionID: session.id, text: task });
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 90000);
      await client.session.wait({ sessionID: session.id }, { signal: ctl.signal });
      clearTimeout(t);
    } catch {
      // lanjut baca pesan apa adanya
    }
    const msgs = (await client.message.list({ sessionID: session.id })) as {
      data?: Array<{ type?: string; text?: string; content?: Array<{ type?: string; text?: string }> }>;
    };
    const data = Array.isArray(msgs) ? msgs : (msgs.data ?? []);
    const lastAssistant = [...data].reverse().find((m) => m.type === "assistant");
    const fullText = (lastAssistant?.content ?? []).map((p) => (p.type === "text" ? p.text : "")).join("\n");
    const { display, speak } = splitSpeak(fullText);
    const tag = speak[speak.length - 1];
    let path = "tag";
    let spoken = tag ?? "";
    if (!spoken) {
      // Tiru summarize auto: coba generate sekali (8 s), lalu heuristik.
      try {
        const g = await Promise.race([
          client.session.generate({ sessionID: session.id, prompt: "Ringkas dalam 2 kalimat." }).then((r) => r.text),
          new Promise<string>((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
        ]);
        spoken = g.trim();
        path = "generate";
      } catch {
        spoken = display.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
        path = "heuristic";
      }
    }
    spoken = clamp2(spoken);
    const row = {
      trial: i + 1,
      withEntry,
      path,
      sentences: sentences(spoken),
      chars: spoken.length,
      hasCode: /```|`[^`]+`/.test(spoken),
      hasSpeakTag: /<\/?speak>/i.test(spoken),
      spoken,
      ok: sentences(spoken) <= 2 && !/<\/?speak>/i.test(spoken),
    };
    rows.push(row);
    console.log(`#${i + 1} [${withEntry ? "entry" : "no-entry"}] → ${path}: ${spoken.slice(0, 100)}`);
  }
  const okCount = rows.filter((r) => r.ok).length;
  const out = { server: info.version, model: MODEL, okCount, total: rows.length, rows };
  await writeFile(get("out", "/tmp/speak-trials.json"), JSON.stringify(out, null, 2));
  console.log(`HASIL: ${okCount}/${rows.length} ringkasan OK (≤2 kalimat, tanpa tag)`);
  process.exit(okCount >= 9 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
