/**
 * M0 spike: capture raw OpenCode v2 events + polling snapshots per scenario.
 *
 * Usage:
 *   bun run ./capture-events.ts [--scenario <name|all>] [--out <dir>] [--work <dir>]
 *
 * Output (per scenario <name>):
 *   <out>/<name>.jsonl        raw V2 events, one JSON object per line (unmodified)
 *   <out>/<name>.poll.jsonl   polling snapshots {at, active, permissions, forms, messages}
 *   <out>/_summary.json       versions, per-scenario event counts, verification results
 *
 * Requires: `opencode` binary on PATH (uses Service.ensure -> `opencode serve --service`).
 * Costs tokens: 6 small prompts. Time-boxed per scenario.
 */
import { mkdir, writeFile, appendFile, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";

type Args = { scenario: string; out: string; work: string };

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (k: string, d: string) => {
    const i = a.indexOf(`--${k}`);
    return i >= 0 && a[i + 1] ? a[i + 1] : d;
  };
  return {
    scenario: get("scenario", "all"),
    out: get("out", resolve(process.cwd(), "../../docs/fixtures/opencode-events")),
    work: get("work", "/tmp/spike-work"),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Model pinned for the M0 spike: free tier, tool-capable, verified working 2026-10-11.
 *  Default model (9router, http://127.0.0.1:20128) is DOWN in this env (see 00-provider-failure). */
const SPIKE_MODEL = { id: "muse-spark-1.3-free", providerID: "openagentic" } as const;

/** Strip secrets before writing anything to fixtures or logs. */
function redact(value: unknown): unknown {
  const secretKeys = new Set(["apiKey", "api_key", "token", "password", "authorization", "secret", "key"]);
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = secretKeys.has(k) ? "<redacted>" : redact(v);
    }
    return out;
  }
  if (typeof value === "string") {
    // Redact bearer-ish tokens and sk- keys embedded in strings.
    if (/sk-[A-Za-z0-9_-]{8,}/.test(value) || /Bearer\s+[A-Za-z0-9._~-]{8,}/i.test(value)) return "<redacted-string>";
  }
  return value;
}

type ScenarioDef = {
  name: string;
  prompt: string;
  createOpts?: Record<string, unknown>;
  maxWaitMs: number;
  afterPrompt?: (ctx: ScenarioCtx) => Promise<void>;
};

type ScenarioCtx = {
  client: ReturnType<typeof OpenCode.make>;
  sessionID: string;
  workdir: string;
  note: (s: string) => void;
  verification: Record<string, unknown>;
};

async function pollSnapshot(client: ReturnType<typeof OpenCode.make>, sessionID: string) {
  const at = new Date().toISOString();
  const snap: Record<string, unknown> = { at, sessionID };
  try {
    snap.active = await client.session.active();
  } catch (e) {
    snap.activeError = String(e);
  }
  try {
    snap.permissionPending = await client.permission.request.list({});
  } catch (e) {
    snap.permissionsError = String(e);
  }
  try {
    snap.sessionPermissions = await client.permission.list({ sessionID });
  } catch (e) {
    snap.sessionPermissionsError = String(e);
  }
  try {
    snap.forms = await client.session.form.list({ sessionID });
  } catch (e) {
    snap.formsError = String(e);
  }
  try {
    snap.globalForms = await client.form.list({});
  } catch (e) {
    snap.globalFormsError = String(e);
  }
  try {
    const msgs = await client.message.list({ sessionID });
    const raw = msgs as unknown as { data?: unknown[] } | unknown[];
    const list = Array.isArray(raw) ? raw : (raw.data ?? []);
    snap.messages = (list as Record<string, unknown>[]).map((m) => {
      const r = m as { id?: string; type?: string; text?: string; content?: unknown[]; outcome?: string };
      return {
        id: r.id,
        type: r.type,
        outcome: r.outcome,
        textLen:
          typeof r.text === "string"
            ? r.text.length
            : JSON.stringify(r.content ?? "").length,
      };
    });
  } catch (e) {
    snap.messagesError = String(e);
  }
  return snap;
}

async function waitIdle(
  client: ReturnType<typeof OpenCode.make>,
  sessionID: string,
  maxWaitMs: number,
  note: (s: string) => void,
) {
  const start = Date.now();
  // Prefer experimental wait; fall back to active-polling on error/timeout.
  while (Date.now() - start < maxWaitMs) {
    try {
      const remaining = maxWaitMs - (Date.now() - start);
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), Math.min(15000, remaining));
      await client.session.wait({ sessionID }, { signal: ctl.signal });
      clearTimeout(t);
      note(`wait() returned after ${Date.now() - start}ms`);
      return;
    } catch (e) {
      const active = await client.session.active().catch(() => null);
      const mine = active && (active as Record<string, unknown>)[sessionID];
      if (!mine) {
        note(`session not in active set after ${Date.now() - start}ms`);
        return;
      }
      await sleep(2000);
    }
  }
  note(`TIMEOUT waiting idle after ${maxWaitMs}ms`);
}

