// Stub speechSynthesis untuk E2E: rekam ucapan, akhiri per utterance ~300 ms.
(() => {
  const spoken = [];
  window.__spoken = spoken;
  window.__ttsCancelled = 0;
  let timer = 0;
  class FakeUtterance {
    constructor(text) {
      this.text = text;
      this.lang = "";
      this.rate = 1;
      this.pitch = 1;
      this.volume = 1;
      this.voice = null;
      this.onend = null;
      this.onerror = null;
      this.onboundary = null;
    }
  }
  const synth = {
    __queue: [],
    speak(u) {
      spoken.push({ text: u.text, at: Date.now() });
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          if (u.onboundary) u.onboundary(2);
        } catch {}
        if (u.onend) u.onend();
      }, 300);
    },
    cancel() {
      window.__ttsCancelled++;
      clearTimeout(timer);
    },
    getVoices() {
      return [{ uri: "id-test", name: "Bahasa Test", lang: "id-ID" }];
    },
    onvoiceschanged: null,
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = FakeUtterance;
})();
