import type { Vec2 } from "@/lib/types";
import type { Rect } from "@/lib/geometry";

export interface SnapBox {
  pos: Vec2;
  w: number;
  d: number;
}

export interface SnapResult {
  pos: Vec2;
  /** World x of the active vertical alignment guide, if any. */
  guideX?: number;
  /** World y of the active horizontal alignment guide, if any. */
  guideY?: number;
}

/**
 * Snap a dragged machine to nearby alignment lines (other machines' left /
 * center / right edges and the floor edges/center), falling back to the grid.
 * Each axis is resolved independently. Returns the snapped top-left position
 * plus any active guide lines for rendering.
 */
export function computeSnap(
  moving: SnapBox,
  others: SnapBox[],
  floor: Rect,
  grid: number,
  threshold = 0.3
): SnapResult {
  const targetsX: number[] = [floor.x, floor.x + floor.w, floor.x + floor.w / 2];
  const targetsY: number[] = [floor.y, floor.y + floor.h, floor.y + floor.h / 2];
  for (const o of others) {
    targetsX.push(o.pos.x, o.pos.x + o.w / 2, o.pos.x + o.w);
    targetsY.push(o.pos.y, o.pos.y + o.d / 2, o.pos.y + o.d);
  }

  const x = snapAxis(moving.pos.x, moving.w, targetsX, grid, threshold);
  const y = snapAxis(moving.pos.y, moving.d, targetsY, grid, threshold);

  return {
    pos: { x: x.value, y: y.value },
    guideX: x.guide,
    guideY: y.guide,
  };
}

function snapAxis(
  start: number,
  size: number,
  targets: number[],
  grid: number,
  threshold: number
): { value: number; guide?: number } {
  // moving edges expressed as offsets from the top-left origin
  const offsets = [0, size / 2, size];
  let best: { value: number; guide: number; dist: number } | null = null;
  for (const off of offsets) {
    const edge = start + off;
    for (const t of targets) {
      const dist = Math.abs(edge - t);
      if (dist <= threshold && (!best || dist < best.dist)) {
        best = { value: t - off, guide: t, dist };
      }
    }
  }
  if (best) return { value: best.value, guide: best.guide };
  return { value: Math.round(start / grid) * grid };
}
