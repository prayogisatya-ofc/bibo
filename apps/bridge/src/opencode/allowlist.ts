/**
 * Allowlist endpoint OpenCode (NFR-SEC-04).
 * Bridge HANYA boleh memanggil path di bawah ini. Grup terlarang
 * (credential, integration, pty, persistentPty, fs write, config update,
 * mcp mutasi, pairing) tidak pernah dipanggil maupun di-proxy.
 */

/** Normalisasi path: buang query string dan trailing slash (kecuali root). */
export function normalizePath(raw: string): string {
  const path = raw.split("?", 1)[0] ?? "/";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

function matchAny(path: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Selalu ditolak (exact atau di bawahnya). */
const DENIED = [
  "/api/credential",
  "/api/integration",
  "/api/pty",
  "/api/persistent-pty",
  "/api/experimental/persistent-pty",
  "/api/experimental/fs/write",
  "/api/experimental/config",
  "/api/experimental/mcp",
  "/api/mcp",
  "/api/pair",
  "/auth/connect",
] as const;

/** Sub-path sensitif di bawah /api/session/. */
const DENIED_SESSION_SUBS = ["/terminal", "/pty"] as const;

/** Selalu diizinkan (exact). */
const ALLOWED_EXACT = [
  "/api/info",
  "/api/agent",
  "/api/model",
  "/api/session",
  "/api/session/active",
  "/api/permission/request",
  "/api/permission/saved",
  "/api/form",
  "/api/event",
  "/api/fs/find",
  "/api/fs/list",
] as const;

/** Diizinkan beserta sub-pathnya. */
const ALLOWED_PREFIX = ["/api/session", "/api/agent", "/api/model"] as const;

/** Pola berparameter yang diizinkan (segmen ":x" cocok apa pun kecuali "/"). */
const ALLOWED_PATTERNS = [
  "/api/experimental/session/:id/instructions/entries",
  "/api/experimental/session/:id/instructions/entries/:key",
] as const;

function matchPattern(path: string, pattern: string): boolean {
  const a = path.split("/");
  const b = pattern.split("/");
  if (a.length !== b.length) return false;
  return b.every((seg, i) => seg.startsWith(":") || seg === a[i]);
}

/** true bila bridge boleh memanggil method+path tersebut. */
export function isAllowed(method: string, rawPath: string): boolean {
  void method; // izin berbasis path; method write sudah tercakup di DENIED.
  const path = normalizePath(rawPath);
  if (matchAny(path, DENIED)) return false;
  if ((ALLOWED_EXACT as readonly string[]).includes(path)) return true;
  if (ALLOWED_PATTERNS.some((p) => matchPattern(path, p))) return true;
  if (matchAny(path, ALLOWED_PREFIX)) {
    const rest = path.replace(/^\/api\/session\/[^/]+/, "");
    if (DENIED_SESSION_SUBS.some((s) => rest === s || rest.startsWith(`${s}/`))) return false;
    return true;
  }
  // /api/fs/read/* diizinkan (read-only); bentuk lain ditolak.
  if (path === "/api/fs/read" || path.startsWith("/api/fs/read/")) return true;
  return false;
}

/**
 * Tabel operasi @opencode/client yang dipakai bridge → rute HTTP.
 * Semua panggilan bridge ke OpenCode WAJIB terdaftar di sini dan lolos
 * isAllowed (ditegakkan oleh test/op-usage.test.ts yang memindai src).
 */
export const OP_ROUTES: Record<string, { method: string; path: string }> = {
  "server.info": { method: "GET", path: "/api/info" },
  "session.list": { method: "GET", path: "/api/session" },
  "session.create": { method: "POST", path: "/api/session" },
  "session.get": { method: "GET", path: "/api/session/{id}" },
  "session.active": { method: "GET", path: "/api/session/active" },
  "session.prompt": { method: "POST", path: "/api/session/{id}/prompt" },
  "session.interrupt": { method: "POST", path: "/api/session/{id}/interrupt" },
  "session.form.list": { method: "GET", path: "/api/session/{id}/form" },
  "session.form.reply": { method: "POST", path: "/api/session/{id}/form/{formID}/reply" },
  "session.form.cancel": { method: "DELETE", path: "/api/session/{id}/form/{formID}" },
  "message.list": { method: "GET", path: "/api/session/{id}/message" },
  "session.diff": { method: "GET", path: "/api/session/{id}/diff" },
  "session.instructions.entry.put": { method: "PUT", path: "/api/experimental/session/{id}/instructions/entries/{key}" },
  "permission.list": { method: "GET", path: "/api/session/{id}/permission" },
  "permission.reply": { method: "POST", path: "/api/session/{id}/permission/{requestID}/reply" },
  "event.subscribe": { method: "GET", path: "/api/event" },
};

/** Rute HTTP untuk sebuah operasi; melempar bila operasi tak terdaftar. */
export function routeFor(op: string): { method: string; path: string } {
  const r = OP_ROUTES[op];
  if (!r) throw new Error(`operasi OpenCode tak terdaftar di allowlist: ${op}`);
  return r;
}
