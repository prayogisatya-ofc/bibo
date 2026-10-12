/** Rumus mulut parametris — CHARACTER.md §6.7 (tabel rumus). */
import { describe, expect, it } from "vitest";
import { mouthParams, smoothLevel } from "../src/mouth.js";

describe("mouthParams (§6.7)", () => {
  it("a=0: tertutup → m-smile, bukan elips", () => {
    const m = mouthParams(0);
    expect(m.closed).toBe(true);
    expect(m.rx).toBeCloseTo(3, 5);
    expect(m.ry).toBeCloseTo(1.5, 5);
    expect(m.cy).toBeCloseTo(120 + 1.5 * 0.6, 5);
    expect(m.tongue).toBeNull();
  });

  it("ambang tertutup a<0.08", () => {
    expect(mouthParams(0.079).closed).toBe(true);
    expect(mouthParams(0.08).closed).toBe(false);
  });

  it("a=1: terbuka penuh", () => {
    const m = mouthParams(1);
    expect(m.rx).toBeCloseTo(6.5, 5); // 3 + 3.5·1
    expect(m.ry).toBeCloseTo(8, 5); // 1.5 + 6.5·1
    expect(m.cy).toBeCloseTo(120 + 8 * 0.6, 5);
    expect(m.tongue).not.toBeNull();
    expect(m.tongue?.rx).toBeCloseTo(6.5 * 0.6, 5);
    expect(m.tongue?.ry).toBeCloseTo(8 * 0.4, 5);
    expect(m.tongue?.cy).toBeCloseTo(120 + 8 * 1.3, 5);
  });

  it("a=0.5: lidah tampil (a>0.4)", () => {
    const m = mouthParams(0.5);
    expect(m.rx).toBeCloseTo(3 + 3.5 * 0.5, 5);
    expect(m.ry).toBeCloseTo(1.5 + 6.5 * 0.5, 5);
    expect(m.cy).toBeCloseTo(120 + m.ry * 0.6, 5);
    expect(m.tongue).not.toBeNull();
  });

  it("a=0.4: lidah disembunyikan (a<=0.4)", () => {
    expect(mouthParams(0.4).tongue).toBeNull();
    expect(mouthParams(0.41).tongue).not.toBeNull();
  });

  it("monoton membesar terhadap a", () => {
    let prev = mouthParams(0);
    for (const a of [0.1, 0.3, 0.6, 0.9, 1]) {
      const m = mouthParams(a);
      expect(m.rx).toBeGreaterThan(prev.rx);
      expect(m.ry).toBeGreaterThan(prev.ry);
      prev = m;
    }
  });
});

describe("smoothLevel", () => {
  it("lerp 0.35 per frame", () => {
    expect(smoothLevel(0, 1)).toBeCloseTo(0.35, 10);
    expect(smoothLevel(0.35, 1)).toBeCloseTo(0.35 + 0.65 * 0.35, 10);
  });

  it("konvergen ke level", () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = smoothLevel(a, 0.8);
    expect(a).toBeCloseTo(0.8, 3);
  });
});
