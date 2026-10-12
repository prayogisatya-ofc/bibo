/**
 * Pola berbahaya untuk klasifikasi risiko (PRD §10.1).
 * Strategi anti-pengelabuan: selain regex pada perintah asli, semua pemeriksaan
 * kata kunci juga dijalankan pada bentuk "squash" (huruf-angka saja, lowercase)
 * sehingga spasi/quote sisipan seperti r'm' -rf tetap tertangkap.
 */

export function squash(cmd: string): string {
  return cmd.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Pecah perintah majemuk menjadi segmen (;, &&, ||, pipa, newline). */
export function segments(cmd: string): string[] {
  return cmd
    .split(/;|&&|\|\||\| |\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Konstruksi dinamis shell: variabel, substitusi, backtick, eval. */
export function hasDynamic(cmd: string): boolean {
  return (
    /\$\{|\$\(|`[^`]*`|\$\w|eval\s|exec\s*\(|source\s/.test(cmd) ||
    /\$\*/.test(cmd)
  );
}

/** Kata kunci destruktif (dicocokkan pada squash: huruf-angka saja). */
const DESTRUCTIVE_SQUASH = [
  "rmrf", // rm -rf, rm-rf, r'm' -rf, ...
  "rmdir",
  "mkfs",
  "ddof=",
  "shutdown",
  "reboot",
  "halt",
  "poweroff",
  "fdisk",
  "chmodr",
  "chmod777",
  "chownr",
  "dels",
  "deltree",
  "formatc",
];

export function isDestructive(cmd: string): boolean {
  const sq = squash(cmd);
  if (DESTRUCTIVE_SQUASH.some((k) => sq.includes(k))) return true;
  if (/\brm\s+(-[a-z]*r[a-z]*\s+)?(-\/|\/\s|\*\s*$|\.\s*$)/i.test(cmd)) return true; // rm -r /, rm *
  if (/: *\(\) *\{ *: *\| *: *& *\} *; *:/.test(cmd)) return true; // fork bomb
  return false;
}

/** Perintah istimewa / eskalasi. */

export function isPrivileged(cmd: string): boolean {
  if (/\b(sudo|doas|runas)\b/i.test(cmd)) return true;
  const sq = squash(cmd);
  if (sq.startsWith("sudo") || sq.startsWith("doas")) return true;
  if (sq.includes("setuid")) return true;
  return /\bsu\s+(-\s*)?root\b/i.test(cmd);
}

/** Git destruktif. */
const GIT_DANGEROUS_SQUASH = [
  "pushforce",
  "pushf",
  "resethard",
  "cleanfd",
  "cleanfdx",
  "rebase",
  "filterbranch",
  "pushorigin",
];

export function isDangerousGit(cmd: string): boolean {
  const sq = squash(cmd);
  if (!sq.includes("git")) return false;
  if (sq.includes("gitpush")) return true; // semua push = high (PRD §10.1)
  return GIT_DANGEROUS_SQUASH.some((k) => sq.includes(k));
}

/** Unduh-lalu-eksekusi. */
export function isPipeToShell(cmd: string): boolean {
  const low = ` ${cmd.toLowerCase()} `;
  const fetch = ["curl", "wget", "aria2c", "httpie"].some((f) => new RegExp(`\\b${f}\\b`).test(low));
  if (!fetch) return false;
  if (!/[|]/.test(cmd)) return false;
  return /\b(sh|bash|zsh|fish|pwsh|powershell|cmd)\b/.test(low);
}

/** SQL destruktif. */
export function isDestructiveSql(cmd: string): boolean {
  return /\b(drop\s+(table|database|schema)|truncate\s+table|delete\s+from\s+\w+\s*;?\s*$)/i.test(cmd);
}

/** Redirect tulis ke lokasi sistem. */
const SYSTEM_DIRS = ["/etc/", "/usr/", "/bin/", "/sbin/", "/boot/", "/dev/", "/proc/", "/sys/", "/root/", "c:\\windows", "c:/windows"];
export function writesToSystem(cmd: string): boolean {
  const low = cmd.toLowerCase();
  if (!/[>]/.test(cmd)) return false;
  return SYSTEM_DIRS.some((d) => low.includes(d));
}

/** Instalasi global. */
export function isGlobalInstall(cmd: string): boolean {
  const sq = squash(cmd);
  if (sq.includes("installg") || sq.includes("installglobal")) return true;
  if (sq.includes("pipinstall") && !sq.includes("user") && !sq.includes("venv")) return true;
  if (/\b(gem|apt-get|brew|choco|scoop|apk|yum|dnf)\b.*\binstall\b/i.test(cmd)) return true;
  return false;
}

/** Akses rahasia: .env, kunci, SSH. */
export function accessesSecrets(path: string): boolean {
  const low = path.toLowerCase();
  const base = low.split("/").pop() ?? low;
  return (
    base === ".env" ||
    base.startsWith(".env.") ||
    base.endsWith(".pem") ||
    base.endsWith(".key") ||
    base === "id_rsa" ||
    base === "id_ed25519" ||
    base === "known_hosts" ||
    base === "authorized_keys" ||
    low.includes(".ssh/") ||
    low.includes("secret") ||
    low.includes("secrets/") ||
    low.includes("credential")
  );
}

/** Di luar direktori proyek? (prefix segmen path, toleran ./ ../). */
export function isOutsideDir(target: string, directory: string): boolean {
  const norm = (p: string): string => {
    const parts: string[] = [];
    for (const seg of p.replace(/\\/g, "/").split("/")) {
      if (seg === "" || seg === ".") continue;
      if (seg === "..") parts.pop();
      else parts.push(seg);
    }
    return `/${parts.join("/")}`;
  };
  const t = norm(target.startsWith("/") ? target : `${directory}/${target}`);
  const d = norm(directory);
  return t !== d && !t.startsWith(`${d}/`);
}

/** Perintah baca/daftar yang jelas aman (kata pertama). */
const SAFE_READ = ["read", "glob", "grep", "list", "ls", "cat", "head", "tail", "find", "stat", "file", "wc", "diff", "echo", "pwd", "whoami", "which", "git"];
export function isSafeReadCommand(cmd: string): boolean {
  const first = cmd.trim().split(/\s+/)[0] ?? "";
  const sq = squash(first);
  if ((SAFE_READ as readonly string[]).includes(sq)) {
    // git saja aman bila subperintahnya baca; git tulis ditangani lain.
    if (sq === "git") return /^\s*git\s+(status|diff|log|show|branch)\b/i.test(cmd);
    return true;
  }
  return false;
}
