import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Persistensi bridge: sesi terakhir per direktori + pengaturan (FR-003, FR-056). */

export interface BridgeStoreData {
  lastSessionByDir: Record<string, string>;
  recentDirs: string[];
  settings: Record<string, unknown>;
}

const EMPTY: BridgeStoreData = { lastSessionByDir: {}, recentDirs: [], settings: {} };

export async function loadStore(dataDir: string): Promise<BridgeStoreData> {
  try {
    const raw = await readFile(join(dataDir, "store.json"), "utf-8");
    const parsed = JSON.parse(raw) as Partial<BridgeStoreData>;
    return {
      lastSessionByDir: parsed.lastSessionByDir ?? {},
      recentDirs: (parsed.recentDirs ?? []).slice(0, 10),
      settings: parsed.settings ?? {},
    };
  } catch {
    return { ...EMPTY };
  }
}

export async function saveStore(dataDir: string, data: BridgeStoreData): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, "store.json"), JSON.stringify(data, null, 2));
}

export function rememberDir(data: BridgeStoreData, dir: string): void {
  data.recentDirs = [dir, ...data.recentDirs.filter((d) => d !== dir)].slice(0, 10);
}
