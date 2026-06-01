import sharp from "sharp";
import type { FloorExtractor, FloorProposal } from "./types";
import { extractFloorFromLuminance } from "./core";

/**
 * Server-side floor extractor. Uses sharp to produce a downscaled grayscale
 * grid, then runs the shared heuristic in {@link extractFloorFromLuminance}.
 * A stronger CV/ML model can replace this behind the FloorExtractor interface.
 */
export class HeuristicFloorExtractor implements FloorExtractor {
  readonly name = "heuristic-v1";

  async extract(image: Buffer): Promise<FloorProposal> {
    const meta = await sharp(image).metadata();
    const fullW = meta.width ?? 1000;
    const fullH = meta.height ?? 1000;

    const targetW = Math.min(256, fullW);
    const { data, info } = await sharp(image)
      .removeAlpha()
      .grayscale()
      .resize({ width: targetW, fit: "inside" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width: w, height: h, channels: ch } = info;
    const lum = (x: number, y: number) => data[(y * w + x) * ch];

    return extractFloorFromLuminance(lum, w, h, fullW, fullH);
  }
}
