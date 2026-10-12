import { useEffect, useState } from "react";
import type { PermissionView } from "@codepet/protocol";
import { fill, useT } from "../i18n/index.js";
import { character } from "../character.js";
import { ChevronDownIcon, MicIcon, QuestionIcon } from "./icons.js";
import { useFocusTrap } from "./useFocusTrap.js";

/**
 * Kartu persetujuan izin (PRD §11.2, FR-040..042) — dua varian:
 * - "popup": popup di bawah Bibo (mode Ngobrol), panah ke atas, bisa diminimalkan;
 * - "dock": menempel di atas komposer (mode Chat).
 * Aturan risiko: badge; "Selalu" hanya klik + peringatan, hilang untuk high;
 * high wajib ketik OK + "Konfirmasi lewat layar"; petunjuk suara hanya bila
 * voiceAllowed. Fokus tertangkap; aria-live assertive; Esc TIDAK menyetujui/
 * menolak (di popup: meminimalkan; kartu tak pernah hilang selama pending).
 */
export function ApprovalCard({
  perm,
  onReply,
  variant,
  directory,
  onMinimize,
}: {
  perm: PermissionView;
  onReply: (requestID: string, decision: "once" | "reject" | "always") => void;
  /** popup = di bawah Bibo (ngobrol); dock = di atas komposer (chat). */
  variant: "popup" | "dock";
  /** Folder proyek untuk catatan folder/tujuan. */
  directory: string;
  /** Popup: kecilkan ke chip "Menunggu izin". */
  onMinimize?: () => void;
}): JSX.Element {
  const t = useT();
  const [confirmAlways, setConfirmAlways] = useState(false);
  const [okText, setOkText] = useState("");
  const trapRef = useFocusTrap<HTMLDivElement>(true);

  useEffect(() => {
    setConfirmAlways(false);
    setOkText("");
  }, [perm.requestID]);

  const badge =
    perm.risk === "high" ? t.riskHigh : perm.risk === "medium" ? t.riskMedium : t.riskLow;
  const title = fill(t.permTitle, { name: character.name });
  const cmd = perm.patterns.map((p) => `$ ${p}`).join("\n");
  const note =
    perm.preview && perm.preview.trim()
      ? `${t.permFolderLabel}: ${directory} · ${perm.preview}`
      : `${t.permFolderLabel}: ${directory}`;

  const voiceHint =
    perm.risk === "high" || !perm.voiceAllowed ? (
      <p className="voice-hint">{t.screenOnlyHint}</p>
    ) : (
      <p className="voice-hint">{t.voiceHint}</p>
    );

  function onKeyDown(e: React.KeyboardEvent): void {
    // Esc BUKAN keputusan: di popup ia meminimalkan; kartu tak pernah hilang.
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (variant === "popup") onMinimize?.();
    }
  }

  const card = (
    <div
      className={`${variant === "popup" ? "perm-pop" : "perm-dock"} risk-${perm.risk}`}
      role="alertdialog"
      aria-live="assertive"
      aria-label={`${title}: ${perm.title}`}
      data-testid="approval"
      ref={trapRef}
      onKeyDown={onKeyDown}
    >
      {variant === "popup" && <span className="pop-arrow" aria-hidden="true" />}
      <div className="perm-head">
        <span className="perm-q" aria-hidden="true">
          <QuestionIcon size={20} />
        </span>
        <b>{title}</b>
        <span className="spacer" aria-hidden="true" />
        <span className={`risk-badge risk-${perm.risk}`} data-testid="risk-badge">
          {badge}
        </span>
        {variant === "popup" && onMinimize && (
          <button
            type="button"
            className="icon-btn"
            style={{ width: 32, height: 32 }}
            onClick={onMinimize}
            aria-label={t.minimize}
            data-testid="perm-minimize"
          >
            <ChevronDownIcon size={16} />
          </button>
        )}
      </div>
      {perm.patterns.length > 0 && (
        <pre className="perm-cmd" data-testid="perm-patterns">
          {cmd}
        </pre>
      )}
      <p className="perm-note">{note}</p>
      {(variant === "dock" || perm.risk === "high" || !perm.voiceAllowed) && voiceHint}
      <div className="perm-actions">
        {perm.risk !== "high" &&
          (confirmAlways ? (
            <span className="ok-confirm">
              <span className="always-warn">{t.permAlwaysWarn}</span>
              <button type="button" onClick={() => onReply(perm.requestID, "always")} data-testid="perm-always-confirm">
                {t.permAlwaysYes}
              </button>
              <button type="button" onClick={() => setConfirmAlways(false)}>
                {t.cancel}
              </button>
            </span>
          ) : (
            <button type="button" className="link-btn" onClick={() => setConfirmAlways(true)} data-testid="perm-always">
              {t.permAlways}
            </button>
          ))}
        <span className="spacer" aria-hidden="true" />
        <button type="button" className="btn-reject" onClick={() => onReply(perm.requestID, "reject")} data-testid="perm-reject">
          {t.permReject}
        </button>
        {perm.risk === "high" ? (
          <span className="ok-confirm">
            <input
              value={okText}
              onChange={(e) => setOkText(e.target.value)}
              placeholder={t.permOkPlaceholder}
              aria-label={t.permOkAria}
              data-testid="perm-ok-input"
            />
            <button
              type="button"
              className="btn-once"
              disabled={okText.trim().toUpperCase() !== "OK"}
              onClick={() => onReply(perm.requestID, "once")}
              data-testid="perm-once"
            >
              {t.permOnce}
            </button>
          </span>
        ) : (
          <button type="button" className="btn-once" onClick={() => onReply(perm.requestID, "once")} data-testid="perm-once">
            {t.permOnce}
          </button>
        )}
      </div>
    </div>
  );

  // Mode ngobrol: petunjuk suara tampil DI BAWAH kartu (hanya bila voiceAllowed,
  // high risk memakai "Konfirmasi lewat layar" di dalam kartu).
  if (variant === "popup" && perm.voiceAllowed && perm.risk !== "high") {
    return (
      <>
        {card}
        <div className="perm-voice-hint" data-testid="perm-voice-hint">
          <span className="voice-mic-mini" aria-hidden="true">
            <MicIcon size={20} />
          </span>
          <span>{t.voiceHint}</span>
        </div>
      </>
    );
  }
  return card;
}
