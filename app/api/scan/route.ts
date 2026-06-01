import { NextResponse } from "next/server";
import { HeuristicFloorExtractor } from "@/lib/scan/heuristic";

// sharp needs the Node.js runtime (not Edge).
export const runtime = "nodejs";

const extractor = new HeuristicFloorExtractor();
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No image file provided under field 'image'." },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image too large (max 12 MB)." },
        { status: 413 }
      );
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Uploaded file is not an image." },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const proposal = await extractor.extract(buffer);
    return NextResponse.json({ proposal, extractor: extractor.name });
  } catch (err) {
    console.error("scan extraction failed", err);
    return NextResponse.json(
      { error: "Failed to process the image. Please try a different file." },
      { status: 500 }
    );
  }
}
