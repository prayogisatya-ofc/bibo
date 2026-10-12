import { useState } from "react";
import { useT } from "../i18n/index.js";

const DIRS_KEY = "codepet.dir-history";

export function loadDirHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DIRS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function saveDirHistory(dirs: string[]): void {
  try {
    localStorage.setItem(DIRS_KEY, JSON.stringify(dirs.slice(0, 10)));
  } catch {
    // abaikan
  }
}

import type { BridgeMessage } from "@codepet/protocol";

type ListedSession = Extract<BridgeMessage, { type: "session.listed" }>["sessions"][number];

export function Onboarding({
  recent, sessions, onPick,
}: {
  recent: string[];
  sessions: ListedSession[];
  onPick: (dir: string, sessionID?: string) => void;
}): JSX.Element {
  const t = useT();
  const [dir, setDir] = useState("");
  const local = loadDirHistory();
  const merged = [...recent, ...local.filter((d) => !recent.includes(d))].slice(0, 10);
  return (
    <div className="modal" role="dialog" aria-label={t.onboardTitle}>
      <div className="modal-box">
        <h2>{t.onboardTitle}</h2>
        <p>{t.onboardHint}</p>
        <div className="row">
          <input
            value={dir}
            onChange={(e) => setDir(e.target.value)}
            placeholder={t.onboardPlaceholder}
            aria-label={t.onboardTitle}
            data-testid="dir-input"
            onKeyDown={(e) => {
              if (e.key === "Enter" && dir.trim()) onPick(dir.trim());
            }}
          />
          <button type="button" disabled={!dir.trim()} onClick={() => onPick(dir.trim())} data-testid="dir-go">
            {t.onboardGo}
          </button>
        </div>
        {sessions.length > 0 && (
          <>
            <h3>{t.sessionLabel}</h3>
            <ul className="recent">
              {sessions.map((sn) => (
                <li key={sn.sessionID}>
                  <button type="button" onClick={() => onPick(sn.directory ?? dir ?? merged[0] ?? "", sn.sessionID)} data-testid={`sess-${sn.sessionID}`}>
                    {sn.title || sn.sessionID}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {merged.length > 0 && (
          <>
            <h3>{t.recentTitle}</h3>
            <ul className="recent">
              {merged.map((d) => (
                <li key={d}>
                  <button type="button" onClick={() => onPick(d)}>
                    {d}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
