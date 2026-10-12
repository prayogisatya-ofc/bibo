import { useEffect, useState } from "react";
import { useT } from "../i18n/index.js";
import { type TtsEngine } from "../voice/tts.js";

export type Verbosity = "silent" | "normal" | "cerewet";

/** Panel pengaturan suara + UI (FR-050, FR-052, FR-053, FR-056). */
export function SettingsPanel({
  bridgeHttp,
  onBridgeHttp,
  open,
  onClose,
  engine,
  verbosity,
  onVerbosity,
  muted,
  onMuted,
  theme,
  onTheme,
  sttLang,
  onSttLang,
  sendMode,
  onSendMode,
  headphone,
  onHeadphone,
  dictText,
  onDictText,
  avatarSize,
  onAvatarSize,
  locale,
  onLocale,
}: {
  bridgeHttp: string;
  onBridgeHttp: (v: string) => void;
  open: boolean;
  onClose: () => void;
  engine: TtsEngine | undefined;
  verbosity: Verbosity;
  onVerbosity: (v: Verbosity) => void;
  muted: boolean;
  onMuted: (m: boolean) => void;
  theme: "light" | "dark" | "auto";
  onTheme: (t: "light" | "dark" | "auto") => void;
  locale: "id" | "en";
  onLocale: (v: "id" | "en") => void;
  sttLang: string;
  onSttLang: (v: string) => void;
  sendMode: "auto" | "confirm";
  onSendMode: (v: "auto" | "confirm") => void;
  headphone: boolean;
  onHeadphone: (v: boolean) => void;
  dictText: string;
  onDictText: (v: string) => void;
  avatarSize: "s" | "m" | "l";
  onAvatarSize: (v: "s" | "m" | "l") => void;
}): JSX.Element | null {
  const t = useT();
  const [voices, setVoices] = useState(() => engine?.listVoices() ?? []);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [voiceURI, setVoiceURI] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (open) setVoices(engine?.listVoices() ?? []);
  }, [open, engine]);

  if (!open) return null;

  function testVoice(): void {
    engine?.speak("test", "Halo, ini Bibo. Suara test satu dua tiga.", "normal");
  }

  return (
    <div className="modal" role="dialog" aria-label={t.settingsTitle}>
      <div className="modal-box">
        <h2>{t.settingsTitle}</h2>
        <label>
          {t.languageLabel}
          <select value={locale} onChange={(e) => onLocale(e.target.value as "id" | "en")} data-testid="locale">
            <option value="id">Indonesia</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          {t.themeLabel}
          <select value={theme} onChange={(e) => onTheme(e.target.value as "light" | "dark" | "auto")} data-testid="theme">
            <option value="dark">{t.themeDark}</option>
            <option value="light">{t.themeLight}</option>
            <option value="auto">{t.themeAuto}</option>
          </select>
        </label>
        <label>
          Cerewet
          <select value={verbosity} onChange={(e) => onVerbosity(e.target.value as Verbosity)} data-testid="verbosity">
            <option value="silent">Senyap</option>
            <option value="normal">Normal</option>
            <option value="cerewet">Cerewet</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={muted} onChange={(e) => onMuted(e.target.checked)} data-testid="mute" />
          Bisukan semua suara (Ctrl+M)
        </label>
        <label>
          Suara
          <select
            value={voiceURI ?? ""}
            onChange={(e) => {
              const v = e.target.value || undefined;
              setVoiceURI(v);
              engine?.setSettings({ voiceURI: v });
            }}
            data-testid="voice-select"
          >
            <option value="">Otomatis (id-ID bila ada)</option>
            {voices.map((v) => (
              <option key={v.uri} value={v.uri}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </label>
        {engine?.usingDefaultVoice && <p className="warn">Suara Bahasa Indonesia tidak ditemukan; memakai suara default.</p>}
        <label>
          Kecepatan: {rate.toFixed(1)}
          <input
            type="range" min={0.7} max={1.4} step={0.1} value={rate} data-testid="rate"
            onChange={(e) => {
              const r = Number(e.target.value);
              setRate(r);
              engine?.setSettings({ rate: r });
            }}
          />
        </label>
        <label>
          Nada: {pitch.toFixed(1)}
          <input
            type="range" min={0.5} max={1.5} step={0.1} value={pitch} data-testid="pitch"
            onChange={(e) => {
              const p = Number(e.target.value);
              setPitch(p);
              engine?.setSettings({ pitch: p });
            }}
          />
        </label>
        <label>
          Volume: {volume.toFixed(1)}
          <input
            type="range" min={0} max={1} step={0.1} value={volume} data-testid="volume"
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              engine?.setSettings({ volume: v });
            }}
          />
        </label>
        <button type="button" onClick={testVoice} data-testid="test-voice">
          Uji suara
        </button>
        <h3>Suara masuk (mic)</h3>
        <label>
          Bahasa STT
          <select value={sttLang} onChange={(e) => onSttLang(e.target.value)} data-testid="stt-lang">
            <option value="id-ID">Indonesia (id-ID)</option>
            <option value="en-US">English (en-US)</option>
          </select>
        </label>
        <label>
          Mode kirim suara
          <select value={sendMode} onChange={(e) => onSendMode(e.target.value as "auto" | "confirm")} data-testid="send-mode">
            <option value="auto">Otomatis (kirim 600 ms setelah final)</option>
            <option value="confirm">Konfirmasi (masuk kotak input)</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={headphone} onChange={(e) => onHeadphone(e.target.checked)} data-testid="headphone" />
          Mode headphone (mic tidak menghentikan ucapan)
        </label>
        <label>
          Ukuran avatar
          <select value={avatarSize} onChange={(e) => onAvatarSize(e.target.value as "s" | "m" | "l")} data-testid="avatar-size">
            <option value="s">Kecil</option>
            <option value="m">Sedang</option>
            <option value="l">Besar</option>
          </select>
        </label>
        <label>
          Kamus koreksi (satu per baris: salah -&gt; benar)
          <textarea value={dictText} onChange={(e) => onDictText(e.target.value)} rows={4} data-testid="dict" />
        </label>
        <p className="privacy">
          Privasi: di Chrome, audio Web Speech API diproses layanan eksternal. CodePet tidak menyimpan audio.
        </p>
        <label>
          {t.bridgeUrlLabel}
          <input value={bridgeHttp} onChange={(e) => onBridgeHttp(e.target.value)} inputMode="url" />
        </label>
        <button type="button" onClick={onClose}>
          {t.close}
        </button>
      </div>
    </div>
  );
}
