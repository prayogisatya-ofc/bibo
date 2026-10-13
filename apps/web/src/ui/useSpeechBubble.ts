import { useCallback, useEffect, useReducer, useRef } from "react";
import { reduceBubble, type Bubble, type BubbleEvent } from "./bubbleState.js";

/** Jeda fade-out setelah ucapan selesai (AGENT-PROMPT-AVATAR-UI §C.4). */
export const BUBBLE_FADE_MS = 1500;

/**
 * Bubble ucapan: reducer murni + timer 1,5 dtk yang menghilangkan bubble
 * setelah `speechend` (selama fade, bubble tetap terlihat dengan opacity 0).
 */
export function useSpeechBubble(): { bubble: Bubble | null; dispatch: (e: BubbleEvent) => void } {
  const [bubble, dispatchRaw] = useReducer(reduceBubble, null);
  const timer = useRef<number | undefined>(undefined);

  const dispatch = useCallback((e: BubbleEvent) => {
    if (e.type === "speechend") {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => dispatchRaw({ type: "faded" }), BUBBLE_FADE_MS);
    } else if (e.type === "speak") {
      window.clearTimeout(timer.current);
    }
    dispatchRaw(e);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { bubble, dispatch };
}
