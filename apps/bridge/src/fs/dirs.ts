import { homedir } from "node:os";
import { isAbsolute, resolve, sep } from "node:path";
import { readdir } from "node:fs/promises";

export interface DirEntry {
  name: string;
  isDirectory: boolean;
}

/** Error HTTP yang aman dikirim ke browser (tanpa stack / path internal). */
export type DirHttpStatus = 400 | 403 | 404 | 500;

export class DirHttpError extends Error {
  constructor(
    public readonly status: DirHttpStatus,
    message: string,
  ) {
    super(message);
    this.name = "DirHttpError";
  }
}

/**
 * Normalisasi + validasi path untuk GET /api/dirs.
 * - kosong/undefined → home dir user
 * - tolak karakter null
 * - path harus absolut (path relatif — termasuk traversal relatif seperti
 *   "../x" — ditolak sebelum resolve)
 * - defense-in-depth: hasil resolve() tak boleh mengandung segmen ".."
 *   (resolve() selalu menormalisasi, tapi cek eksplisit bila perilaku berubah)
 */
export function resolveDirPath(raw: string | null | undefined, home: string = homedir()): string {
  const input = (raw ?? "").trim();
  if (!input) return home;
  if (input.includes("\0")) throw new DirHttpError(400, "Path tidak valid.");
  if (!isAbsolute(input)) throw new DirHttpError(400, "Path harus absolut.");
  const abs = resolve(input);
  if (abs.split(sep).includes("..")) throw new DirHttpError(400, "Path tidak valid.");
  return abs;
}

/**
 * Baca isi direktori: direktori dulu, lalu alfabetis (case-insensitive).
 * Error FS dipetakan ke status HTTP tanpa membocorkan detail internal.
 */
export async function listDir(absDir: string): Promise<DirEntry[]> {
  let dirents;
  try {
    dirents = await readdir(absDir, { withFileTypes: true });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException | null)?.code;
    if (code === "ENOENT") throw new DirHttpError(404, "Folder tidak ditemukan.");
    if (code === "ENOTDIR") throw new DirHttpError(400, "Itu bukan folder.");
    if (code === "EACCES" || code === "EPERM") throw new DirHttpError(403, "Tidak ada izin membaca folder ini.");
    throw new DirHttpError(500, "Gagal membaca folder.");
  }
  return dirents
    .map((d) => ({ name: d.name, isDirectory: d.isDirectory() }))
    .sort(
      (a, b) =>
        Number(b.isDirectory) - Number(a.isDirectory) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
}
