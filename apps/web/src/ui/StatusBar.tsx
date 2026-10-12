import { useT } from "../i18n/index.js";
import type { ConnStatus } from "../ws/client.js";

export function StatusBar({
  conn,
  ocStatus,
  ocVersion,
  directory,
  agent,
  model,
  onDir,
  onOpenSettings,
  onToggleMini,
  mini,
}: {
  conn: ConnStatus;
  ocStatus: "up" | "down";
  ocVersion: string | undefined;
  directory: string;
  agent: string;
  model: string;
  onDir: () => void;
  onOpenSettings: () => void;
  onToggleMini: () => void;
  mini: boolean;
}): JSX.Element {
  const t = useT();
  const dot = ocStatus === "up" && conn === "open" ? "ok" : conn === "reconnecting" || conn === "connecting" ? "warn" : "bad";
  const label =
    ocStatus === "down" || conn === "down"
      ? t.statusDown
      : dot === "warn"
        ? t.statusReconnecting
        : `${t.statusOnline}${ocVersion ? ` · OpenCode ${ocVersion}` : ""}`;
  return (
    <header className="statusbar" role="status" aria-live="polite">
      <span className={`dot dot-${dot}`} aria-hidden="true" />
      <span data-testid="conn-label">{label}</span>
      <button type="button" className="dir" onClick={onDir} title={directory || t.onboardTitle} data-testid="dir-btn">
        {directory || "—"}
      </button>
      <span className="meta">
        {agent} · {model}
      </span>
      <button type="button" onClick={onToggleMini} aria-label="mini" data-testid="mini-btn">
        {mini ? "⤢" : "⤡"}
      </button>
      <button type="button" onClick={onOpenSettings} aria-label={t.settingsTitle} data-testid="settings-btn">
        ⚙
      </button>
    </header>
  );
}
