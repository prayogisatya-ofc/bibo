import { useT } from "../i18n/index.js";
import type { DiffFile } from "../state/store.js";

export function ChangesCard({ files, onClose }: { files: DiffFile[]; onClose: () => void }): JSX.Element | null {
  const t = useT();
  if (files.length === 0) return null;
  return (
    <section className="changes" data-testid="changes" aria-label={t.changesTitle}>
      <div className="changes-head">
        <strong>
          {t.changesTitle} ({files.length})
        </strong>
        <button type="button" onClick={onClose} aria-label={t.close}>
          ×
        </button>
      </div>
      <ul>
        {files.map((f) => (
          <li key={f.path}>
            <span className="fname">{f.path}</span>
            <span className="fstat">
              +{f.additions} −{f.deletions}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
