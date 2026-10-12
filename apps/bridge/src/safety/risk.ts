import {
  accessesSecrets,
  hasDynamic,
  isDangerousGit,
  isDestructive,
  isDestructiveSql,
  isGlobalInstall,
  isOutsideDir,
  isPipeToShell,
  isPrivileged,
  isSafeReadCommand,
  segments,
  writesToSystem,
} from "./risk-patterns.js";

export type Risk = "low" | "medium" | "high";

export interface ClassifyInput {
  action: string;
  resources: string[];
  /** Direktori proyek sesi (untuk tulis-luar-deteksi). */
  directory: string | undefined;
}

/**
 * Klasifikasi risiko FAIL-SAFE: ragu → naikkan satu tingkat (PRD §10.1).
 * - low: baca/daftar di dalam proyek.
 * - medium: edit/tulis di dalam proyek, shell aman, baca di luar proyek.
 * - high: pola §10.1 (destruktif, eskalasi, git berbahaya, pipe-to-shell,
 *   tulis di luar proyek, instal global, SQL destruktif, rahasia, redirect sistem).
 */
export function classifyRisk(input: ClassifyInput): Risk {
  const action = input.action.toLowerCase();
  const dir = input.directory ?? "";

  // Aksi baca/daftar murni.
  if (["read", "glob", "grep", "list", "ls"].includes(action)) {
    const targets = input.resources.length > 0 ? input.resources : [""];
    if (targets.some((t) => accessesSecrets(t))) return "high";
    if (dir && targets.some((t) => t && isOutsideDir(t, dir))) return "medium";
    return "low";
  }

  // Aksi tulis/edit.
  if (["edit", "write", "patch", "multiedit", "execute"].includes(action)) {
    const targets = input.resources.length > 0 ? input.resources : [""];
    if (targets.some((t) => accessesSecrets(t))) return "high";
    if (dir && targets.some((t) => t && isOutsideDir(t, dir))) return "high";
    if (action === "execute") return classifyShell(targets.join(" "), dir);
    return "medium";
  }

  // Aksi shell generik.
  if (["shell", "bash", "run", "command"].includes(action)) {
    return classifyShell(input.resources.join(" "), dir);
  }

  // Direktori eksternal eksplisit (hak akses agent build).
  if (action === "external_directory") {
    const joined = input.resources.join(" ");
    if (/writ|edit|patch|rm|del|creat|mkdir|touch|>|install/i.test(joined)) return "high";
    if (hasDynamic(joined)) return "high";
    return "medium";
  }

  // Tak dikenal → medium (fail-safe: bertanya, bukan diam-diam jalan).
  return "medium";
}

function classifyShell(cmd: string, dir: string): Risk {
  if (!cmd.trim()) return "medium";
  // Pola lintas-segmen dicek pada perintah UTUH sebelum dipecah.
  if (isPipeToShell(cmd)) return "high";
  const segs = segments(cmd);
  let worst: Risk = "low";
  for (const seg of segs) {
    const r = classifySegment(seg, dir);
    if (r === "high") return "high";
    if (r === "medium") worst = "medium";
  }
  return worst;
}

function classifySegment(seg: string, dir: string): Risk {
  if (
    isDestructive(seg) ||
    isPrivileged(seg) ||
    isDangerousGit(seg) ||
    isPipeToShell(seg) ||
    isDestructiveSql(seg) ||
    isGlobalInstall(seg) ||
    writesToSystem(seg) ||
    hasDynamic(seg)
  ) {
    return "high";
  }
  // Tulis ke luar proyek via redirect.
  if (dir) {
    const m = seg.match(/>\s*([^\s|&;]+)/);
    if (m?.[1] && isOutsideDir(m[1], dir)) return "high";
  }
  if (isSafeReadCommand(seg)) return "low";
  // Perintah shell biasa (npm test, git status, echo, ls, ...): medium.
  return "medium";
}
