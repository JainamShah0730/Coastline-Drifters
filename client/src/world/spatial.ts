// ─────────────────────────────────────────────────────────────────────────────
// spatial.ts — small, dependency-free data structures used by the hot paths.
//
//  1. SegmentGrid  – uniform-grid index over line segments (the road).
//  2. CircleGrid   – spatial hash for circular obstacles (trees, rocks, ...).
//  3. kNearest     – top-K selection with a bounded max-heap, O(n log k).
//
// NOTE: "erasable" TypeScript only (no parameter properties / enums).
// ─────────────────────────────────────────────────────────────────────────────

export interface Point2 { x: number; z: number }
export interface Circle { cx: number; cz: number; r: number }

// Pack two integer cell coordinates into one number usable as a Map key.
function cellKey(ix: number, iz: number): number {
  return (ix + 4096) * 8192 + (iz + 4096);
}

// ── 1. Segment grid ─────────────────────────────────────────────────────────
export class SegmentGrid {
  private cell: number;
  private inv: number;
  private buckets: Map<number, number[]> = new Map();
  private seg: Float64Array; // x1, z1, x2, z2 per segment

  /**
   * @param points   polyline vertices
   * @param closed   if true, last point connects back to first
   * @param cellSize query radius up to this value is answered exactly
   */
  constructor(points: readonly Point2[], closed: boolean, cellSize: number) {
    this.cell = cellSize;
    this.inv = 1 / cellSize;
    const n = closed ? points.length : points.length - 1;
    this.seg = new Float64Array(n * 4);

    for (let i = 0; i < n; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      this.seg[i * 4] = a.x;
      this.seg[i * 4 + 1] = a.z;
      this.seg[i * 4 + 2] = b.x;
      this.seg[i * 4 + 3] = b.z;

      const x0 = Math.floor(Math.min(a.x, b.x) * this.inv);
      const x1 = Math.floor(Math.max(a.x, b.x) * this.inv);
      const z0 = Math.floor(Math.min(a.z, b.z) * this.inv);
      const z1 = Math.floor(Math.max(a.z, b.z) * this.inv);
      for (let ix = x0; ix <= x1; ix++) {
        for (let iz = z0; iz <= z1; iz++) {
          const k = cellKey(ix, iz);
          let list = this.buckets.get(k);
          if (!list) { list = []; this.buckets.set(k, list); }
          list.push(i);
        }
      }
    }
  }

  get cellSize(): number { return this.cell; }

  /**
   * Squared distance to the nearest segment.
   * Exact whenever the true distance is <= cellSize; if nothing is nearby
   * it returns Infinity (every caller treats that as "far from the road").
   */
  minDistSq(px: number, pz: number): number {
    const cx = Math.floor(px * this.inv);
    const cz = Math.floor(pz * this.inv);
    const s = this.seg;
    let best = Infinity;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = this.buckets.get(cellKey(cx + dx, cz + dz));
        if (!list) continue;
        for (let j = 0; j < list.length; j++) {
          const o = list[j] * 4;
          const x1 = s[o], z1 = s[o + 1], x2 = s[o + 2], z2 = s[o + 3];
          const ex = x2 - x1, ez = z2 - z1;
          const l2 = ex * ex + ez * ez;
          let t = l2 === 0 ? 0 : ((px - x1) * ex + (pz - z1) * ez) / l2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const qx = px - (x1 + t * ex);
          const qz = pz - (z1 + t * ez);
          const d = qx * qx + qz * qz;
          if (d < best) best = d;
        }
      }
    }
    return best;
  }
}

// ── 2. Circle grid (spatial hash) ───────────────────────────────────────────
const EMPTY: readonly number[] = [];

export class CircleGrid {
  private inv: number;
  private buckets: Map<number, number[]> = new Map();

  /**
   * @param circles  obstacles
   * @param cellSize bucket size (≈ 2–4× typical query radius works well)
   * @param margin   extra radius baked into insertion (e.g. the car's radius)
   *                 so a query only ever needs to look at ONE cell.
   */
  constructor(circles: readonly Circle[], cellSize: number, margin: number) {
    this.inv = 1 / cellSize;
    for (let i = 0; i < circles.length; i++) {
      const c = circles[i];
      const R = c.r + margin;
      const x0 = Math.floor((c.cx - R) * this.inv);
      const x1 = Math.floor((c.cx + R) * this.inv);
      const z0 = Math.floor((c.cz - R) * this.inv);
      const z1 = Math.floor((c.cz + R) * this.inv);
      for (let ix = x0; ix <= x1; ix++) {
        for (let iz = z0; iz <= z1; iz++) {
          const k = cellKey(ix, iz);
          let list = this.buckets.get(k);
          if (!list) { list = []; this.buckets.set(k, list); }
          list.push(i); // ascending index order preserved
        }
      }
    }
  }

  /** Indices of every circle whose (radius + margin) overlaps this cell. */
  query(x: number, z: number): readonly number[] {
    return this.buckets.get(cellKey(Math.floor(x * this.inv), Math.floor(z * this.inv))) ?? EMPTY;
  }
}

// ── 3. K nearest via bounded max-heap ───────────────────────────────────────
/** Indices of the k points closest to (x, z), nearest first. O(n log k). */
export function kNearest(points: readonly Point2[], x: number, z: number, k: number): number[] {
  const hd: number[] = []; // max-heap of squared distances
  const hi: number[] = []; // parallel heap of point indices

  const swap = (a: number, b: number) => {
    const td = hd[a]; hd[a] = hd[b]; hd[b] = td;
    const ti = hi[a]; hi[a] = hi[b]; hi[b] = ti;
  };
  const siftUp = (i: number) => {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hd[p] >= hd[i]) break;
      swap(p, i); i = p;
    }
  };
  const siftDown = (i: number) => {
    const n = hd.length;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < n && hd[l] > hd[m]) m = l;
      if (r < n && hd[r] > hd[m]) m = r;
      if (m === i) break;
      swap(m, i); i = m;
    }
  };

  for (let i = 0; i < points.length; i++) {
    const dx = points[i].x - x, dz = points[i].z - z;
    const d = dx * dx + dz * dz;
    if (hd.length < k) {
      hd.push(d); hi.push(i); siftUp(hd.length - 1);
    } else if (d < hd[0]) {
      hd[0] = d; hi[0] = i; siftDown(0);
    }
  }

  // Pop the heap: farthest comes out first, so fill the result back-to-front.
  const out = new Array<number>(hd.length);
  for (let p = hd.length - 1; p >= 0; p--) {
    out[p] = hi[0];
    const lastD = hd.pop()!, lastI = hi.pop()!;
    if (hd.length > 0) { hd[0] = lastD; hi[0] = lastI; siftDown(0); }
  }
  return out;
}
