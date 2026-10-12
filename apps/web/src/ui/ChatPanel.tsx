import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n/index.js";
import { useApp } from "../state/store.js";
import { Markdown } from "./markdown.js";
import { MicButton } from "./MicButton.js";

const HISTORY_KEY = "codepet.input-history";

function loadHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function ChatPanel({
  disabled,
  busy,
  onSend,
  onStop,
  externalDraft,
  mic,
}: {
  disabled: boolean;
  busy: boolean;
  onSend: (text: string, delivery: "queue" | "steer") => void;
  onStop: () => void;
  externalDraft: { text: string; key: string } | undefined;
  mic: { listening: boolean; disabled: boolean; onDown: () => void; onUp: () => void };
}): JSX.Element {
  const t = useT();
  const { chat } = useApp();
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
    <section className="chat" aria-label="Chat">
      <div
        className="chat-log"
        ref={boxRef}
        data-testid="chat-log"
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          if (!nearBottom.current) setStick(false);
        }}
      >
        {chat.length === 0 && <p className="empty">{t.emptyChat}</p>}
        {chat.map((m) => (
          <div key={m.id} className={`bubble bubble-${m.role}`}>
            <Markdown text={m.text} />
          </div>
        ))}
      </div>
      {!stick && (
        <button type="button" className="resume" onClick={() => setStick(true)}>
          ↓ lanjut ikuti
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
      <div className="composer">
        <MicButton listening={mic.listening} disabled={disabled || mic.disabled} onDown={mic.onDown} onUp={mic.onUp} />
        <textarea
          value={draft}
          disabled={disabled}
          placeholder={t.inputPlaceholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          aria-label={t.inputPlaceholder}
          data-testid="chat-input"
        />
        {busy ? (
          <button type="button" className="stop" onClick={onStop} data-testid="stop-btn">
            {t.stop}
          </button>
        ) : (
          <button type="button" onClick={() => submit("queue")} disabled={disabled || !draft.trim()} data-testid="send-btn">
            {t.send}
          </button>
        )}
      </div>
    </section>
  );
}
