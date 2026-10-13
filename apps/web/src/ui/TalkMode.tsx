import type { ReactNode } from "react";
import type { AvatarMood, AvatarPose, WorkingVariant } from "@codepet/avatar";
import { fill, useT } from "../i18n/index.js";
import { character } from "../character.js";
import { AvatarStage } from "./AvatarStage.js";
import { MicButton } from "./MicButton.js";
import { MicIcon } from "./icons.js";
import { SpeechBubble } from "./SpeechBubble.js";
import type { Bubble } from "./bubbleState.js";

/** Tiga batang ekualiser — tingginya mengikuti speechLevel (hanya saat TTS aktif). */
function Equalizer({ level }: { level: number }): JSX.Element {
  const bars = [0, 1, 2].map((i) => {
    const phase = (level + i * 0.37) % 1;
    return 4 + Math.round(phase * 12);
  });
  return (
    <span className="eq" aria-hidden="true">
      {bars.map((h, i) => (
        <i key={i} style={{ height: h }} />
      ))}
    </span>
  );
}

/**
 * Mode Ngobrol (§C.4): HANYA topbar minimal (di App), Bibo besar di tengah,
 * bubble ucapan, indikator berbicara, popup izin/form di bawah Bibo, dan
 * kontrol mic. Tidak ada daftar chat atau feed tool.
 */
export function TalkMode({
  pose,
  variant,
  mood,
  level,
  theme,
  locale,
  bubble,
  ttsActive,
  listening,
  interim,
  sttSupported,
  micDown,
  micUp,
  permPopup,
  formPopup,
  popupOpen,
  awaitingPerm,
  onReopenPerm,
  animateFrom,
}: {
  pose: AvatarPose;
  variant: WorkingVariant | undefined;
  mood: AvatarMood;
  level: number;
  theme: "light" | "dark";
  locale: "id" | "en";
  bubble: Bubble | null;
  /** True hanya saat TTS aktif (level > 0). */
  ttsActive: boolean;
  listening: boolean;
  interim: string;
  sttSupported: boolean;
  micDown: () => void;
  micUp: () => void;
  /** Popup izin (atau null bila tak ada / diminimalkan). */
  permPopup: ReactNode;
  /** Popup form (atau null bila tak ada / diminimalkan). */
  formPopup: ReactNode;
  /** True bila ada popup izin/form yang tampil (mic besar disembunyikan). */
  popupOpen: boolean;
  /** True bila ada izin pending yang diminimalkan. */
  awaitingPerm: boolean;
  onReopenPerm: () => void;
  /** Ukuran awal animasi saat baru pindah dari mode lain (px). */
  animateFrom: number | undefined;
}): JSX.Element {
  const t = useT();
  const asking = pose === "asking";
  const biboSize = asking ? 290 : 400;

  return (
    <main className="talk-screen">
      <div className={`talk-stage${asking ? " asking" : ""}`}>
        <div className="talk-bibo-wrap">
          <AvatarStage pose={pose} variant={variant} mood={mood} level={level} theme={theme} locale={locale} size={biboSize} animateFrom={animateFrom} />
          <SpeechBubble bubble={bubble} />
        </div>
      </div>

      {ttsActive && (
        <div className="speaking-chip" data-testid="speaking-chip">
          <Equalizer level={level} />
          <span>{fill(t.speakingChip, { name: character.name })}</span>
        </div>
      )}

      {permPopup}
      {formPopup}

      {awaitingPerm && !popupOpen && (
        <button type="button" className="awaiting-chip" onClick={onReopenPerm} data-testid="awaiting-chip">
          {t.awaitingPerm}
        </button>
      )}

      {!popupOpen && (
        <div className="talk-controls">
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
          <MicButton size="huge" listening={listening} disabled={!sttSupported} onDown={micDown} onUp={micUp} />
          <div className="talk-hint">
            <b>{t.talkHint1}</b> · {fill(t.talkHint2, { mode: t.modeChat })}
          </div>
        </div>
      )}
    </main>
  );
}
