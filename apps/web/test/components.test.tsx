import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { Button, IconButton, Card, Input, Chip } from "../src/ui/components/index.js";

afterEach(cleanup);

describe("komponen reusable", () => {
  it("Button: render varian & size", () => {
    render(<Button variant="primary" size="lg">Klik</Button>);
    const b = screen.getByRole("button", { name: "Klik" });
    expect(b.className).toContain("bg-[var(--accent)]");
    expect(b.className).toContain("px-6");
  });

  it("Button: ghost + sm", () => {
    render(<Button variant="ghost" size="sm">X</Button>);
    expect(screen.getByRole("button").className).toContain("bg-transparent");
  });

  it("IconButton: aria-label", () => {
    render(<IconButton label="Kirim">+</IconButton>);
    expect(screen.getByRole("button", { name: "Kirim" })).toBeTruthy();
  });

  it("Card: padded default", () => {
    const { container } = render(<Card>isi</Card>);
    expect(container.firstChild?.textContent).toBe("isi");
  });

  it("Input: meneruskan props", () => {
    render(<Input placeholder="ketik" data-testid="inp" />);
    expect(screen.getByTestId("inp").getAttribute("placeholder")).toBe("ketik");
  });

  it("Chip: tone accent", () => {
    render(<Chip tone="accent">baru</Chip>);
    expect(screen.getByText("baru").className).toContain("bg-[var(--accent)]");
  });
});
