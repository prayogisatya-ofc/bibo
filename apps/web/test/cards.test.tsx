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
  it("tombol + badge + petunjuk suara", () => {
    render(<ApprovalCard perm={perm} onReply={() => {}} />);
    expect(screen.getByTestId("risk-badge").textContent).toContain("sedang");
    expect(screen.getByText(/ucapkan.*ya.*tolak/i)).toBeTruthy();
    expect(screen.getByTestId("perm-once")).toBeTruthy();
    expect(screen.getByTestId("perm-always")).toBeTruthy();
  });
  it("high: tanpa always, butuh ketik OK", () => {
    const onReply = vi.fn();
    render(<ApprovalCard perm={{ ...perm, risk: "high", voiceAllowed: false }} onReply={onReply} />);
    expect(screen.queryByTestId("perm-always")).toBeNull();
    const btn = screen.getByTestId("perm-once") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("perm-ok-input"), { target: { value: "ok" } });
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(onReply).toHaveBeenCalledWith("per_1", "once");
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
    render(<FormCard form={form} onReply={onReply} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId("form-opt-q0-Blue"));
    expect(onReply).toHaveBeenCalledWith("frm_1", { q0: "Blue" });
    fireEvent.click(screen.getByTestId("form-cancel"));
    expect(onCancel).toHaveBeenCalledWith("frm_1");
  });
});
