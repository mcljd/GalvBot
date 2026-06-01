import type { CostGrid } from "@/lib/optimizer/grid";

/** Minimal binary min-heap keyed by number priority. */
class MinHeap {
  private ids: number[] = [];
  private prio: number[] = [];

  get size() {
    return this.ids.length;
  }

  push(id: number, p: number) {
    this.ids.push(id);
    this.prio.push(p);
    let i = this.ids.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.prio[parent] <= this.prio[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.ids[0];
    const lastId = this.ids.pop()!;
    const lastP = this.prio.pop()!;
    if (this.ids.length > 0) {
      this.ids[0] = lastId;
      this.prio[0] = lastP;
      let i = 0;
      const n = this.ids.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let s = i;
        if (l < n && this.prio[l] < this.prio[s]) s = l;
        if (r < n && this.prio[r] < this.prio[s]) s = r;
        if (s === i) break;
        this.swap(i, s);
        i = s;
      }
    }
    return top;
  }

  private swap(a: number, b: number) {
    [this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]];
    [this.prio[a], this.prio[b]] = [this.prio[b], this.prio[a]];
  }
}

export interface RouteResult {
  /** Cell indices along the path, start → end (empty if unreachable). */
  cells: number[];
  /** Total traversal cost. */
  cost: number;
  /** Geometric length in meters (cells crossed × cell size). */
  length: number;
}

/**
 * A* shortest route between two cells over a {@link CostGrid} (4-connectivity).
 * Start and end cells are always enterable even if hard-blocked, so a route can
 * always leave/arrive at a machine that happens to sit on a costly cell.
 */
export function routeCells(
  grid: CostGrid,
  start: number,
  goal: number
): RouteResult {
  const { cols, rows, cost, cell } = grid;
  const n = cols * rows;
  if (start === goal) return { cells: [start], cost: 0, length: 0 };

  const g = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  g[start] = 0;
  const open = new MinHeap();
  open.push(start, heuristic(start, goal, cols));
  const closed = new Uint8Array(n);

  const enterCost = (idx: number): number => {
    if (idx === start || idx === goal) {
      return Number.isFinite(cost[idx]) ? cost[idx] : 1;
    }
    return cost[idx];
  };

  while (open.size > 0) {
    const cur = open.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;

    const cx = cur % cols;
    const cy = (cur / cols) | 0;
    const neighbors: number[] = [];
    if (cx > 0) neighbors.push(cur - 1);
    if (cx < cols - 1) neighbors.push(cur + 1);
    if (cy > 0) neighbors.push(cur - cols);
    if (cy < rows - 1) neighbors.push(cur + cols);

    for (const nb of neighbors) {
      const c = enterCost(nb);
      if (!Number.isFinite(c)) continue;
      const tentative = g[cur] + c;
      if (tentative < g[nb]) {
        g[nb] = tentative;
        came[nb] = cur;
        open.push(nb, tentative + heuristic(nb, goal, cols));
      }
    }
  }

  if (!Number.isFinite(g[goal])) return { cells: [], cost: Infinity, length: 0 };

  const cells: number[] = [];
  let node = goal;
  while (node !== -1) {
    cells.push(node);
    if (node === start) break;
    node = came[node];
  }
  cells.reverse();
  return { cells, cost: g[goal], length: (cells.length - 1) * cell };
}

function heuristic(a: number, b: number, cols: number): number {
  const ax = a % cols;
  const ay = (a / cols) | 0;
  const bx = b % cols;
  const by = (b / cols) | 0;
  return Math.abs(ax - bx) + Math.abs(ay - by);
}
