import { useEffect, useMemo, useRef, useState } from "react";
import { createActor } from "xstate";
import type { BridgeMessage } from "@codepet/protocol";
import type { AvatarMood, AvatarPose, WorkingVariant } from "@codepet/avatar";
import { eventsFromBridge, machine, snapshotPose } from "./machine.js";

/**
 * Jahitan (seam) fase D untuk fase C (PRD §8.2, CHARACTER.md §11).
 * `speaking` adalah overlay Berbicara, BUKAN pose — renderer menggerakkan
 * mulut parametris + busur suara dari level TTS, sedangkan pose dasar
 * (badan/tangan) datang dari `pose`/`variant`.
 */
export interface OrchestratorSnapshot {
  pose: AvatarPose;
  variant?: WorkingVariant;
  speaking: boolean;
  mood: AvatarMood;
}

/** Actor XState + pose turunannya. Panggil feed(m) untuk setiap pesan bridge. */
export function useOrchestrator(): {
  snap: OrchestratorSnapshot;
  feed: (m: BridgeMessage) => void;
  mic: (on: boolean) => void;
} {
  const actorRef = useRef<ReturnType<typeof createActor<typeof machine>> | undefined>(undefined);
  if (!actorRef.current) {
    actorRef.current = createActor(machine);
    actorRef.current.start();
  }
  const [snap, setSnap] = useState<OrchestratorSnapshot>({ pose: "offline", speaking: false, mood: "neutral" });

  useEffect(() => {
    const actor = actorRef.current;
    if (!actor) return;
    const sub = actor.subscribe(() => {
      setSnap(snapshotPose(actor.getSnapshot().context, Date.now()));
    });
    // TICK tiap 500 ms untuk transient (celebrate/confused), mood, & sleeping.
    const timer = setInterval(() => {
      setSnap(snapshotPose(actor.getSnapshot().context, Date.now()));
    }, 500);
    return () => {
      sub.unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const feed = useMemo(
    () => (m: BridgeMessage) => {
      const actor = actorRef.current;
      if (!actor) return;
      for (const e of eventsFromBridge(m)) actor.send(e);
      setSnap(snapshotPose(actor.getSnapshot().context, Date.now()));
    },
    [],
  );

  const mic = useMemo(
    () => (on: boolean) => {
      const actor = actorRef.current;
      if (!actor) return;
      actor.send({ type: "MIC", on });
      setSnap(snapshotPose(actor.getSnapshot().context, Date.now()));
    },
    [],
  );
  return { snap, feed, mic };
}
