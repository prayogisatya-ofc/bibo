import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach } from "vitest";
import { ApprovalCard } from "../src/ui/ApprovalCard.js";
import { FormCard } from "../src/ui/FormCard.js";

afterEach(cleanup);

const perm = {
  requestID: "per_1",
  tool: "shell",
  title: "Minta izin shell: npm test",
  patterns: ["npm test"],
  risk: "medium" as const,
  voiceAllowed: true,
};

describe("ApprovalCard (FR-040..042)", () => {
  it("tombol + badge + petunjuk suara (dock)", () => {
    render(<ApprovalCard perm={perm} onReply={() => {}} variant="dock" directory="/tmp/x" />);
    expect(screen.getByTestId("risk-badge").textContent).toContain("sedang");
    expect(screen.getByText(/ucapkan.*ya.*tolak/i)).toBeTruthy();
    expect(screen.getByTestId("perm-once")).toBeTruthy();
    expect(screen.getByTestId("perm-always")).toBeTruthy();
  });
  it("low: petunjuk suara ada (dock + popup), badge rendah", () => {
    render(<ApprovalCard perm={{ ...perm, risk: "low", voiceAllowed: true }} onReply={() => {}} variant="dock" directory="/tmp/x" />);
    expect(screen.getByTestId("risk-badge").textContent).toContain("rendah");
    expect(screen.getByText(/ucapkan.*ya.*tolak/i)).toBeTruthy();
    cleanup();
    render(<ApprovalCard perm={{ ...perm, risk: "low", voiceAllowed: true }} onReply={() => {}} variant="popup" directory="/tmp/x" />);
    expect(screen.getByTestId("perm-voice-hint")).toBeTruthy();
    expect(screen.getByTestId("perm-always")).toBeTruthy(); // low boleh selalu-izinkan
  });
  it("high: tanpa always, butuh ketik OK, petunjuk layar", () => {
    const onReply = vi.fn();
    render(<ApprovalCard perm={{ ...perm, risk: "high", voiceAllowed: false }} onReply={onReply} variant="dock" directory="/tmp/x" />);
    expect(screen.queryByTestId("perm-always")).toBeNull();
    expect(screen.getByText(/konfirmasi lewat layar/i)).toBeTruthy();
    const btn = screen.getByTestId("perm-once") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("perm-ok-input"), { target: { value: "ok" } });
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(onReply).toHaveBeenCalledWith("per_1", "once");
  });
  it("popup: petunjuk suara di bawah kartu; Esc meminimalkan (bukan menolak)", () => {
    const onReply = vi.fn();
    const onMinimize = vi.fn();
    const { container } = render(<ApprovalCard perm={perm} onReply={onReply} variant="popup" directory="/tmp/x" onMinimize={onMinimize} />);
    expect(screen.getByTestId("perm-voice-hint")).toBeTruthy();
    // Kait visual popup: panah ke Bibo + border izin + kotak perintah gelap.
    expect(container.querySelector(".perm-pop .pop-arrow")).toBeTruthy();
    expect(container.querySelector(".perm-cmd")?.textContent).toContain("$ npm test");
    expect(container.querySelector(".risk-badge.risk-medium")).toBeTruthy();
    fireEvent.keyDown(screen.getByTestId("approval"), { key: "Escape" });
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onReply).not.toHaveBeenCalled();
  });
  it("popup high: tanpa always, tanpa petunjuk suara di bawah", () => {
    render(
      <ApprovalCard perm={{ ...perm, risk: "high", voiceAllowed: false }} onReply={() => {}} variant="popup" directory="/tmp/x" />,
    );
    expect(screen.queryByTestId("perm-always")).toBeNull();
    expect(screen.queryByTestId("perm-voice-hint")).toBeNull();
    expect(screen.getByText(/konfirmasi lewat layar/i)).toBeTruthy();
  });
  it("selalu-izinkan dua langkah dengan peringatan", () => {
    const onReply = vi.fn();
    render(<ApprovalCard perm={perm} onReply={onReply} variant="dock" directory="/tmp/x" />);
    fireEvent.click(screen.getByTestId("perm-always"));
    expect(screen.getByText(/tidak untuk risiko tinggi/i)).toBeTruthy();
    fireEvent.click(screen.getByTestId("perm-always-confirm"));
    expect(onReply).toHaveBeenCalledWith("per_1", "always");
  });
});

describe("FormCard (FR-043)", () => {
  const form = {
    formID: "frm_1",
    title: "Questions",
    fields: [{ key: "q0", title: "Warna", description: "Pilih warna", type: "string", options: [{ value: "Red", label: "Red" }, { value: "Blue", label: "Blue" }] }],
  };
  it("pilihan tunggal + boolean + batal", () => {
    const onReply = vi.fn();
    const onCancel = vi.fn();
    render(<FormCard form={form} onReply={onReply} onCancel={onCancel} variant="dock" />);
    fireEvent.click(screen.getByTestId("form-opt-q0-Blue"));
    expect(onReply).toHaveBeenCalledWith("frm_1", { q0: "Blue" });
    fireEvent.click(screen.getByTestId("form-cancel"));
    expect(onCancel).toHaveBeenCalledWith("frm_1");
  });
  it("popup: Esc meminimalkan, bukan membatalkan", () => {
    const onCancel = vi.fn();
    const onMinimize = vi.fn();
    render(<FormCard form={form} onReply={() => {}} onCancel={onCancel} variant="popup" onMinimize={onMinimize} />);
    fireEvent.keyDown(screen.getByTestId("formcard"), { key: "Escape" });
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
