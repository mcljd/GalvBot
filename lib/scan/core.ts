import type { Vec2 } from "@/lib/types";
import type { FloorProposal } from "./types";

/**
 * Shared, environment-agnostic floor-extraction heuristic. It operates purely
 * on a downscaled luminance grid, so it can be driven server-side (sharp) or in
 * the browser (canvas). NOT a neural model — a transparent CV pass:
 *   border-background estimate → content bbox (boundary) →
 *   dark connected components (obstacle hints).
 *
 * @param lum   luminance accessor over the downscaled grid (0..255)
 * @param w,h   downscaled grid dimensions
 * @param fullW,fullH original image pixel dimensions (proposal is in this space)
 */
export function extractFloorFromLuminance(
  lum: (x: number, y: number) => number,
  w: number,
  h: number,
  fullW: number,
  fullH: number
): FloorProposal {
  // Background luminance estimated from the image border.
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(lum(x, 0), lum(x, h - 1));
  for (let y = 0; y < h; y++) border.push(lum(0, y), lum(w - 1, y));
  const bg = median(border);

  const contentThresh = 28;
  let minX = w,
    minY = h,
    maxX = 0,
    maxY = 0;
  let contentCount = 0;
  const dark = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = lum(x, y);
      if (Math.abs(v - bg) > contentThresh) {
        contentCount++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      if (bg - v > 70) dark[y * w + x] = 1;
    }
  }

  const sx = fullW / w;
  const sy = fullH / h;

  let boundary: Vec2[];
  let confidence: number;
  if (contentCount > w * h * 0.01 && maxX > minX && maxY > minY) {
    const pad = 1;
    boundary = rectPoly(
      Math.max(0, minX - pad) * sx,
      Math.max(0, minY - pad) * sy,
      Math.min(w, maxX + pad) * sx,
      Math.min(h, maxY + pad) * sy
    );
    const fill = contentCount / ((maxX - minX + 1) * (maxY - minY + 1));
    confidence = Math.max(0.35, Math.min(0.8, fill));
  } else {
    boundary = rectPoly(0, 0, fullW, fullH);
    confidence = 0.2;
  }

  const obstacles = detectObstacles(dark, w, h, sx, sy).map((r) => ({
    polygon: rectPoly(r.x0, r.y0, r.x1, r.y1),
    label: "Detected obstacle",
  }));

  return {
    imageWidth: fullW,
    imageHeight: fullH,
    boundary,
    obstacles,
    confidence: Math.round(confidence * 100) / 100,
    note:
      "Auto-detected by a heuristic edge/region pass — please review and adjust. You must calibrate the real-world scale before continuing.",
  };
}

export function rectPoly(x0: number, y0: number, x1: number, y1: number): Vec2[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

function median(arr: number[]): number {
  if (arr.length === 0) return 128;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

interface CompRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  area: number;
}

/** Flood-fill connected components over the dark mask; return scaled bboxes. */
function detectObstacles(
  dark: Uint8Array,
  w: number,
  h: number,
  sx: number,
  sy: number
): CompRect[] {
  const seen = new Uint8Array(w * h);
  const comps: CompRect[] = [];
  const stack: number[] = [];

  for (let i = 0; i < dark.length; i++) {
    if (!dark[i] || seen[i]) continue;
    stack.length = 0;
    stack.push(i);
    seen[i] = 1;
    let minX = w,
      minY = h,
      maxX = 0,
      maxY = 0,
      count = 0;
    while (stack.length) {
      const idx = stack.pop()!;
      const x = idx % w;
      const y = (idx / w) | 0;
      count++;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      const neighbors = [idx - 1, idx + 1, idx - w, idx + w];
      for (const n of neighbors) {
        if (n < 0 || n >= dark.length || seen[n] || !dark[n]) continue;
        if ((n === idx - 1 && x === 0) || (n === idx + 1 && x === w - 1))
          continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    const bw = maxX - minX;
    const bh = maxY - minY;
    const fill = count / Math.max(1, (bw + 1) * (bh + 1));
    if (
      count > w * h * 0.0015 &&
      count < w * h * 0.2 &&
      bw < w * 0.8 &&
      bh < h * 0.8 &&
      fill > 0.45
    ) {
      comps.push({
        x0: minX * sx,
        y0: minY * sy,
        x1: maxX * sx,
        y1: maxY * sy,
        area: count,
      });
    }
  }

  return comps.sort((a, b) => b.area - a.area).slice(0, 6);
}
