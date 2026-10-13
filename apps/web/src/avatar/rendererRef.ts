import type { AvatarRenderer } from "@bibo/avatar";

/**
 * Instance renderer avatar yang sedang aktif (satu-satunya).
 * Dipakai App handlers untuk memanggil react(): nod saat prompt terkirim,
 * perk saat mic ditekan, thanks saat izin diberikan, hello saat pertama
 * kali terhubung. Diisi/dikosongkan oleh AvatarStage saat mount/unmount.
 */
export const rendererRef: { current: AvatarRenderer | null } = { current: null };
