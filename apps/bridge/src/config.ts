/** Bridge configuration from environment. See PRD Lampiran C. */
export interface BridgeConfig {
  /** Manual OpenCode URL. Empty = Service.ensure(). */
  opencodeUrl: string | undefined;
  /** Bridge listen port (127.0.0.1 only). */
  port: number;
  /** Active-session poll interval ms. */
  pollMs: number;
  /** Permission/form poll interval ms. */
  approvalPollMs: number;
  /** Log level. */
  logLevel: "debug" | "info" | "warn" | "error";
  /** Directory for store.json + token. */
  dataDir: string;
}

function num(v: string | undefined, dflt: number): number {
  const n = v === undefined || v === "" ? Number.NaN : Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  const level = env["BIBO_LOG_LEVEL"];
  return {
    opencodeUrl: env["OPENCODE_URL"] || undefined,
    port: num(env["BIBO_BRIDGE_PORT"], 4317),
    pollMs: num(env["BIBO_POLL_MS"], 1000),
    approvalPollMs: num(env["BIBO_APPROVAL_POLL_MS"], 1500),
    logLevel: level === "debug" || level === "info" || level === "warn" || level === "error" ? level : "info",
    dataDir: env["BIBO_DATA_DIR"] || ".bibo",
  };
}
