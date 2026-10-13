import type { OpenCodeClient } from "./opencode/client.js";
import type { BridgeStoreData } from "./store.js";

/**
 * FITUR C: pilih model dari server OpenCode (GET /api/model + POST /api/session/{id}/model).
 *
 * Keputusan produk: default = model default server OpenCode bila user belum
 * pernah memilih; bridge TIDAK me-pin model diam-diam. Pilihan user disimpan di
 * store.settings["preferredModel"] dan diterapkan SEKALI ke sesi BARU
 * (ensureSession), bukan ke sesi yang sudah ada.
 */

export interface ModelRef {
  id: string;
  providerID: string;
  variant?: string;
}

export interface ModelEntry {
  id: string;
  name: string;
  providerID: string;
}

/** Petakan hasil `client.model.list()` ke entri UI; toleran terhadap field
 *  hilang/bentuk tak terduga (AGENTS.md #2, #6): lewati entri tanpa id/providerID,
 *  fallback name → id. Tak pernah melempar untuk input tak-array. */
export function mapModelList(data: unknown): ModelEntry[] {
  const raw = Array.isArray(data) ? data : (data as { data?: unknown } | null)?.data;
  if (!Array.isArray(raw)) return [];
  const out: ModelEntry[] = [];
  for (const m of raw) {
    if (typeof m !== "object" || m === null) continue;
    const rec = m as Record<string, unknown>;
    const id = typeof rec["id"] === "string" ? rec["id"] : "";
    const providerID = typeof rec["providerID"] === "string" ? rec["providerID"] : "";
    if (!id || !providerID) continue;
    const name = typeof rec["name"] === "string" && rec["name"] !== "" ? rec["name"] : id;
    out.push({ id, name, providerID });
  }
  return out;
}

/** Daftar model dari server; melempar bila panggilan gagal (pemanggil yang menilai). */
export async function fetchModels(client: OpenCodeClient): Promise<ModelEntry[]> {
  const out = await client.model.list();
  return mapModelList(out);
}

/** Pilihan user yang tersimpan; undefined bila belum pernah memilih / rusak. */
export function getPreferredModel(store: BridgeStoreData): ModelRef | undefined {
  const p = store.settings["preferredModel"];
  if (typeof p !== "object" || p === null) return undefined;
  const rec = p as Record<string, unknown>;
  if (typeof rec["id"] !== "string" || rec["id"] === "") return undefined;
  if (typeof rec["providerID"] !== "string" || rec["providerID"] === "") return undefined;
  return {
    id: rec["id"],
    providerID: rec["providerID"],
    ...(typeof rec["variant"] === "string" && rec["variant"] !== "" ? { variant: rec["variant"] } : {}),
  };
}

export function savePreferredModel(store: BridgeStoreData, ref: ModelRef): void {
  store.settings["preferredModel"] = { id: ref.id, providerID: ref.providerID, ...(ref.variant ? { variant: ref.variant } : {}) };
}

/**
 * Terapkan pilihan tersimpan ke SESI BARU, sekali, diam-diam.
 * Mengembalikan ref yang diterapkan, atau null bila: belum ada pilihan,
 * atau server menolak (abaikan — default server tetap dipakai).
 */
export async function applyPreferredModel(
  client: OpenCodeClient,
  store: BridgeStoreData,
  sessionID: string,
): Promise<ModelRef | null> {
  const pref = getPreferredModel(store);
  if (!pref) return null;
  try {
    await client.session.switchModel({ sessionID, model: pref });
    return pref;
  } catch {
    return null;
  }
}
