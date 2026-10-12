import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BridgeMessage } from "@codepet/protocol";
import { LocaleProvider, useT, type Locale } from "./i18n/index.js";
import { AppProvider, useApp } from "./state/store.js";
import { useBridge } from "./ws/client.js";
import { useOrchestrator } from "./orchestrator/useOrchestrator.js";
import { StatusBar } from "./ui/StatusBar.js";
import { AvatarStage } from "./ui/AvatarStage.js";
import { ChatPanel } from "./ui/ChatPanel.js";
import { ActivityFeed } from "./ui/ActivityFeed.js";
import { ChangesCard } from "./ui/ChangesCard.js";
import { Onboarding, loadDirHistory, saveDirHistory } from "./ui/Onboarding.js";
import { SettingsPanel, type Verbosity } from "./ui/Settings.js";
import { TtsEngine, type UtteranceLike } from "./voice/tts.js";
import { FakeSttEngine, WebSpeechEngine, type SttEngine } from "./voice/stt.js";
import { actionLabel, isSpeakable, matchCommand, matchFormAnswer } from "./voice/commands.js";
import { applyDict, loadDict, saveDict } from "./voice/dictionary.js";
import { ApprovalCard } from "./ui/ApprovalCard.js";
import { FormCard } from "./ui/FormCard.js";
import { MicButton } from "./ui/MicButton.js";
import { humanError } from "./ui/errors.js";

const BRIDGE_KEY = "codepet.bridge-url";
const DEFAULT_BRIDGE = "http://127.0.0.1:4317";


