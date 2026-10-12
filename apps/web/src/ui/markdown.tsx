import { useState, type ReactNode } from "react";
import { useT } from "../i18n/index.js";

/** Markdown ringan: blok kode + inline code, bold, italic, link, list, heading. */

function inline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push(text.slice(last, idx));
    const tok = m[0];
    const k = `${keyPrefix}-${n++}`;
    if (tok.startsWith("`")) parts.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**")) parts.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("*")) parts.push(<em key={k}>{tok.slice(1, -1)}</em>);
    else {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      if (lm) {
        parts.push(
          <a key={k} href={lm[2]} target="_blank" rel="noreferrer">
            {lm[1]}
          </a>,
        );
      } else parts.push(tok);
    }
    last = idx + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function CodeBlock({ code, lang }: { code: string; lang: string }): JSX.Element {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="codeblock">
      <div className="codeblock-head">
        <span>{lang || "code"}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            });
          }}
        >
          {copied ? t.copied : t.copy}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function Markdown({ text }: { text: string }): JSX.Element {
  const blocks: ReactNode[] = [];
  const re = /```(\w*)\n([\s\S]*?)```/g;
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) blocks.push(<TextBlock key={`t-${n}`} text={text.slice(last, idx)} />);
    blocks.push(<CodeBlock key={`c-${n}`} lang={m[1] ?? ""} code={(m[2] ?? "").replace(/\n$/, "")} />);
    n++;
    last = idx + m[0].length;
  }
  if (last < text.length) blocks.push(<TextBlock key={`t-${n}`} text={text.slice(last)} />);
  if (blocks.length === 0) blocks.push(<TextBlock key="t-0" text={text} />);
  return <>{blocks}</>;
}

function TextBlock({ text }: { text: string }): JSX.Element {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = (k: string): void => {
    if (list.length > 0) {
      out.push(
        <ul key={k}>
          {list.map((li, i) => (
            <li key={i}>{inline(li.replace(/^[-*]\s+/, ""), `${k}-${i}`)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  lines.forEach((ln, i) => {
    if (/^#{1,3}\s/.test(ln)) {
      flush(`u-${i}`);
      out.push(<p key={i} className="md-head">{inline(ln.replace(/^#+\s*/, ""), `h-${i}`)}</p>);
    } else if (/^[-*]\s+/.test(ln)) {
      list.push(ln);
    } else if (ln.trim() === "") {
      flush(`u-${i}`);
    } else {
      flush(`u-${i}`);
      out.push(<p key={i}>{inline(ln, `p-${i}`)}</p>);
    }
  });
  flush("u-end");
  return <>{out}</>;
}
