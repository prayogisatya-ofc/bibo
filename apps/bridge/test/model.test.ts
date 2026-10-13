import { describe, expect, it } from "vitest";
import {
  applyPreferredModel,
  fetchModels,
  getPreferredModel,
  mapModelList,
  savePreferredModel,
} from "../src/model.js";
import type { OpenCodeClient } from "../src/opencode/client.js";
import type { BridgeStoreData } from "../src/store.js";

/** FITUR C: unit untuk pemetaan toleran + preferredModel. */

function emptyStore(): BridgeStoreData {
  return { lastSessionByDir: {}, recentDirs: [], settings: {} };
}

function fakeClient(hooks: { listResult?: unknown; listThrows?: boolean; onSwitch?: (args: unknown) => void; switchThrows?: boolean }): OpenCodeClient {
  return {
    model: {
      list: async () => {
        if (hooks.listThrows) throw new Error("boom");
        return hooks.listResult as never;
      },
    },
    session: {
      switchModel: async (args: unknown) => {
        if (hooks.switchThrows) throw new Error("boom");
        hooks.onSwitch?.(args);
      },
    },
  } as unknown as OpenCodeClient;
}

describe("mapModelList (toleran)", () => {
  it("memetakan Model.Info → entri", () => {
    const out = mapModelList({ data: [{ id: "a", name: "A", providerID: "p", modelID: "a" }] });
    expect(out).toEqual([{ id: "a", name: "A", providerID: "p" }]);
  });
  it("menerima array langsung", () => {
    expect(mapModelList([{ id: "a", name: "A", providerID: "p" }])).toHaveLength(1);
  });
  it("name hilang → fallback id; id/providerID hilang → dilewati", () => {
    const out = mapModelList({
      data: [
        { id: "a", providerID: "p" }, // name → "a"
        { name: "tanpa id", providerID: "p" }, // dilewati
        { id: "b", name: "B" }, // tanpa providerID → dilewati
        null,
        "string",
        42,
      ],
    });
    expect(out).toEqual([{ id: "a", name: "a", providerID: "p" }]);
  });
  it("bukan array → [] tanpa crash", () => {
    expect(mapModelList(undefined)).toEqual([]);
    expect(mapModelList(null)).toEqual([]);
    expect(mapModelList({})).toEqual([]);
    expect(mapModelList({ data: "bukan-array" })).toEqual([]);
  });
});

describe("fetchModels", () => {
  it("melempar bila client gagal", async () => {
    await expect(fetchModels(fakeClient({ listThrows: true }))).rejects.toThrow();
  });
  it("meneruskan hasil pemetaan", async () => {
    const out = await fetchModels(fakeClient({ listResult: { data: [{ id: "a", name: "A", providerID: "p" }] } }));
    expect(out).toEqual([{ id: "a", name: "A", providerID: "p" }]);
  });
});

describe("preferredModel di store", () => {
  it("getPreferredModel: valid / belum ada / rusak", () => {
    expect(getPreferredModel(emptyStore())).toBeUndefined();
    const s = emptyStore();
    s.settings["preferredModel"] = { id: "a", providerID: "p", variant: "v" };
    expect(getPreferredModel(s)).toEqual({ id: "a", providerID: "p", variant: "v" });
    const rusak = emptyStore();
    rusak.settings["preferredModel"] = { id: "", providerID: "p" };
    expect(getPreferredModel(rusak)).toBeUndefined();
    const bukanObj = emptyStore();
    bukanObj.settings["preferredModel"] = "a";
    expect(getPreferredModel(bukanObj)).toBeUndefined();
  });
  it("savePreferredModel menyimpan bentuk kanonis", () => {
    const s = emptyStore();
    savePreferredModel(s, { id: "a", providerID: "p" });
    expect(s.settings["preferredModel"]).toEqual({ id: "a", providerID: "p" });
  });
  it("applyPreferredModel: switch sekali dengan ref tersimpan", async () => {
    const s = emptyStore();
    savePreferredModel(s, { id: "a", providerID: "p" });
    const calls: unknown[] = [];
    const applied = await applyPreferredModel(fakeClient({ onSwitch: (a) => calls.push(a) }), s, "ses_1");
    expect(applied).toEqual({ id: "a", providerID: "p" });
    expect(calls).toEqual([{ sessionID: "ses_1", model: { id: "a", providerID: "p" } }]);
  });
  it("applyPreferredModel: tanpa pilihan → null, tak memanggil", async () => {
    let called = false;
    const applied = await applyPreferredModel(fakeClient({ onSwitch: () => (called = true) }), emptyStore(), "ses_1");
    expect(applied).toBeNull();
    expect(called).toBe(false);
  });
  it("applyPreferredModel: server menolak → null (default server tetap)", async () => {
    const s = emptyStore();
    savePreferredModel(s, { id: "a", providerID: "p" });
    const applied = await applyPreferredModel(fakeClient({ switchThrows: true }), s, "ses_1");
    expect(applied).toBeNull();
  });
});
