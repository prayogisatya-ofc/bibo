import { useT } from "../i18n/index.js";
import { FolderIcon, GearIcon, SpeakerIcon, SpeakerOffIcon } from "./icons.js";
import type { ConnStatus } from "../ws/client.js";
import type { UiMode } from "./useUiMode.js";
import { ModelPicker, type ModelCurrent, type ModelOption } from "./ModelPicker.js";
import { IconButton } from "./components/index.js";

export interface TopBarModelState {
  models: ModelOption[];
  current: ModelCurrent | null;
  loading: boolean;
  error: string | null;
  onSelect: (id: string, providerID: string) => void;
  onRetry: () => void;
}

/**
 * Bilah atas 68px (fase C): logotype, chip folder proyek (klik = ganti
 * direktori), chip status koneksi, pemilih mode Chat|Ngobrol, bisukan,
 * pengaturan. Menggantikan StatusBar lama (+ menghapus mini-btn).
 */
export function TopBar({
  conn,
  ocStatus,
  ocVersion,
  directory,
  mode,
  setMode,
  muted,
  onToggleMute,
  onDir,
  onOpenSettings,
  showDirChip,
  model,
}: {
  conn: ConnStatus;
  ocStatus: "up" | "down";
  ocVersion: string | undefined;
  directory: string;
  mode: UiMode;
  setMode: (m: UiMode) => void;
  muted: boolean;
  onToggleMute: () => void;
  onDir: () => void;
  onOpenSettings: () => void;
  /** Referensi menyembunyikan chip folder di mode Ngobrol. */
  showDirChip: boolean;
  /** FITUR C: pemilih model (di samping chip koneksi). */
  model: TopBarModelState;
}): JSX.Element {
  const t = useT();
  const connected = ocStatus === "up" && conn === "open";
  const warn = conn === "reconnecting" || conn === "connecting";
  const label =
    ocStatus === "down" || conn === "down"
      ? t.statusDown
      : warn
        ? t.statusReconnecting
        : `${t.statusOnline}${ocVersion ? ` · OpenCode ${ocVersion}` : ""}`;
  return (
    <header className="topbar">
      <div className="logotype">Bibo</div>
      {showDirChip && (
        <button
          type="button"
          className="dir-chip"
          onClick={onDir}
          title={directory ? `${t.dirChangeTitle}: ${directory}` : t.dirChangeTitle}
          data-testid="dir-btn"
        >
          <FolderIcon size={16} />
          <span className="dir-text">{directory || "—"}</span>
        </button>
      )}
      <span
        className={`conn-chip${connected ? "" : warn ? " is-warn" : " is-bad"}`}
        role="status"
        aria-live="polite"
        data-testid="conn-label"
      >
        <span className="conn-dot" aria-hidden="true" />
        <span className="conn-text">{label}</span>
      </span>
      <ModelPicker {...model} />
      <span className="spacer" aria-hidden="true" />
      <div className="mode-switch" role="group" aria-label="Mode">
        <button
          type="button"
          aria-pressed={mode === "chat"}
          onClick={() => setMode("chat")}
          data-testid="mode-chat"
        >
          {t.modeChat}
        </button>
        <button
          type="button"
          aria-pressed={mode === "talk"}
          onClick={() => setMode("talk")}
          data-testid="mode-talk"
        >
          {t.modeTalk}
        </button>
      </div>
      <IconButton
        label={muted ? t.unmuteTitle : t.muteTitle}
        onClick={onToggleMute}
        data-testid="mute-btn"
        size="sm"
        className={muted ? "is-on" : ""}
      >
        {muted ? <SpeakerOffIcon /> : <SpeakerIcon />}
      </IconButton>
      <IconButton label={t.settingsTitle} onClick={onOpenSettings} data-testid="settings-btn" size="sm">
        <GearIcon />
      </IconButton>
    </header>
  );
}
