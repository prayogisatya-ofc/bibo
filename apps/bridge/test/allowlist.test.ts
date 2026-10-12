import { describe, expect, it } from "vitest";
import { isAllowed, normalizePath } from "../src/opencode/allowlist.js";

describe("normalizePath", () => {
  it("membuang query dan trailing slash", () => {
    expect(normalizePath("/api/session/ses_1/permission?x=1")).toBe("/api/session/ses_1/permission");
    expect(normalizePath("/api/info/")).toBe("/api/info");
  });
});

describe("isAllowed (NFR-SEC-04)", () => {
  const allowed: Array<[string, string]> = [
    ["GET", "/api/info"],
    ["GET", "/api/session/active"],
    ["POST", "/api/session"],
    ["POST", "/api/session/ses_abc/prompt"],
    ["POST", "/api/session/ses_abc/interrupt"],
    ["GET", "/api/session/ses_abc/message"],
    ["GET", "/api/session/ses_abc/diff"],
    ["GET", "/api/session/ses_abc/permission"],
    ["POST", "/api/session/ses_abc/permission/per_1/reply"],
    ["GET", "/api/session/ses_abc/form"],
    ["POST", "/api/session/ses_abc/form/frm_1/reply"],
    ["POST", "/api/session/ses_abc/generate"],
    ["GET", "/api/permission/request"],
    ["GET", "/api/form"],
    ["GET", "/api/event"],
    ["GET", "/api/agent"],
    ["GET", "/api/fs/find"],
    ["GET", "/api/fs/read/some/file.ts"],
  ];
  for (const [m, p] of allowed) {
    it(`allow ${m} ${p}`, () => expect(isAllowed(m, p)).toBe(true));
  }

  const denied: Array<[string, string]> = [
    ["GET", "/api/credential"],
    ["POST", "/api/credential"],
    ["GET", "/api/credential/cred_1"],
    ["GET", "/api/integration"],
    ["POST", "/api/integration/x/connect/key"],
    ["GET", "/api/pty"],
    ["POST", "/api/pty/pty_1/connect-token"],
    ["GET", "/api/persistent-pty/pty_1"],
    ["POST", "/api/experimental/persistent-pty/shutdown"],
    ["POST", "/api/experimental/fs/write"],
    ["PATCH", "/api/experimental/config"],
    ["POST", "/api/experimental/mcp/srv/connect"],
    ["GET", "/api/mcp/resource"],
    ["POST", "/api/pair"],
    ["GET", "/auth/connect/abc"],
    ["GET", "/api/session/ses_1/terminal"],
    ["GET", "/api/session/ses_1/terminal/read"],
    ["GET", "/api/experimental/session/ses_1/terminal"],
    ["GET", "/api/admin"],
  ];
  for (const [m, p] of denied) {
    it(`deny ${m} ${p}`, () => expect(isAllowed(m, p)).toBe(false));
  }
});
