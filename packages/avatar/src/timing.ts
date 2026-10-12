/**
 * timing.ts -- SATU-SATUNYA tempat angka waktu/amplitudo animasi avatar.
 * Semua nilai berasal dari CHARACTER.md §§4-10. Jangan menaruh angka
 * waktu di luar file ini (kontrak §12).
 */

export interface Timing {
  ease: {
    soft: string;
    out: string;
    pop: string;
    fall: string;
    inOut: string;
    linear: string;
  };
  transition: {
    poseMs: number;
    eyeMouthMs: number;
    handLayerMs: number;
  };
  idle: {
    float: { periodMs: number; jitter: number; ampY: number };
    sway: { periodMs: number; deg: number };
    shadow: { scaleX: number; opacityFrom: number; opacityTo: number };
    hands: { amp: number; lagLms: number; lagRms: number };
    blink: {
      closeMs: number;
      openMs: number;
      minIntervalMs: number;
      maxIntervalMs: number;
      doubleChance: number;
      doubleGapMs: number;
      slowChance: number;
      slowCloseMs: number;
    };
    lampStandby: { periodMs: number; opacityFrom: number; opacityTo: number };
    glance: {
      minIntervalMs: number;
      maxIntervalMs: number;
      holdMinMs: number;
      holdMaxMs: number;
      x: number;
      y: number;
    };
    wave: {
      minIntervalMs: number;
      maxIntervalMs: number;
      handRChance: number;
      anticipateMs: number;
      raiseMs: number;
      waveMs: number;
      waveHalfCycles: number;
      waveHalfMs: number;
      returnMs: number;
      raiseR: { dx: number; dy: number };
      raiseL: { dx: number; dy: number };
      waveDeg: number;
      tiltDeg: number;
    };
  };
  thinking: {
    float: { periodMs: number; jitter: number; ampY: number; tiltDeg: number };
    handToChinMs: number;
    chin: {
      dx: number; dy: number; rubX: number; rubY: number; rubDeg: number;
      rubs: number; rubMs: number; stillMs: number;
      pauseMinMs: number; pauseMaxMs: number;
    };
    eyesGlance: { minMs: number; maxMs: number; moveMs: number; x: number; y: number };
    lampPulseMs: number;
    dots: {
      cycleMs: number; appearMs: number; staggerMs: number;
      pulseMs: number; holdMs: number; fadeMs: number; stopFadeMs: number;
    };
  };
  working: {
    typing: {
      periodMs: number; phaseDelayMs: number; burstPeriodMs: number;
      burstMinMs: number; burstMaxMs: number;
      pauseMinMs: number; pauseMaxMs: number;
      pressY: number; squashY: number;
    };
    enter: { everyBurstsMin: number; everyBurstsMax: number; nodMs: number; nodY: number };
    keyHighlightMs: number;
    body: { floatAmp: number; floatPeriodMs: number; bowDeg: number };
    eyes: {
      sweepMs: number; blinkAtMs: number; returnMs: number;
      cycleMs: number; jitter: number; lineShiftEvery: number;
    };
  };
  asking: {
    raiseMs: number;
    anticipateY: number;
    shakeDeg: number;
    shakeMs: number;
    shakes: number;
    shakePauseMs: number;
    escalatedShakeDeg: number;
    body: { scale: number; rotateDeg: number; floatAmp: number; floatPeriodMs: number };
    qBubble: {
      cycleMs: number; jitter: number; appearMs: number;
      wobbleDeg: number; wobblePeriodMs: number; fadeMs: number;
    };
    lampDouble: { onMs: number; offMs: number; on2Ms: number; restMs: number };
    escalateAtMs: number;
    escalatedCycleMs: number;
  };
  celebrate: {
    durationMs: number;
    float: { periodMs: number; jitter: number; ampY: number };
    hands: { periodMs: number; ampY: number; rotDeg: number };
    jump: { everyBursts: number; height: number; anticipate: number; landSquashY: number; ms: number };
    lampPulseMs: number;
    confetti: {
      pool: number;
      burstIntervalMs: number;
      originX: number;
      originY: number;
      angleFrom: number;
      angleTo: number;
      angleJitter: number;
      distMin: number;
      distMax: number;
      fall: number;
      durMinMs: number;
      durMaxMs: number;
      appearMs: number;
    };
  };
  confused: {
    durationMs: number;
    mouthWave: { periodMs: number; waveLength: number; amp: number; travel: number };
    scratch: {
      targetX: number; targetY: number; enterMs: number;
      scrubs: number; scrubMs: number; scrubX: number; scrubY: number;
      scrubDeg: number; pauseMs: number;
    };
    handTremble: { amp: number; periodMs: number };
    body: { shakeX: number; shakeDeg: number; shakePeriodMs: number; floatAmp: number };
    eyesSearch: { x: number; periodMs: number };
    sweat: {
      cycleMs: number; jitter: number; appearMs: number; riseMs: number; riseY: number;
      fallMs: number; fallY: number; fadeMs: number; delay2Ms: number;
    };
    lampFast: { hz: number; onMs: number; offMs: number; pauseMs: number };
  };
  speaking: {
    mouth: { lerp: number; closeThreshold: number; stopCloseMs: number };
    arcs: { cycleMs: number; jitter: number; staggerMs: number; appearMs: number; peakOpacity: number };
    lampHz: number;
    rippleMs: number;
    bodyNod: number;
    beatMs: number;
    beatY: number;
    stopFadeMs: number;
  };
  sleeping: {
    lamp: { periodMs: number; opacityFrom: number; opacityTo: number };
    zzz: {
      cycleMs: number; staggerMs: number; appearMs: number;
      driftMs: number; driftY: number; fadeMs: number;
    };
    twitch: { minMs: number; maxMs: number; amp: number };
    snot: { minMs: number; maxMs: number; growMs: number; popMs: number; r: number };
    antennaDroopDeg: number;
  };
  listening: {
    body: { rotateDeg: number; scale: number; floatAmp: number; floatPeriodMs: number };
    arcs: { cycleMs: number; staggerMs: number; travel: number };
    nodMs: number;
  };
  offline: {
    redBlinkMs: number;
    redIntervalMs: number;
    antennaDroopDeg: number;
    fadeMs: number;
  };
  director: {
    gapMinMs: number;
    gapMaxMs: number;
    sleepAfterMs: number;
    behaviors: Record<string, { weight: number; cooldownMs: number; durationMs: number }>;
  };
  mood: { ttlMs: number };
  react: {
    hello: { appearMs: number };
    nod: { ms: number; y: number };
    perk: { ms: number };
    startle: { jumpY: number; ms: number };
    shrug: { ms: number; y: number };
    thanks: { ms: number };
    poke: {
      window1Ms: number;
      window3Ms: number;
      squashMs: number;
      totalMs: number;
      annoyedMs: number;
      dizzyMs: number;
      dizzyCooldownMs: number;
    };
  };
  reduced: { blinkMs: number; slowPulseMs: number };
}