function Shell({ locale, setLocale }: { locale: Locale; setLocale: (v: Locale) => void }): JSX.Element {
  const { agent, chat, feed, diffs, errors, apply, pushUser, pushSystem, clearDiffs } = useApp();
  const [bridgeHttp, setBridgeHttp] = useState(() => localStorage.getItem(BRIDGE_KEY) ?? DEFAULT_BRIDGE);
  const [info, setInfo] = useState({ ocStatus: "down" as "up" | "down", ocVersion: undefined as string | undefined, directory: "", sessionID: undefined as string | undefined, recentDirs: [] as string[], agent: undefined as string | undefined, model: undefined as string | undefined });
  const [sessions, setSessions] = useState<Extract<BridgeMessage, { type: "session.listed" }>["sessions"]>([]);
  const [mini, setMini] = useState(() => localStorage.getItem("codepet.mini") === "1");
  const [showChat, setShowChat] = useState(true);
  const [avatarSize, setAvatarSize] = useState<"s" | "m" | "l">(() => {
    const v = localStorage.getItem("codepet.avatar-size");
    return v === "s" || v === "l" ? v : "m";
  });
  const [showOnboard, setShowOnboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [level, setLevel] = useState(0);
  const [verbosity, setVerbosity] = useState<Verbosity>(() => {
    const v = localStorage.getItem("codepet.verbosity");
    return v === "silent" || v === "cerewet" ? v : "normal";
  });
  const [muted, setMutedState] = useState(() => localStorage.getItem("codepet.muted") === "1");
  const [theme, setTheme] = useState<"dark" | "light" | "auto">("dark");
  const effectiveTheme: "dark" | "light" = theme === "auto" ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : theme;
  const t = useT();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [voiceDraft, setVoiceDraft] = useState<{ text: string; key: string } | undefined>(undefined);
  const [toast, setToast] = useState<{ msg: string; key: number } | undefined>(undefined);
  const [sendMode, setSendMode] = useState<"auto" | "confirm">(
    () => (localStorage.getItem("codepet.send-mode") === "confirm" ? "confirm" : "auto"),
  );
  const [sttLang, setSttLang] = useState(() => localStorage.getItem("codepet.stt-lang") ?? "id-ID");
  const [dictText, setDictText] = useState(() => Object.entries(loadDict()).map(([k, v]) => `${k} -> ${v}`).join("\n"));
  const [headphone, setHeadphone] = useState(() => localStorage.getItem("codepet.headphone") === "1");
  const [micDenied, setMicDenied] = useState(false);

  const onMessage = useCallback(
    (m: BridgeMessage) => {
      if (m.type === "bridge.ready") {
        setInfo({
          ocStatus: m.opencode.status,
          ocVersion: m.opencode.version,
          directory: m.directory,
          sessionID: m.sessionID,
          recentDirs: m.recentDirs,
          agent: m.agent,
          model: m.model,
        });
        if (!m.directory) setShowOnboard(true);
      } else if (m.type === "bridge.status") {
        setInfo((p) => ({ ...p, ocStatus: m.opencode === "up" ? "up" : "down" }));
      } else if (m.type === "session.listed") {
        setSessions(m.sessions);
      } else if (m.type === "error") {
        pushSystem(humanError(m.code, m.message, localeRef.current));
      } else if (m.type === "agent.speak") {
        lastSpeakRef.current = { id: m.id, text: m.text, priority: m.priority };
        // Senyap: hanya urgent (permission/form/error). Mute: semua diam.
        if (!mutedRef.current && (verbosityRef.current !== "silent" || m.priority === "urgent")) {
          engineRef.current?.speak(m.id, m.text, m.priority);
        }
      }
      apply(m);
      feedRef.current(m);
    },
    [apply, pushSystem],
  );

  const { status, send } = useBridge(bridgeHttp, onMessage);
  const engine = useMemo(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
    const synth = window.speechSynthesis;
    const eng = new TtsEngine(
      {
        speak: (u) => synth.speak(u as SpeechSynthesisUtterance),
        cancel: () => synth.cancel(),
        getVoices: () => synth.getVoices().map((v) => ({ uri: v.voiceURI, name: v.name, lang: v.lang, ref: v })),
        onvoiceschanged: null,
      },
      (text) => {
        const u = new SpeechSynthesisUtterance(text) as unknown as UtteranceLike;
        return u;
      },
    );
    eng.onLevel = (l) => setLevel(l);
    return eng;
  }, []);
  const { snap, feed: feedOrch, mic: setOrchMic } = useOrchestrator();
  const lastSpeakRef = useRef<{ id: string; text: string; priority: "normal" | "urgent" } | undefined>(undefined);
  const feedRef = useRef(feedOrch);
  feedRef.current = feedOrch;
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const verbosityRef = useRef(verbosity);
  verbosityRef.current = verbosity;
  const localeRef = useRef(locale);
  localeRef.current = locale;

  // Sapaan saat koneksi terbuka (bridge membalas bridge.ready + agent.state).
  const sendRef = useRef(send);
  sendRef.current = send;
  const micStartRef = useRef(micStart);
  micStartRef.current = micStart;
  const micStopRef = useRef(micStop);
  micStopRef.current = micStop;
  useEffect(() => {
    if (status === "open") sendRef.current({ type: "hello", clientVersion: "web-m2" });
  }, [status]);

  useEffect(() => {
    localStorage.setItem(BRIDGE_KEY, bridgeHttp);
  }, [bridgeHttp]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(undefined), 2500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
  }, [theme]);

  // Spasi tahan = PTT bila fokus bukan di input (FR-011).
  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.code !== "Space" || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT" || t.isContentEditable)) return;
      e.preventDefault();
      micStartRef.current();
    };
    const up = (e: KeyboardEvent): void => {
      if (e.code !== "Space") return;
      micStopRef.current();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ctrl/Cmd+M = mute global (FR-053).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "m") {
        e.preventDefault();
        setMutedState((m) => {
          const next = !m;
          localStorage.setItem("codepet.muted", next ? "1" : "0");
          engine?.setSettings({ muted: next });
          if (next) engine?.cancel();
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine]);

  // STT engine: ?stt=fake (E2E), ?stt=none (paksa tak tersedia), atau Web Speech.
  const sttParam = new URLSearchParams(window.location.search).get("stt");
  const stt: SttEngine = useMemo(() => {
    if (sttParam === "fake") return new FakeSttEngine();
    if (sttParam === "none") return { supported: false, reason: "Dinonaktifkan untuk tes.", start: () => {}, stop: () => {}, onInterim: () => {}, onFinal: () => {}, onError: () => {} };
    return new WebSpeechEngine();
  }, [sttParam]);
  const sttRef = useRef(stt);
  sttRef.current = stt;

  function micStart(): void {
    if (offlineRef.current || !infoRef.current.directory) return;
    if (!headphoneRef.current) engineRef.current?.cancel(); // barge-in ≤100 ms
    setInterim("");
    sttRef.current.start({ lang: sttLangRef.current });
    setListening(true);
    setOrchMic(true);
  }

  function micStop(): void {
    sttRef.current.stop();
    setListening(false);
    setInterim("");
    setOrchMic(false);
  }

  // Wire callback STT sekali.
  useEffect(() => {
    stt.onInterim = (text) => setInterim(text);
    stt.onFinal = (result) => {
      setListening(false);
      setInterim("");
      setOrchMic(false);
      const fixed = applyDict(result.transcript, loadDict());
      if (!isSpeakable(fixed)) return; // transkrip kosong → abaikan, jangan kirim pesan invalid
      // Jawaban suara untuk pilihan tunggal form (bila ada form menunggu).
      const pendingForm = agentRef.current.pendingForms[0];
      if (pendingForm) {
        const ans = matchFormAnswer(
          fixed,
          pendingForm.fields as Array<{ key?: string; title?: string; type?: string; options?: Array<{ value: string; label?: string }> }>,
        );
        if (ans) {
          pushSystem(`Perintah suara: jawab ${ans.value}`);
          setToast({ msg: `Perintah suara: jawab ${ans.value}`, key: Date.now() });
          sendRef.current({ type: "form.reply", formID: pendingForm.formID, answer: { [ans.key]: ans.value } });
          return;
        }
      }
      const action = matchCommand(fixed, {
        busy: busyRef.current,
        ttsSpeaking: (levelRef.current ?? 0) > 0,
        pending: agentRef.current.pendingPermissions.map((p) => ({ requestID: p.requestID, risk: p.risk })),
        muted: mutedRef.current,
      });
      if (action.kind === "text") {
        if (sendModeRef.current === "auto") {
          void sendWithAutoSubmit(action.text);
        } else {
          setVoiceDraft({ text: action.text, key: `v-${Date.now()}` });
        }
        return;
      }
      handleVoiceAction(action);
    };
    stt.onError = (code) => {
      setListening(false);
      setInterim("");
      setOrchMic(false);
      if (code === "MIC_DENIED" || code === "NOT_SUPPORTED") setMicDenied(true);
      else pushSystem(`Mic bermasalah (${code}). Coba lagi atau pakai chat teks.`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stt]);

  function handleVoiceAction(action: Exclude<ReturnType<typeof matchCommand>, { kind: "text" }>): void {
    pushSystem(actionLabel(action));
    setToast({ msg: actionLabel(action), key: Date.now() });
    switch (action.kind) {
      case "interrupt":
        engineRef.current?.cancel();
        sendRef.current({ type: "agent.interrupt" });
        break;
      case "permAllow":
        sendRef.current({ type: "permission.reply", requestID: action.requestID, decision: "once", via: "voice" });
        break;
      case "permReject":
        sendRef.current({ type: "permission.reply", requestID: action.requestID, decision: "reject", via: "voice" });
        break;
      case "repeat": {
        const last = lastSpeakRef.current;
        if (last) engineRef.current?.speak(`repeat-${Date.now()}`, last.text, last.priority);
        break;
      }
      case "mute":
        setMuted(action.to);
        break;
    }
  }

  async function sendWithAutoSubmit(text: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 600));
    sendText(text, "queue");
  }

  function sendText(text: string, delivery: "queue" | "steer"): void {
    engineRef.current?.cancel();
    pushUser(text);
    sendRef.current({ type: "user.message", text, source: "voice", locale: sttLangRef.current, delivery });
  }

  function setMuted(m: boolean): void {
    setMutedState(m);
    localStorage.setItem("codepet.muted", m ? "1" : "0");
    engine?.setSettings({ muted: m });
    if (m) engine?.cancel();
  }

  function changeVerbosity(v: Verbosity): void {
    setVerbosity(v);
    localStorage.setItem("codepet.verbosity", v);
    send({ type: "settings.update", settings: { verbosity: v } });
  }

  const offline = info.ocStatus === "down" || status !== "open";
  const busy = agent.phase === "busy" || agent.phase === "awaiting";
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const agentRef = useRef(agent);
  agentRef.current = agent;
  const levelRef = useRef(level);
  levelRef.current = level;
  const sendModeRef = useRef(sendMode);
  sendModeRef.current = sendMode;
  const sttLangRef = useRef(sttLang);
  sttLangRef.current = sttLang;
  const headphoneRef = useRef(headphone);
  headphoneRef.current = headphone;
  const offlineRef = useRef(offline);
  offlineRef.current = offline;
  const infoRef = useRef(info);
  infoRef.current = info;

  function pickDir(dir: string, sessionID?: string): void {
    saveDirHistory([dir, ...loadDirHistory().filter((d) => d !== dir)]);
    setShowOnboard(false);
    send({ type: "session.select", directory: dir, ...(sessionID ? { sessionID } : {}) });
  }

  function openOnboard(): void {
    setShowOnboard(true);
    send({ type: "session.list" });
  }

  function toggleMini(): void {
    const next = !mini;
    setMini(next);
    setShowChat(!next);
    localStorage.setItem("codepet.mini", next ? "1" : "0");
  }

  return (
    <div className={mini ? "app mini" : "app"}>
      <StatusBar
        conn={status}
        ocStatus={info.ocStatus}
        ocVersion={info.ocVersion}
        directory={info.directory}
        agent={info.agent ?? "—"}
        model={info.model ?? "—"}
        onDir={openOnboard}
        onOpenSettings={() => setShowSettings(true)}
        onToggleMini={toggleMini}
        mini={mini}
      />
      {offline && (
        <div className="banner" role="alert" data-testid="offline-banner">
          {t.offlineBanner}
        </div>
      )}
      {showOnboard && (
        <Onboarding
          recent={info.recentDirs}
          sessions={sessions}
          onPick={pickDir}
        />
      )}
      <SettingsPanel
        bridgeHttp={bridgeHttp} onBridgeHttp={setBridgeHttp} open={showSettings} onClose={() => setShowSettings(false)}
        engine={engine} verbosity={verbosity} onVerbosity={changeVerbosity} muted={muted} onMuted={setMuted}
        theme={theme} onTheme={setTheme} locale={locale} onLocale={(v) => { setLocale(v); localStorage.setItem("codepet.locale", v); send({ type: "settings.update", settings: { locale: v } }); }}
        sttLang={sttLang} onSttLang={(v) => { setSttLang(v); localStorage.setItem("codepet.stt-lang", v); }}
        sendMode={sendMode} onSendMode={(v) => { setSendMode(v); localStorage.setItem("codepet.send-mode", v); }}
        headphone={headphone} onHeadphone={(v) => { setHeadphone(v); localStorage.setItem("codepet.headphone", v ? "1" : "0"); }}
        avatarSize={avatarSize}
        onAvatarSize={(v) => { setAvatarSize(v); localStorage.setItem("codepet.avatar-size", v); }}
        dictText={dictText} onDictText={(v) => {
          setDictText(v);
          const d: Record<string, string> = {};
          for (const line of v.split("\n")) {
            const m = line.split(/->|=>|=/);
            if (m.length >= 2 && (m[0]?.trim() ?? "") && (m[1]?.trim() ?? "")) {
              d[m[0]!.trim().toLowerCase()] = m[1]!.trim();
            }
          }
          saveDict(d);
        }}
      />
      <main className="layout">
        <div className={`left avatar-${avatarSize}`}>
          {mini && (
            <button type="button" className="chat-fab" onClick={() => setShowChat((v) => !v)} data-testid="chat-fab" aria-label="chat">
              💬
            </button>
          )}
          <AvatarStage
            pose={snap.pose}
            variant={snap.variant}
            mood={snap.mood}
            level={level}
            theme={effectiveTheme}
            locale={locale}
          />
          {listening && (
            <p className="mic-caption" aria-live="polite" data-testid="mic-caption">
              🎤 {interim || "Mendengarkan…"}
            </p>
          )}
          {!stt.supported && (
            <p className="warn" data-testid="mic-unavailable">
              Mic tidak tersedia — chat teks tetap jalan.
            </p>
          )}
          <ActivityFeed items={feed} />
          {agent.pendingPermissions.map((p) => (
            <ApprovalCard key={p.requestID} perm={p} onReply={(requestID, decision) => send({ type: "permission.reply", requestID, decision, via: "click" })} />
          ))}
          {agent.pendingForms.map((f) => (
            <FormCard
              key={f.formID}
              form={f}
              onReply={(formID, answer) => send({ type: "form.reply", formID, answer })}
              onCancel={(formID) => send({ type: "form.cancel", formID })}
            />
          ))}
        </div>
        {(!mini || showChat) && (
        <div className={`right${mini && showChat ? " open" : ""}`}>
          <ChatPanel
            disabled={offline || !info.directory}
            busy={busy}
            onSend={(text, delivery) => {
              engine?.cancel(); // antrean usang dibuang saat prompt baru
              pushUser(text);
              send({ type: "user.message", text, source: "chat", locale: "id-ID", delivery });
            }}
            onStop={() => {
              engine?.cancel(); // interrupt menghentikan suara seketika
              send({ type: "agent.interrupt" });
            }}
            externalDraft={voiceDraft}
            mic={{ listening, disabled: !stt.supported, onDown: micStart, onUp: micStop }}
          />
          {toast && (
            <p className="toast" role="status" data-testid="voice-toast">
              {toast.msg}
            </p>
          )}
          <ChangesCard files={diffs} onClose={clearDiffs} />
          {errors.length > 0 && (
            <ul className="errors" aria-live="assertive">
              {errors.map((e, i) => (
                <li key={i}>{humanError(e.split(":")[0] ?? "", e, locale)}</li>
              ))}
            </ul>
          )}
          <span className="chat-count" data-testid="chat-count">
            {chat.length}
          </span>
        </div>
        )}
      </main>
    </div>
  );
}

export function App(): JSX.Element {
  const [locale, setLocale] = useState<Locale>(() => (localStorage.getItem("codepet.locale") === "en" ? "en" : "id"));
  return (
    <LocaleProvider value={locale}>
      <AppProvider key={locale}>
        <Shell locale={locale} setLocale={setLocale} />
      </AppProvider>
    </LocaleProvider>
  );
}
