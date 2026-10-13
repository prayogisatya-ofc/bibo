import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DirPicker } from "../src/ui/DirPicker.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

interface Entry {
  name: string;
  isDirectory: boolean;
}

/** Mock fetch /api/dirs: path dijawab dari query param `path`. */
function stubDirs(byPath: Record<string, Entry[]>) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string) => {
    calls.push(url);
    const q = new URL(url, "http://x").searchParams.get("path") ?? "";
    const p = q === "" ? "/home/u" : q;
    const entries = byPath[p];
    if (!entries) {
      return { ok: false, json: async () => ({ error: "Folder tidak ditemukan." }) };
    }
    return { ok: true, json: async () => ({ path: p, entries }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

const HOME_ENTRIES: Entry[] = [
  { name: "proj", isDirectory: true },
  { name: "catatan.txt", isDirectory: false },
];

describe("DirPicker (FITUR B)", () => {
  it("memuat daftar dari bridge + breadcrumb + tombol pilih", async () => {
    const { calls } = stubDirs({ "/home/u": HOME_ENTRIES });
    const onSelect = vi.fn();
    render(<DirPicker bridgeHttp="http://127.0.0.1:4317" onSelect={onSelect} onClose={() => {}} />);

    expect(await screen.findByTestId("dir-picker")).toBeTruthy();
    expect(await screen.findByTestId("dir-entry-proj")).toBeTruthy();
    expect(screen.getByText("catatan.txt")).toBeTruthy(); // file tampil tapi tak bisa diklik
    expect(screen.getByTestId("dir-picker-select")).toBeTruthy();
    expect(calls[0]).toContain("/api/dirs?path=");
  });

  it("klik folder menavigasi ke dalamnya", async () => {
    stubDirs({
      "/home/u": HOME_ENTRIES,
      "/home/u/proj": [{ name: "src", isDirectory: true }],
    });
    render(<DirPicker bridgeHttp="http://127.0.0.1:4317" onSelect={() => {}} onClose={() => {}} />);
    fireEvent.click(await screen.findByTestId("dir-entry-proj"));
    expect(await screen.findByTestId("dir-entry-src")).toBeTruthy();
  });

  it("tombol naik kembali ke induk", async () => {
    stubDirs({
      "/home/u": HOME_ENTRIES,
      "/home/u/proj": [{ name: "src", isDirectory: true }],
    });
    render(<DirPicker bridgeHttp="http://127.0.0.1:4317" onSelect={() => {}} onClose={() => {}} />);
    fireEvent.click(await screen.findByTestId("dir-entry-proj"));
    await screen.findByTestId("dir-entry-src");
    fireEvent.click(screen.getByTestId("dir-picker-up"));
    expect(await screen.findByTestId("dir-entry-proj")).toBeTruthy();
  });

  it("pilih folder ini → onSelect(path saat ini)", async () => {
    stubDirs({
      "/home/u": HOME_ENTRIES,
      "/home/u/proj": [{ name: "src", isDirectory: true }],
    });
    const onSelect = vi.fn();
    render(<DirPicker bridgeHttp="http://127.0.0.1:4317" onSelect={onSelect} onClose={() => {}} />);
    fireEvent.click(await screen.findByTestId("dir-entry-proj"));
    await screen.findByTestId("dir-entry-src");
    fireEvent.click(screen.getByTestId("dir-picker-select"));
    expect(onSelect).toHaveBeenCalledWith("/home/u/proj");
  });

  it("input manual sebagai fallback menavigasi", async () => {
    stubDirs({ "/home/u": HOME_ENTRIES, "/tmp": [] });
    render(<DirPicker bridgeHttp="http://127.0.0.1:4317" onSelect={() => {}} onClose={() => {}} />);
    await screen.findByTestId("dir-entry-proj");
    fireEvent.change(screen.getByTestId("dir-picker-input"), { target: { value: "/tmp" } });
    fireEvent.click(screen.getByTestId("dir-picker-go"));
    expect(await screen.findByText("Folder ini kosong.")).toBeTruthy();
  });

  it("error bridge → pesan ramah + coba lagi", async () => {
    const { fetchMock } = stubDirs({});
    render(<DirPicker bridgeHttp="http://127.0.0.1:4317" onSelect={() => {}} onClose={() => {}} />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Folder tidak ditemukan.");
    fireEvent.click(screen.getByTestId("dir-picker-retry"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("Esc memanggil onClose", async () => {
    stubDirs({ "/home/u": HOME_ENTRIES });
    const onClose = vi.fn();
    render(<DirPicker bridgeHttp="http://127.0.0.1:4317" onSelect={() => {}} onClose={onClose} />);
    await screen.findByTestId("dir-entry-proj");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
