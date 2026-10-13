import { chmod, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DirHttpError, listDir, resolveDirPath } from "../src/fs/dirs.js";

/** Unit FITUR B: validasi path + listing GET /api/dirs. */

describe("resolveDirPath", () => {
  it("kosong/undefined → home dir", () => {
    expect(resolveDirPath("")).toBe(homedir());
    expect(resolveDirPath(undefined)).toBe(homedir());
    expect(resolveDirPath(null)).toBe(homedir());
    expect(resolveDirPath("   ")).toBe(homedir());
  });
  it("path absolut diterima dan dinormalisasi", () => {
    expect(resolveDirPath("/tmp/../tmp")).toBe("/tmp");
    expect(resolveDirPath("/tmp/./x")).toBe("/tmp/x");
  });
  it("path relatif ditolak (400)", () => {
    for (const p of ["a/b", "./x", "../etc", ".."]) {
      try {
        resolveDirPath(p);
        expect.unreachable(`seharusnya menolak ${p}`);
      } catch (e) {
        expect(e).toBeInstanceOf(DirHttpError);
        expect((e as DirHttpError).status).toBe(400);
      }
    }
  });
  it("karakter null ditolak (400)", () => {
    try {
      resolveDirPath("/tmp/x\0y");
      expect.unreachable("seharusnya menolak null byte");
    } catch (e) {
      expect((e as DirHttpError).status).toBe(400);
    }
  });
});

describe("listDir", () => {
  let root = "";
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "codepet-dirs-"));
    await mkdir(join(root, "Zeta"));
    await mkdir(join(root, "alpha"));
    await writeFile(join(root, "b.txt"), "b");
    await writeFile(join(root, "A.txt"), "a");
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("direktori dulu, lalu alfabetis case-insensitive", async () => {
    const entries = await listDir(root);
    expect(entries.map((e) => e.name)).toEqual(["alpha", "Zeta", "A.txt", "b.txt"]);
    expect(entries[0]).toEqual({ name: "alpha", isDirectory: true });
    expect(entries[2]).toEqual({ name: "A.txt", isDirectory: false });
  });
  it("folder tak ada → 404", async () => {
    try {
      await listDir(join(root, "tidak-ada"));
      expect.unreachable("seharusnya 404");
    } catch (e) {
      expect((e as DirHttpError).status).toBe(404);
    }
  });
  it("bukan direktori → 400", async () => {
    try {
      await listDir(join(root, "b.txt"));
      expect.unreachable("seharusnya 400");
    } catch (e) {
      expect((e as DirHttpError).status).toBe(400);
    }
  });
  it("tanpa izin baca → 403", async () => {
    if (process.getuid?.() === 0) return; // root melewati permission FS
    const locked = join(root, "locked");
    await mkdir(locked);
    await chmod(locked, 0o000);
    try {
      await listDir(locked);
      expect.unreachable("seharusnya 403");
    } catch (e) {
      expect((e as DirHttpError).status).toBe(403);
    } finally {
      await chmod(locked, 0o755);
    }
  });
  it("pesan error ramah dan tak membocorkan path", async () => {
    try {
      await listDir(join(root, "rahasia-tidak-ada"));
      expect.unreachable("seharusnya 404");
    } catch (e) {
      const err = e as DirHttpError;
      expect(err.status).toBe(404);
      expect(err.message).toBe("Folder tidak ditemukan.");
      expect(err.message).not.toContain("rahasia-tidak-ada");
    }
  });
});
