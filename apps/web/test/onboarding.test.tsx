import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Onboarding, normDir } from "../src/ui/Onboarding.js";

afterEach(cleanup);

const sessions = [
  { sessionID: "s1", title: "Sesi A1", directory: "/proj/a" },
  { sessionID: "s2", title: "Sesi A2", directory: "/proj/a/" },
  { sessionID: "s3", title: "Sesi B1", directory: "/proj/b" },
];

function setup(onPick = vi.fn()) {
  render(
    <Onboarding recent={[]} sessions={sessions} bridgeHttp="http://127.0.0.1:8787" onPick={onPick} />,
  );
  return onPick;
}

describe("normDir", () => {
  it("menormalkan trailing slash & spasi", () => {
    expect(normDir("/proj/a/")).toBe("/proj/a");
    expect(normDir("  /proj/a  ")).toBe("/proj/a");
    expect(normDir(undefined)).toBe("");
  });
});

describe("Onboarding folder+sesi", () => {
  it("tanpa folder: tampil petunjuk, bukan daftar sesi", () => {
    setup();
    expect(screen.getByTestId("sess-hint")).toBeTruthy();
    expect(screen.queryByTestId("sess-s1")).toBeNull();
  });

  it("sesi difilter per folder (termasuk varian trailing slash)", () => {
    setup();
    fireEvent.change(screen.getByTestId("dir-input"), { target: { value: "/proj/a" } });
    expect(screen.getByTestId("sess-s1")).toBeTruthy();
    expect(screen.getByTestId("sess-s2")).toBeTruthy();
    expect(screen.queryByTestId("sess-s3")).toBeNull();
  });

  it("klik sesi: onPick(dir, sessionID) untuk lanjutkan", () => {
    const onPick = setup();
    fireEvent.change(screen.getByTestId("dir-input"), { target: { value: "/proj/a/" } });
    fireEvent.click(screen.getByTestId("sess-s2"));
    expect(onPick).toHaveBeenCalledWith("/proj/a", "s2");
  });

  it("tombol sesi baru: onPick(dir) tanpa sessionID", () => {
    const onPick = setup();
    fireEvent.change(screen.getByTestId("dir-input"), { target: { value: "/proj/b" } });
    fireEvent.click(screen.getByTestId("sess-new"));
    expect(onPick).toHaveBeenCalledWith("/proj/b");
  });

  it("folder tanpa sesi: tampil pesan kosong", () => {
    setup();
    fireEvent.change(screen.getByTestId("dir-input"), { target: { value: "/proj/c" } });
    expect(screen.getByTestId("sess-empty")).toBeTruthy();
  });
});
