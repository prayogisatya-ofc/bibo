import type { ReactNode } from "react";
import type { AvatarMood, AvatarPose, WorkingVariant } from "@codepet/avatar";
import { fill, useT } from "../i18n/index.js";
import { character } from "../character.js";
import { AvatarStage } from "./AvatarStage.js";
import { MicButton } from "./MicButton.js";
import { MicIcon, StopIcon } from "./icons.js";
import { ChatPanel } from "./ChatPanel.js";
import { ChangesCard } from "./ChangesCard.js";
import { activityChip, stageSub, stageTitle } from "./stageText.js";
import type { DiffFile } from "../state/store.js";

const AVATAR_PX: Record<"s" | "m" | "l", number> = { s: 170, m: 250, l: 310 };

/**
 * Mode Chat (§C.3): kartu kiri 360px (panggung Bibo, chip aktivitas, judul
 * status, mic besar 72px, tombol hentikan) + kartu kanan fleksibel (header
 * sesi, percakapan, komposer). Kartu izin/form menempel di atas komposer.
 */
export function ChatMode({
  pose,
  variant,
  mood,
  level,
  theme,
  locale,
  avatarSize,
  listening,
  interim,
  sttSupported,
  micDown,
  micUp,
  onStopBibo,
  sessionTitle,
  agentLabel,
  chatDisabled,
  busy,
  onSend,
  onStop,
  externalDraft,
  docked,
  changes,
  onCloseChanges,
  errors,
  toast,
  chatCount,
}: {
  pose: AvatarPose;
  variant: WorkingVariant | undefined;
  mood: AvatarMood;
  level: number;
  theme: "light" | "dark";
  locale: "id" | "en";
  avatarSize: "s" | "m" | "l";
  listening: boolean;
  interim: string;
  sttSupported: boolean;
  micDown: () => void;
  micUp: () => void;
  onStopBibo: () => void;
  sessionTitle: string;
  agentLabel: string;
  chatDisabled: boolean;
  busy: boolean;
  onSend: (text: string, delivery: "queue" | "steer") => void;
  onStop: () => void;
  externalDraft: { text: string; key: string } | undefined;
  docked: ReactNode;
  changes: DiffFile[];
  onCloseChanges: () => void;
  errors: string[];
  toast: { msg: string; key: number } | undefined;
  chatCount: number;
}): JSX.Element {
  const t = useT();
  const chip = activityChip(pose, variant, t);
  const size = AVATAR_PX[avatarSize];

  return (
    <main className="chat-screen">
      <div className="stage-card">
        <div className="stage-box">
          <AvatarStage pose={pose} variant={variant} mood={mood} level={level} theme={theme} locale={locale} size={size} />
          {chip && (
            <div className="activity-chip" data-testid="activity-chip">
              <span className="pulse-dot" aria-hidden="true" />
              {chip}
            </div>
          )}
        </div>
        <div className="stage-status">
          <div className="stage-title" data-testid="avatar-caption">
            {stageTitle(pose, t)}
          </div>
          <div className="stage-sub">{stageSub(pose, t)}</div>
        </div>
        <div className="stage-spacer" aria-hidden="true" />
        {listening && (
          <p className="interim-caption" aria-live="polite" data-testid="mic-caption">
            <MicIcon size={14} />
            <span>{interim || t.chipListening}</span>
          </p>
        )}
        {!sttSupported && (
          <p className="warn" data-testid="mic-unavailable">
            Mic tidak tersedia — chat teks tetap jalan.
          </p>
        )}
        <MicButton size="big" listening={listening} disabled={!sttSupported} onDown={micDown} onUp={micUp} />
        <div className="mic-hint">
          <b>{t.holdToTalk}</b>
          <br />
          {t.orHoldSpace}
        </div>
        <button type="button" className="stop-bibo" onClick={onStopBibo} data-testid="stop-bibo">
          <StopIcon size={16} />
          <span className="stop-label">{fill(t.stopBibo, { name: character.name })}</span>
        </button>
      </div>

      <ChatPanel
        sessionTitle={sessionTitle}
        agentLabel={agentLabel}
        disabled={chatDisabled}
        busy={busy}
        onSend={onSend}
        onStop={onStop}
        externalDraft={externalDraft}
        mic={{ listening, disabled: !sttSupported, onDown: micDown, onUp: micUp }}
        docked={docked}
        afterLog={
          <>
            <ChangesCard files={changes} onClose={onCloseChanges} />
            {errors.length > 0 && (
              <ul className="errors" aria-live="assertive">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </>
        }
      />
      {toast && (
        <p className="toast" role="status" data-testid="voice-toast">
          {toast.msg}
        </p>
      )}
      <span className="chat-count" data-testid="chat-count">
        {chatCount}
      </span>
    </main>
  );
}
