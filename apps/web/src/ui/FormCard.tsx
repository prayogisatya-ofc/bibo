import { useState } from "react";
import type { FormView } from "@codepet/protocol";

interface Field {
  key?: string;
  title?: string;
  description?: string;
  type?: string;
  options?: Array<{ value: string; label?: string; description?: string }>;
  default?: unknown;
}

function asFields(raw: unknown[]): Field[] {
  return raw.filter((f): f is Field => typeof f === "object" && f !== null);
}

/**
 * Kartu form generik (FR-043): teks, pilihan tunggal/ganda, boolean.
 * Jawaban via klik/ketik; suara (nomor/label) ditangani matchFormAnswer.
 */
export function FormCard({
  form,
  onReply,
  onCancel,
}: {
  form: FormView;
  onReply: (formID: string, answer: Record<string, unknown>) => void;
  onCancel: (formID: string) => void;
}): JSX.Element {
  const fields = asFields(form.fields);
  const [values, setValues] = useState<Record<string, unknown>>(() => Object.fromEntries(fields.map((f) => [f.key ?? "", f.default ?? ""])));
  const [multi, setMulti] = useState<Record<string, string[]>>({});

  function set(k: string, v: unknown): void {
    setValues((p) => ({ ...p, [k]: v }));
  }

  function toggleMulti(k: string, v: string): void {
    setMulti((p) => {
      const cur = p[k] ?? [];
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
      setValues((q) => ({ ...q, [k]: next }));
      return { ...p, [k]: next };
    });
  }

  return (
    <div className="formcard" role="dialog" aria-live="assertive" aria-label={form.title} data-testid="formcard">
      <strong>{form.title}</strong>
      {fields.map((f) => {
        const key = f.key ?? "";
        if (f.options && f.options.length > 0) {
          const isMulti = f.type === "multiselect";
          if (!isMulti) {
            return (
              <fieldset key={key}>
                <legend>
                  {f.title ?? key} {f.description ? <span className="muted">— {f.description}</span> : null}
                </legend>
                <p className="voice-hint">Ucapkan nomor atau nama pilihan.</p>
                {f.options.map((o, i) => (
                  <button key={o.value} type="button" onClick={() => onReply(form.formID, { [key]: o.value })} data-testid={`form-opt-${key}-${o.value}`}>
                    {i + 1}. {o.label ?? o.value}
                  </button>
                ))}
              </fieldset>
            );
          }
          return (
            <fieldset key={key}>
              <legend>
                {f.title ?? key} {f.description ? <span className="muted">— {f.description}</span> : null}
              </legend>
              {f.options.map((o) => (
                <label key={o.value}>
                  <input
                    type="checkbox"
                    checked={(multi[key] ?? []).includes(o.value)}
                    onChange={() => toggleMulti(key, o.value)}
                    data-testid={`form-opt-${key}-${o.value}`}
                  />
                  {o.label ?? o.value}
                </label>
              ))}
              <button type="button" onClick={() => onReply(form.formID, { [key]: multi[key] ?? [] })} data-testid={`form-send-${key}`}>
                Jawab
              </button>
            </fieldset>
          );
        }
        if (f.type === "boolean") {
          return (
            <label key={key}>
              <input
                type="checkbox"
                checked={values[key] === true}
                onChange={(e) => set(key, e.target.checked)}
                data-testid={`form-bool-${key}`}
              />
              {f.title ?? key}
              <button type="button" onClick={() => onReply(form.formID, { [key]: values[key] ?? false })} data-testid={`form-send-${key}`}>
                Jawab
              </button>
            </label>
          );
        }
        return (
          <label key={key}>
            {f.title ?? key}
            <input
              type="text"
              value={String(values[key] ?? "")}
              onChange={(e) => set(key, e.target.value)}
              data-testid={`form-text-${key}`}
            />
            <button type="button" onClick={() => onReply(form.formID, { [key]: values[key] ?? "" })} data-testid={`form-send-${key}`}>
              Jawab
            </button>
          </label>
        );
      })}
      <button type="button" onClick={() => onCancel(form.formID)} data-testid="form-cancel">
        Batal
      </button>
    </div>
  );
}