const SCENARIOS: ScenarioDef[] = [
  {
    name: "01-simple-question",
    prompt: "Reply with exactly this text and nothing else, no tools: SPIKE-OK",
    maxWaitMs: 90_000,
  },
  {
    name: "02-edit-file",
    prompt:
      "In the current directory there is a file named spike-note.txt. " +
      "Append exactly one new line with the text 'spike edit ok' to it using your edit tool, then reply DONE.",
    maxWaitMs: 120_000,
  },
  {
    name: "03-bash-permission",
    prompt: "Run the shell command `echo spike-permission-test` using your bash tool, then reply DONE.",
    createOpts: {
      // Force approval prompts for everything to observe permission flow.
      permissions: [{ action: "*", resource: "*", effect: "ask" }],
    },
    maxWaitMs: 120_000,
    afterPrompt: async (ctx) => {
      // Give the agent a chance to raise a permission request, then answer it.
      for (let i = 0; i < 10; i++) {
        await sleep(3000);
        const pending = await ctx.client.permission.list({ sessionID: ctx.sessionID }).catch(() => []);
        if (Array.isArray(pending) && pending.length > 0) {
          ctx.note(`found ${pending.length} pending permission(s), replying reject to unblock`);
          ctx.verification["permissionRequestSample"] = pending[0];
          const first = pending[0] as { id: string };
          const res = await ctx.client.permission.reply({
            sessionID: ctx.sessionID,
            requestID: first.id,
            decision: "reject",
          });
          ctx.verification["permissionReplyResult"] = res;
          return;
        }
      }
      ctx.note("no pending permission observed within 30s");
    },
  },
  {
    name: "04-agent-question-form",
    prompt:
      "Use your question tool (if you have one) to ask me one question: " +
      "which color do I prefer, red or blue? Wait for my answer before continuing.",
    maxWaitMs: 120_000,
    afterPrompt: async (ctx) => {
      for (let i = 0; i < 10; i++) {
        await sleep(3000);
        const forms = await ctx.client.session.form.list({ sessionID: ctx.sessionID }).catch(() => []);
        if (Array.isArray(forms) && forms.length > 0) {
          ctx.note(`found ${forms.length} pending form(s)`);
          ctx.verification["formSample"] = forms[0];
          return;
        }
        const pending = await ctx.client.permission.list({ sessionID: ctx.sessionID }).catch(() => []);
        if (Array.isArray(pending) && pending.length > 0) {
          ctx.note(`found permission (maybe question-as-permission): ${JSON.stringify(pending[0]).slice(0, 300)}`);
          ctx.verification["questionAsPermission"] = pending[0];
          return;
        }
      }
      ctx.note("no form/permission observed within 30s");
    },
  },
  {
    name: "05-tool-failure",
    prompt:
      "Read the file named does-not-exist-xyz-123.txt in the current directory and tell me its contents. " +
      "Do not create it, just report what happens.",
    maxWaitMs: 120_000,
  },
  {
    name: "06-interrupt",
    prompt:
      "Write a very long story, at least 2000 words, about a small white robot. " +
      "Keep writing without stopping until I tell you to stop. Do not use tools, just write text.",
    maxWaitMs: 60_000,
    afterPrompt: async (ctx) => {
      await sleep(8000);
      const res = await ctx.client.session.interrupt({ sessionID: ctx.sessionID });
      ctx.note(`interrupt result: ${JSON.stringify(res)}`);
      ctx.verification["interruptResult"] = res;
    },
  },
];

