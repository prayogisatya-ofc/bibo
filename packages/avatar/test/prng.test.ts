/** PRNG ber-seed — deterministik untuk IdleDirector & jitter (§5.3.4). */
import { describe, expect, it } from "vitest";
import { jittered, mulberry32, weightedPick } from "../src/prng.js";

describe("mulberry32", () => {
  it("seed sama → urutan sama", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  it("seed beda → urutan beda", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it("keluaran di [0,1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("jittered", () => {
  it("hasil dalam ±jitter dari base", () => {
    const r = mulberry32(3);
    for (let i = 0; i < 100; i++) {
      const v = jittered(r, 1000, 0.15);
      expect(v).toBeGreaterThanOrEqual(850);
      expect(v).toBeLessThanOrEqual(1150);
    }
  });
});

describe("weightedPick", () => {
  it("bobot nol tidak pernah terpilih", () => {
    const r = mulberry32(9);
    for (let i = 0; i < 50; i++) {
      expect(weightedPick(r, [0, 0, 1])).toBe(2);
    }
  });

  it("distribusi mengikuti bobot (kasar)", () => {
    const r = mulberry32(11);
    const n = [0, 0];
    for (let i = 0; i < 1000; i++) {
      const idx = weightedPick(r, [3, 1]);
      n[idx] = (n[idx] ?? 0) + 1;
    }
    expect(n[0] ?? 0).toBeGreaterThan((n[1] ?? 0) * 2);
  });
});
