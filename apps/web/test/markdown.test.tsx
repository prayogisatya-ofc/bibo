import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Markdown } from "../src/ui/markdown.js";

describe("Markdown ringan (FR-020)", () => {
  it("blok kode + tombol salin", () => {
    render(<Markdown text={"Contoh:\n```ts\nconst a = 1;\n```\nlanjut"} />);
    expect(screen.getByText("lanjut")).toBeTruthy();
    expect(screen.getByText("Salin")).toBeTruthy();
    expect(screen.getByText("const a = 1;")).toBeTruthy();
  });
  it("inline code, bold, link", () => {
    render(<Markdown text={"pakai `App.tsx` dan **LoginForm**, lihat [docs](https://x.id)"} />);
    expect(screen.getByText("App.tsx").tagName).toBe("CODE");
    expect(screen.getByText("LoginForm").tagName).toBe("STRONG");
    expect(screen.getByText("docs").tagName).toBe("A");
  });
});
