import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import { eventsFromBridge, machine, snapshotPose } from "../src/orchestrator/machine.js";
import type { BridgeMessage, BridgePayload } from "@bibo/protocol";

function feed(title: string, status: "running" | "ok" | "fail"): BridgePayload {
  return { type: "feed.item", item: { id: "c", kind: "tool", title, status, ts: 1 } };
}

/** Urutan pesan WS setara skenario edit-files mock: busy → working(typing) → idle+celebrate. */
describe("orchestrator mengikuti sinyal bridge", () => {
  it("edit-files: idle → thinking → working+typing → celebrate → idle", () => {
    const actor = createActor(machine);
    actor.start();
    const snap = () => snapshotPose(actor.getSnapshot().context, Date.now());
    expect(snap().pose).toBe("offline"); // belum ada bridge

    for (const m of eventsFromBridge({ type: "bridge.status", opencode: "up" } as BridgePayload as BridgeMessage)) actor.send(m);
    expect(snap().pose).toBe("idle");

    for (const m of eventsFromBridge({
      type: "agent.state",
      state: { phase: "busy", runningTools: [], pendingPermissions: [], pendingForms: [] },
    } as BridgePayload as BridgeMessage)) actor.send(m);
    expect(snap().pose).toBe("thinking");

    for (const m of eventsFromBridge(feed("membaca file", "running") as BridgePayload as BridgeMessage)) actor.send(m);
    for (const m of eventsFromBridge({
      type: "agent.state",
      state: { phase: "busy", busyKind: "editing", runningTools: ["edit"], pendingPermissions: [], pendingForms: [] },
    } as BridgePayload as BridgeMessage)) actor.send(m);
    const working = snap();
    expect(working.pose).toBe("working");
    expect(working.variant).toBe("typing");
    expect(working.mood).toBe("neutral");

    for (const m of eventsFromBridge({
      type: "agent.state",
      state: { phase: "idle", runningTools: [], pendingPermissions: [], pendingForms: [], lastOutcome: "success" },
    } as BridgePayload as BridgeMessage)) actor.send(m);
    const happy = snap();
    expect(happy.pose).toBe("celebrate");
    expect(happy.mood).toBe("happy"); // happy 10 s setelah celebrate
    actor.stop();
  });

  it("permission: asking selama menunggu; tidak idle saat aktif (silent-events)", () => {
    const actor = createActor(machine);
    actor.start();
    const snap = () => snapshotPose(actor.getSnapshot().context, Date.now());
    for (const m of eventsFromBridge({ type: "bridge.status", opencode: "up" } as BridgePayload as BridgeMessage)) actor.send(m);
    // Sesi aktif tanpa event tool (silent): busy dari prompt.
    for (const m of eventsFromBridge({
      type: "agent.state",
      state: { phase: "busy", runningTools: [], pendingPermissions: [], pendingForms: [] },
    } as BridgePayload as BridgeMessage)) actor.send(m);
    expect(snap().pose).toBe("thinking");
    // Izin datang (event ATAU polling — sama-sama AGENT awaiting).
    for (const m of eventsFromBridge({
      type: "agent.state",
      state: {
        phase: "awaiting",
        runningTools: [],
        pendingPermissions: [{ requestID: "p", tool: "shell", title: "t", patterns: [], risk: "medium", voiceAllowed: true }],
        pendingForms: [],
      },
    } as BridgePayload as BridgeMessage)) actor.send(m);
    expect(snap().pose).toBe("asking");
    actor.stop();
  });

  it("confused: wary 10 s setelah gagal; celebrate: 3 s", () => {
    const actor = createActor(machine);
    actor.start();
    for (const m of eventsFromBridge({ type: "bridge.status", opencode: "up" } as BridgePayload as BridgeMessage)) actor.send(m);
    const t0 = Date.now();
    for (const m of eventsFromBridge({
      type: "agent.state",
      state: { phase: "error", runningTools: [], pendingPermissions: [], pendingForms: [], lastOutcome: "failed" },
    } as BridgePayload as BridgeMessage)) actor.send(m);
    const s1 = snapshotPose(actor.getSnapshot().context, t0);
    expect(s1.pose).toBe("confused");
    expect(s1.mood).toBe("wary");
    // Setelah transient 4 s lewat: pose kembali, mood tetap wary hingga 10 s.
    const s2 = snapshotPose(actor.getSnapshot().context, t0 + 4500);
    expect(s2.mood).toBe("wary");
    actor.stop();
  });

  it("offline saat bridge down", () => {
    const actor = createActor(machine);
    actor.start();
    for (const m of eventsFromBridge({ type: "bridge.status", opencode: "down" } as BridgePayload as BridgeMessage)) actor.send(m);
    expect(snapshotPose(actor.getSnapshot().context, Date.now()).pose).toBe("offline");
    actor.stop();
  });
});
