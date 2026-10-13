import { useT } from "../i18n/index.js";
import { SpinnerIcon } from "./icons.js";
import { Button, Select } from "./components/index.js";

export interface ModelOption {
  id: string;
  name: string;
  providerID: string;
}

export interface ModelCurrent {
  id: string;
  providerID: string;
}

/**
 * FITUR C: pemilih model OpenCode di TopBar (di samping chip koneksi).
 * Native <select> agar aksesibel + andal diuji; label menampilkan nama model
 * aktif, atau "Model: bawaan server" bila belum ada pilihan.
 */
export function ModelPicker({
  models,
  current,
  loading,
  error,
  onSelect,
  onRetry,
}: {
  models: ModelOption[];
  current: ModelCurrent | null;
  loading: boolean;
  /** Kode error dari bridge (OC_DOWN / MODEL_LIST_FAILED / MODEL_SET_FAILED). */
  error: string | null;
  onSelect: (id: string, providerID: string) => void;
  onRetry: () => void;
}): JSX.Element {
  const t = useT();

  if (loading) {
    return (
      <span className="model-picker is-loading" role="status" data-testid="model-picker">
        <SpinnerIcon size={14} />
        <span className="model-text">{t.modelLoading}</span>
      </span>
    );
  }
  if (error !== null) {
    const msg =
      error === "OC_DOWN" ? t.modelDownError : error === "MODEL_SET_FAILED" ? t.modelSetError : t.modelLoadError;
    return (
      <span className="model-picker is-error" role="alert" title={msg} data-testid="model-picker">
        <span className="model-text">{t.modelLabel}</span>
        <Button size="sm" onClick={onRetry} data-testid="model-retry">
          {t.modelRetry}
        </Button>
      </span>
    );
  }
  const curValue = current ? JSON.stringify({ id: current.id, providerID: current.providerID }) : "";
  const curName = current
    ? models.find((m) => m.id === current.id && m.providerID === current.providerID)?.name
    : undefined;
  return (
    <span className="model-picker" data-testid="model-picker">
      <Select
        aria-label={t.modelPickerTitle}
        data-testid="model-select"
        value={curValue}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return; // opsi "bawaan server": hanya label, bukan aksi
          try {
            const parsed = JSON.parse(v) as { id?: unknown; providerID?: unknown };
            if (typeof parsed.id === "string" && typeof parsed.providerID === "string") {
              onSelect(parsed.id, parsed.providerID);
            }
          } catch {
            // abaikan nilai rusak
          }
        }}
        title={curName ? `${t.modelLabel}: ${curName}` : `${t.modelLabel}: ${t.modelDefault}`}
      >
        <option value="">{`${t.modelLabel}: ${t.modelDefault}`}</option>
        {models.map((m) => (
          <option
            key={`${m.providerID}/${m.id}`}
            value={JSON.stringify({ id: m.id, providerID: m.providerID })}
            title={`${m.id} · ${m.providerID}`}
          >
            {m.name}
          </option>
        ))}
      </Select>
    </span>
  );
}
