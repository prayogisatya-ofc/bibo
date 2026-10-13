import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ActivityFeed } from "../src/ui/ActivityFeed.js";
import type { FeedItem } from "@codepet/protocol";

afterEach(cleanup);

function item(over: Partial<FeedItem> = {}): FeedItem {
  return {
    id: "tool-1",
    kind: "tool",
    title: "menjalankan perintah",
    status: "running",
    ts: 1_000_000,
    ...over,
  };
}

function durText(): string | null | undefined {
  return screen.getByTestId("feed").querySelector(".tool-dur")?.textContent;
}

describe("ActivityFeed", () => {
  it("item berjalan: tampil 'berjalan' tanpa durasi", () => {
    render(<ActivityFeed items={[item()]} />);
    expect(durText()).toBe("berjalan");
  });

  it("durasi item selesai BEKU (tidak menghitung terus saat re-render)", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000_000);
      const { rerender } = render(
        <ActivityFeed items={[item({ status: "running", ts: 1_000_000 })]} />,
      );
      expect(durText()).toBe("berjalan");
      // Tool selesai 2,5 detik kemudian (ts = waktu selesai dari bridge).
      vi.setSystemTime(1_002_500);
      rerender(<ActivityFeed items={[item({ status: "ok", ts: 1_002_500 })]} />);
      expect(durText()).toBe("2,5 s");
      // Re-render 10 detik kemudian (tick orchestrator tiap 500 ms):
      // durasi HARUS tetap, tidak ikut menghitung.
      vi.setSystemTime(1_012_500);
      rerender(<ActivityFeed items={[item({ status: "ok", ts: 1_002_500 })]} />);
      expect(durText()).toBe("2,5 s");
    } finally {
      vi.useRealTimers();
    }
  });

  it("kosong: tidak render apa-apa", () => {
    const { container } = render(<ActivityFeed items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
