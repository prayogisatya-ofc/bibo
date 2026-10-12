/** Kontrak timing.ts — satu-satunya sumber angka waktu (§12, §5.4). */
import { describe, expect, it } from "vitest";
import { T } from "../src/timing.js";

describe("timing contract", () => {
  it("durasi transient: celebrate 3 s, confused 4 s", () => {
    expect(T.celebrate.durationMs).toBe(3000);
    expect(T.confused.durationMs).toBe(4000);
  });

  it("pool konfeti tepat 24", () => {
    expect(T.celebrate.confetti.pool).toBe(24);
  });

  it("stagger: dots 0,35 s, zzz 0,5 s, busur suara 0,2 s", () => {
    expect(T.thinking.dots.staggerMs).toBe(350);
    expect(T.sleeping.zzz.staggerMs).toBe(500);
    expect(T.speaking.arcs.staggerMs).toBe(200);
  });

  it("lampu speaking 2 Hz (periode 500 ms)", () => {
    expect(T.speaking.lampHz).toBe(2);
  });

  it("kurva easing terdefinisi", () => {
    for (const k of ["soft", "out", "pop", "fall", "linear"] as const) {
      expect(T.ease[k]).toMatch(/cubic-bezier|linear/);
    }
  });

  it("transisi pose 280 ms, crossfade mata/mulut 120 ms", () => {
    expect(T.transition.poseMs).toBe(280);
    expect(T.transition.eyeMouthMs).toBe(120);
    expect(T.transition.handLayerMs).toBe(80);
  });

  it("semua angka hingga dan bukan NaN; durasi > 0", () => {
    const nums: [string, number][] = [];
    const walk = (o: unknown, path: string): void => {
      if (typeof o === "number") nums.push([path, o]);
      else if (o && typeof o === "object")
        for (const [k, v] of Object.entries(o)) walk(v, path ? `${path}.${k}` : k);
    };
    walk(T, "");
    expect(nums.length).toBeGreaterThan(50);
    for (const [path, n] of nums) {
      expect(Number.isFinite(n), path).toBe(true);
      // Offset/koordinat boleh negatif; durasi & peluang tidak.
      if (/(Ms|Hz|Chance|chance)$/.test(path)) expect(n, path).toBeGreaterThanOrEqual(0);
    }
    expect(T.celebrate.durationMs).toBeGreaterThan(0);
    expect(T.thinking.dots.cycleMs).toBeGreaterThan(0);
  });

  it("offset antar-tangan mengetik ≥ 80 ms (kriteria §6.3)", () => {
    expect(T.working.typing.burstPeriodMs / 2).toBeGreaterThanOrEqual(80);
    expect(T.working.typing.phaseDelayMs).toBeGreaterThanOrEqual(80);
  });

  it("perilaku IdleDirector lengkap dengan cooldown", () => {
    const names = Object.keys(T.director.behaviors);
    expect(names).toContain("lookAround");
    expect(names).toContain("waveR");
    expect(names).toContain("yawn");
    for (const n of names) {
      const b = T.director.behaviors[n];
      expect(b?.weight).toBeGreaterThan(0);
      expect(b?.cooldownMs).toBeGreaterThan(0);
    }
  });
});
