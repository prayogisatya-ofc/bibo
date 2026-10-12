import { useEffect, useRef } from "react";
import { BotRenderer, type AvatarRenderer } from "@codepet/avatar";
import type { AvatarMood, AvatarPose, WorkingVariant } from "@codepet/avatar";
import { poseLabel } from "../orchestrator/pose.js";
import { character } from "../character.js";
import { rendererRef } from "../avatar/rendererRef.js";

/**
 * Panggung avatar — mount BotRenderer dengan kontrak AvatarRenderer baru
 * (theme, reducedMotion, characterName, getAriaLabel dari i18n).
 * Instance diekspos lewat rendererRef agar App bisa memanggil react().
 */
export function AvatarStage({
  pose,
  variant,
  mood,
  level,
  theme,
  locale,
  size,
}: {
  pose: AvatarPose;
  /** Varian Bekerja; undefined untuk pose non-working. */
  variant: WorkingVariant | undefined;
  mood: AvatarMood;
  /** Level suara 0..1 → overlay Berbicara (mulut parametris); 0 = diam. */
  level: number;
  theme: "light" | "dark";
  locale: "id" | "en";
  /** Ukuran kotak avatar (px); transisi 350ms di CSS (ganti mode). */
  size: number;
}): JSX.Element {
  const boxRef = useRef<HTMLDivElement>(null);
  const localeRef = useRef(locale);
  localeRef.current = locale;

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const r: AvatarRenderer = new BotRenderer();
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    r.mount(box, {
      theme,
      reducedMotion: mq.matches,
      characterName: character.name,
      getAriaLabel: (p, v) => `${character.name}: ${poseLabel(p, v, localeRef.current)}`,
    });
    rendererRef.current = r;
    const onMotion = (): void => r.setReducedMotion(mq.matches);
    mq.addEventListener("change", onMotion);
    return () => {
      mq.removeEventListener("change", onMotion);
      r.destroy();
      if (rendererRef.current === r) rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rendererRef.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    rendererRef.current?.setPose(pose, variant === undefined ? undefined : { variant });
  }, [pose, variant]);

  useEffect(() => {
    rendererRef.current?.setMood(mood);
  }, [mood]);

  useEffect(() => {
    rendererRef.current?.setSpeechLevel(level);
  }, [level]);

  const caption = poseLabel(pose, variant, locale);
  return (
    <div className="avatar-anim" style={{ width: size, height: size }}>
      <div
        className="avatar-live avatar-box"
        ref={boxRef}
        role="img"
        aria-label={`${character.name}: ${caption}`}
        data-testid="bibo-svg"
      />
    </div>
  );
}
