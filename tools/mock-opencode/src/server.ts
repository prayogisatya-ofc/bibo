import { readFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Mock OpenCode v2 — mereplay fixture M0 (`docs/fixtures/opencode-events/`)
 * dengan sessionID/location ditulis ulang ke sesi mock.
 * Skenario: simple-answer, edit-files, permission-medium, form-question,
 * tool-failure, interrupt, stream-drop, silent-events.
 * Dipilih via session.create metadata.mockScenario (atau title "mock:<nama>").
 */

const here = dirname(fileURLToPath(import.meta.url));
const FIX_DIR = join(here, "..", "..", "..", "docs", "fixtures", "opencode-events");

const SCENARIO_FILE: Record<string, string> = {
  "simple-answer": "01-simple-question.jsonl",
  "edit-files": "02-edit-file.jsonl",
  "permission-medium": "03-bash-permission.jsonl",
  // permission-high memakai alur yang sama (03); beda low/medium/high
  // ditentukan risk classifier bridge di M6, bukan oleh server.
  "permission-high": "03-bash-permission.jsonl",
  "form-question": "04-agent-question-form.jsonl",
  "tool-failure": "05-tool-failure.jsonl",
  interrupt: "06-interrupt.jsonl",
  "stream-drop": "01-simple-question.jsonl",
  "silent-events": "01-simple-question.jsonl",
};

/** Kunci skenario di _summary.json (sumber sessionID eksplisit, anti-kontaminasi). */
const SCENARIO_SUMMARY_KEY: Record<string, string> = {
  "simple-answer": "01-simple-question",
  "edit-files": "02-edit-file",
  "permission-medium": "03-bash-permission",
  "permission-high": "03-bash-permission",
  "form-question": "04-agent-question-form",
  "tool-failure": "05-tool-failure",
  interrupt: "06-interrupt",
  "stream-drop": "01-simple-question",
  "silent-events": "01-simple-question",
};

let summaryCache: Record<string, { sessionID?: string }> | undefined;

async function summarySessions(): Promise<Record<string, { sessionID?: string }>> {
  if (!summaryCache) {
    try {
      const raw = await readFile(join(FIX_DIR, "_summary.json"), "utf-8");
      summaryCache = ((JSON.parse(raw) as { scenarios?: Record<string, { sessionID?: string }> }).scenarios ?? {});
    } catch {
      summaryCache = {};
    }
  }
  return summaryCache;
}

export interface MockEvent {
  id: string;
  type: string;
  created?: number;
  location?: { directory: string };
  data?: Record<string, unknown>;
  [k: string]: unknown;
}

interface SessionState {
  id: string;
  directory: string;
  scenario: string;
  events: MockEvent[]; // milik sesi ini, sessionID sudah ditulis ulang
  fixtureSession: string;
  cursor: number; // event berikutnya untuk koneksi SSE baru
  conns: number;
  running: boolean;
  interrupted: boolean;
  pendingPermissions: Array<{ id: string; sessionID: string; action: string; resources: string[] }>;
  pendingForms: Array<{ id: string; sessionID: string; title: string; fields: unknown[]; answer?: unknown }>;
  model?: { id: string; providerID: string };
  replaying: boolean;
  everReplayed: boolean;
  texts: string; // akumulasi delta untuk message.list
  outcome: string | undefined;
  userText: string;
  done: boolean;
}

const sessions = new Map<string, SessionState>();
let seq = 0;

/** Log debug mock (MOCK_LOG=1 → /tmp/mock-debug.log). */
function mlog(s: string): void {
  if (process.env["MOCK_LOG"] === "1") {
    void import("node:fs/promises").then((fs) =>
      fs.appendFile("/tmp/mock-debug.log", `${new Date().toISOString()} ${s}\n`).catch(() => {}),
    );
  }
}

function fixtureSessionOf(events: MockEvent[]): string {
  const count = new Map<string, number>();
  for (const e of events) {
    const sid = (e.data as Record<string, unknown> | undefined)?.["sessionID"];
    if (typeof sid === "string" && sid.startsWith("ses_")) count.set(sid, (count.get(sid) ?? 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [k, v] of count) {
    if (v > bestN) {
      best = k;
      bestN = v;
    }
  }
  return best;
}

async function loadFixture(scenario: string): Promise<{ events: MockEvent[]; fixtureSession: string }> {
  const file = SCENARIO_FILE[scenario] ?? SCENARIO_FILE["simple-answer"]!;
  const raw = await readFile(join(FIX_DIR, file), "utf-8");
  const events = raw
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as MockEvent);
  // Utamakan sessionID eksplisit dari _summary (fixture terkontaminasi sesi lain);
  // fallback ke inferensi bila summary tak ada.
  const key = SCENARIO_SUMMARY_KEY[scenario];
  const recorded = key ? (await summarySessions())[key]?.sessionID : undefined;
  if (recorded && events.some((e) => ((e.data as Record<string, unknown> | undefined)?.["sessionID"]) === recorded)) {
    return { events, fixtureSession: recorded };
  }
  return { events, fixtureSession: fixtureSessionOf(events) };
}

function rewriteForSession(events: MockEvent[], fixtureSession: string, st: SessionState): MockEvent[] {
  const now = Date.now();
  const base = events.length > 0 && typeof events[0]?.created === "number" ? (events[0].created as number) : now;
  return events
    .filter((e) => {
      const sid = (e.data as Record<string, unknown> | undefined)?.["sessionID"];
      // Hanya event milik sesi fixture (atau tanpa sessionID yang relevan: server.connected).
      if (e.type === "server.connected") return true;
      if (typeof sid === "string") return sid === fixtureSession;
      // sessionID bersarang (form.created membawa sessionID di data.form).
      const form = (e.data as Record<string, unknown> | undefined)?.["form"] as
        | { sessionID?: unknown }
        | undefined;
      if (form && typeof form.sessionID === "string") return form.sessionID === fixtureSession;
      // Event global lain (project.updated dsb.) dilewati agar replay deterministik.
      return false;
    })
    .map((e, i) => {
      const data = { ...((e.data as Record<string, unknown>) ?? {}) };
      if (typeof data["sessionID"] === "string") data["sessionID"] = st.id;
      // ID sesi bersarang (form.created membawa sessionID di dalam data.form).
      const form = data["form"] as { sessionID?: unknown } | undefined;
      if (form && typeof form.sessionID === "string") {
        data["form"] = { ...form, sessionID: st.id };
      }
      // Tulis ulang id event agar unik per sesi mock.
      return { ...e, id: `evt_mock${i}_${st.id.slice(4, 10)}`, created: now + i * 15, location: { directory: st.directory }, data };
    });
}

/** Sink SSE yang masih terbuka; replay menyiar ke semuanya. */
const sinks = new Set<{ send: (e: MockEvent) => void; destroy: () => void; closed: boolean }>();

function broadcast(ev: MockEvent): void {
  for (const s of sinks) {
    if (!s.closed) {
      try {
        s.send(ev);
      } catch {
        s.closed = true;
      }
    }
  }
}

function kickReplay(st: SessionState): void {
  if (st.replaying) {
    mlog(`kick-skip ${st.id} (already replaying)`);
    return;
  }
  mlog(`kick-start ${st.id} cursor=${st.cursor} first=${!st.everReplayed}`);
  st.replaying = true;
  const first = !st.everReplayed;
  st.everReplayed = true;
  void replay(st, broadcast, first)
    .catch(() => {
      // stream-drop: koneksi hancur di tengah; cursor sudah maju, replay
      // berikutnya (dipicu koneksi SSE baru) melanjutkan sisa.
    })
    .finally(() => {
      st.replaying = false;
    });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function replay(st: SessionState, send: (e: MockEvent) => void, isFirstConn: boolean): Promise<void> {
  st.running = true;
  if (st.scenario === "interrupt") {
    // Skenario interrupt: agen menulis tanpa henti sampai diinterrupt.
    // Buang event terminal bawaan fixture SEBELUM replay agar sesi bertahan.
    st.events = st.events.filter(
      (e) => e.type !== "session.execution.succeeded" && e.type !== "session.execution.failed" && e.type !== "session.execution.interrupted",
    );
  }
  const evs = st.events;
  if (st.scenario === "silent-events") {
    // Diam total: hanya ubah message/active; teks final muncul setelah jeda.
    await sleep(1500);
    st.texts = "SMOKE-OK (silent)";
    st.outcome = "succeeded";
    st.running = false;
    st.done = true;
    return;
  }
  let i = st.cursor;
  if (st.scenario === "stream-drop" && isFirstConn) {
    // Putus di tengah: kirim 5 event lalu hancurkan SEMUA koneksi agar
    // bridge reconnect; koneksi baru memicu lanjutan dari cursor.
    for (; i < Math.min(5, evs.length); i++) {
      send(evs[i]!);
      st.cursor = i + 1;
      await sleep(15);
    }
    for (const s of sinks) {
      try {
        s.destroy();
      } catch {
        // abaikan
      }
      s.closed = true;
    }
    sinks.clear();
    throw new Error("mock stream-drop");
  }
  for (; i < evs.length; i++) {
    if (st.interrupted) break;    const e = evs[i]!;
    // Blokir di permission/form: tahan replay sampai dijawab (kecuali interrupt).
    if (e.type === "permission.asked") {
      const d = e.data as { id: string; action: string; resources: string[] };
      if (st.scenario === "permission-high") {
        // Skenario high: tulis ulang aksi menjadi perintah berbahaya.
        d.action = "shell";
        d.resources = ["rm -rf dist"];
        (e.data as { save?: string[] }).save = ["rm *"];
      }
      if (!st.pendingPermissions.some((p) => p.id === d.id)) {
        st.pendingPermissions.push({ id: String(d.id), sessionID: st.id, action: String(d.action), resources: (d.resources ?? []).map(String) });
      }
      send(e);
      st.cursor = i + 1;
      await waitForUnblock(st, () => st.pendingPermissions.length === 0);
      continue;
    }
    if (e.type === "form.created") {
      const form = (e.data as { form: { id: string; title: string; fields: unknown[] } }).form;
      if (!st.pendingForms.some((f) => f.id === form.id)) {
        st.pendingForms.push({ id: form.id, sessionID: st.id, title: form.title, fields: form.fields });
      }
      send(e);
      st.cursor = i + 1;
      await waitForUnblock(st, () => st.pendingForms.length === 0);
      continue;
    }
    if (e.type === "session.text.delta") {
      st.texts += String((e.data as { delta?: string }).delta ?? "");
    }
    if (e.type === "session.execution.succeeded" || e.type === "session.execution.failed") {
      st.outcome = e.type === "session.execution.succeeded" ? "succeeded" : "failed";
    }
    if (e.type === "session.execution.interrupted") st.outcome = "interrupted";
    send(e);
    st.cursor = i + 1;
    await sleep(12);
  }
  if (!st.outcome && !st.done && st.scenario === "interrupt" && !st.interrupted) {
    // Bertahan sibuk sampai interrupt datang (maks 120 s) agar E2E stop deterministik.
    await waitForUnblock(st, () => st.interrupted, 1200);
  }
  if (st.interrupted) {
    st.outcome = "interrupted";
    const tail: MockEvent[] = [
      { id: `evt_mock_end_${seq++}`, type: "session.step.failed", created: Date.now(), location: { directory: st.directory }, data: { sessionID: st.id } },
      { id: `evt_mock_end_${seq++}`, type: "session.execution.interrupted", created: Date.now(), location: { directory: st.directory }, data: { sessionID: st.id } },
    ];
    for (const t of tail) send(t);
  }
  st.running = false;
  st.done = true;
}

async function waitForUnblock(st: SessionState, clear: () => boolean, maxIter = 600): Promise<void> {
  for (let i = 0; i < maxIter; i++) {
    if (clear() || st.interrupted) return;
    await sleep(100);
  }
}

function scenarioOf(body: { title?: string; metadata?: Record<string, unknown> }): string {  const m = body.metadata?.["mockScenario"];
  if (typeof m === "string" && SCENARIO_FILE[m]) return m;
  const t = body.title ?? "";
  if (t.startsWith("mock:")) {
    const name = t.slice(5);
    if (SCENARIO_FILE[name]) return name;
  }
  const env = process.env["MOCK_DEFAULT_SCENARIO"];
  if (env && SCENARIO_FILE[env]) return env;
  return "simple-answer";
}

function json(res: { writeHead: (s: number, h?: Record<string, string>) => void; end: (s?: string) => void }, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export async function startMock(port: number): Promise<{ url: string; close: () => void }> {
  const { createServer } = await import("node:http");
  const server = createServer((req, res) => {
    void (async () => {
      try {
        await route(req, res);
      } catch (e) {
        json(res, 500, { error: String(e).slice(0, 200) });
      }
    })();
  });
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() };
}

async function readBody(req: { on: (ev: string, fn: (c?: string) => void) => void }): Promise<unknown> {
  const chunks: string[] = [];
  await new Promise<void>((r) => {
    req.on("data", (c) => {
      if (c) chunks.push(c);
    });
    req.on("end", () => r());
  });
  const raw = chunks.join("");
  return raw ? (JSON.parse(raw) as unknown) : {};
}

async function route(
  req: import("node:http").IncomingMessage,
  res: {
    writeHead: (s: number, h?: Record<string, string>) => void;
    end: (s?: string) => void;
    write: (s: string) => boolean | void;
    destroy?: () => void;
  },
): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const path = url.pathname;
  const j = (s: number, b: unknown) => json(res, s, b);

  // Mode server-down (uji FR-005): semua endpoint 503 kecuali /api/info.
  if (process.env["MOCK_DOWN"] === "1" && path !== "/api/info") {
    j(503, { error: "mock down" });
    return;
  }

  if (method === "GET" && path === "/api/info") {
    j(200, { version: "2.0.16-mock", pid: 1, urls: [], paths: { tmp: "/tmp" } });
    return;
  }
  if (method === "GET" && path === "/api/model") {
    // FITUR C: daftar model palsu agar E2E/tes bisa menguji pemilih model.
    j(200, {
      data: [
        { id: "mock-a", modelID: "mock-a", name: "Mock A (cepat)", providerID: "mock" },
        { id: "mock-b", modelID: "mock-b", name: "Mock B (pintar)", providerID: "mock" },
        { id: "mock-c", modelID: "mock-c", name: "Mock C (hemat)", providerID: "mock" },
      ],
    });
    return;
  }
  if (path === "/api/session" && method === "POST") {
    const body = (await readBody(req)) as { title?: string; location?: { directory?: string }; metadata?: Record<string, unknown> };
    const id = `ses_mock${(++seq).toString().padStart(4, "0")}`;
    const directory = body.location?.directory ?? "/tmp/mock";
    const scenario = scenarioOf(body);
    const { events, fixtureSession } = await loadFixture(scenario);
    const st: SessionState = {
      id,
      directory,
      scenario,
      events: [],
      fixtureSession,
      cursor: 0,
      conns: 0,
      running: false,
      replaying: false,
      everReplayed: false,
      interrupted: false,
      pendingPermissions: [],
      pendingForms: [],
      texts: "",
      outcome: undefined,
      userText: "",
      done: false,
    };
    st.events = rewriteForSession(events, fixtureSession, st);
    sessions.set(id, st);
    mlog(`create ${id} scenario=${scenario} events=${st.events.length}`);
    j(200, { data: { id, title: body.title ?? "", location: { directory } } });
    return;
  }
  if (path === "/api/session" && method === "GET") {
    j(200, { data: [...sessions.values()].map((s) => ({ id: s.id, title: "", location: { directory: s.directory } })), cursor: null });
    return;
  }
  if (method === "GET" && path === "/api/session/active") {
    const active: Record<string, { type: string }> = {};
    for (const s of sessions.values()) {
      if (s.running) active[s.id] = { type: "running" };
    }
    j(200, { data: active });
    return;
  }
  const mPrompt = path.match(/^\/api\/session\/([^/]+)\/prompt$/);
  if (mPrompt && method === "POST") {
    const st = sessions.get(mPrompt[1]!);
    if (!st) {
      j(404, { error: "no session" });
      return;
    }
    // Cerminkan server nyata: prompt 500 bila direktori sesi tak ada di disk.
    try {
      await stat(st.directory);
    } catch {
      j(500, { error: "location not found" });
      return;
    }
    const body = (await readBody(req)) as { text?: string };
    st.userText = body.text ?? "";
    st.interrupted = false;
    mlog(`prompt ${st.id} replaying=${st.replaying} done=${st.done} cursor=${st.cursor}`);
    j(200, {
      data: {
        id: `msg_mock${seq++}`,
        sessionID: st.id,
        time: { created: Date.now() },
        type: "user",
        payload: { text: st.userText },
        delivery: "steer",
      },
    });
    kickReplay(st);
    return;
  }
  const mModel = path.match(/^\/api\/session\/([^/]+)\/model$/);
  if (mModel && method === "POST") {
    const st = sessions.get(mModel[1]!);
    if (!st) {
      j(404, { error: "no session" });
      return;
    }
    // FITUR C: catat model aktif sesi (observabilitas untuk tes).
    const body = (await readBody(req)) as { model?: { id?: unknown; providerID?: unknown } };
    const mid = body.model?.id;
    const pid = body.model?.providerID;
    if (typeof mid === "string" && typeof pid === "string") {
      st.model = { id: mid, providerID: pid };
      mlog(`model-switch ${st.id} → ${pid}/${mid}`);
    }
    res.writeHead(204);
    res.end();
    return;
  }
  const mInterrupt = path.match(/^\/api\/session\/([^/]+)\/interrupt$/);
  if (mInterrupt && method === "POST") {
    const st = sessions.get(mInterrupt[1]!);
    if (!st) {
      j(404, { error: "no session" });
      return;
    }
    st.interrupted = true;
    st.pendingPermissions = [];
    st.pendingForms = [];
    j(200, { interrupted: st.running });
    return;
  }
  const mMsg = path.match(/^\/api\/session\/([^/]+)\/message$/);
  if (mMsg && method === "GET") {
    const st = sessions.get(mMsg[1]!);
    if (!st) {
      j(404, { error: "no session" });
      return;
    }
    const data: unknown[] = [{ id: `msg_mock_u`, time: { created: Date.now() }, type: "user", text: st.userText }];
    if (st.texts) {
      data.push({
        id: `msg_mock_a`,
        time: { created: Date.now() },
        type: "assistant",
        agent: "build",
        model: { id: "mock", providerID: "mock" },
        content: [{ type: "text", text: st.texts }],
      });
    }
    if (st.done) {
      data.push({ id: `msg_mock_i`, time: { created: Date.now() }, type: "idle", outcome: st.outcome ?? "succeeded" });
    }
    j(200, { data, cursor: { previous: null, next: null } });
    return;
  }
  const mPermList = path.match(/^\/api\/session\/([^/]+)\/permission$/);
  if (mPermList && method === "GET") {
    const st = sessions.get(mPermList[1]!);
    j(200, { data: st ? st.pendingPermissions : [] });
    return;
  }
  const mPermReply = path.match(/^\/api\/session\/([^/]+)\/permission\/([^/]+)\/reply$/);
  if (mPermReply && method === "POST") {
    const st = sessions.get(mPermReply[1]!);
    if (!st) {
      j(404, { error: "no session" });
      return;
    }
    const body = (await readBody(req)) as { decision?: string };
    const idx = st.pendingPermissions.findIndex((p) => p.id === mPermReply[2]);
    if (idx < 0) {
      j(404, { error: "no request" });
      return;
    }
    const [p] = st.pendingPermissions.splice(idx, 1);
    void p;
    // Lanjutan replay memakai tail fixture itu sendiri (permission.replied,
    // tool.failed, execution.* sudah ada di fixture 03). Tanpa sintesis.
    // Klien mengharap 204 untuk reply void.
    res.writeHead(204);
    res.end();
    return;
  }
  if (method === "GET" && path === "/api/permission/request") {
    const all = [...sessions.values()].flatMap((s) => s.pendingPermissions);
    j(200, { location: { directory: "" }, data: all });
    return;
  }
  const mFormList = path.match(/^\/api\/session\/([^/]+)\/form$/);
  if (mFormList && method === "GET") {
    const st = sessions.get(mFormList[1]!);
    j(200, { data: st ? st.pendingForms : [] });
    return;
  }
  if (method === "GET" && path === "/api/form") {
    j(200, { location: { directory: "" }, data: [...sessions.values()].flatMap((s) => s.pendingForms) });
    return;
  }
  const mFormReply = path.match(/^\/api\/session\/([^/]+)\/form\/([^/]+)\/reply$/);
  if (mFormReply && method === "POST") {
    const st = sessions.get(mFormReply[1]!);
    if (!st) {
      j(404, { error: "no session" });
      return;
    }
    const idx = st.pendingForms.findIndex((f) => f.id === mFormReply[2]);
    if (idx < 0) {
      j(404, { error: "no form" });
      return;
    }
    st.pendingForms.splice(idx, 1);
    // Fixture 04 berhenti di form.created (sesi parkir); sintetis kelanjutan
    // seperti server nyata: form.replied lalu execution.succeeded.
    st.events.push(
      {
        id: `evt_mock_fr_${seq++}`,
        type: "form.replied",
        created: Date.now(),
        location: { directory: st.directory },
        data: { sessionID: st.id, formID: mFormReply[2] },
      },
      {
        id: `evt_mock_fr_${seq++}`,
        type: "session.execution.succeeded",
        created: Date.now(),
        location: { directory: st.directory },
        data: { sessionID: st.id },
      },
    );
    res.writeHead(204);
    res.end();
    return;
  }
  const mFormCancel = path.match(/^\/api\/session\/([^/]+)\/form\/([^/]+)$/);
  if (mFormCancel && method === "DELETE") {
    const st = sessions.get(mFormCancel[1]!);
    if (st) st.pendingForms = st.pendingForms.filter((f) => f.id !== mFormCancel[2]);
    res.writeHead(204);
    res.end();
    return;
  }
  const mGet = path.match(/^\/api\/session\/([^/]+)$/);
  if (mGet && method === "GET") {
    const st = sessions.get(mGet[1]!);
    if (!st) {
      j(404, { error: "no session" });
      return;
    }
    // FITUR C: sertakan model aktif sesi agar tes bisa memverifikasi switchModel.
    j(200, { data: { id: st.id, title: "", location: { directory: st.directory }, model: st.model ?? null } });
    return;
  }
  if (method === "POST" && path === "/api/experimental/session/wait-reset") {
    j(200, {});
    return;
  }
  const mWait = path.match(/^\/api\/experimental\/session\/([^/]+)\/wait$/);
  if (mWait && method === "POST") {
    const st = sessions.get(mWait[1]!);
    if (!st) {
      j(404, { error: "no session" });
      return;
    }
    for (let i = 0; i < 300; i++) {
      if (!st.running) break;
      await sleep(100);
    }
    if (!st.running) {
      res.writeHead(204);
      res.end();
    } else {
      j(503, { error: "busy" });
    }
    return;
  }
  if (method === "GET" && path === "/api/event") {
    // SSE: daftarkan sink; replay berjalan via kickReplay (dipicu prompt),
    // sehingga koneksi lama milik bridge tetap menerima event sesi baru.
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    const sink = {
      closed: false,
      send: (ev: MockEvent) => {
        res.write(`event: ${ev.type}\n`);
        res.write(`data: ${JSON.stringify(ev)}\n\n`);
      },
      destroy: () => res.destroy?.(),
    };
    sinks.add(sink);
    (req as { on: (ev: string, fn: () => void) => void }).on("close", () => {
      sink.closed = true;
      sinks.delete(sink);
    });
    sink.send({ id: "evt_mock_conn", type: "server.connected", data: {} });
    // Jika ada sesi yang menunggu replay dan belum berjalan, jalankan.
    // (Memicu juga replay lanjutan stream-drop setelah bridge reconnect.)
    for (const s of [...sessions.values()].reverse()) {
      if (!s.replaying && !s.done && s.userText) {
        s.conns++;
        mlog(`sse-kick ${s.id} conns=${s.conns}`);
        kickReplay(s);
        break;
      }
    }
    // Tahan koneksi terbuka; replay menulis via sinks.
    await sleep(120_000);
    try {
      res.end();
    } catch {
      // abaikan
    }
    return;
  }
  // Eksperimental lain yang dipakai bridge: kembalikan bentuk minimal.
  const mDiff = path.match(/^\/api\/session\/([^/]+)\/diff$/);
  if (mDiff && method === "GET") {
    const st = sessions.get(mDiff[1]!);
    if (st && st.scenario === "edit-files" && st.outcome) {
      j(200, { data: [{ path: "spike-note.txt", additions: 1, deletions: 0 }] });
    } else {
      j(200, { data: [] });
    }
    return;
  }
  if (method === "GET" && path.endsWith("/diff")) {
    j(200, []);
    return;
  }
  if (path.includes("/instructions/entries")) {
    if (method === "PUT") {
      await readBody(req);
      j(204, {});
      return;
    }
    j(200, { data: [] });
    return;
  }
  if (path.endsWith("/inbox")) {
    j(200, []);
    return;
  }
  j(404, { error: `mock: ${method} ${path} belum diimplementasi` });
}

if (import.meta.main) {
  const port = Number(process.env["MOCK_PORT"] ?? "4098");
  const { url } = await startMock(port);
  console.log(`[mock-opencode] ${url}`);
}
