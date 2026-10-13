import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ModelPicker } from "../src/ui/ModelPicker.js";
import { LocaleProvider } from "../src/i18n/index.js";

afterEach(() => {
  cleanup();
});

const MODELS = [
  { id: "mock-a", name: "Mock A (cepat)", providerID: "mock" },
  { id: "mock-b", name: "Mock B (pintar)", providerID: "mock" },
];

function renderPicker(props: Partial<Parameters<typeof ModelPicker>[0]> = {}) {
  return render(
    <LocaleProvider value="id">
      <ModelPicker
        models={MODELS}
        current={null}
        loading={false}
        error={null}
        onSelect={() => {}}
        onRetry={() => {}}
        {...props}
      />
    </LocaleProvider>,
  );
}

describe("ModelPicker (FITUR C)", () => {
  it("loading: status memuat, tanpa select", () => {
    renderPicker({ loading: true });
    expect(screen.getByTestId("model-picker").getAttribute("role")).toBe("status");
    expect(screen.getByText("Memuat model…")).toBeTruthy();
    expect(screen.queryByTestId("model-select")).toBeNull();
  });

  it("error: pesan ramah + tombol muat ulang", () => {
    const onRetry = vi.fn();
    renderPicker({ error: "OC_DOWN", onRetry });
    expect(screen.getByTestId("model-picker").getAttribute("role")).toBe("alert");
    expect(screen.getByTitle("OpenCode belum terhubung.")).toBeTruthy();
    fireEvent.click(screen.getByTestId("model-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("tanpa pilihan: label 'Model: bawaan server'", () => {
    renderPicker();
    const sel = screen.getByTestId("model-select") as HTMLSelectElement;
    expect(sel.value).toBe("");
    expect(sel.options[sel.selectedIndex]?.text).toBe("Model: bawaan server");
  });

  it("dengan pilihan: menampilkan nama model aktif", () => {
    renderPicker({ current: { id: "mock-b", providerID: "mock" } });
    const sel = screen.getByTestId("model-select") as HTMLSelectElement;
    expect(sel.options[sel.selectedIndex]?.text).toBe("Mock B (pintar)");
  });

  it("pilih opsi → onSelect(id, providerID)", () => {
    const onSelect = vi.fn();
    renderPicker({ onSelect });
    const sel = screen.getByTestId("model-select");
    fireEvent.change(sel, { target: { value: JSON.stringify({ id: "mock-a", providerID: "mock" }) } });
    expect(onSelect).toHaveBeenCalledWith("mock-a", "mock");
  });
});
