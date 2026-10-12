import { describe, expect, it } from "vitest";
import { getStrings } from "../src/i18n/index.js";
import { id } from "../src/i18n/locales/id.js";
import { en } from "../src/i18n/locales/en.js";

describe("i18n (NFR-I18N-01)", () => {
  it("id dan en punya kunci sama", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(id).sort());
  });
  it("ganti locale tanpa ubah kode", () => {
    expect(getStrings("id").send).toBe("Kirim");
    expect(getStrings("en").send).toBe("Send");
  });
});
