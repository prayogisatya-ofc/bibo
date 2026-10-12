import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { BUBBLE_FADE_MS, useSpeechBubble } from "../src/ui/useSpeechBubble.js";
import type { Bubble, BubbleEvent } from "../src/ui/speechBubble.js";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

let seen: { bubble: Bubble | null; dispatch: (e: BubbleEvent) => void } | undefined;
function Probe(): null {
  seen = useSpeechBubble();
  return null;
}

function speak(id = "s1", text = "Satu. Dua."): void {
  const s = seen;
  if (!s) return;
  act(() => s.dispatch({ type: "speak", id, text, urgent: false, error: false }));
}

describe("useSpeechBubble (fade 1,5 dtk §C.4)", () => {
  it(`speechend → fading; hilang setelah ${BUBBLE_FADE_MS} ms`, () => {
    expect(BUBBLE_FADE_MS).toBe(1500);
    render(<Probe />);
    speak();
    expect(seen?.bubble?.fading).toBe(false);
    act(() => seen?.dispatch({ type: "speechend", id: "s1" }));
    expect(seen?.bubble?.fading).toBe(true);
    // Belum hilang sebelum waktunya.
    act(() => {
      vi.advanceTimersByTime(BUBBLE_FADE_MS - 1);
    });
    expect(seen?.bubble).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(seen?.bubble).toBeNull();
  });

  it("speak baru membatalkan timer fade yang tertunda", () => {
    render(<Probe />);
    speak("s1");
    act(() => seen?.dispatch({ type: "speechend", id: "s1" }));
    expect(seen?.bubble?.fading).toBe(true);
    // Ucapan baru sebelum fade selesai → timer lama dibuang.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    speak("s2", "Hai.");
    expect(seen?.bubble?.id).toBe("s2");
    expect(seen?.bubble?.fading).toBe(false);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // Timer lama tidak boleh menghapus bubble s2.
    expect(seen?.bubble?.id).toBe("s2");
  });

  it("unmount membersihkan timer", () => {
    const { unmount } = render(<Probe />);
    speak();
    act(() => seen?.dispatch({ type: "speechend", id: "s1" }));
    unmount();
    // Tidak boleh throw / bocor setelah unmount.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
