import type { FloorProposal } from "./types";
import { extractFloorFromLuminance } from "./core";

/**
 * Client-side floor extractor used when no server route is available (e.g. the
 * static GitHub Pages demo). Decodes the image into a downscaled canvas and
 * runs the same shared heuristic as the server extractor.
 */
export async function extractFloorInBrowser(file: File): Promise<FloorProposal> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const fullW = img.naturalWidth || 1000;
    const fullH = img.naturalHeight || 1000;

    const targetW = Math.min(256, fullW);
    const scale = targetW / fullW;
    const w = Math.max(1, Math.round(fullW * scale));
    const h = Math.max(1, Math.round(fullH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    // luminance from RGBA
    const lum = (x: number, y: number) => {
      const i = (y * w + x) * 4;
      return Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      );
    };

    return extractFloorFromLuminance(lum, w, h, fullW, fullH);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = src;
  });
}
