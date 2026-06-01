import type { Vec2 } from "@/lib/types";

/**
 * A proposed floor extracted from an uploaded image. All polygon coordinates
 * are in PIXEL space of the original uploaded image, so the client can overlay
 * them directly and run the (required) scale-calibration step before
 * converting to meters.
 */
export interface FloorProposal {
  imageWidth: number;
  imageHeight: number;
  boundary: Vec2[];
  obstacles: { polygon: Vec2[]; label?: string }[];
  /** 0..1 — a rough self-assessment, surfaced honestly in the UI. */
  confidence: number;
  note: string;
}

/**
 * Pluggable floor-extraction strategy. The MVP ships a deterministic
 * HeuristicFloorExtractor; a stronger CV/ML model or paid API can implement
 * this same interface without touching the UI.
 */
export interface FloorExtractor {
  readonly name: string;
  extract(image: Buffer): Promise<FloorProposal>;
}
