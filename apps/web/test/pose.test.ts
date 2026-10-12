import { describe, expect, it } from "vitest";
import type { AvatarPose, WorkingVariant } from "@codepet/avatar";
import { busyKindOf, derivePose, poseLabel, type PoseContext } from "../src/orchestrator/pose.js";

const base: PoseContext = {
  link: "online",
  agent: "idle",
  busyKind: undefined,
  mic: "off",
  speaking: false,
  celebrate: false,
  confused: false,
  idleMs: 1000,
};

describe("derivePose prioritas (PRD §8.2, pemetaan CHARACTER.md §11)", () => {
  const cases: Array<[string, Partial<PoseContext>, { pose: AvatarPose; variant?: WorkingVariant }]> = [
    ["offline mengalahkan semua", { link: "offline", agent: "working", busyKind: "editing", celebrate: true }, { pose: "offline" }],
    ["confused > asking", { agent: "awaiting", confused: true }, { pose: "confused" }],
    ["error → confused", { agent: "error" }, { pose: "confused" }],
    ["asking saat menunggu izin", { agent: "awaiting" }, { pose: "asking" }],
    ["asking saat menunggu form", { agent: "awaiting", busyKind: "editing" }, { pose: "asking" }],
    ["listening > working", { agent: "working", busyKind: "editing", mic: "listening" }, { pose: "listening" }],
    ["working + reading", { agent: "working", busyKind: "reading" }, { pose: "working", variant: "reading" }],
    ["working + editing → typing", { agent: "working", busyKind: "editing" }, { pose: "working", variant: "typing" }],
    ["working + running", { agent: "working", busyKind: "running" }, { pose: "working", variant: "running" }],
    ["working + searching", { agent: "working", busyKind: "searching" }, { pose: "working", variant: "searching" }],
    ["working + delegating", { agent: "working", busyKind: "delegating" }, { pose: "working", variant: "delegating" }],
    ["working + kind tak dikenal → generic", { agent: "working", busyKind: "thinking" }, { pose: "working", variant: "generic" }],
    ["working tanpa kind → generic", { agent: "working" }, { pose: "working", variant: "generic" }],
    ["thinking tanpa tool", { agent: "thinking" }, { pose: "thinking" }],
    ["celebrate setelah sukses", { celebrate: true }, { pose: "celebrate" }],
    ["idle default", {}, { pose: "idle" }],
    ["sleeping setelah 120 s", { idleMs: 120_001 }, { pose: "sleeping" }],
    // speaking OVERLAY: pose dasar tetap working, flag speaking terpisah.
    ["speaking bukan pose (tetap working+typing)", { agent: "working", busyKind: "editing", speaking: true }, { pose: "working", variant: "typing" }],
    ["speaking bukan pose (tetap idle)", { speaking: true }, { pose: "idle" }],
  ];
  for (const [name, patch, want] of cases) {
    it(name, () => {
      expect(derivePose({ ...base, ...patch })).toEqual(want);
    });
  }
});

describe("TOOL_BUSY_KIND (nama nyata M0, PRD §8.3a)", () => {
  it("read/edit/shell/execute/question/task/subagent + fallback", () => {
    expect(busyKindOf("read")).toBe("reading");
    expect(busyKindOf("edit")).toBe("editing");
    expect(busyKindOf("shell")).toBe("running");
    expect(busyKindOf("execute")).toBe("running");
    expect(busyKindOf("question")).toBe("thinking");
    expect(busyKindOf("webfetch")).toBe("searching");
    expect(busyKindOf("task")).toBe("delegating");
    expect(busyKindOf("subagent")).toBe("delegating");
    expect(busyKindOf("alat-tak-dikenal")).toBe("thinking");
  });
});

describe("poseLabel (id/en)", () => {
  it("working memakai variant; non-working mengabaikan variant", () => {
    expect(poseLabel("working", "reading", "id")).toBe("Aku lagi baca file…");
    expect(poseLabel("working", "typing", "id")).toBe("Aku lagi mengedit file…");
    expect(poseLabel("working", undefined, "id")).toBe("Aku lagi bekerja…");
    expect(poseLabel("working", "running", "en")).toBe("Running commands…");
    expect(poseLabel("asking", undefined, "id")).toBe("Boleh…?");
    expect(poseLabel("celebrate", undefined, "id")).toBe("Beres!");
    expect(poseLabel("idle", undefined, "id")).toBe("Bibo siap.");
  });
});
