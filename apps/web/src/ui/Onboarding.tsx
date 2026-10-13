import { useState } from "react";
import { useT } from "../i18n/index.js";
import { DirPicker } from "./DirPicker.js";
import { FolderIcon, PlusIcon, XIcon } from "./icons.js";
import { Button, IconButton } from "./components/index.js";

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
  recent, sessions, bridgeHttp, onPick, onClose,
}: {
  recent: string[];
  sessions: ListedSession[];
  bridgeHttp: string;
  onPick: (dir: string, sessionID?: string) => void;
  onClose: () => void;
}): JSX.Element {
  const t = useT();
  const [dir, setDir] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const local = loadDirHistory();
  const merged = [...recent, ...local.filter((d) => !recent.includes(d))].slice(0, 10);
  const dirN = normDir(dir);
  // Filter sesi: cocokkan direktori; jika sesi tidak punya info direktori,
  // tampilkan juga (jangan disembunyikan).
  const folderSessions = dirN
    ? sessions.filter((sn) => {
        const snDir = normDir(sn.directory);
        return !snDir || snDir === dirN;
      })
    : [];
  return (
    <div className="modal" role="dialog" aria-label={t.onboardTitle}>
      <div className="modal-box onboard-box">
        <div className="row picker-head">
          <h2>{t.onboardTitle}</h2>
          <IconButton label={t.dialogClose} onClick={onClose} data-testid="onboard-close">
            <XIcon size={16} />
          </IconButton>
        </div>
        <p className="onboard-hint">{t.onboardHint}</p>

        <section className="onboard-section" aria-label={t.onboardTitle}>
          <div className="row onboard-folder-row">
            <Button variant="secondary" onClick={() => setPickerOpen(true)} data-testid="dir-browse" title={t.dirBrowse}>
              <FolderIcon size={16} /> {t.dirBrowse}
            </Button>
            {dirN && <span className="onboard-dir" data-testid="dir-chosen" title={dirN}>{dirN}</span>}
          </div>
        </section>

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

        <section className="onboard-section" aria-label={t.sessionInFolder}>
          <h3 className="onboard-h3">{t.sessionInFolder}</h3>
          {!dirN ? (
            <p className="muted" data-testid="sess-hint">{t.sessionPickFolderFirst}</p>
          ) : (
            <>
              <Button
                variant="primary"
                disabled={!dirN}
                onClick={() => onPick(dirN)}
                data-testid="sess-new"
                className="onboard-new-btn"
              >
                <PlusIcon size={14} /> {t.sessionNew}
              </Button>
              {folderSessions.length > 0 ? (
                <ul className="onboard-list">
                  {folderSessions.map((sn) => (
                    <li key={sn.sessionID}>
                      <button
                        type="button"
                        className="onboard-item"
                        onClick={() => onPick(dirN, sn.sessionID)}
                        data-testid={`sess-${sn.sessionID}`}
                        title={t.sessionContinue}
                      >
                        <span className="onboard-item-title">{sn.title || sn.sessionID}</span>
                        <span className="onboard-item-sub">{t.sessionContinue}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted" data-testid="sess-empty">{t.sessionNoneInFolder}</p>
              )}
            </>
          )}
        </section>

        {merged.length > 0 && (
          <section className="onboard-section" aria-label={t.recentTitle}>
            <h3 className="onboard-h3">{t.recentTitle}</h3>
            <ul className="onboard-list">
              {merged.map((d) => (
                <li key={d}>
                  <button
                    type="button"
                    className="onboard-item"
                    onClick={() => setDir(d)}
                    data-testid={`recent-${d}`}
                    title={d}
                  >
                    <FolderIcon size={16} />
                    <span className="onboard-item-title onboard-path">{d}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
