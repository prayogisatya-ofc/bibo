import { describe, expect, it, vi, afterEach } from "vitest";
import { ALWAYS_NOT_ALLOWED, VOICE_NOT_ALLOWED, guardReply, logDecision } from "../src/safety/guard.js";
import { ReminderTracker } from "../src/safety/remind.js";

describe("guardReply (PRD §10.2)", () => {
  it("voice + high → VOICE_NOT_ALLOWED (kecuali reject)", () => {
    expect(guardReply({ risk: "high", via: "voice", decision: "once" })).toMatchObject({ ok: false, code: VOICE_NOT_ALLOWED });
    expect(guardReply({ risk: "high", via: "voice", decision: "reject" })).toEqual({ ok: true });
  });
  it("reject selalu boleh (menolak = aman)", () => {
    expect(guardReply({ risk: "low", via: "voice", decision: "reject" })).toEqual({ ok: true });
    expect(guardReply({ risk: "high", via: "click", decision: "reject" })).toEqual({ ok: true });
  });
  it("always: hanya klik + low/medium", () => {
    expect(guardReply({ risk: "medium", via: "click", decision: "always" })).toEqual({ ok: true });
    expect(guardReply({ risk: "medium", via: "voice", decision: "always" }).ok).toBe(false);
    expect(guardReply({ risk: "high", via: "click", decision: "always" })).toMatchObject({ ok: false, code: ALWAYS_NOT_ALLOWED });
  });
  it("once klik selalu boleh; once suara low/medium boleh", () => {
    expect(guardReply({ risk: "high", via: "click", decision: "once" })).toEqual({ ok: true });
    expect(guardReply({ risk: "medium", via: "voice", decision: "once" })).toEqual({ ok: true });
  });
});

describe("logDecision tanpa rahasia", () => {
  afterEach(() => vi.restoreAllMocks());
  it("hanya waktu/requestID/risiko/via/keputusan", async () => {
    const { appendFile, mkdir } = await import("node:fs/promises");
    void appendFile;
    void mkdir;
    const rec = await logDecision("/tmp/guard-test-log", { requestID: "per_1", risk: "high", via: "voice", decision: "reject" });
    expect(rec.requestID).toBe("per_1");
    expect(JSON.stringify(rec)).not.toContain("rm -rf");
    const { readFile, rm } = await import("node:fs/promises");
    const lines = (await readFile("/tmp/guard-test-log/decisions.jsonl", "utf-8")).trim().split("\n");
    const last = JSON.parse(lines[lines.length - 1] ?? "{}") as Record<string, unknown>;
    expect(Object.keys(last).sort()).toEqual(["at", "decision", "requestID", "risk", "via"]);
    await rm("/tmp/guard-test-log", { recursive: true, force: true });
  });
});

describe("ReminderTracker (FR-045, fake timer)", () => {
  it("sekali setelah 60 s; tak pernah auto-approve", () => {
    vi.useFakeTimers();
    try {
      const r = new ReminderTracker();
      expect(r.check(0, ["p1"])).toEqual([]);
      expect(r.check(59_999, ["p1"])).toEqual([]);
      expect(r.check(60_000, ["p1"])).toEqual(["p1"]);
      expect(r.check(120_000, ["p1"])).toEqual([]); // hanya sekali
      expect(r.check(130_000, ["p1", "p2"])).toEqual([]); // p2 baru muncul, jatuh tempo +60 s
      expect(r.check(190_000, ["p1", "p2"])).toEqual(["p2"]);
      expect(r.check(200_000, [])).toEqual([]); // dijawab → dibersihkan
      expect(r.check(260_000, ["p1"])).toEqual([]); // siklus baru: tunggu lagi
      expect(r.check(320_000, ["p1"])).toEqual(["p1"]);
    } finally {
      vi.useRealTimers();
    }
  });
});
