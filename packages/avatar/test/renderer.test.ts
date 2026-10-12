import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BiboSvgRenderer } from "../src/renderer.js";
import { AVATAR_POSES, type AvatarPose } from "@codepet/protocol";

function visibleEye(svg: SVGSVGElement): string | undefined {
  const groups = svg.querySelectorAll("#eyes > g");
  for (const g of groups) {
    const el = g as SVGGElement;
    if (el.style.display !== "none") {
      const cls = [...el.classList].find((c) => c.startsWith("e-"));
      return cls;
    }
  }
  return undefined;
}

function visibleIcon(svg: SVGSVGElement): string | undefined {
  const groups = svg.querySelectorAll("#badge-icon > g");
  for (const g of groups) {
    const el = g as SVGGElement;
    if (el.style.display !== "none") {
      const cls = [...el.classList].find((c) => c.startsWith("bi-"));
      return cls;
    }
  }
  return undefined;
}

describe("BiboSvgRenderer", () => {
  let el: HTMLElement;
  let r: BiboSvgRenderer;
  beforeEach(() => {
    el = document.createElement("div");
    document.body.appendChild(el);
    r = new BiboSvgRenderer();
    r.mount(el, { theme: "dark", reducedMotion: true, sleepMs: 50 });
  });
  afterEach(() => {
    r.destroy();
    el.remove();
    vi.useRealTimers();
  });

  it("semua 14 pose: mata + badge + tone benar", () => {
    const svg = el.querySelector("svg") as unknown as SVGSVGElement;
    const eyeOf: Record<AvatarPose, string> = {
      offline: "e-flat", sleeping: "e-sleep", idle: "e-open", listening: "e-wide",
      thinking: "e-open", "working.reading": "e-focus", "working.editing": "e-focus",
      "working.running": "e-focus", "working.searching": "e-open", "working.delegating": "e-open",
      "working.generic": "e-focus", asking: "e-wide", celebrate: "e-happy", confused: "e-worried",
    };
    const iconOf: Record<AvatarPose, string | undefined> = {
      offline: "bi-offline", sleeping: "bi-zzz", idle: undefined, listening: "bi-mic",
      thinking: "bi-dots", "working.reading": "bi-eye", "working.editing": "bi-code",
      "working.running": "bi-terminal", "working.searching": "bi-globe", "working.delegating": "bi-dots",
      "working.generic": "bi-gear", asking: "bi-question", celebrate: "bi-check", confused: "bi-exclaim",
    };
    for (const pose of AVATAR_POSES) {
      r.setPose(pose);
      expect(visibleEye(svg), `${pose} eye`).toBe(eyeOf[pose]);
      expect(visibleIcon(svg), `${pose} icon`).toBe(iconOf[pose]);
      expect(svg.dataset["loop"]).toBeTruthy();
    }
    const badge = svg.querySelector("#badge") as SVGGElement;
    r.setPose("idle");
    expect(badge.getAttribute("data-hidden")).toBe("1");
    r.setPose("thinking");
    expect(badge.getAttribute("data-hidden")).toBe("0");
  });

  it("setSpeechLevel: denyut + badge wave + pulih", () => {
    const svg = el.querySelector("svg") as unknown as SVGSVGElement;
    r.setPose("idle");
    r.setSpeechLevel(0.5);
    expect(svg.dataset["speaking"]).toBe("1");
    expect(visibleIcon(svg)).toBe("bi-wave");
    const pulse = svg.querySelector("#speech-pulse") as SVGGElement;
    expect(pulse.getAttribute("transform") ?? "").toContain("scale(");
    r.setSpeechLevel(0);
    expect(svg.dataset["speaking"]).toBe("0");
    expect(visibleIcon(svg)).toBe(undefined); // idle: badge kembali tersembunyi
    r.setSpeechLevel(2);
    r.setSpeechLevel(-1);
  });

  it("setLook dibatasi -1..1; tidur setelah sleepMs", () => {
    // Mount ulang di bawah fake timer agar rantai timeout deterministik.
    vi.useFakeTimers();
    r.destroy();
    el.innerHTML = "";
    r.mount(el, { theme: "dark", reducedMotion: true, sleepMs: 50 });
    const svg = el.querySelector("svg") as unknown as SVGSVGElement;
    r.setPose("idle");
    r.setLook(5, -5);
    const face = svg.querySelector("#face") as SVGGElement;
    expect(face.style.transform).toContain("6.0px");
    vi.advanceTimersByTime(60000);
    // Visual tidur (pose logis tetap idle).
    expect(r.currentPose).toBe("idle");
    expect(visibleEye(svg)).toBe("e-sleep");
    r.setPose("idle");
    expect(visibleEye(svg)).toBe("e-open");
  });

  it("tema + destroy", () => {
    const svg = el.querySelector("svg") as unknown as SVGSVGElement;
    r.setTheme("light");
    expect(svg.getAttribute("data-theme")).toBe("light");
    r.destroy();
    expect(el.querySelector("svg")).toBeNull();
  });
});
