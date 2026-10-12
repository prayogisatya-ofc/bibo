import { describe, expect, it } from "vitest";
import { busyKindOf, derivePose, type PoseContext } from "../src/orchestrator/pose.js";

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

describe("derivePose prioritas (PRD §8.2)", () => {
  const cases: Array<[string, Partial<PoseContext>, string]> = [
    ["offline mengalahkan semua", { link: "offline", agent: "working", busyKind: "editing", celebrate: true }, "offline"],
    ["confused > asking", { agent: "awaiting", confused: true }, "confused"],
    ["asking saat menunggu izin", { agent: "awaiting" }, "asking"],
    ["asking saat menunggu form", { agent: "awaiting", busyKind: "editing" }, "asking"],
    ["listening > working", { agent: "working", busyKind: "editing", mic: "listening" }, "listening"],
    ["working.reading", { agent: "working", busyKind: "reading" }, "working.reading"],
    ["working.editing", { agent: "working", busyKind: "editing" }, "working.editing"],
    ["working.running", { agent: "working", busyKind: "running" }, "working.running"],
    ["working.searching", { agent: "working", busyKind: "searching" }, "working.searching"],
    ["working.delegating", { agent: "working", busyKind: "delegating" }, "working.delegating"],
    ["working.generic utk kind tak dikenal", { agent: "working", busyKind: "thinking" }, "working.generic"],
    ["thinking tanpa tool", { agent: "thinking" }, "thinking"],
    ["error → confused", { agent: "error" }, "confused"],
    ["celebrate setelah sukses", { celebrate: true }, "celebrate"],
    ["idle default", {}, "idle"],
    ["sleeping setelah 120 s", { idleMs: 120_001 }, "sleeping"],
    ["speaking bukan pose (tetap working)", { agent: "working", busyKind: "editing", speaking: true }, "working.editing"],
  ];
  for (const [name, patch, want] of cases) {
    it(name, () => {
      expect(derivePose({ ...base, ...patch })).toBe(want);
    });
  }
});

describe("TOOL_BUSY_KIND (nama nyata M0)", () => {
  it("read/edit/shell/execute/question + fallback", () => {
    expect(busyKindOf("read")).toBe("reading");
    expect(busyKindOf("edit")).toBe("editing");
    expect(busyKindOf("shell")).toBe("running");
    expect(busyKindOf("execute")).toBe("running");
    expect(busyKindOf("question")).toBe("thinking");
    expect(busyKindOf("webfetch")).toBe("searching");
    expect(busyKindOf("alat-tak-dikenal")).toBe("thinking");
  });
});