async function main() {
  const args = parseArgs();
  const outDir = resolve(process.cwd(), args.out);
  await mkdir(outDir, { recursive: true });
  await mkdir(args.work, { recursive: true });

  console.log("[spike] ensuring opencode service...");
  const endpoint = await Service.ensure();
  console.log("[spike] endpoint:", endpoint.url);
  const client = OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint) });

  const info = await client.server.info();
  console.log("[spike] server.info:", JSON.stringify(info));
  await writeFile(join(outDir, "..", "server-info.json"), JSON.stringify({ info: redact(info), endpoint: { url: endpoint.url } }, null, 2));

  let defaultModel: unknown = null;
  try {
    defaultModel = redact(await client.model.default({}));
    console.log("[spike] model.default:", JSON.stringify(defaultModel).slice(0, 300));
  } catch (e) {
    console.log("[spike] model.default error:", String(e).slice(0, 300));
  }
  let agents: unknown = null;
  try {
    agents = await client.agent.list({});
    const names = Array.isArray(agents) ? agents.map((a) => (a as { name?: string }).name) : agents;
    console.log("[spike] agents:", JSON.stringify(names).slice(0, 500));
  } catch (e) {
    console.log("[spike] agent.list error:", String(e).slice(0, 300));
  }

  // ---- global event recorder ----
  let activeFile: string | null = null;
  const counts: Record<string, Record<string, number>> = {};
  let currentScenario = "";
  const seenTypes = new Set<string>();

  const eventDone = new Promise<void>(() => {});
  void eventDone;
  let subAlive = true;
  let streamEnds = 0;
  async function recordLoop() {
    while (subAlive) {
      try {
        for await (const ev of client.event.subscribe()) {
          const t = (ev as { type?: string }).type ?? "<unknown>";
          seenTypes.add(`${currentScenario}:${t}`);
          if (currentScenario && counts[currentScenario]) {
            counts[currentScenario]![t] = (counts[currentScenario]![t] ?? 0) + 1;
          }
          if (activeFile) {
            await appendFile(activeFile, JSON.stringify(ev) + "\n");
          }
        }
        streamEnds++;
        console.log(`[spike] event stream ended (#${streamEnds}), resubscribing...`);
      } catch (e) {
        streamEnds++;
        console.log(`[spike] event stream error (#${streamEnds}): ${String(e).slice(0, 200)}, resubscribing...`);
        await sleep(1000);
      }
    }
  }
  const loop = recordLoop();

  const wanted =
    args.scenario === "all" ? SCENARIOS : SCENARIOS.filter((s) => s.name.startsWith(args.scenario));
  if (wanted.length === 0) throw new Error(`unknown scenario: ${args.scenario}`);

  const summary: Record<string, unknown> = {
    serverInfo: redact(info),
    clientPackage: "2.0.16",
    defaultModel,
    agents: Array.isArray(agents) ? (agents as { name?: string }[]).map((a) => a.name) : agents,
    scenarios: {},
  };

  for (const sc of wanted) {
    console.log(`\n[spike] === scenario ${sc.name} ===`);
    counts[sc.name] = {};
    const eventFile = join(outDir, `${sc.name}.jsonl`);
    const pollFile = join(outDir, `${sc.name}.poll.jsonl`);
    await writeFile(eventFile, "");
    await writeFile(pollFile, "");
    currentScenario = sc.name;
    activeFile = eventFile;

    const notes: string[] = [];
    const verification: Record<string, unknown> = {};
    const note = (s: string) => {
      console.log(`[spike:${sc.name}] ${s}`);
      notes.push(`${new Date().toISOString()} ${s}`);
    };

    // Scenario workdir + seed file for edit scenario.
    const workdir = join(args.work, sc.name);
    await mkdir(workdir, { recursive: true });
    if (sc.name.startsWith("02-")) {
      await writeFile(join(workdir, "spike-note.txt"), "seed line\n");
    }

    const session = await client.session.create({
      title: `spike-${sc.name}`,
      location: { directory: workdir },
      model: { ...SPIKE_MODEL },
      ...(sc.createOpts ?? {}),
    } as Parameters<typeof client.session.create>[0]);
    note(`session created: ${session.id}`);

    // Poller during scenario.
    let polling = true;
    const poller = (async () => {
      while (polling) {
        const snap = await pollSnapshot(client, session.id);
        await appendFile(pollFile, JSON.stringify(snap) + "\n");
        await sleep(1500);
      }
    })();

    // Prompt (do not await completion — prompt returns after enqueue).
    const inbox = await client.session.prompt({ sessionID: session.id, text: sc.prompt });
    note(`prompt enqueued: ${JSON.stringify(inbox).slice(0, 300)}`);

    if (sc.afterPrompt) {
      await sc.afterPrompt({ client, sessionID: session.id, workdir, note, verification });
    }
    await waitIdle(client, session.id, sc.maxWaitMs, note);

    // Final settle: extra 5s to catch trailing events, one last poll.
    await sleep(5000);
    polling = false;
    await poller.catch(() => {});
    const finalSnap = await pollSnapshot(client, session.id);
    await appendFile(pollFile, JSON.stringify({ ...finalSnap, final: true }) + "\n");

    // session.generate check on the two content scenarios (cheap: 1 call each).
    if (sc.name.startsWith("01-") || sc.name.startsWith("02-")) {
      try {
        const g = await client.session.generate({
          sessionID: session.id,
          prompt: "Ringkas hasil terakhir dalam maksimal 2 kalimat Bahasa Indonesia untuk diucapkan, tanpa kode.",
        });
        verification["generate"] = g;
        note(`generate ok: ${JSON.stringify(g).slice(0, 200)}`);
      } catch (e) {
        verification["generateError"] = String(e).slice(0, 500);
        note(`generate error: ${String(e).slice(0, 300)}`);
      }
    }
    // instructions entry check once (on simple scenario).
    if (sc.name.startsWith("01-")) {
      try {
        await client.session.instructions.entry.put({
          sessionID: session.id,
          key: "codepet.voice",
          value: "Akhiri jawaban dengan <speak>ringkasan 1 kalimat</speak>.",
        });
        const entries = await client.session.instructions.entry.list({ sessionID: session.id });
        verification["instructionEntries"] = entries;
        note(`instruction entry put+list ok (${Array.isArray(entries) ? entries.length : "?"} entries)`);
      } catch (e) {
        verification["instructionError"] = String(e).slice(0, 500);
        note(`instruction entry error: ${String(e).slice(0, 300)}`);
      }
      // inbox delivery update check: enqueue then flip delivery mode.
      try {
        const m1 = await client.session.prompt({ sessionID: session.id, text: "Reply PING with PONG." });
        const inboxList = await client.session.inbox.list({ sessionID: session.id });
        verification["inboxList"] = inboxList;
        note(`inbox list: ${JSON.stringify(inboxList).slice(0, 300)}`);
        void m1;
      } catch (e) {
        verification["inboxError"] = String(e).slice(0, 500);
        note(`inbox check error: ${String(e).slice(0, 300)}`);
      }
    }

    (summary.scenarios as Record<string, unknown>)[sc.name] = redact({
      sessionID: session.id,
      workdir,
      eventCounts: counts[sc.name],
      notes,
      verification,
    });
    console.log(`[spike] --- ${sc.name} events: ${JSON.stringify(counts[sc.name])}`);
  }

  currentScenario = "";
  activeFile = null;
  // Observe a quiet period to see if the stream stays alive with no work.
  console.log("[spike] quiet observation 10s (stream liveness)...");
  const endsBefore = streamEnds;
  await sleep(10_000);
  (summary as Record<string, unknown>).streamEndsDuringRun = streamEnds;
  (summary as Record<string, unknown>).streamEndedWhileQuiet = streamEnds > endsBefore;
  subAlive = false;
  // Break the subscribe loop by stopping? loop exits on flag after next event/end; force process exit below.
  // Merge with previous summary so single-scenario re-runs don't drop other scenarios.
  let prev: Record<string, unknown> = {};
  try {
    prev = JSON.parse(await readFile(join(outDir, "_summary.json"), "utf-8")) as Record<string, unknown>;
  } catch {
    prev = {};
  }
  const merged = {
    ...(prev as object),
    ...summary,
    scenarios: { ...((prev.scenarios as Record<string, unknown>) ?? {}), ...((summary.scenarios as Record<string, unknown>) ?? {}) },
  };
  await writeFile(join(outDir, "_summary.json"), JSON.stringify(merged, null, 2));
  console.log("[spike] summary written. streamEnds=", streamEnds);
  void loop;
  process.exit(0);
}

main().catch((e) => {
  console.error("[spike] FATAL", e);
  process.exit(1);
});
