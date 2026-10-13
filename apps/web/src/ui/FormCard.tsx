import { useState } from "react";
import type { FormView } from "@bibo/protocol";
import { useT } from "../i18n/index.js";
import { ChevronDownIcon } from "./icons.js";
import { useFocusTrap } from "./useFocusTrap.js";
import { Button, IconButton, Input } from "./components/index.js";

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
 * Dua varian seperti ApprovalCard: "popup" (di bawah Bibo, mode Ngobrol)
 * dan "dock" (di atas komposer, mode Chat). Esc meminimalkan, bukan membatalkan.
 */
export function FormCard({
  form,
  onReply,
  onCancel,
  variant,
  onMinimize,
}: {
  form: FormView;
  onReply: (formID: string, answer: Record<string, unknown>) => void;
  onCancel: (formID: string) => void;
  variant: "popup" | "dock";
  onMinimize?: () => void;
}): JSX.Element {
  const t = useT();
  const trapRef = useFocusTrap<HTMLDivElement>(true);
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

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (variant === "popup") onMinimize?.();
    }
  }

  return (
    <div
      className={`${variant === "popup" ? "perm-pop form-pop" : "perm-dock"}`}
      role="alertdialog"
      aria-live="assertive"
      aria-label={form.title}
      data-testid="formcard"
      ref={trapRef}
      onKeyDown={onKeyDown}
    >
      {variant === "popup" && <span className="pop-arrow" aria-hidden="true" />}
      <div className="perm-head">
        <strong>{form.title}</strong>
        <span className="spacer" aria-hidden="true" />
        {variant === "popup" && onMinimize && (
          <IconButton label={t.minimize} onClick={onMinimize} data-testid="form-minimize" size="sm">
            <ChevronDownIcon size={16} />
          </IconButton>
        )}
      </div>
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
                <p className="voice-hint">{t.formVoiceHint}</p>
                {f.options.map((o, i) => (
                  <Button key={o.value} size="sm" onClick={() => onReply(form.formID, { [key]: o.value })} data-testid={`form-opt-${key}-${o.value}`}>
                    {i + 1}. {o.label ?? o.value}
                  </Button>
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
              <Button size="sm" variant="primary" onClick={() => onReply(form.formID, { [key]: multi[key] ?? [] })} data-testid={`form-send-${key}`}>
                {t.formAnswer}
              </Button>
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
              <Button size="sm" variant="primary" onClick={() => onReply(form.formID, { [key]: values[key] ?? false })} data-testid={`form-send-${key}`}>
                {t.formAnswer}
              </Button>
            </label>
          );
        }
        return (
          <label key={key}>
            {f.title ?? key}
            <Input
              type="text"
              value={String(values[key] ?? "")}
              onChange={(e) => set(key, e.target.value)}
              data-testid={`form-text-${key}`}
            />
            <Button size="sm" variant="primary" onClick={() => onReply(form.formID, { [key]: values[key] ?? "" })} data-testid={`form-send-${key}`}>
              {t.formAnswer}
            </Button>
          </label>
        );
      })}
      <div className="perm-actions">
        <span className="spacer" aria-hidden="true" />
        <Button size="sm" variant="danger" onClick={() => onCancel(form.formID)} data-testid="form-cancel">
          {t.cancel}
        </Button>
      </div>
    </div>
  );
}
