import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { useUiMode, type UiMode } from "../src/ui/useUiMode.js";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

let seen: { mode: UiMode; toggleMode: () => void } | undefined;
function Probe(): null {
  seen = useUiMode();
  return null;
}

describe("useUiMode (§C.2)", () => {
  it("default chat; tersimpan di localStorage", () => {
    render(<Probe />);
    expect(seen?.mode).toBe("chat");
    act(() => seen?.toggleMode());
    expect(seen?.mode).toBe("talk");
    expect(localStorage.getItem("codepet.ui-mode")).toBe("talk");
  });
  it("memulihkan dari localStorage", () => {
    localStorage.setItem("codepet.ui-mode", "talk");
    render(<Probe />);
    expect(seen?.mode).toBe("talk");
  });
  it("Ctrl+. berpindah mode", () => {
    render(<Probe />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: ".", ctrlKey: true, bubbles: true }));
    });
    expect(seen?.mode).toBe("talk");
    expect(localStorage.getItem("codepet.ui-mode")).toBe("talk");
  });
  it("Ctrl+. diabaikan saat fokus di input teks", () => {
    render(<Probe />);
    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    act(() => {
      ta.dispatchEvent(new KeyboardEvent("keydown", { key: ".", ctrlKey: true, bubbles: true }));
    });
    expect(seen?.mode).toBe("chat");
    ta.remove();
  });
});
