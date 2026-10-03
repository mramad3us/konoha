/**
 * Time-ordered scheduler (binary min-heap). Ties resolve in insertion order.
 * Entries are plain data so the scheduler serializes as an array.
 */

export interface ScheduleEntry {
  tick: number;
  seq: number;
  /** Entity id (>0) for actor turns, or a negative system id. */
  id: number;
}

export class Scheduler {
  private heap: ScheduleEntry[] = [];
  private seq = 0;
  /** Latest scheduled tick per id, so stale entries can be skipped (lazy deletion). */
  private latest = new Map<number, number>();

  get size(): number {
    return this.heap.length;
  }

  /** Schedule (or reschedule) an id. Any earlier entry for the same id becomes stale. */
  schedule(id: number, tick: number): void {
    const seq = ++this.seq;
    this.latest.set(id, seq);
    this.push({ tick, seq, id });
  }

  unschedule(id: number): void {
    this.latest.delete(id);
  }

  isScheduled(id: number): boolean {
    return this.latest.has(id);
  }

  /** Tick of the next live entry for an id, or null. O(n) — debug/UI only. */
  tickOf(id: number): number | null {
    const seq = this.latest.get(id);
    if (seq === undefined) return null;
    for (const e of this.heap) if (e.seq === seq) return e.tick;
    return null;
  }

  /** Peek the next live entry without removing it. */
  peek(): ScheduleEntry | null {
    this.dropStale();
    return this.heap[0] ?? null;
  }

  /** Remove and return the next live entry. The id is no longer scheduled afterwards. */
  pop(): ScheduleEntry | null {
    this.dropStale();
    const top = this.heap[0];
    if (!top) return null;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    this.latest.delete(top.id);
    return top;
  }

  /** Pull every entry earlier than `tick` up to `tick` (after a time skip), keeping order. */
  rebase(tick: number): void {
    for (const e of this.heap) if (e.tick < tick) e.tick = tick;
    // A sorted array is a valid heap; raising ticks can break the parent/child order otherwise.
    this.heap.sort((a, b) => (this.less(a, b) ? -1 : this.less(b, a) ? 1 : 0));
  }

  serialize(): { seq: number; entries: ScheduleEntry[] } {
    const live = this.heap.filter(e => this.latest.get(e.id) === e.seq);
    return { seq: this.seq, entries: live.map(e => ({ ...e })) };
  }

  static deserialize(data: { seq: number; entries: ScheduleEntry[] }): Scheduler {
    const s = new Scheduler();
    s.seq = data.seq;
    for (const e of data.entries) {
      s.latest.set(e.id, e.seq);
      s.push({ ...e });
    }
    return s;
  }

  private dropStale(): void {
    while (this.heap.length > 0) {
      const top = this.heap[0];
      if (this.latest.get(top.id) === top.seq) return;
      const last = this.heap.pop()!;
      if (this.heap.length > 0) {
        this.heap[0] = last;
        this.siftDown(0);
      }
    }
  }

  private less(a: ScheduleEntry, b: ScheduleEntry): boolean {
    return a.tick < b.tick || (a.tick === b.tick && a.seq < b.seq);
  }

  private push(e: ScheduleEntry): void {
    const h = this.heap;
    h.push(e);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(h[i], h[p])) break;
      [h[i], h[p]] = [h[p], h[i]];
      i = p;
    }
  }

  private siftDown(i: number): void {
    const h = this.heap;
    const n = h.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < n && this.less(h[l], h[m])) m = l;
      if (r < n && this.less(h[r], h[m])) m = r;
      if (m === i) return;
      [h[i], h[m]] = [h[m], h[i]];
      i = m;
    }
  }
}
