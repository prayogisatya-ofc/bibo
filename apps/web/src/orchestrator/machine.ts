import { assign, setup } from "xstate";
import type { AgentState, BridgeMessage } from "@codepet/protocol";
import { derivePose, type PoseContext } from "./pose.js";
import type { AvatarPose } from "@codepet/avatar";

/**
 * Orkestrator XState v5 (PRD §8.1): tiga region paralel link/agent/voice.
 * Transient: celebrate (±2 s setelah sukses), confused (±4 s setelah gagal).
 */

interface Ctx {
  link: "online" | "offline";
  phase: AgentState["phase"];
  busyKind: AgentState["busyKind"];
  mic: "off" | "listening";
  speaking: boolean;
  celebrateUntil: number;
  confusedUntil: number;
  lastActive: number;
}

type Ev =
  | { type: "BRIDGE"; status: "up" | "down" | "reconnecting" }
  | { type: "AGENT"; state: AgentState }
  | { type: "FEED_TOOL"; tool: string; status: "running" | "ok" | "fail" }
  | { type: "MIC"; on: boolean }
  | { type: "SPEAK"; on: boolean }
  | { type: "TICK"; now: number };

export const machine = setup({
  types: { context: {} as Ctx, events: {} as Ev },
  actions: {
    noteActive: assign({ lastActive: ({ event }) => (event.type === "TICK" ? event.now : Date.now()) }),
    applyAgent: assign(({ event, context }) => {
      if (event.type !== "AGENT") return {};
      const s = event.state;
      const now = Date.now();
      return {
        phase: s.phase,
        busyKind: s.busyKind,
        celebrateUntil: s.lastOutcome === "success" ? now + 2000 : context.celebrateUntil,
        confusedUntil: s.lastOutcome === "failed" ? now + 4000 : context.confusedUntil,
        lastActive: now,
      };
    }),
  },
}).createMachine({
  id: "bibo",
  type: "parallel",
  context: {
    link: "offline",
    phase: "idle",
    busyKind: undefined,
    mic: "off",
    speaking: false,
    celebrateUntil: 0,
    confusedUntil: 0,
    lastActive: Date.now(),
  },
  states: {
    link: {
      initial: "offline",
      states: {
        offline: {
          on: {
            BRIDGE: {
              target: "online",
              guard: ({ event }) => event.status === "up",
              actions: assign({ link: "online", lastActive: () => Date.now() }),
            },
          },
        },
        online: {
          on: {
            BRIDGE: {
              target: "offline",
              guard: ({ event }) => event.status === "down",
              actions: assign({ link: "offline", lastActive: () => Date.now() }),
            },
          },
        },
      },
    },
    agent: {
      initial: "idle",
      states: {
        idle: {
          on: {
            AGENT: {
              target: "busy",
              guard: ({ event }) => event.state.phase === "busy",
              actions: "applyAgent",
            },
          },
        },
        busy: {
          on: {
            AGENT: [
              {
                target: "awaiting",
                guard: ({ event }) => event.state.phase === "awaiting",
                actions: "applyAgent",
              },
              { target: "idle", guard: ({ event }) => event.state.phase === "idle", actions: "applyAgent" },
              { target: "error", guard: ({ event }) => event.state.phase === "error", actions: "applyAgent" },
            ],
          },
        },
        awaiting: {
          on: {
            AGENT: [
              { target: "busy", guard: ({ event }) => event.state.phase === "busy", actions: "applyAgent" },
              { target: "idle", guard: ({ event }) => event.state.phase === "idle", actions: "applyAgent" },
            ],
          },
        },
        error: {
          on: {
            AGENT: [
              { target: "busy", guard: ({ event }) => event.state.phase === "busy", actions: "applyAgent" },
              { target: "idle", guard: ({ event }) => event.state.phase === "idle", actions: "applyAgent" },
            ],
          },
        },
      },
    },
    voice: {
      initial: "quiet",
      states: {
        quiet: {
          on: {
            MIC: { target: "listening", guard: ({ event }) => event.on },
            SPEAK: { target: "speaking", guard: ({ event }) => event.on },
          },
        },
        listening: {
          on: {
            MIC: { target: "quiet", guard: ({ event }) => !event.on },
            SPEAK: { target: "speaking", guard: ({ event }) => event.on },
          },
        },
        speaking: {
          on: {
            SPEAK: { target: "quiet", guard: ({ event }) => !event.on },
            MIC: { target: "listening", guard: ({ event }) => event.on },
          },
        },
      },
    },
  },
  on: {
    // Fallback: event BRIDGE yang tak cocok guard region (mis. "reconnecting")
    // hanya menyentuh lastActive; link dipertahankan.
    BRIDGE: {
      actions: assign(({ context }) => ({ link: context.link, lastActive: Date.now() })),
    },
    AGENT: { actions: "applyAgent" },
    FEED_TOOL: {
      // Nama tool mentah tidak ada di feed.item (judul ringkas Indonesia);
      // busyKind resmi datang dari agent.state. Feed hanya menandai aktivitas.
      actions: assign({ lastActive: () => Date.now() }),
    },
    MIC: { actions: assign({ mic: ({ event }) => (event.type === "MIC" && event.on ? "listening" : "off") }) },
    SPEAK: { actions: assign({ speaking: ({ event }) => event.type === "SPEAK" && event.on }) },
  },
});

export interface Snapshot {
  pose: AvatarPose;
  speaking: boolean;
}

/** Bangun PoseContext dari konteks machine + jam. */
export function poseFromContext(c: Ctx, now: number): PoseContext {
  return {
    link: c.link === "online" ? "online" : "offline",
    agent: c.phase === "busy" && c.busyKind ? "working" : c.phase === "busy" ? "thinking" : c.phase,
    busyKind: c.busyKind,
    mic: c.mic,
    speaking: c.speaking,
    celebrate: now < c.celebrateUntil,
    confused: now < c.confusedUntil,
    idleMs: now - c.lastActive,
  };
}

export function snapshotPose(c: Ctx, now: number): Snapshot {
  const ctx = poseFromContext(c, now);
  return { pose: derivePose(ctx), speaking: ctx.speaking };
}

/** Terjemahkan pesan WS bridge → event machine. */
export function eventsFromBridge(m: BridgeMessage): Ev[] {
  switch (m.type) {
    case "bridge.status":
      return [{ type: "BRIDGE", status: m.opencode }];
    case "bridge.ready":
      return [{ type: "BRIDGE", status: m.opencode.status }];
    case "agent.state":
      return [{ type: "AGENT", state: m.state }];
    case "feed.item":
      return m.item.kind === "tool" || m.item.kind === "shell"
        ? [{ type: "FEED_TOOL", tool: m.item.title, status: m.item.status }]
        : [];
    case "permission.requested":
    case "form.requested":
      return [];
    default:
      return [];
  }
}