export const T: Timing = {
  ease: {
    soft: "cubic-bezier(.45,0,.55,1)",
    out: "cubic-bezier(.22,1,.36,1)",
    pop: "cubic-bezier(.34,1.56,.64,1)",
    fall: "cubic-bezier(.5,0,.9,.6)",
    inOut: "cubic-bezier(.65,0,.35,1)",
    linear: "linear",
  },
  transition: { poseMs: 280, eyeMouthMs: 120, handLayerMs: 80 },

  idle: {
    float: { periodMs: 3200, jitter: 0.15, ampY: 4 },
    sway: { periodMs: 6400, deg: 1 },
    shadow: { scaleX: 0.9, opacityFrom: 0.14, opacityTo: 0.09 },
    hands: { amp: 3, lagLms: 350, lagRms: 700 },
    blink: {
      closeMs: 60, openMs: 60,
      minIntervalMs: 2500, maxIntervalMs: 5500,
      doubleChance: 0.15, doubleGapMs: 180,
      slowChance: 0.1, slowCloseMs: 220,
    },
    lampStandby: { periodMs: 4000, opacityFrom: 0.75, opacityTo: 1 },
    glance: {
      minIntervalMs: 4000, maxIntervalMs: 9000,
      holdMinMs: 600, holdMaxMs: 1400, x: 3, y: 2,
    },
    wave: {
      minIntervalMs: 8000, maxIntervalMs: 14000, handRChance: 0.7,
      anticipateMs: 120, raiseMs: 280, waveMs: 880,
      waveHalfCycles: 4, waveHalfMs: 220, returnMs: 320,
      raiseR: { dx: 8, dy: -48 }, raiseL: { dx: -8, dy: -44 },
      waveDeg: 20, tiltDeg: 1.5,
    },
  },

  thinking: {
    float: { periodMs: 4000, jitter: 0.15, ampY: 3, tiltDeg: -3 },
    handToChinMs: 350,
    chin: {
      dx: -44, dy: 0, rubX: 2.5, rubY: 1.5, rubDeg: 8,
      rubs: 3, rubMs: 300, stillMs: 1200,
      pauseMinMs: 900, pauseMaxMs: 1600,
    },
    eyesGlance: { minMs: 2500, maxMs: 4000, moveMs: 400, x: 4, y: -4 },
    lampPulseMs: 2000,
    dots: {
      cycleMs: 1800, appearMs: 180, staggerMs: 350,
      pulseMs: 150, holdMs: 650, fadeMs: 250, stopFadeMs: 150,
    },
  },

  working: {
    typing: {
      // burstPeriodMs 160 (bukan 140): offset antar-tangan 80 ms agar memenuhi
      // kriteria §6.3 "selisih fase ≥ 0,08 s" (140 ms hanya memberi 70 ms).
      periodMs: 220, phaseDelayMs: 110, burstPeriodMs: 160,
      burstMinMs: 1200, burstMaxMs: 2000,
      pauseMinMs: 400, pauseMaxMs: 900,
      pressY: -5, squashY: 0.94,
    },
    enter: { everyBurstsMin: 3, everyBurstsMax: 5, nodMs: 150, nodY: 2 },
    keyHighlightMs: 80,
    body: { floatAmp: 1.5, floatPeriodMs: 3600, bowDeg: 2 },
    eyes: {
      sweepMs: 1400, blinkAtMs: 1520, returnMs: 250,
      cycleMs: 1900, jitter: 0.15, lineShiftEvery: 3,
    },
  },

  asking: {
    raiseMs: 350, anticipateY: 2,
    shakeDeg: 8, shakeMs: 260, shakes: 3, shakePauseMs: 900,
    escalatedShakeDeg: 12,
    body: { scale: 1.03, rotateDeg: 3, floatAmp: 3, floatPeriodMs: 2600 },
    qBubble: {
      cycleMs: 1600, jitter: 0.15, appearMs: 250,
      wobbleDeg: 6, wobblePeriodMs: 350, fadeMs: 250,
    },
    lampDouble: { onMs: 120, offMs: 80, on2Ms: 120, restMs: 1280 },
    escalateAtMs: 20000,
    escalatedCycleMs: 1100,
  },

  celebrate: {
    durationMs: 3000,
    float: { periodMs: 1600, jitter: 0.1, ampY: 6 },
    hands: { periodMs: 800, ampY: 12, rotDeg: 12 },
    jump: { everyBursts: 3, height: 14, anticipate: 3, landSquashY: 0.94, ms: 500 },
    lampPulseMs: 800,
    confetti: {
      pool: 24,
      burstIntervalMs: 1500,
      originX: 100, originY: 56,
      angleFrom: -160, angleTo: -20, angleJitter: 8,
      distMin: 55, distMax: 90,
      fall: 40,
      durMinMs: 1300, durMaxMs: 1700,
      appearMs: 80,
    },
  },

  confused: {
    durationMs: 4000,
    mouthWave: { periodMs: 700, waveLength: 16, amp: 3, travel: 16 },
    scratch: {
      targetX: 136, targetY: 76, enterMs: 300,
      scrubs: 5, scrubMs: 140, scrubX: 5, scrubY: 2,
      scrubDeg: 10, pauseMs: 800,
    },
    handTremble: { amp: 1, periodMs: 250 },
    body: { shakeX: 3, shakeDeg: 3, shakePeriodMs: 1600, floatAmp: 2 },
    eyesSearch: { x: 3, periodMs: 1200 },
    sweat: {
      cycleMs: 1800, jitter: 0.15, appearMs: 200, riseMs: 150, riseY: -4,
      fallMs: 1150, fallY: 22, fadeMs: 150, delay2Ms: 900,
    },
    lampFast: { hz: 4, onMs: 125, offMs: 125, pauseMs: 800 },
  },

  speaking: {
    mouth: { lerp: 0.35, closeThreshold: 0.08, stopCloseMs: 100 },
    arcs: { cycleMs: 1200, jitter: 0.15, staggerMs: 200, appearMs: 180, peakOpacity: 0.85 },
    lampHz: 2,
    rippleMs: 500,
    bodyNod: 1.5,
    beatMs: 250,
    beatY: -6,
    stopFadeMs: 150,
  },

  sleeping: {
    lamp: { periodMs: 4500, opacityFrom: 0.35, opacityTo: 0.6 },
    zzz: {
      cycleMs: 3000, staggerMs: 500, appearMs: 300,
      driftMs: 1200, driftY: -4, fadeMs: 500,
    },
    twitch: { minMs: 20000, maxMs: 40000, amp: 1 },
    snot: { minMs: 10000, maxMs: 15000, growMs: 2000, popMs: 120, r: 6 },
    antennaDroopDeg: -10,
  },

  listening: {
    body: { rotateDeg: 2, scale: 1.02, floatAmp: 2, floatPeriodMs: 2400 },
    arcs: { cycleMs: 1200, staggerMs: 200, travel: 6 },
    nodMs: 200,
  },

  offline: {
    redBlinkMs: 150,
    redIntervalMs: 3000,
    antennaDroopDeg: -12,
    fadeMs: 300,
  },

  director: {
    gapMinMs: 3000,
    gapMaxMs: 8000,
    sleepAfterMs: 120000,
    behaviors: {
      lookAround: { weight: 30, cooldownMs: 12000, durationMs: 1000 },
      antennaWiggle: { weight: 15, cooldownMs: 20000, durationMs: 800 },
      waveR: { weight: 12, cooldownMs: 25000, durationMs: 1600 },
      waveL: { weight: 8, cooldownMs: 25000, durationMs: 1600 },
      stretch: { weight: 8, cooldownMs: 40000, durationMs: 1400 },
      hum: { weight: 7, cooldownMs: 40000, durationMs: 2000 },
      miniJump: { weight: 5, cooldownMs: 40000, durationMs: 500 },
      antennaSpin: { weight: 5, cooldownMs: 60000, durationMs: 1000 },
      yawn: { weight: 10, cooldownMs: 60000, durationMs: 1600 },
    },
  },

  mood: { ttlMs: 10000 },

  react: {
    hello: { appearMs: 400 },
    nod: { ms: 280, y: 3 },
    perk: { ms: 300 },
    startle: { jumpY: -8, ms: 220 },
    shrug: { ms: 600, y: 6 },
    thanks: { ms: 300 },
    poke: {
      window1Ms: 2000,
      window3Ms: 3000,
      squashMs: 100,
      totalMs: 360,
      annoyedMs: 600,
      dizzyMs: 500,
      dizzyCooldownMs: 8000,
    },
  },

  reduced: { blinkMs: 60, slowPulseMs: 3000 },
};
