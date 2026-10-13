import { useState } from "react";
import { useT } from "../i18n/index.js";
import { DirPicker } from "./DirPicker.js";
import { FolderIcon, PlusIcon } from "./icons.js";
import { Button } from "./components/index.js";

const DIRS_KEY = "bibo.dir-history";

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

import type { BridgeMessage } from "@bibo/protocol";

type ListedSession = Extract<BridgeMessage, { type: "session.listed" }>["sessions"][number];

/** Normalisasi path untuk perbandingan (trailing slash, spasi). */
export function normDir(d: string | undefined): string {
  return (d ?? "").trim().replace(/\/+$/, "");
}

export function Onboarding({
  recent, sessions, bridgeHttp, onPick,
}: {
  recent: string[];
  sessions: ListedSession[];
  bridgeHttp: string;
  onPick: (dir: string, sessionID?: string) => void;
}): JSX.Element {
  const t = useT();
  const [dir, setDir] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const local = loadDirHistory();
  const merged = [...recent, ...local.filter((d) => !recent.includes(d))].slice(0, 10);
  const dirN = normDir(dir);
  const folderSessions = dirN ? sessions.filter((sn) => normDir(sn.directory) === dirN) : [];
  return (
    <div className="modal" role="dialog" aria-label={t.onboardTitle}>
      <div className="modal-box">
        <h2>{t.onboardTitle}</h2>
        <p>{t.onboardHint}</p>
        <div className="row">
          <Button variant="secondary" onClick={() => setPickerOpen(true)} data-testid="dir-browse" title={t.dirBrowse}>
            <FolderIcon size={16} /> {t.dirBrowse}
          </Button>
          {dirN && <span className="muted" data-testid="dir-chosen">{dirN}</span>}
        </div>
        {pickerOpen && (
          <DirPicker
            bridgeHttp={bridgeHttp}
            {...(dirN ? { initialDir: dirN } : {})}
            onSelect={(d) => {
              setDir(d);
              setPickerOpen(false);
            }}
            onClose={() => setPickerOpen(false)}
          />
        )}
        <h3>{t.sessionInFolder}</h3>
        {!dirN ? (
          <p className="muted" data-testid="sess-hint">{t.sessionPickFolderFirst}</p>
        ) : (
          <>
            <Button
              variant="primary"
              disabled={!dirN}
              onClick={() => onPick(dirN)}
              data-testid="sess-new"
            >
              <PlusIcon size={14} /> {t.sessionNew}
            </Button>
            {folderSessions.length > 0 ? (
              <ul className="recent">
                {folderSessions.map((sn) => (
                  <li key={sn.sessionID}>
                    <button
                      type="button"
                      onClick={() => onPick(dirN, sn.sessionID)}
                      data-testid={`sess-${sn.sessionID}`}
                      title={t.sessionContinue}
                    >
                      {sn.title || sn.sessionID}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" data-testid="sess-empty">{t.sessionNoneInFolder}</p>
            )}
          </>
        )}
        {merged.length > 0 && (
          <>
            <h3>{t.recentTitle}</h3>
            <ul className="recent">
              {merged.map((d) => (
                <li key={d}>
                  <button type="button" onClick={() => setDir(d)} data-testid={`recent-${d}`}>
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
