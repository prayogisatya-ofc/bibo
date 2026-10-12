import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EventNormalizer } from "../src/opencode/normalize.js";

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, "..", "..", "..", "docs", "fixtures", "opencode-events");

function load(name: string): unknown[] {
  return readFileSync(join(FIX, name), "utf-8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as unknown);
}

describe("normalize (kontrak: fixture nyata M0 lolos)", () => {
  it("03 permission: asked → replied → tool.failed → execution.interrupted", () => {
    const n = new EventNormalizer();
    const mine = "ses_ed4be57a7ffedykyopnF8nPW5x";
    const got: string[] = [];
    for (const raw of load("03-bash-permission.jsonl") as Array<{ type?: string; data?: { sessionID?: string } }>) {
      const s = n.normalize(raw);
      if (s && (raw.data?.sessionID === mine || s.t === "permission.replied")) got.push(s.t);
    }
    expect(got).toContain("permission.asked");
    expect(got).toContain("permission.replied");
    expect(got).toContain("tool.ended");
    expect(got).toContain("exec.ended");
    const asked = got.filter((t) => t === "permission.asked");
    expect(asked).toHaveLength(1);
  });

  it("permission.asked memetakan field M0", () => {
    const n = new EventNormalizer();
    const s = n.normalize({
      type: "permission.asked",
      data: { id: "per_1", sessionID: "ses_1", action: "shell", resources: ["echo hi"], save: ["echo *"] },
    });
    expect(s).toEqual({
      t: "permission.asked",
      request: { requestID: "per_1", sessionID: "ses_1", action: "shell", resources: ["echo hi"], risk: "medium", voiceAllowed: true },
    });
  });

  it("nama tool di-join dari input.started (bukan dari tool.called)", () => {
    const n = new EventNormalizer();
    expect(n.normalize({ type: "session.tool.called", data: { sessionID: "s", id: "call_1" } })).toBeNull();
    const started = n.normalize({ type: "session.tool.input.started", data: { sessionID: "s", id: "call_1", name: "read" } });
    expect(started).toMatchObject({ t: "tool.started", tool: "read" });
    const ended = n.normalize({ type: "session.tool.success", data: { sessionID: "s", id: "call_1" } });
    expect(ended).toMatchObject({ t: "tool.ended", tool: "read", ok: true });
  });

  it("form.created → form.asked; tak dikenal → null", () => {
    const n = new EventNormalizer();
    const s = n.normalize({
      type: "form.created",
      data: { form: { id: "frm_1", sessionID: "s", title: "Q", fields: [] } },
    });
    expect(s).toMatchObject({ t: "form.asked", form: { formID: "frm_1" } });
    expect(n.normalize({ type: "project.updated", data: {} })).toBeNull();
    expect(n.normalize({ type: "session.idle", data: {} })).toBeNull();
    expect(n.unknownCount).toBeGreaterThan(0);
  });

  it("04 fixture: form.created milik sesi ter-normalisasi", () => {
    const n = new EventNormalizer();
    const mine = "ses_ed4be33eeffev1f7JJF0P9hFTe";
    let found = false;
    for (const raw of load("04-agent-question-form.jsonl") as Array<{ type?: string; data?: { sessionID?: string; form?: { sessionID?: string } } }>) {
      if (raw.type === "form.created") {
        const s = n.normalize(raw);
        if (s?.t === "form.asked" && s.form.sessionID === mine) found = true;
      }
    }
    expect(found).toBe(true);
  });
});
