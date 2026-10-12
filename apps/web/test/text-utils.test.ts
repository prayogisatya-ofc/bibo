import { describe, expect, it } from "vitest";
import { stripSpeak, truncate2k } from "../src/ui/text-utils.js";
import { humanError } from "../src/ui/errors.js";

describe("text-utils", () => {
  it("stripSpeak membuang blok speak", () => {
    expect(stripSpeak("Halo <speak>hai, ini ringkasan</speak> dunia")).toBe("Halo dunia");
    expect(stripSpeak("ok <speak>x</speak>")).toBe("ok");
    expect(stripSpeak("tanpa tag")).toBe("tanpa tag");
  });
  it("truncate2k memotong 2 KB", () => {
    expect(truncate2k("a".repeat(3000)).length).toBeLessThanOrEqual(2048);
    expect(truncate2k("pendek")).toBe("pendek");
  });
});

describe("humanError (FR-044)", () => {
  it("tanpa stack trace, Bahasa Indonesia", () => {
    expect(humanError("OPENCODE_DOWN", "")).toContain("kehilangan kontak");
    expect(humanError("NO_SESSION", "")).toContain("folder proyek");
    expect(humanError("X_UNKNOWN", "boom")).toContain("boom");
    expect(humanError("X_UNKNOWN", "boom")).not.toContain("at ");
  });
});
