import { describe, expect, it } from "vitest";
import { createReducer } from "../src/state/reducer.js";

describe("reducer (prioritas ADR-007)", () => {
  it("idle → busy saat exec.started; idle saat exec.ended success", () => {
    const r = createReducer();
    expect(r.state.phase).toBe("idle");
    r.reduce({ t: "exec.started", sessionID: "s" });
    expect(r.state.phase).toBe("busy");
    r.reduce({ t: "exec.ended", sessionID: "s", outcome: "success" });
    expect(r.state.phase).toBe("idle");
    expect(r.state.lastOutcome).toBe("success");
  });

  it("tool.started → busyKind editing; tool.ended → kembali thinking/busy", () => {
    const r = createReducer();
    r.reduce({ t: "exec.started", sessionID: "s" });
    r.reduce({ t: "tool.started", sessionID: "s", callID: "c1", tool: "edit" });
    expect(r.state.busyKind).toBe("editing");
    const { emit } = r.reduce({ t: "tool.ended", sessionID: "s", callID: "c1", tool: "edit", ok: true });
    expect(emit.feed?.status).toBe("ok");
    expect(r.state.phase).toBe("busy"); // exec masih jalan
  });

  it("awaiting mengalahkan working; reply mengembalikan", () => {
    const r = createReducer();
    r.reduce({ t: "exec.started", sessionID: "s" });
    r.reduce({ t: "tool.started", sessionID: "s", callID: "c1", tool: "shell" });
    expect(r.state.phase).toBe("busy");
    r.reduce({ t: "permission.asked", request: { requestID: "p1", sessionID: "s", action: "shell", resources: ["rm -rf x"], risk: "medium" as const, voiceAllowed: true } });
    expect(r.state.phase).toBe("awaiting");
    expect(r.state.pendingPermissions).toHaveLength(1);
    expect(r.state.pendingPermissions[0]?.risk).toBe("medium"); // default fail-safe M1
    r.reduce({ t: "permission.replied", requestID: "p1", decision: "reject" });
    expect(r.state.pendingPermissions).toHaveLength(0);
    expect(r.state.phase).toBe("busy"); // tool masih tercatat jalan
  });

  it("exec.ended failed → error; interrupted → idle", () => {
    const r = createReducer();
    r.reduce({ t: "exec.started", sessionID: "s" });
    r.reduce({ t: "exec.ended", sessionID: "s", outcome: "failed", error: "boom" });
    expect(r.state.phase).toBe("error");
    expect(r.state.lastError).toBe("boom");
    const r2 = createReducer();
    r2.reduce({ t: "exec.started", sessionID: "s" });
    r2.reduce({ t: "exec.ended", sessionID: "s", outcome: "interrupted" });
    expect(r2.state.phase).toBe("idle");
  });

  it("teks delta dirakit menjadi final", () => {
    const r = createReducer();
    r.reduce({ t: "text.delta", sessionID: "s", messageID: "m", text: "halo " });
    const { emit } = r.reduce({ t: "text.done", sessionID: "s", messageID: "m", text: "" });
    expect(emit.textFinal?.text).toBe("halo ");
  });

  it("conn down → error", () => {
    const r = createReducer();
    r.reduce({ t: "conn", status: "down" });
    expect(r.state.phase).toBe("error");
  });
});
