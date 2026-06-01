import type { Vec2, Machine } from "./types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Axis-aligned bounding box of a polygon. */
export function bbox(poly: Vec2[]): Rect {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Effective footprint of a machine after rotation (90/270 swap w and d). */
export function rotatedFootprint(m: Machine): { w: number; d: number } {
  const r = m.rotationDeg ?? 0;
  if (r === 90 || r === 270) return { w: m.footprint.d, d: m.footprint.w };
  return { w: m.footprint.w, d: m.footprint.d };
}

/** Rect occupied by a machine, optionally expanded by its clearance margin. */
export function machineFootprintRect(
  m: Machine,
  pos: Vec2,
  withClearance = false
): Rect {
  const f = rotatedFootprint(m);
  const c = withClearance ? m.clearance : 0;
  return {
    x: pos.x - c,
    y: pos.y - c,
    w: f.w + 2 * c,
    h: f.d + 2 * c,
  };
}

/** Center point of a machine's footprint. */
export function machineCenter(m: Machine, pos?: Vec2): Vec2 | null {
  const p = pos ?? m.pos;
  if (!p) return null;
  const f = rotatedFootprint(m);
  return { x: p.x + f.w / 2, y: p.y + f.d / 2 };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/** Area of overlap between two rects (0 if disjoint). */
export function overlapArea(a: Rect, b: Rect): number {
  const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (dx <= 0 || dy <= 0) return 0;
  return dx * dy;
}

export function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function euclidean(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(pt: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y;
    const xj = poly[j].x,
      yj = poly[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Shoelace polygon area (absolute). */
export function polygonArea(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  }
  return Math.abs(a / 2);
}

/** True if rect is fully inside the (rectangular-ish) boundary bbox. */
export function rectInsideBoundary(r: Rect, boundary: Vec2[]): boolean {
  const b = bbox(boundary);
  return (
    r.x >= b.x &&
    r.y >= b.y &&
    r.x + r.w <= b.x + b.w &&
    r.y + r.h <= b.y + b.h
  );
}

/** Distance between two axis-aligned rects (0 if touching/overlapping). */
export function rectDistance(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  return Math.hypot(dx, dy);
}
