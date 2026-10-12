import { useEffect, useRef, useState } from "react";
import type { PermissionView } from "@codepet/protocol";

/**
 * Kartu persetujuan izin (PRD §11.2, FR-040..042).
 * - Badge risiko; "Selalu" hanya klik + peringatan, hilang untuk high.
 * - High: wajib ketik OK. Fokus tertangkap; aria-live assertive.
 * - Petunjuk suara hanya bila voiceAllowed.
 */
export function ApprovalCard({
  perm,
  onReply,
}: {
  perm: PermissionView;
  onReply: (requestID: string, decision: "once" | "reject" | "always") => void;
}): JSX.Element {
  const [confirmAlways, setConfirmAlways] = useState(false);
  const [okText, setOkText] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setConfirmAlways(false);
    setOkText("");
    boxRef.current?.querySelector("button")?.focus();
  }, [perm.requestID]);

  const badge =
    perm.risk === "high" ? "Risiko tinggi" : perm.risk === "medium" ? "Risiko sedang" : "Risiko rendah";

  return (
    <div className="approval" role="alertdialog" aria-live="assertive" aria-label={`Minta izin: ${perm.title}`} data-testid="approval" ref={boxRef}>
      <div className="approval-head">
        <strong>{perm.title}</strong>
        <span className={`risk risk-${perm.risk}`} data-testid="risk-badge">
          {badge}
        </span>
      </div>
      {perm.patterns.length > 0 && (
        <pre className="perm-patterns" data-testid="perm-patterns">
          {perm.patterns.join("\n")}
        </pre>
      )}
      {perm.voiceAllowed ? (
        <p className="voice-hint">Ucapkan “ya” / “tolak”.</p>
      ) : (
        <p className="voice-hint">Risiko tinggi: ucapkan “tolak” saja bila menolak; persetujuan lewat layar.</p>
      )}
      <div className="approval-btns">
        <button type="button" onClick={() => onReply(perm.requestID, "reject")} data-testid="perm-reject">
          Tolak
        </button>
        {perm.risk === "high" ? (
          <span className="ok-confirm">
            <input
              value={okText}
              onChange={(e) => setOkText(e.target.value)}
              placeholder='Ketik "OK" untuk menyetujui'
              aria-label='Ketik OK untuk menyetujui'
              data-testid="perm-ok-input"
            />
            <button type="button" disabled={okText.trim().toUpperCase() !== "OK"} onClick={() => onReply(perm.requestID, "once")} data-testid="perm-once">
              Izinkan sekali
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => onReply(perm.requestID, "once")} data-testid="perm-once">
            Izinkan sekali
          </button>
        )}
        {perm.risk !== "high" &&
          (confirmAlways ? (
            <span className="ok-confirm">
              <span className="warn">Selalu izinkan pola ini? Tidak untuk risiko tinggi.</span>
              <button type="button" onClick={() => onReply(perm.requestID, "always")} data-testid="perm-always-confirm">
                Ya, selalu
              </button>
              <button type="button" onClick={() => setConfirmAlways(false)}>
                Batal
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmAlways(true)} data-testid="perm-always">
              Selalu…
            </button>
          ))}
      </div>
    </div>
  );
}
