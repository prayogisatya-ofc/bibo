import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { fill, useT } from "../i18n/index.js";
import { character } from "../character.js";
import { type TtsEngine } from "../voice/tts.js";
import { useFocusTrap } from "./useFocusTrap.js";

export type Verbosity = "silent" | "normal" | "cerewet";

type TabId = "voice" | "look" | "avatar" | "behavior" | "conn";

/** Panel pengaturan bertab: Suara & Ucapan, Tampilan, Avatar, Perilaku, Koneksi (FR-050, FR-052, FR-053, FR-056). */
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
  const [tab, setTab] = useState<TabId>("voice");
  const trapRef = useFocusTrap<HTMLDivElement>(open);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "voice", label: t.secVoice },
    { id: "look", label: t.secLook },
    { id: "avatar", label: t.secAvatar },
    { id: "behavior", label: t.secBehavior },
    { id: "conn", label: t.secConn },
  ];

  useEffect(() => {
    if (open) setVoices(engine?.listVoices() ?? []);
  }, [open, engine]);

  // Esc menutup panel (aksesibilitas dialog).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function testVoice(): void {
    engine?.speak("test", fill(t.testVoice, { name: character.name }), "normal");
  }

  /** Navigasi tab via panah/Home/End (aktivasi otomatis). */
  function onTabKey(e: KeyboardEvent<HTMLButtonElement>, i: number): void {
    let j: number | null = null;
    if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = tabs.length - 1;
    if (j === null) return;
    const next = tabs[j];
    if (!next) return;
    e.preventDefault();
    setTab(next.id);
    tabRefs.current[j]?.focus();
  }

  return (
    <div className="modal settings-modal" role="dialog" aria-modal="true" aria-label={t.settingsTitle}>
      <div className="modal-box settings-panel" ref={trapRef}>
        <h2>{t.settingsTitle}</h2>

        <div className="settings-tabs" role="tablist" aria-label={t.settingsTitle}>
          {tabs.map((tb, i) => (
            <button
              key={tb.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`settings-tab-${tb.id}`}
              aria-selected={tab === tb.id}
              aria-controls={`settings-tabpanel-${tb.id}`}
              tabIndex={tab === tb.id ? 0 : -1}
              data-testid={`settings-tab-${tb.id}`}
              onClick={() => setTab(tb.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {tb.label}
            </button>
          ))}
        </div>

        <section
          role="tabpanel"
          id={`settings-tabpanel-${tab}`}
          aria-labelledby={`settings-tab-${tab}`}
          className="settings-tabpanel"
        >
          {tab === "voice" && (
            <>
              <label>
                <input type="checkbox" checked={muted} onChange={(e) => onMuted(e.target.checked)} data-testid="mute" />
                {t.muteAll}
              </label>
              <label>
                {t.voiceLabel}
                <select
                  value={voiceURI ?? ""}
                  onChange={(e) => {
                    const v = e.target.value || undefined;
                    setVoiceURI(v);
                    engine?.setSettings({ voiceURI: v });
                  }}
                  data-testid="voice-select"
                >
                  <option value="">{t.voiceAuto}</option>
                  {voices.map((v) => (
                    <option key={v.uri} value={v.uri}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </label>
              {engine?.usingDefaultVoice && <p className="warn">{t.voiceDefaultWarn}</p>}
              <label>
                {t.rateLabel}: {rate.toFixed(1)}
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
                {t.pitchLabel}: {pitch.toFixed(1)}
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
                {t.volumeLabel}: {volume.toFixed(1)}
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
                {t.testVoiceBtn}
              </button>
              <h4 className="settings-sub">{t.micSubhead}</h4>
              <label>
                {t.sttLangLabel}
                <select value={sttLang} onChange={(e) => onSttLang(e.target.value)} data-testid="stt-lang">
                  <option value="id-ID">{t.sttId}</option>
                  <option value="en-US">{t.sttEn}</option>
                </select>
              </label>
              <label>
                {t.sendModeLabel}
                <select value={sendMode} onChange={(e) => onSendMode(e.target.value as "auto" | "confirm")} data-testid="send-mode">
                  <option value="auto">{t.sendModeAuto}</option>
                  <option value="confirm">{t.sendModeConfirm}</option>
                </select>
              </label>
              <label>
                <input type="checkbox" checked={headphone} onChange={(e) => onHeadphone(e.target.checked)} data-testid="headphone" />
                {t.headphoneLabel}
              </label>
              <label>
                {t.dictLabel}
                <textarea value={dictText} onChange={(e) => onDictText(e.target.value)} rows={4} data-testid="dict" />
              </label>
            </>
          )}

          {tab === "look" && (
            <>
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
            </>
          )}

          {tab === "avatar" && (
            <label>
              {t.avatarSizeLabel}
              <select value={avatarSize} onChange={(e) => onAvatarSize(e.target.value as "s" | "m" | "l")} data-testid="avatar-size">
                <option value="s">{t.avatarS}</option>
                <option value="m">{t.avatarM}</option>
                <option value="l">{t.avatarL}</option>
              </select>
            </label>
          )}

          {tab === "behavior" && (
            <label>
              {t.verbosityLabel}
              <select value={verbosity} onChange={(e) => onVerbosity(e.target.value as Verbosity)} data-testid="verbosity">
                <option value="silent">{t.verbositySilent}</option>
                <option value="normal">{t.verbosityNormal}</option>
                <option value="cerewet">{t.verbosityChatty}</option>
              </select>
            </label>
          )}

          {tab === "conn" && (
            <label>
              {t.bridgeUrlLabel}
              <input value={bridgeHttp} onChange={(e) => onBridgeHttp(e.target.value)} inputMode="url" />
            </label>
          )}
        </section>

        <p className="privacy">{t.privacyNote}</p>
        <p className="muted">{t.settingsHint}</p>
        <button type="button" className="btn-close" onClick={onClose}>
          {t.close}
        </button>
      </div>
    </div>
  );
}
