import { describe, expect, it } from "vitest";
import { AVATAR_POSES, agentSignal, agentState, bridgeMessage, webMessage } from "@codepet/protocol";

/** Tes kontrak (PRD §13.1): semua pesan WS valid dua arah + pose avatar. */

describe("kontrak pesan Web → Bridge", () => {
  it("semua tipe webMessage lolos", () => {
    const samples = [
      { v: 1, type: "hello", clientVersion: "x" },
      { v: 1, type: "user.message", text: "hi", source: "chat", locale: "id-ID" },
      { v: 1, type: "user.message", text: "hi", source: "voice", locale: "id-ID", delivery: "queue" },
      { v: 1, type: "agent.interrupt" },
      { v: 1, type: "permission.reply", requestID: "per_1", decision: "once", via: "click" },
      { v: 1, type: "form.reply", formID: "frm_1", answer: { q0: "Red" } },
      { v: 1, type: "form.cancel", formID: "frm_1" },
      { v: 1, type: "session.select", directory: "/tmp/x" },
      { v: 1, type: "session.list" },
      { v: 1, type: "settings.update", settings: { a: 1 } },
      { v: 1, type: "speech.request_summary", messageID: "m" },
    ];
    for (const s of samples) {
      expect(webMessage.safeParse(s).success, JSON.stringify(s)).toBe(true);
    }
    expect(webMessage.safeParse({ v: 1, type: "user.message", text: "", source: "chat" }).success).toBe(false);
    expect(webMessage.safeParse({ v: 2, type: "hello" }).success).toBe(false);
  });
});

describe("kontrak pesan Bridge → Web", () => {
  const state = agentState.parse({ phase: "idle", runningTools: [], pendingPermissions: [], pendingForms: [] });
  it("semua tipe bridgeMessage lolos", () => {
    const samples = [
      { v: 1, type: "bridge.ready", bridgeVersion: "b", opencode: { status: "up" }, directory: "/x" },
      { v: 1, type: "bridge.ready", bridgeVersion: "b", opencode: { status: "down" }, directory: "", recentDirs: ["/a"] },
      { v: 1, type: "bridge.status", opencode: "down" },
      { v: 1, type: "agent.state", state },
      { v: 1, type: "agent.text.delta", messageID: "m", text: "a" },
      { v: 1, type: "agent.text.final", messageID: "m", text: "a" },
      { v: 1, type: "agent.speak", id: "s", text: "hai", priority: "normal", kind: "ack" },
      { v: 1, type: "feed.item", item: { id: "i", kind: "tool", title: "t", status: "ok", ts: 1 } },
      { v: 1, type: "permission.requested", requestID: "p", tool: "shell", title: "t", patterns: [], risk: "high", voiceAllowed: false },
      { v: 1, type: "form.requested", formID: "f", title: "t", fields: [] },
      { v: 1, type: "diff.ready", sessionID: "s", files: [] },
      { v: 1, type: "error", code: "c", message: "m", recoverable: true },
    ];
    for (const s of samples) {
      expect(bridgeMessage.safeParse(s).success, JSON.stringify(s)).toBe(true);
    }
    expect(
      bridgeMessage.safeParse({
        v: 1, type: "bridge.ready", bridgeVersion: "b", opencode: { status: "up", version: "2.0.16" },
        directory: "/x", sessionID: "ses_1", recentDirs: ["/a"], agent: "build", model: "m",
      }).success,
    ).toBe(true);
    expect(
      bridgeMessage.safeParse({ v: 1, type: "session.listed", sessions: [{ sessionID: "ses_1", title: "t" }] }).success,
    ).toBe(true);
  });
});

describe("kontrak AgentSignal", () => {
  it("semua varian lolos + pose valid", () => {
    expect(agentSignal.safeParse({ t: "exec.started", sessionID: "s" }).success).toBe(true);
    expect(agentSignal.safeParse({ t: "conn", status: "down" }).success).toBe(true);
    expect(agentSignal.safeParse({ t: "form.replied", formID: "f" }).success).toBe(true);
    expect(AVATAR_POSES).toHaveLength(14);
  });
});
