import { useCallback, useEffect, useState } from "react";
import { useT } from "../i18n/index.js";
import { useFocusTrap } from "./useFocusTrap.js";
import { ArrowUpIcon, FolderIcon, SpinnerIcon, XIcon } from "./icons.js";

interface DirEntry {
  name: string;
  isDirectory: boolean;
}

interface DirListResponse {
  path: string;
  entries: DirEntry[];
}

/** Pemisah path: dukung "/" (posix) dan "\" (windows). */
function splitParts(p: string): string[] {
  return p.split(/[\\/]/).filter(Boolean);
}

/** Segmen breadcrumb dari path absolut: ["/", "home", "kamu", ...] (atau ["C:", ...] di Windows). */
function segments(p: string): string[] {
  const parts = splitParts(p);
  if (/^[A-Za-z]:$/.test(parts[0] ?? "")) return parts;
  return ["/", ...parts];
}

/** Path absolut dari segmen ke-i (inklusif). */
function pathOf(segs: string[], i: number): string {
  const sel = segs.slice(0, i + 1);
  if (sel[0] === "/") return `/${sel.slice(1).join("/")}`;
  const win = /^[A-Za-z]:$/.test(sel[0] ?? "");
  return win ? sel.join("\\") : sel.join("/");
}

/** Induk dari path absolut; root mengembalikan dirinya sendiri. */
function parentOf(p: string): string {
  const parts = splitParts(p);
  const win = /^[A-Za-z]:$/.test(parts[0] ?? "");
  if (parts.length <= 1) return win ? `${parts[0] ?? "C:"}\\` : "/";
  const head = parts.slice(0, -1);
  return win ? head.join("\\") : `/${head.join("/")}`;
}

function joinPath(base: string, name: string): string {
  const sep = base.includes("\\") && !base.includes("/") ? "\\" : "/";
  return base.endsWith(sep) ? base + name : base + sep + name;
}

/**
 * Modal pemilih folder "seperti pilih file": breadcrumb, daftar isi,
 * tombol naik, dan tombol "Pilih folder ini". Input manual tetap tersedia
 * sebagai fallback. Esc menutup; fokus terperangkap di dalam dialog.
 */
export function DirPicker({
  bridgeHttp,
  initialDir,
  onSelect,
  onClose,
}: {
  bridgeHttp: string;
  initialDir?: string;
  onSelect: (dir: string) => void;
  onClose: () => void;
}): JSX.Element {
  const t = useT();
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  const [cur, setCur] = useState<string | null>(null);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  const load = useCallback(
    async (path: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${bridgeHttp}/api/dirs?path=${encodeURIComponent(path)}`);
        const data = (await res.json().catch(() => null)) as (Partial<DirListResponse> & { error?: string }) | null;
        if (!res.ok || !data || typeof data.path !== "string" || !Array.isArray(data.entries)) {
          throw new Error(typeof data?.error === "string" && data.error ? data.error : t.dirPickerError);
        }
        setCur(data.path);
        setEntries(data.entries as DirEntry[]);
      } catch (e) {
        setError(e instanceof Error && e.message ? e.message : t.dirPickerError);
      } finally {
        setLoading(false);
      }
    },
    [bridgeHttp, t],
  );

  useEffect(() => {
    void load(initialDir ?? "");
  }, [load, initialDir]);

  // Esc menutup picker.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const segs = cur === null ? [] : segments(cur);
  const canUp = cur !== null && parentOf(cur) !== cur;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={t.dirPickerTitle} data-testid="dir-picker">
      <div className="modal-box dir-picker" ref={trapRef}>
        <div className="row picker-head">
          <h2>{t.dirPickerTitle}</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label={t.dirPickerClose}
            data-testid="dir-picker-close"
          >
            <XIcon size={18} />
          </button>
        </div>
        {cur !== null && (
          <nav className="crumbs" aria-label="breadcrumb">
            {segs.map((s, i) => (
              <span key={`${i}-${s}`} className="crumb-wrap">
                {i > 0 && (
                  <span className="crumb-sep" aria-hidden="true">
                    /
                  </span>
                )}
                <button type="button" className="crumb" onClick={() => void load(pathOf(segs, i))}>
                  {s}
                </button>
              </span>
            ))}
          </nav>
        )}
        <div className="picker-list" role="list" aria-busy={loading}>
          {loading && (
            <p className="muted">
              <SpinnerIcon size={16} /> {t.dirPickerLoading}
            </p>
          )}
          {!loading && error !== null && (
            <p className="errors" role="alert">
              {error}{" "}
              <button type="button" onClick={() => void load(cur ?? "")} data-testid="dir-picker-retry">
                {t.dirPickerRetry}
              </button>
            </p>
          )}
          {!loading && error === null && entries.length === 0 && <p className="muted">{t.dirPickerEmpty}</p>}
          {!loading &&
            error === null &&
            entries.map((e) =>
              e.isDirectory ? (
                <button
                  key={e.name}
                  type="button"
                  role="listitem"
                  className="picker-entry"
                  onClick={() => void load(joinPath(cur ?? "/", e.name))}
                  data-testid={`dir-entry-${e.name}`}
                >
                  <FolderIcon size={16} />
                  <span>{e.name}</span>
                </button>
              ) : (
                <span key={e.name} role="listitem" className="picker-entry file" title={t.dirPickerFile}>
                  {e.name}
                </span>
              ),
            )}
        </div>
        <div className="row">
          <button
            type="button"
            onClick={() => {
              if (canUp && cur !== null) void load(parentOf(cur));
            }}
            disabled={!canUp}
            data-testid="dir-picker-up"
          >
            <ArrowUpIcon size={16} /> {t.dirPickerUp}
          </button>
          <button
            type="button"
            disabled={cur === null}
            onClick={() => {
              if (cur !== null) onSelect(cur);
            }}
            data-testid="dir-picker-select"
          >
            {t.dirPickerSelectHere}
          </button>
        </div>
        <div className="row">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder={t.onboardPlaceholder}
            aria-label={t.dirPickerManual}
            data-testid="dir-picker-input"
            onKeyDown={(e) => {
              if (e.key === "Enter" && manual.trim()) void load(manual.trim());
            }}
          />
          <button
            type="button"
            disabled={!manual.trim()}
            onClick={() => void load(manual.trim())}
            data-testid="dir-picker-go"
          >
            {t.dirPickerGo}
          </button>
        </div>
        <p className="muted picker-hint">{t.dirPickerManual}</p>
      </div>
    </div>
  );
}
