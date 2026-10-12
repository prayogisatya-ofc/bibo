/**
 * Pengingat izin menunggu (FR-045): SEKALI setelah 60 s tanpa jawaban.
 * Murni + diuji fake timer. TIDAK PERNAH auto-approve.
 */

export class ReminderTracker {
  private firstSeen = new Map<string, number>();
  private reminded = new Set<string>();

  /** Kembalikan requestID yang jatuh tempo diingatkan pada `now`. */
  check(now: number, pendingIDs: string[]): string[] {
    const due: string[] = [];
    const alive = new Set(pendingIDs);
    // Bersihkan yang sudah dijawab/dibatalkan.
    for (const id of [...this.firstSeen.keys()]) {
      if (!alive.has(id)) {
        this.firstSeen.delete(id);
        this.reminded.delete(id);
      }
    }
    for (const id of pendingIDs) {
      if (!this.firstSeen.has(id)) this.firstSeen.set(id, now);
      const seen = this.firstSeen.get(id) ?? now;
      if (!this.reminded.has(id) && now - seen >= 60_000) {
        this.reminded.add(id);
        due.push(id);
      }
    }
    return due;
  }

  reset(): void {
    this.firstSeen.clear();
    this.reminded.clear();
  }
}
