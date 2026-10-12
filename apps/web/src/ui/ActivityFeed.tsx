import { useState } from "react";
import type { FeedItem } from "@codepet/protocol";
import { truncate2k } from "./text-utils.js";

const ICON: Record<FeedItem["kind"], string> = { tool: "🔧", shell: "⌨", note: "📝" };
const ST: Record<FeedItem["status"], string> = { running: "⟳", ok: "✓", fail: "✗" };

export function ActivityFeed({ items }: { items: FeedItem[] }): JSX.Element {
  const [open, setOpen] = useState<string | undefined>(undefined);
  if (items.length === 0) return <div className="feed empty-feed" data-testid="feed" />;
  return (
    <ul className="feed" data-testid="feed" aria-live="polite">
      {items.map((f) => (
        <li key={f.id}>
          <button type="button" className="feed-row" onClick={() => setOpen(open === f.id ? undefined : f.id)}>
            <span aria-hidden="true">{ICON[f.kind]}</span>
            <span className="feed-title">{f.title}</span>
            <span className={`feed-st feed-${f.status}`} aria-label={f.status}>
              {ST[f.status]}
            </span>
          </button>
          {open === f.id && f.detail && <pre className="feed-detail">{truncate2k(f.detail)}</pre>}
        </li>
      ))}
    </ul>
  );
}
