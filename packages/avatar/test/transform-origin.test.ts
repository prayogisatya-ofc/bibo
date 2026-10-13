/**
 * Regresi: menganimasikan properti individual (scale/rotate) pada elemen SVG
 * yang punya atribut transform membuat Chrome salah menempatkan
 * transform-origin (meski sudah transform-box: fill-box) — mata "terbang ke
 * atas" saat karakter tidur dipoke, gear "matahari" mengorbit, dsb.
 *
 * Perbaikan: bake translate dasar (via baseTranslate) ke keyframes properti
 * `transform` agar animasi terjadi di tempat.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BotRenderer } from "../src/renderer.js";
import { baseTranslate } from "../src/animator.js";
import type {
  AvatarMountOptions,
  AvatarPose,
  AvatarPoseOptions,
  WorkingVariant,
} from "../src/types.js";
import {
  installDomFakes,
  recordsFor,
  recordsWithId,
  reinstallRaf,
  resetAnimRecords,
} from "./dom-fake.js";

installDomFakes();

let host: HTMLElement;
let r: BotRenderer;

function svg(): SVGSVGElement {
  return host.querySelector("svg") as unknown as SVGSVGElement;
}

function q(id: string): Element {
  const e = svg().querySelector(`#${id}`);
  if (!e) throw new Error(`#${id} tidak ada`);
  return e;
}

function mount(): BotRenderer {
  host = document.createElement("div");
  document.body.appendChild(host);
  r = new BotRenderer();
  const opts: AvatarMountOptions = {
    theme: "dark",
    reducedMotion: false,
    seed: 1234,
    characterName: "TestBot",
  };
  r.mount(host, opts);
  return r;
}

function setPose(pose: AvatarPose, variant?: WorkingVariant): void {
  const opts: AvatarPoseOptions = variant ? { variant } : {};
  r.setPose(pose, opts);
}

function eyeVariantShown(v: string): boolean {
  return (svg().querySelector(`#eye-l .${v}`) as HTMLElement).style.opacity === "1";
}

beforeEach(() => {
  vi.useFakeTimers();
  reinstallRaf();
  resetAnimRecords();
});

afterEach(() => {
  r?.destroy();
  host?.remove();
  vi.useRealTimers();
});

describe("baseTranslate", () => {
  it("mem-parse translate(x,y) atribut menjadi string CSS", () => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
    el.setAttribute("transform", "translate(84,108)");
    expect(baseTranslate(el)).toBe("translate(84px,108px)");
  });

  it("string kosong bila tidak ada atribut transform", () => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
    expect(baseTranslate(el)).toBe("");
  });
});

describe("mata tidak terbang (transform di-bake)", () => {
  it("blink: keyframes transform memuat translate dasar mata", () => {
    mount();
    resetAnimRecords();
    vi.advanceTimersByTime(12000);
    const rec = recordsFor(q("eye-l"), "blink")[0];
    expect(rec).toBeDefined();
    const kf = JSON.stringify(rec?.keyframes);
    expect(kf).toContain("translate(84px,108px)");
    expect(kf).not.toContain('"scale"');
  });

  it("startle-eyes: pop di tempat", () => {
    mount();
    resetAnimRecords();
    r.react("startle");
    const rec = recordsFor(q("eye-r"), "startle-eyes")[0];
    expect(rec).toBeDefined();
    const kf = JSON.stringify(rec?.keyframes);
    expect(kf).toContain("translate(116px,108px)");
    expect(kf).not.toContain('"scale"');
  });

  it("dizzy: putaran di tempat", () => {
    mount();
    for (let i = 0; i < 5; i++) r.react("poke");
    const rec = recordsFor(q("eye-l"), "dizzy")[0];
    expect(rec).toBeDefined();
    const kf = JSON.stringify(rec?.keyframes);
    expect(kf).toContain("translate(84px,108px) rotate(360deg)");
  });

  it("poke saat tidur: e-wide → e-focus → e-sleep (tanpa animasi 'wake')", () => {
    mount();
    setPose("sleeping");
    expect(eyeVariantShown("e-sleep")).toBe(true);
    resetAnimRecords();
    r.react("poke");
    // Startle: mata terbuka lebar.
    expect(eyeVariantShown("e-wide")).toBe(true);
    expect(recordsWithId("wake").length).toBe(0);
    // Kesal 1 detik: mata menyipit.
    vi.advanceTimersByTime(350);
    expect(eyeVariantShown("e-focus")).toBe(true);
    // Kembali tidur.
    vi.advanceTimersByTime(1000);
    expect(eyeVariantShown("e-sleep")).toBe(true);
  });
});

describe("gear & props di tempat", () => {
  it("gear-spin: rotate di-bake dengan translate dasar", () => {
    mount();
    setPose("working", "generic");
    vi.advanceTimersByTime(400);
    const rec = recordsFor(q("prop-gear"), "gear-spin")[0];
    expect(rec).toBeDefined();
    const kf = JSON.stringify(rec?.keyframes);
    expect(kf).toContain("translate(100px,20px) rotate(360deg)");
    expect(kf).not.toContain('"rotate"');
  });

  it("q-bubble appear: scale di-bake", () => {
    mount();
    setPose("asking");
    const rec = recordsFor(q("q-bubble"), "appear")[0];
    expect(rec).toBeDefined();
    const kf = JSON.stringify(rec?.keyframes);
    expect(kf).toContain("translate(160px,44px)");
    expect(kf).not.toContain('"scale"');
  });

  it("mulut tidur: transform di-bake (bukan properti scale)", () => {
    mount();
    setPose("sleeping");
    const t = (q("mouth") as HTMLElement).style.getPropertyValue("transform");
    expect(t).toContain("translate(100px,120px)");
    expect((q("mouth") as HTMLElement).style.getPropertyValue("scale")).toBe("");
  });
});

describe("tangan tidak mengorbit (rotate di-bake)", () => {
  it("cheer: rotate di-bake dengan translate atribut tangan", () => {
    mount();
    setPose("celebrate");
    vi.advanceTimersByTime(500);
    const rec = recordsFor(q("hand-l"), "cheer")[0];
    expect(rec).toBeDefined();
    const kf = JSON.stringify(rec?.keyframes);
    expect(kf).toContain("translate(42px,152px)");
    expect(kf).toContain("rotate(");
    expect(kf).not.toContain('"rotate"');
  });

  it("chin rub: rotate di-bake dengan translate atribut tangan", () => {
    mount();
    setPose("thinking");
    vi.advanceTimersByTime(3000);
    const rec = recordsFor(q("hand-r"), "rub")[0];
    expect(rec).toBeDefined();
    const kf = JSON.stringify(rec?.keyframes);
    expect(kf).toContain("translate(158px,148px)");
    expect(kf).toContain("rotate(");
    expect(kf).not.toContain('"rotate"');
  });
});
