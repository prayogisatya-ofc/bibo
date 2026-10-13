import { useEffect, useRef, useState, type ReactNode } from "react";
import { fill, useT } from "../i18n/index.js";
import { character } from "../character.js";
import { useApp } from "../state/store.js";
import { Markdown } from "./markdown.js";
import { MicButton } from "./MicButton.js";
import { SendIcon, StopIcon } from "./icons.js";

const HISTORY_KEY = "codepet.input-history";

function loadHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** Ikon karakter mini untuk gelembung agent (versi sederhana, bukan salinan referensi). */
function MiniAvatar(): JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="var(--app-bg)" />
      <rect x="7" y="11" width="26" height="21" rx="10" fill="#fff" stroke="#CDD4F1" />
      <rect x="11" y="16" width="18" height="11" rx="5.5" fill="#1F2540" />
      <ellipse cx="16.5" cy="21.5" rx="1.5" ry="2.2" fill="#7CF3D6" />
      <ellipse cx="23.5" cy="21.5" rx="1.5" ry="2.2" fill="#7CF3D6" />
    </svg>
  );
}

export function ChatPanel({
  sessionTitle,
  agentLabel,
  disabled,
  busy,
  onSend,
  onStop,
  externalDraft,
  mic,
  docked,
  afterLog,
}: {
  sessionTitle: string;
  agentLabel: string;
  disabled: boolean;
  busy: boolean;
  onSend: (text: string, delivery: "queue" | "steer") => void;
  onStop: () => void;
  externalDraft: { text: string; key: string } | undefined;
  mic: { listening: boolean; disabled: boolean; onDown: () => void; onUp: () => void };
  /** Kartu izin/form yang menempel di atas komposer (mode chat). */
  docked?: ReactNode;
  /** ChangesCard + error setelah giliran selesai (di dalam kartu kanan). */
  afterLog?: ReactNode;
}): JSX.Element {
  const t = useT();
  const { chat } = useApp();
  const emptyChat = fill(t.emptyChat, { name: character.name });
  const inputPlaceholder = fill(t.inputPlaceholder, { name: character.name });
  const [draft, setDraft] = useState("");
  const [stick, setStick] = useState(true);
  const [showChoice, setShowChoice] = useState(false);
  const [histIdx, setHistIdx] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);

  // Draf suara (mode konfirmasi): ditimpa dari luar sekali per kiriman.
  const lastVoiceKey = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (externalDraft && externalDraft.key !== lastVoiceKey.current) {
      lastVoiceKey.current = externalDraft.key;
      setDraft(externalDraft.text);
    }
  }, [externalDraft]);

  useEffect(() => {
    if (stick && nearBottom.current && boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [chat, stick]);

  function submit(delivery: "queue" | "steer"): void {
    const text = draft.trim();
    if (!text || disabled) return;
    const h = [text, ...loadHistory().filter((x) => x !== text)].slice(0, 50);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
    } catch {
      // abaikan
    }
    setHistIdx(-1);
    setDraft("");
    setShowChoice(false);
    onSend(text, delivery);
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (busy) setShowChoice(true);
      else submit("queue");
    } else if (e.key === "ArrowUp" && draft === "") {
      const h = loadHistory();
      if (h.length > 0) {
        e.preventDefault();
        const next = Math.min(histIdx + 1, h.length - 1);
        setHistIdx(next);
        setDraft(h[next] ?? "");
      }
    } else if (e.key === "ArrowDown") {
      setHistIdx(-1);
      setDraft("");
    } else if (e.key === "Escape") {
      onStop();
    }
  }

  return (
    <section className="chat-card" aria-label="Chat">
      <div className="session-head">
        <b>{sessionTitle}</b>
        <span className="spacer" aria-hidden="true" />
        <span className="agent-chip">{agentLabel}</span>
      </div>
      <div
        className="chat-log"
        ref={boxRef}
        data-testid="chat-log"
        tabIndex={0}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          if (!nearBottom.current) setStick(false);
        }}
      >
        {chat.length === 0 && <p className="empty">{emptyChat}</p>}
        {chat.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="bubble bubble-user">
              <Markdown text={m.text} />
            </div>
          ) : m.role === "agent" ? (
            <div key={m.id} className="bubble-agent-row">
              <span className="agent-mini" aria-hidden="true">
                <MiniAvatar />
              </span>
              <div className="bubble bubble-agent">
                <Markdown text={m.text} />
              </div>
            </div>
          ) : (
            <div key={m.id} className="bubble bubble-system">
              <Markdown text={m.text} />
            </div>
          ),
        )}
      </div>
      {!stick && (
        <button
          type="button"
          className="resume"
          onClick={() => {
            setStick(true);
            nearBottom.current = true;
            if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
          }}
        >
          {t.followLabel}
        </button>
      )}
      {showChoice && (
        <div className="busy-choice" role="dialog" aria-label={t.busyChoiceTitle}>
          <p>{t.busyChoiceTitle}</p>
          <div>
            <button type="button" onClick={() => submit("queue")} autoFocus>
              {t.busyQueue}
            </button>
            <button type="button" onClick={() => submit("steer")}>
              {t.busySteer}
            </button>
            <button type="button" onClick={() => setShowChoice(false)}>
              {t.close}
            </button>
          </div>
        </div>
      )}
      {afterLog}
      {docked ? <div className="docked-cards">{docked}</div> : null}
      <div className="composer-zone">
        <div className="composer">
          <textarea
            value={draft}
            disabled={disabled}
            placeholder={inputPlaceholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            aria-label={inputPlaceholder}
            data-testid="chat-input"
          />
          <MicButton size="small" testId="mic-input-btn" listening={mic.listening} disabled={disabled || mic.disabled} onDown={mic.onDown} onUp={mic.onUp} />
          {busy ? (
            <button type="button" className="stop-btn" onClick={onStop} data-testid="stop-btn" aria-label={t.stop}>
              <StopIcon size={18} />
            </button>
          ) : (
            <button
              type="button"
              className="send-btn"
              onClick={() => submit("queue")}
              disabled={disabled || !draft.trim()}
              data-testid="send-btn"
              aria-label={t.send}
            >
              <SendIcon size={22} />
            </button>
          )}
        </div>
        <div className="kbd-hints">{t.kbdHints}</div>
      </div>
    </section>
  );
}
