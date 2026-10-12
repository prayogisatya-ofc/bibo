import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import { eventsFromBridge, machine, snapshotPose } from "../src/orchestrator/machine.js";
import type { BridgeMessage, BridgePayload } from "@codepet/protocol";

function feed(title: string, status: "running" | "ok" | "fail"): BridgePayload {
  return { type: "feed.item", item: { id: "c", kind: "tool", title, status, ts: 1 } };
}

/** Urutan pesan WS setara skenario edit-files mock: busy → working.editing → idle+celebrate. */
describe("orchestrator mengikuti sinyal bridge", () => {
  it("edit-files: idle → thinking → working.editing → celebrate → idle", () => {
    const actor = createActor(machine);
    actor.start();
    const pose = (): string => snapshotPose(actor.getSnapshot().context, Date.now()).pose;
    expect(pose()).toBe("offline"); // belum ada bridge

    for (const m of eventsFromBridge({ type: "bridge.status", opencode: "up" } as BridgePayload as BridgeMessage)) actor.send(m);
    expect(pose()).toBe("idle");

    for (const m of eventsFromBridge({
      type: "agent.state",
      state: { phase: "busy", runningTools: [], pendingPermissions: [], pendingForms: [] },
    } as BridgePayload as BridgeMessage)) actor.send(m);
    expect(pose()).toBe("thinking");

    for (const m of eventsFromBridge(feed("membaca file", "running") as BridgePayload as BridgeMessage)) actor.send(m);
    for (const m of eventsFromBridge({
      type: "agent.state",
      state: { phase: "busy", busyKind: "editing", runningTools: ["edit"], pendingPermissions: [], pendingForms: [] },
    } as BridgePayload as BridgeMessage)) actor.send(m);
    expect(pose()).toBe("working.editing");

    for (const m of eventsFromBridge({
      type: "agent.state",
      state: { phase: "idle", runningTools: [], pendingPermissions: [], pendingForms: [], lastOutcome: "success" },
    } as BridgePayload as BridgeMessage)) actor.send(m);
    expect(pose()).toBe("celebrate");
    actor.stop();
  });

  it("permission: asking selama menunggu; tidak idle saat aktif (silent-events)", () => {
    const actor = createActor(machine);
    actor.start();
    const pose = (): string => snapshotPose(actor.getSnapshot().context, Date.now()).pose;
    for (const m of eventsFromBridge({ type: "bridge.status", opencode: "up" } as BridgePayload as BridgeMessage)) actor.send(m);
    // Sesi aktif tanpa event tool (silent): busy dari prompt.
    for (const m of eventsFromBridge({
      type: "agent.state",
      state: { phase: "busy", runningTools: [], pendingPermissions: [], pendingForms: [] },
    } as BridgePayload as BridgeMessage)) actor.send(m);
    expect(pose()).toBe("thinking");
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
    expect(pose()).toBe("asking");
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
